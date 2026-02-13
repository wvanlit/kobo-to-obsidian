import type { ChapterRef, EnrichedBook } from "../domain/models";

export function renderSingleBookMarkdown(
	book: EnrichedBook,
	convertedAt = new Date(),
): string {
	const title =
		book.metadata.title ?? book.book.titleFromAnnot ?? "Untitled Book";
	const author = book.metadata.author ?? book.book.authorFromAnnot;
	const lines: string[] = [];

	lines.push("---");
	lines.push(`source: ${book.book.sourceAnnotPath}`);
	lines.push(`convertedAt: ${convertedAt.toISOString()}`);
	if (author) {
		lines.push(`author: ${escapeYaml(author)}`);
	}
	lines.push("---");
	lines.push("");
	lines.push(`# ${title}`);
	lines.push("");

	const grouped = groupByChapter(book);
	for (const [chapter, annotations] of grouped) {
		lines.push(`## ${chapter?.title ?? "Unknown chapter"}`);
		lines.push("");
		for (const annotation of annotations) {
			lines.push(
				`- > ${annotation.highlightedText.replaceAll("\n", "\n  > ")}`,
			);
			if (annotation.noteText) {
				lines.push(`  - Note: ${annotation.noteText}`);
			}
			lines.push(`  - Added: ${annotation.createdAt.toISOString()}`);
		}
		lines.push("");
	}

	return `${lines.join("\n").trimEnd()}\n`;
}

export function renderChapterMarkdown(
	book: EnrichedBook,
	chapter: ChapterRef,
	convertedAt = new Date(),
): string {
	const title =
		book.metadata.title ?? book.book.titleFromAnnot ?? "Untitled Book";
	const lines: string[] = [];

	lines.push("---");
	lines.push(`book: ${escapeYaml(title)}`);
	lines.push(`chapter: ${escapeYaml(chapter.title)}`);
	lines.push(`convertedAt: ${convertedAt.toISOString()}`);
	lines.push("---");
	lines.push("");
	lines.push(`# ${chapter.title}`);
	lines.push("");

	const chapterAnnotations = book.book.annotations.filter(
		(annotation) =>
			book.chapterByAnnotationId.get(annotation.id)?.id === chapter.id,
	);

	for (const annotation of chapterAnnotations) {
		lines.push(`- > ${annotation.highlightedText.replaceAll("\n", "\n  > ")}`);
		if (annotation.noteText) {
			lines.push(`  - Note: ${annotation.noteText}`);
		}
		lines.push(`  - Added: ${annotation.createdAt.toISOString()}`);
	}

	if (chapterAnnotations.length === 0) {
		lines.push("_No highlights mapped to this chapter._");
	}

	lines.push("");
	return lines.join("\n");
}

function groupByChapter(
	book: EnrichedBook,
): Map<ChapterRef | undefined, typeof book.book.annotations> {
	const grouped = new Map<
		ChapterRef | undefined,
		typeof book.book.annotations
	>();

	for (const annotation of book.book.annotations) {
		const chapter = book.chapterByAnnotationId.get(annotation.id);
		const current = grouped.get(chapter) ?? [];
		grouped.set(chapter, [...current, annotation]);
	}

	return grouped;
}

function escapeYaml(value: string): string {
	if (value.includes(":") || value.includes("#") || value.includes('"')) {
		return `"${value.replaceAll('"', '\\"')}"`;
	}

	return value;
}
