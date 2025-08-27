/**
 * Contains all the code for extracting data from Kobo
 */
import * as fs from "fs";
import * as path from "path";
import JSZip from "jszip";
import { DOMParser } from "xmldom";
import xpath from "xpath";

export type KoboDrivePath = string & { readonly KoboDrivePath: unique symbol };
export type EpubFilePath = string & { readonly EpubFilePath: unique symbol };
export type AnnotationFilePath = string & {
  readonly AnnotationFilePath: unique symbol;
};

export type EpubTableOfContents = {
  chapter: string;
  source: string;
}[];

export type Publication = {
  title: string;
  creator: string;
};

export type Annotation = {
  start: string;
  text: string;
  color: HighlightColor;
};

export enum HighlightColor {
  Yellow = "0",
  Blue = "1",
  Red = "2",
  Green = "3",
  Pink = "4",
}

export function findAllAnnotationFiles(
  koboDrivePath: KoboDrivePath
): AnnotationFilePath[] {
  const annotationsPath = path.join(
    koboDrivePath,
    "Digital Editions",
    "Annotations",
    "Books"
  );

  if (!fs.existsSync(annotationsPath)) {
    return [];
  }

  const annotationFiles: AnnotationFilePath[] = [];

  function findAnnotFiles(dir: string) {
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        findAnnotFiles(fullPath);
      } else if (item.endsWith(".annot")) {
        annotationFiles.push(fullPath as AnnotationFilePath);
      }
    }
  }

  findAnnotFiles(annotationsPath);
  return annotationFiles;
}

export function findMatchingEpubFile(
  koboDrivePath: KoboDrivePath,
  annotationFilePath: AnnotationFilePath
): EpubFilePath | null {
  // Convert annotation path to epub path
  // e.g., Digital Editions/Annotations/Books/Programming/book.epub.annot -> Books/Programming/book.epub
  const annotationsBasePath = path.join(
    koboDrivePath,
    "Digital Editions",
    "Annotations",
    "Books"
  );
  const booksBasePath = path.join(koboDrivePath, "Books");

  // Get relative path from annotations base
  const relativePath = path.relative(annotationsBasePath, annotationFilePath);

  // Remove .annot extension to get the epub filename
  const epubFileName = relativePath.replace(/\.annot$/, "");

  // Construct the full epub path
  const epubPath = path.join(booksBasePath, epubFileName);

  if (fs.existsSync(epubPath)) {
    return epubPath as EpubFilePath;
  }

  return null;
}

// Helper function for working with standalone files (not in Kobo directory structure)
export function findMatchingEpubFileStandalone(
  annotationFilePath: AnnotationFilePath
): EpubFilePath | null {
  // For standalone files, assume the epub file is in the same directory
  // and has the same name but without .annot extension
  const epubPath = annotationFilePath.replace(/\.annot$/, "");

  if (fs.existsSync(epubPath)) {
    return epubPath as EpubFilePath;
  }

  return null;
}

