#!/usr/bin/env bun

import {
  extractPublication,
  extractAnnotations,
  extractTableOfContents,
  findMatchingEpubFileStandalone,
  type AnnotationFilePath,
  type EpubFilePath,
  HighlightColor,
} from "../src/extraction.ts";

const FundamentalsEpub =
  "examples/Mark Richards, Neal Ford - Fundamentals of Software Architecture-O'Reilly Media, Inc. (2025).epub";
const EventStormingEpub = "examples/introducing_eventstorming.epub";

async function testExtractionFunctions() {
  console.log("🔍 Testing Kobo to Obsidian Extraction Functions\n");
  const epubFile = FundamentalsEpub as EpubFilePath;
  const annotationFile = `${epubFile}.annot` as AnnotationFilePath;

  // Test 1: Publication extraction
  console.log("📖 Testing publication extraction...");
  const publication = extractPublication(annotationFile);
  console.log(`   Title: "${publication.title}"`);
  console.log(`   Creator: "${publication.creator}"`);

  // Test 2: Annotations extraction
  console.log("\n📝 Testing annotations extraction...");
  const annotations = extractAnnotations(annotationFile);
  console.log(`   Found ${annotations.length} annotations`);

  if (annotations.length > 0) {
    console.log("\n   Sample annotations:");
    annotations.slice(0, 3).forEach((annotation, index) => {
      console.log(`   ${index + 1}. ${annotation.text.substring(0, 100)}...`);
      console.log(`      Start: ${annotation.start}`);
      console.log(
        `      Color: ${annotation.color} (${getColorName(annotation.color)})`
      );
      console.log("");
    });
  }

  // Test 3: Table of contents extraction
  console.log("\n📚 Testing table of contents extraction...");
  const toc = await extractTableOfContents(epubFile);
  console.log(`   Found ${toc.length} chapters/sections`);

  if (toc.length > 0) {
    console.log("\n   Table of Contents:");
    toc.slice(0, 10).forEach((entry, index) => {
      console.log(`   ${index + 1}. ${entry.chapter} @ ${entry.source}`);
    });
    if (toc.length > 10) {
      console.log(`   ... and ${toc.length - 10} more chapters`);
    }
  }

  // Test 4: File matching (standalone)
  console.log("\n🔗 Testing file matching...");
  const matchingEpub = findMatchingEpubFileStandalone(annotationFile);
  console.log(`   Matching EPUB: ${matchingEpub ? "Found" : "Not found"}`);
  if (matchingEpub) {
    console.log(`   Path: ${matchingEpub}`);
  }

  console.log("\n✅ All tests completed successfully!");
}

function getColorName(color: HighlightColor): string {
  switch (color) {
    case HighlightColor.Yellow:
      return "Yellow";
    case HighlightColor.Blue:
      return "Blue";
    case HighlightColor.Red:
      return "Red";
    case HighlightColor.Green:
      return "Green";
    case HighlightColor.Pink:
      return "Pink";
    default:
      return "Unknown";
  }
}

testExtractionFunctions().catch(console.error);
