import { describe, expect, it } from "bun:test";

import { buildExportPlan } from "../../../src/convert/build-export-plan";
import {
	Annotation,
	BookAggregate,
	BookMetadata,
	ChapterRef,
	EnrichedBook,
} from "../../../src/domain/models";
import {
	asAnnotationId,
	asAnnotFilePath,
	asChapterId,
} from "../../../src/domain/shared";

describe("buildExportPlan", () => {
	it("builds one document in single mode", () => {
		const book = fixtureBook();
		const docs = buildExportPlan(book, "single");

		expect(docs).toHaveLength(1);
		expect(String(docs[0]?.relativePath)).toBe("Fixture Book.md");
	});

	it("builds chapter documents in by-chapter mode", () => {
		const book = fixtureBook();
		const docs = buildExportPlan(book, "by-chapter");

		expect(docs).toHaveLength(2);
		expect(String(docs[0]?.relativePath)).toBe(
			"Fixture Book/01 - Chapter One.md",
		);
		expect(String(docs[1]?.relativePath)).toBe(
			"Fixture Book/02 - Chapter Two.md",
		);
	});

	it("derives file name from annot path when title is missing", () => {
		const book = fixtureBook({
			titleFromAnnot: undefined,
			metadataTitle: undefined,
			sourceAnnotPath:
				"/tmp/A System for Writing_ How an Unconventional Approach.epub.annot",
		});

		const docs = buildExportPlan(book, "single");
		expect(String(docs[0]?.relativePath)).toBe("A System for Writing.md");
	});
});

function fixtureBook(options?: {
	titleFromAnnot?: string;
	metadataTitle?: string;
	sourceAnnotPath?: string;
}): EnrichedBook {
	const chapterOne = ChapterRef.create({
		id: asChapterId("chapter-1"),
		title: "Chapter One",
		href: "OEBPS/Text/ch01.xhtml",
		order: 0,
	});
	const chapterTwo = ChapterRef.create({
		id: asChapterId("chapter-2"),
		title: "Chapter Two",
		href: "OEBPS/Text/ch02.xhtml",
		order: 1,
	});

	const annotationOne = Annotation.create({
		id: asAnnotationId("a-1"),
		createdAt: new Date("2024-01-01T00:00:00Z"),
		highlightedText: "Highlight one",
		fragmentStart: "OEBPS/Text/ch01.xhtml#x",
		fragmentEnd: "OEBPS/Text/ch01.xhtml#y",
	});
	const annotationTwo = Annotation.create({
		id: asAnnotationId("a-2"),
		createdAt: new Date("2024-01-02T00:00:00Z"),
		highlightedText: "Highlight two",
		fragmentStart: "OEBPS/Text/ch02.xhtml#x",
		fragmentEnd: "OEBPS/Text/ch02.xhtml#y",
	});

	const aggregate = BookAggregate.create({
		sourceAnnotPath: asAnnotFilePath(
			options?.sourceAnnotPath ?? "/tmp/sample.annot",
		),
		annotations: [annotationOne, annotationTwo],
		titleFromAnnot:
			options && "titleFromAnnot" in options
				? options.titleFromAnnot
				: "Fixture Book",
	});

	const metadata = BookMetadata.create({
		chapters: [chapterOne, chapterTwo],
		title:
			options && "metadataTitle" in options
				? options.metadataTitle
				: "Fixture Book",
	});

	return EnrichedBook.create({
		book: aggregate,
		metadata,
		chapterByAnnotationId: new Map([
			[annotationOne.id, chapterOne],
			[annotationTwo.id, chapterTwo],
		]),
	});
}
