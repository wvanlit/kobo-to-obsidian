import { describe, expect, it } from "bun:test";
import {
	renderChapterMarkdown,
	renderSingleBookMarkdown,
} from "../../../src/convert/render-markdown";
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
	asBookId,
	asChapterId,
	asProgressRatio,
} from "../../../src/domain/shared";

describe("render markdown", () => {
	it("renders deterministic single-book markdown", () => {
		const book = createEnrichedBook();
		const markdown = renderSingleBookMarkdown(book);

		expect(markdown).toContain("title: Fixture Book");
		expect(markdown).toContain("bookId: fixture-book-id");
		expect(markdown).toContain("annotations: 2");
		expect(markdown).toContain("# Fixture Book");
		expect(markdown).toContain("## Chapter One");
		expect(markdown).toContain("- Highlight one");
		expect(markdown).toContain("- Note: Note one");
		expect(markdown).not.toContain("Added:");
		expect(markdown).not.toContain("convertedAt:");
		expect(markdown).not.toContain("- > ");
	});

	it("renders chapter markdown", () => {
		const book = createEnrichedBook();
		const chapter = book.metadata.chapters[0];
		if (!chapter) {
			throw new Error("Missing chapter fixture");
		}

		const markdown = renderChapterMarkdown(book, chapter);
		expect(markdown).toContain("# Chapter One");
		expect(markdown).toContain("- Highlight one");
		expect(markdown).not.toContain("Highlight two");
		expect(markdown).not.toContain("Added:");
		expect(markdown).not.toContain("convertedAt:");
		expect(markdown).not.toContain("- > ");
	});

	it("merges adjacent highlights into one quote", () => {
		const book = createEnrichedBookWithAdjacentHighlights();
		const markdown = renderSingleBookMarkdown(book);

		expect(markdown).toContain(
			"- Since fleeting notes can be comprised of any thought, not all fleeting notes will become main notes.",
		);
		expect(markdown).toContain("- Why take notes?");
		expect(markdown.match(/^- /gm)?.length).toBe(2);
	});
});

function createEnrichedBook(): EnrichedBook {
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
		noteText: "Note one",
		progress: asProgressRatio(0.1),
	});
	const annotationTwo = Annotation.create({
		id: asAnnotationId("a-2"),
		createdAt: new Date("2024-01-02T00:00:00Z"),
		highlightedText: "Highlight two",
		fragmentStart: "OEBPS/Text/ch02.xhtml#x",
		fragmentEnd: "OEBPS/Text/ch02.xhtml#y",
	});

	const aggregate = BookAggregate.create({
		sourceAnnotPath: asAnnotFilePath("/tmp/sample.annot"),
		annotations: [annotationOne, annotationTwo],
		bookId: asBookId("fixture-book-id"),
		titleFromAnnot: "Fixture Book",
		authorFromAnnot: "Fixture Author",
	});

	const metadata = BookMetadata.create({
		chapters: [chapterOne, chapterTwo],
		title: "Fixture Book",
		author: "Fixture Author",
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

function createEnrichedBookWithAdjacentHighlights(): EnrichedBook {
	const chapterOne = ChapterRef.create({
		id: asChapterId("chapter-1"),
		title: "Chapter One",
		href: "OEBPS/Text/ch01.xhtml",
		order: 0,
	});

	const a1 = Annotation.create({
		id: asAnnotationId("a-1"),
		createdAt: new Date("2024-01-01T00:00:00Z"),
		highlightedText:
			"Since fleeting notes can be comprised of any thought, not all fleeting",
		fragmentStart: "OEBPS/Text/ch01.xhtml#point(/1/4/2/10/1:0)",
		fragmentEnd: "OEBPS/Text/ch01.xhtml#point(/1/4/2/10/1:72)",
	});
	const a2 = Annotation.create({
		id: asAnnotationId("a-2"),
		createdAt: new Date("2024-01-01T00:00:05Z"),
		highlightedText: "notes will become main notes.",
		fragmentStart: "OEBPS/Text/ch01.xhtml#point(/1/4/2/10/1:73)",
		fragmentEnd: "OEBPS/Text/ch01.xhtml#point(/1/4/2/10/1:103)",
	});
	const a3 = Annotation.create({
		id: asAnnotationId("a-3"),
		createdAt: new Date("2024-01-02T00:00:00Z"),
		highlightedText: "Why take notes?",
		fragmentStart: "OEBPS/Text/ch01.xhtml#point(/1/4/2/12/1:0)",
		fragmentEnd: "OEBPS/Text/ch01.xhtml#point(/1/4/2/12/1:15)",
	});

	const aggregate = BookAggregate.create({
		sourceAnnotPath: asAnnotFilePath("/tmp/sample.annot"),
		annotations: [a1, a2, a3],
		titleFromAnnot: "Fixture Book",
	});

	const metadata = BookMetadata.create({
		chapters: [chapterOne],
		title: "Fixture Book",
	});

	return EnrichedBook.create({
		book: aggregate,
		metadata,
		chapterByAnnotationId: new Map([
			[a1.id, chapterOne],
			[a2.id, chapterOne],
			[a3.id, chapterOne],
		]),
	});
}
