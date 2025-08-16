import {
  findAllAnnotationFiles,
  findMatchingEpubFile,
  type KoboDrivePath,
} from "../src/extraction";

const drive = "/media/wessel/KOBOeReader/" as KoboDrivePath;
const annotFiles = findAllAnnotationFiles(drive);

console.log(
  `Found ${annotFiles.length} annotation files in Kobo drive: ${drive}`
);

const epubWithAnnotations = annotFiles.map((file) => {
  const epub = findMatchingEpubFile(drive, file);
  return {
    annotationFile: file,
    epubFile: epub,
  };
});

epubWithAnnotations.forEach(({ annotationFile, epubFile }) => {
  const readablePath = annotationFile
    .replace(drive, "")
    .replace("Digital Editions/Annotations/Books/", "")
    .replace(/\.epub\.annot$/, "");

  const hasEpub = epubFile ? "Yes" : "No";

  console.log(`${readablePath} | Has EPUB: ${hasEpub}`);
});
