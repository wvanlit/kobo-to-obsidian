import path from "node:path";

import type { EnrichedBook } from "../domain/models";
import { asFilePath, type FilePath, type OutputMode } from "../domain/shared";
import { sanitizePathSegment } from "../io/sanitize-path";
import {
	renderChapterMarkdown,
	renderSingleBookMarkdown,
} from "./render-markdown";

export interface OutputDocument {
	relativePath: FilePath;
	markdown: string;
}

export function buildExportPlan(
	book: EnrichedBook,
	mode: OutputMode,
): OutputDocument[] {
	const bookTitle = sanitizePathSegment(
		book.metadata.title ?? book.book.titleFromAnnot ?? "Untitled Book",
	);

	if (mode === "single") {
		return [
			{
				relativePath: asFilePath(`${bookTitle}.md`),
				markdown: renderSingleBookMarkdown(book),
			},
		];
	}

	const docs: OutputDocument[] = [];
	for (const chapter of book.metadata.chapters) {
		const chapterTitle = sanitizePathSegment(
			chapter.title || `Chapter ${chapter.order + 1}`,
		);
		const chapterPrefix = String(chapter.order + 1).padStart(2, "0");
		docs.push({
			relativePath: asFilePath(
				path.posix.join(bookTitle, `${chapterPrefix} - ${chapterTitle}.md`),
			),
			markdown: renderChapterMarkdown(book, chapter),
		});
	}

	const unmappedCount = book.book.annotations.filter(
		(annotation) => book.chapterByAnnotationId.get(annotation.id) === undefined,
	).length;

	if (unmappedCount > 0) {
		docs.push({
			relativePath: asFilePath(
				path.posix.join(bookTitle, "99 - Unknown chapter.md"),
			),
			markdown: renderSingleBookMarkdown({
				...book,
				book: {
					...book.book,
					annotations: book.book.annotations.filter(
						(annotation) =>
							book.chapterByAnnotationId.get(annotation.id) === undefined,
					),
				},
			}),
		});
	}

	return docs;
}
