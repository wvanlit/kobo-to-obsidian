import type { ChapterRef, EnrichedBook } from "../domain/models";
import { resolveBookTitle } from "./resolve-book-title";

interface RenderAnnotation {
	highlightedText: string;
	noteTexts: string[];
	fragmentStart: string;
	fragmentEnd: string;
}

export function renderSingleBookMarkdown(book: EnrichedBook): string {
	const title = resolveBookTitle({
		metadataTitle: book.metadata.title,
		annotTitle: book.book.titleFromAnnot,
		sourceAnnotPath: book.book.sourceAnnotPath,
	});
	const author = book.metadata.author ?? book.book.authorFromAnnot;
	const lines: string[] = [];

	lines.push("---");
	lines.push(`title: ${escapeYaml(title)}`);
	if (author) {
		lines.push(`author: ${escapeYaml(author)}`);
	}
	if (book.book.bookId) {
		lines.push(`bookId: ${escapeYaml(String(book.book.bookId))}`);
	}
	lines.push(`annotations: ${book.book.annotations.length}`);
	lines.push(`source: ${escapeYaml(book.book.sourceAnnotPath)}`);
	lines.push("---");
	lines.push("");
	lines.push(`# ${title}`);
	lines.push("");

	const grouped = groupByChapter(book);
	for (const [chapter, annotations] of grouped) {
		lines.push(`## ${chapter?.title ?? "Unknown chapter"}`);
		lines.push("");
		for (const annotation of mergeAdjacentAnnotations(annotations)) {
			lines.push(renderHighlightBullet(annotation.highlightedText));
			for (const noteText of annotation.noteTexts) {
				lines.push(`  - Note: ${noteText}`);
			}
		}
		lines.push("");
	}

	return `${lines.join("\n").trimEnd()}\n`;
}

export function renderChapterMarkdown(
	book: EnrichedBook,
	chapter: ChapterRef,
): string {
	const title = resolveBookTitle({
		metadataTitle: book.metadata.title,
		annotTitle: book.book.titleFromAnnot,
		sourceAnnotPath: book.book.sourceAnnotPath,
	});
	const lines: string[] = [];

	lines.push("---");
	lines.push(`book: ${escapeYaml(title)}`);
	lines.push(`chapter: ${escapeYaml(chapter.title)}`);
	lines.push("---");
	lines.push("");
	lines.push(`# ${chapter.title}`);
	lines.push("");

	const chapterAnnotations = book.book.annotations.filter(
		(annotation) =>
			book.chapterByAnnotationId.get(annotation.id)?.id === chapter.id,
	);

	for (const annotation of mergeAdjacentAnnotations(chapterAnnotations)) {
		lines.push(renderHighlightBullet(annotation.highlightedText));
		for (const noteText of annotation.noteTexts) {
			lines.push(`  - Note: ${noteText}`);
		}
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
	if (
		value.includes(":") ||
		value.includes("#") ||
		value.includes('"') ||
		value.includes("[") ||
		value.includes("]")
	) {
		return `"${value.replaceAll('"', '\\"')}"`;
	}

	return value;
}

function mergeAdjacentAnnotations(
	annotations: EnrichedBook["book"]["annotations"],
): RenderAnnotation[] {
	const merged: RenderAnnotation[] = [];

	for (const annotation of annotations) {
		const previous = merged[merged.length - 1];
		if (previous && areAdjacent(previous, annotation)) {
			previous.highlightedText = joinAdjacentText(
				previous.highlightedText,
				annotation.highlightedText,
			);
			previous.fragmentEnd = annotation.fragmentEnd;
			if (annotation.noteText) {
				previous.noteTexts.push(annotation.noteText);
			}
			continue;
		}

		merged.push({
			highlightedText: annotation.highlightedText,
			noteTexts: annotation.noteText ? [annotation.noteText] : [],
			fragmentStart: annotation.fragmentStart,
			fragmentEnd: annotation.fragmentEnd,
		});
	}

	return merged;
}

function areAdjacent(
	previous: RenderAnnotation,
	next: EnrichedBook["book"]["annotations"][number],
): boolean {
	if (
		normalizeFragmentPath(previous.fragmentEnd) !==
		normalizeFragmentPath(next.fragmentStart)
	) {
		return false;
	}

	const previousEnd = parsePointLocation(previous.fragmentEnd);
	const nextStart = parsePointLocation(next.fragmentStart);
	if (!previousEnd || !nextStart) {
		return false;
	}

	if (!pointPathEquals(previousEnd.path, nextStart.path)) {
		return false;
	}

	const gap = nextStart.offset - previousEnd.offset;
	return gap >= 0 && gap <= 8;
}

function normalizeFragmentPath(fragment: string): string {
	const beforeHash = fragment.split("#", 1)[0] ?? "";
	return decodeURIComponent(beforeHash)
		.replaceAll("\\", "/")
		.replace(/^\.\//, "")
		.toLowerCase();
}

function parsePointLocation(
	fragment: string,
): { path: number[]; offset: number } | undefined {
	const match = /#point\(([^)]*)\)/i.exec(fragment);
	if (!match) {
		return undefined;
	}

	const [pathPart, offsetPart] = (match[1] ?? "").split(":", 2);
	const path = (pathPart ?? "")
		.split("/")
		.filter(Boolean)
		.map((segment) => Number(segment))
		.filter((segment) => Number.isFinite(segment));
	const offset = Number(offsetPart);
	if (path.length === 0 || !Number.isFinite(offset)) {
		return undefined;
	}

	return { path, offset };
}

function pointPathEquals(left: number[], right: number[]): boolean {
	if (left.length !== right.length) {
		return false;
	}

	for (let index = 0; index < left.length; index += 1) {
		if (left[index] !== right[index]) {
			return false;
		}
	}

	return true;
}

function joinAdjacentText(current: string, next: string): string {
	const left = current.trimEnd();
	const right = next.trimStart();
	if (!left) {
		return right;
	}
	if (!right) {
		return left;
	}

	if (/[([{"'“‘-]$/.test(left) || /^[,.;:!?)}\]'"”’]/.test(right)) {
		return `${left}${right}`;
	}

	return `${left} ${right}`;
}

function renderHighlightBullet(text: string): string {
	return `- ${text.replaceAll("\n", "\n  ")}`;
}