export async function extractTableOfContents(
  epubFilePath: EpubFilePath
): Promise<EpubTableOfContents> {
  try {
    const epubData = fs.readFileSync(epubFilePath);
    const zip = await JSZip.loadAsync(epubData);

    // Find the content.opf file (contains metadata and spine)
    const containerFile = zip.file("META-INF/container.xml");
    if (!containerFile) {
      throw new Error("No container.xml found in EPUB");
    }

    const containerXml = await containerFile.async("text");
    const containerDoc = new DOMParser().parseFromString(
      containerXml,
      "text/xml"
    );

    // Use local-name to ignore namespaces
    const rootfiles = xpath.select(
      "//*[local-name()='rootfile']/@full-path",
      containerDoc
    ) as any[];

    if (!rootfiles || rootfiles.length === 0) {
      throw new Error("No content.opf file found");
    }

    const opfPath = rootfiles[0].value;
    const opfFile = zip.file(opfPath);
    if (!opfFile) {
      throw new Error("content.opf file not found");
    }

    const opfXml = await opfFile.async("text");
    const opfDoc = new DOMParser().parseFromString(opfXml, "text/xml");

    // Try to find toc.ncx file first
    let tocFile: JSZip.JSZipObject | null = null;
    const tocNcxPath = path.posix.join(path.posix.dirname(opfPath), "toc.ncx");
    tocFile = zip.file(tocNcxPath);

    if (!tocFile) {
      // Find the toc.ncx file using manifest
      const tocItems = xpath.select(
        "//*[local-name()='item']",
        opfDoc
      ) as any[];

      for (const item of tocItems) {
        const href = item.getAttribute("href");
        const mediaType = item.getAttribute("media-type");
        if (
          href &&
          (href.includes("toc") ||
            href.includes("nav") ||
            mediaType === "application/x-dtbncx+xml")
        ) {
          const tocPath = path.posix.join(path.posix.dirname(opfPath), href);
          tocFile = zip.file(tocPath);
          if (tocFile) break;
        }
      }
    }

    if (!tocFile) {
      // Fallback: try to find any .ncx file
      const ncxFiles = Object.keys(zip.files).filter((name) =>
        name.endsWith(".ncx")
      );
      if (ncxFiles.length > 0 && ncxFiles[0]) {
        tocFile = zip.file(ncxFiles[0]);
      }
    }

    if (!tocFile) {
      // Return empty TOC if no navigation file found
      return [];
    }

    const tocXml = await tocFile.async("text");
    const tocDoc = new DOMParser().parseFromString(tocXml, "text/xml");

    // Extract chapter titles from NCX file using local-name
    const navPoints = xpath.select(
      "//*[local-name()='navPoint']",
      tocDoc
    ) as any[];
    const chapters: EpubTableOfContents = [];

    for (const navPoint of navPoints) {
      const navLabels = xpath.select(
        ".//*[local-name()='navLabel']/*[local-name()='text']/text()",
        navPoint
      ) as any[];

      // Extract the source file from the content element
      const contentNodes = xpath.select(
        ".//*[local-name()='content']",
        navPoint
      ) as any[];

      if (navLabels.length > 0) {
        const chapterTitle = navLabels[0].textContent?.trim();
        const source =
          contentNodes.length > 0
            ? contentNodes[0].getAttribute("src") || ""
            : "";

        if (chapterTitle) {
          chapters.push({
            chapter: chapterTitle,
            source: source,
          });
        }
      }
    }

    return chapters;
  } catch (error) {
    console.error("Error extracting table of contents:", error);
    return [];
  }
}

export function extractPublication(
  annotationFilePath: AnnotationFilePath
): Publication {
  try {
    const annotationXml = fs.readFileSync(annotationFilePath, "utf-8");
    const doc = new DOMParser().parseFromString(annotationXml, "text/xml");

    // Use simpler xpath expressions that don't require namespace context
    const titleNodes = xpath.select(
      "//*[local-name()='title']/text()",
      doc
    ) as any[];
    const creatorNodes = xpath.select(
      "//*[local-name()='creator']/text()",
      doc
    ) as any[];

    return {
      title:
        titleNodes.length > 0
          ? titleNodes[0].textContent?.trim() || "Unknown Title"
          : "Unknown Title",
      creator:
        creatorNodes.length > 0
          ? creatorNodes[0].textContent?.trim() || "Unknown Creator"
          : "Unknown Creator",
    };
  } catch (error) {
    console.error("Error extracting publication info:", error);
    return { title: "Unknown Title", creator: "Unknown Creator" };
  }
}

export function extractAnnotations(
  annotationFilePath: AnnotationFilePath
): Annotation[] {
  try {
    const annotationXml = fs.readFileSync(annotationFilePath, "utf-8");
    const doc = new DOMParser().parseFromString(annotationXml, "text/xml");

    // Find all annotation elements using local-name to ignore namespaces
    const annotationNodes = xpath.select(
      "//*[local-name()='annotation']",
      doc
    ) as any[];

    const annotations: Annotation[] = [];

    for (const annotationNode of annotationNodes) {
      // Extract the fragment element
      const fragmentNodes = xpath.select(
        ".//*[local-name()='fragment']",
        annotationNode
      ) as any[];
      if (fragmentNodes.length === 0) continue;

      const fragment = fragmentNodes[0];
      const start = fragment.getAttribute("start") || "";
      const color = fragment.getAttribute("color") || "0";

      // Extract the text content
      const textNodes = xpath.select(
        ".//*[local-name()='text']/text()",
        annotationNode
      ) as any[];
      const text =
        textNodes.length > 0 ? textNodes[0].textContent?.trim() || "" : "";

      if (text) {
        annotations.push({
          start,
          text,
          color: color as HighlightColor,
        });
      }
    }

    return annotations;
  } catch (error) {
    console.error("Error extracting annotations:", error);
    return [];
  }
}

// Helpers for grouping annotations by actual chapter (document file)
function normalizeHrefToDocPath(href: string): string {
  // Remove fragment and normalize to posix path
  const noFragment = (href ?? "").split("#")[0] ?? "";
  const posixPath = noFragment.replace(/\\/g, "/");
  // Remove leading './' or '/'
  const cleaned = posixPath.replace(/^\.?\/?/, "");
  // Normalize any redundant segments
  return path.posix.normalize(cleaned);
}

