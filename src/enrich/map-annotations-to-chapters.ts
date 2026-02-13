import { type ChapterRef, EnrichedBook } from "../domain/models";
import type { AnnotationId } from "../domain/shared";

interface AnnotationLike {
	id: AnnotationId;
	fragmentStart: string;
}

export function mapAnnotationsToChapters(
	annotations: AnnotationLike[],
	chapters: ChapterRef[],
): Map<AnnotationId, ChapterRef | undefined> {
	const byAnnotation = new Map<AnnotationId, ChapterRef | undefined>();

	for (const annotation of annotations) {
		const normalizedFragmentPath = normalizeFragmentPath(
			annotation.fragmentStart,
		);
		const chapter = chapters.find((candidate) =>
			normalizeChapterPath(candidate.href).endsWith(normalizedFragmentPath),
		);

		byAnnotation.set(annotation.id, chapter);
	}

	return byAnnotation;
}

export function attachChapterMapping(book: {
	book: EnrichedBook["book"];
	metadata: EnrichedBook["metadata"];
}): EnrichedBook {
	const chapterByAnnotationId = mapAnnotationsToChapters(
		book.book.annotations,
		book.metadata.chapters,
	);

	return EnrichedBook.create({
		book: book.book,
		metadata: book.metadata,
		chapterByAnnotationId,
	});
}

function normalizeFragmentPath(fragmentStart: string): string {
	const beforeHash = fragmentStart.split("#", 1)[0];
	const decoded = decodeURIComponent(beforeHash ?? "");
	return decoded.replaceAll("\\", "/").replace(/^\.\//, "").toLowerCase();
}

function normalizeChapterPath(href: string): string {
	const beforeHash = href.split("#", 1)[0];
	return decodeURIComponent(beforeHash ?? "")
		.replaceAll("\\", "/")
		.replace(/^\.\//, "")
		.toLowerCase();
}
