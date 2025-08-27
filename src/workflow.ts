/**
 * Contains all the code for orchestrating the KTM workflow
 */
import {
  extractAnnotations,
  extractPublication,
  extractTableOfContents,
  findMatchingEpubFile,
  groupAnnotationsByChapter,
  type AnnotationFilePath,
  type KoboDrivePath,
  type ChapterGroupedAnnotations,
} from "./extraction";
import { processChapterNotesWithLLM, type ProcessedNotes } from "./llm";

export async function extractAnnotationData(
  annotationFilePath: AnnotationFilePath,
  koboDrivePath: KoboDrivePath
) {
  const epubFilePath = findMatchingEpubFile(koboDrivePath, annotationFilePath);
  if (!epubFilePath) {
    return new Error(
      `No matching EPUB file found for annotation file: ${annotationFilePath}`
    );
  }

  const toc = await extractTableOfContents(epubFilePath);
  const publication = extractPublication(annotationFilePath);
  const annotations = extractAnnotations(annotationFilePath);

  return {
    toc,
    publication,
    annotations,
  };
}

function splitAuthors(creator: string): string[] {
  const c = creator?.trim() ?? "";
  if (!c) return ["Unknown Author"];
  // Prefer splitting on common multi-author delimiters, avoid splitting on comma in "Last, First"
  const delimiters = [" and ", " & ", ";", " | ", " / "];
  for (const d of delimiters) {
    if (c.includes(d)) {
      return c
        .split(d)
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  // If obvious comma-separated authors (more than one comma), split; otherwise keep as single
  const commaParts = c
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (commaParts.length > 2) {
    return commaParts;
  }
  return [c];
}

export async function processAnnotationsWithLLM(
  annotationFilePath: AnnotationFilePath,
  koboDrivePath: KoboDrivePath
): Promise<ProcessedNotes | Error> {
  try {
    const extractedData = await extractAnnotationData(
      annotationFilePath,
      koboDrivePath
    );

    if (extractedData instanceof Error) {
      return extractedData;
    }

    const { toc, publication, annotations } = extractedData;

    if (annotations.length === 0) {
      return new Error(`No annotations found in file: ${annotationFilePath}`);
    }

    // Group annotations by actual chapter, respecting TOC order and collapsing subchapters
    const groups = groupAnnotationsByChapter(annotations, toc).filter(
      (g) => g.annotations.length > 0
    );

    if (groups.length === 0) {
      return new Error("No chapter groups found for annotations");
    }

    const sections: string[] = [];
    for (const g of groups) {
      try {
        const section = await processChapterNotesWithLLM(
          publication,
          g.chapter,
          g.annotations
        );
        sections.push(section.trim());
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        sections.push(
          `## ${g.chapter}\n\n- [Error generating notes for this chapter: ${msg}]`
        );
      }
    }

    const authors = splitAuthors(publication.creator);
    const frontmatter = [
      "---",
      "tags:",
      "  - book",
      "author:",
      ...authors.map((a) => `  - ${a}`),
      "---",
      "",
    ].join("\n");

    const notes = [frontmatter, ...sections].join("\n\n");

    return { notes };
  } catch (error) {
    if (error instanceof Error) {
      return new Error(`Failed to process annotations: ${error.message}`);
    }
    return new Error("An unknown error occurred while processing annotations");
  }
}