function docPathFromAnnotationStart(start: string): string {
  return normalizeHrefToDocPath(start);
}

export type ChapterGroupedAnnotations = {
  chapter: string; // resolved chapter title (top-level when subchapters exist)
  source: string; // normalized document path used for grouping (e.g., OEBPS/chap03.xhtml or chap03.xhtml)
  annotations: Annotation[];
};

/**
 * Group annotations by their actual chapter (document file), collapsing subchapters.
 * - Matches each annotation's source document to the first TOC entry that references that document.
 * - Preserves TOC order for resulting groups; unmatched docs are appended in encounter order.
 */
export function groupAnnotationsByChapter(
  annotations: Annotation[],
  toc: EpubTableOfContents
): ChapterGroupedAnnotations[] {
  // Prepare TOC entries normalized (remove fragments, normalize to posix)
  const tocEntries = toc.map((t, idx) => {
    const docPath = normalizeHrefToDocPath(t.source);
    return { index: idx, docPath, chapter: t.chapter };
  });

  // Build a quick lookup for the first occurrence of a docPath in the TOC (top-level over subchapters)
  const firstDocPathToToc = new Map<
    string,
    { index: number; chapter: string }
  >();
  for (const entry of tocEntries) {
    if (!entry.docPath) continue;
    // Keep the first occurrence only (likely top-level navPoint precedes children)
    if (!firstDocPathToToc.has(entry.docPath)) {
      firstDocPathToToc.set(entry.docPath, {
        index: entry.index,
        chapter: entry.chapter,
      });
    }
  }

  // Also allow basename-only matches as a fallback (helps when annotation path has extra prefix like 'OEBPS/')
  const basenameToToc = new Map<
    string,
    { index: number; chapter: string; docPath: string }
  >();
  for (const entry of tocEntries) {
    const base = path.posix.basename(entry.docPath);
    if (!basenameToToc.has(base)) {
      basenameToToc.set(base, {
        index: entry.index,
        chapter: entry.chapter,
        docPath: entry.docPath,
      });
    }
  }

  type Group = {
    key: string; // chosen normalized docPath key (prefer TOC docPath)
    chapter: string;
    source: string;
    annotations: Annotation[];
    order: number; // TOC order or large + encounter order for unmatched
  };

  const groups = new Map<string, Group>();
  let unmatchedCounter = 0;

  function addToGroup(
    key: string,
    chapter: string,
    source: string,
    order: number,
    ann: Annotation
  ) {
    let g = groups.get(key);
    if (!g) {
      g = { key, chapter, source, annotations: [], order };
      groups.set(key, g);
    }
    g.annotations.push(ann);
  }

  for (const ann of annotations) {
    const annDocPath = docPathFromAnnotationStart(ann.start);

    // Exact TOC docPath match
    let matchedKey: string | null = null;
    let matched = null as { index: number; chapter: string } | null;

    if (firstDocPathToToc.has(annDocPath)) {
      matched = firstDocPathToToc.get(annDocPath)!;
      matchedKey = annDocPath;
    } else {
      // endsWith match (annotation path may include extra folder prefix)
      for (const [docPath, info] of firstDocPathToToc.entries()) {
        if (annDocPath.endsWith("/" + docPath) || annDocPath === docPath) {
          matched = info;
          matchedKey = docPath; // prefer canonical TOC docPath as the key
          break;
        }
      }

      // basename fallback
      if (!matched) {
        const base = path.posix.basename(annDocPath);
        const baseHit = basenameToToc.get(base);
        if (baseHit) {
          matched = { index: baseHit.index, chapter: baseHit.chapter };
          matchedKey = baseHit.docPath;
        }
      }
    }

    if (matched && matchedKey) {
      addToGroup(matchedKey, matched.chapter, matchedKey, matched.index, ann);
    } else {
      // Unmatched: group by the annotation document itself, append after TOC-ordered groups
      const fallbackKey = annDocPath;
      const fallbackChapter =
        path.posix.basename(annDocPath) || "Unknown Chapter";
      const order = Number.MAX_SAFE_INTEGER / 2 + unmatchedCounter++;
      addToGroup(fallbackKey, fallbackChapter, annDocPath, order, ann);
    }
  }

  // Return groups sorted by order (TOC order first), and stable within same order by key
  return Array.from(groups.values())
    .sort((a, b) =>
      a.order === b.order ? a.key.localeCompare(b.key) : a.order - b.order
    )
    .map((g) => ({
      chapter: g.chapter,
      source: g.source,
      annotations: g.annotations,
    }));
}
