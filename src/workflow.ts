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

export function extractAnnotationData(
  annotationFilePath: AnnotationFilePath,
  koboDrivePath: KoboDrivePath
) {
  const epubFilePath = findMatchingEpubFile(koboDrivePath, annotationFilePath);
  if (!epubFilePath) {
    return new Error(
      `No matching EPUB file found for annotation file: ${annotationFilePath}`
    );
  }

  const toc = extractTableOfContents(epubFilePath);
  const publication = extractPublication(annotationFilePath);
  const annotations = extractAnnotations(annotationFilePath);

  return {
    toc,
    publication,
    annotations,
  };
}
