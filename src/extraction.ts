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
