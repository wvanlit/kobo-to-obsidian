/**
 * Contains all the code for orchestrating the KTM workflow
 */
import {
  extractAnnotations,
  extractPublication,
  extractTableOfContents,
  findMatchingEpubFile,
  type AnnotationFilePath,
  type KoboDrivePath,
} from "./extraction";
import { processNotesWithLLM, type ProcessedNotes } from "./llm";

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

    const processedNotes = await processNotesWithLLM(
      publication,
      toc,
      annotations
    );
    return processedNotes;
  } catch (error) {
    if (error instanceof Error) {
      return new Error(`Failed to process annotations: ${error.message}`);
    }
    return new Error("An unknown error occurred while processing annotations");
  }
}
