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
	asChapterId,
	asProgressRatio,
} from "../../../src/domain/shared";

describe("render markdown", () => {
	it("renders deterministic single-book markdown", () => {
		const book = createEnrichedBook();
		const markdown = renderSingleBookMarkdown(
			book,
			new Date("2024-01-10T00:00:00Z"),
		);

		expect(markdown).toContain("# Fixture Book");
		expect(markdown).toContain("## Chapter One");
		expect(markdown).toContain("- > Highlight one");
		expect(markdown).toContain("- Note: Note one");
		expect(markdown).toContain("convertedAt: 2024-01-10T00:00:00.000Z");
	});

	it("renders chapter markdown", () => {
		const book = createEnrichedBook();
		const chapter = book.metadata.chapters[0];
		if (!chapter) {
			throw new Error("Missing chapter fixture");
		}

		const markdown = renderChapterMarkdown(
			book,
			chapter,
			new Date("2024-01-10T00:00:00Z"),
		);
		expect(markdown).toContain("# Chapter One");
		expect(markdown).toContain("- > Highlight one");
		expect(markdown).not.toContain("Highlight two");
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
