/**
 * Contains all the code for orchestrating the KTM workflow
 */
import {
  extractAnnotations,
  extractPublication,
  extractTableOfContents,
  type AnnotationFilePath,
  type KoboDrivePath,
} from "./extraction";

export function extractAnnotationData(
  annotationFilePath: AnnotationFilePath,
  koboDrivePath: KoboDrivePath
) {
  const toc = extractTableOfContents(annotationFilePath);
  const publication = extractPublication(annotationFilePath);
  const annotations = extractAnnotations(annotationFilePath);

  return {
    toc,
    publication,
    annotations,
  };
}
