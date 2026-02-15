import path from "node:path";

import { buildExportPlan } from "../convert/build-export-plan";
import { BookMetadata, ChapterRef, EnrichedBook } from "../domain/models";
import {
	asChapterId,
	type DirectoryPath,
	type FilePath,
	type InputSource,
	type OutputMode,
} from "../domain/shared";
import { locateEpubForAnnot } from "../enrich/locate-epub";
import { mapAnnotationsToChapters } from "../enrich/map-annotations-to-chapters";
import { parseEpubMetadata } from "../enrich/parse-epub";
import { discoverAnnotFiles } from "../ingest/discover-annot-files";
import { parseAnnotFile } from "../ingest/parse-annot";
import { resolveInputSource } from "../ingest/resolve-input-source";
import { writeOutputDocuments } from "../io/write-output";
import type { AiRefactorOptions } from "../refactor/ai-refactor-config";
import { refactorDocumentsWithOpenCode } from "../refactor/refactor-documents-with-opencode";

export interface ConversionOptions {
	input?: InputSource;
	outputDir: DirectoryPath;
	mode: OutputMode;
	interactive: boolean;
	selectAll?: boolean;
	includeBooks?: string[];
	aiRefactor?: AiRefactorOptions;
}

export interface ConversionDependencies {
	refactorDocuments?: typeof refactorDocumentsWithOpenCode;
}

export interface ConversionResult {
	booksProcessed: number;
	filesWritten: FilePath[];
	warnings: string[];
}

export async function runConversion(
	options: ConversionOptions,
	dependencies: ConversionDependencies = {},
): Promise<ConversionResult> {
	const warnings: string[] = [];
	const inputSource =
		options.input ??
		(await resolveInputSource({
			platform: process.platform,
		}));

	const annotFiles = await discoverAnnotFiles(inputSource);
	const books = await Promise.all(
		annotFiles.map((annotPath) => parseAnnotFile(annotPath)),
	);
	const filteredBooks = filterBooks(books, options.includeBooks);
	const selectedBooks = filteredBooks;

	const filesWritten: FilePath[] = [];

	for (const book of selectedBooks) {
		let metadata = BookMetadata.create({
			chapters: deriveFallbackChapters(book.annotations),
			title: book.titleFromAnnot,
			author: book.authorFromAnnot,
		});

		const epubPath = await locateEpubForAnnot(book.sourceAnnotPath, {
			searchRoot:
				inputSource.kind === "directory"
					? inputSource.path
					: inputSource.mountPath,
		});
		if (epubPath) {
			try {
				const epubMetadata = await parseEpubMetadata(epubPath);
				metadata = BookMetadata.create({
					chapters:
						epubMetadata.chapters.length > 0
							? epubMetadata.chapters
							: metadata.chapters,
					title: epubMetadata.title ?? metadata.title,
					author: epubMetadata.author ?? metadata.author,
				});
			} catch (error) {
				warnings.push(
					`Could not parse EPUB for ${book.sourceAnnotPath}: ${String(error)}`,
				);
			}
		}

		const chapterMap = mapAnnotationsToChapters(
			book.annotations,
			metadata.chapters,
		);
		const enrichedBook = EnrichedBook.create({
			book,
			metadata,
			chapterByAnnotationId: chapterMap,
		});

		const docs = buildExportPlan(enrichedBook, options.mode);
		let outputDocs = docs;

		if (options.aiRefactor) {
			const preAiWritten = await writeOutputDocuments(options.outputDir, docs);
			const inputFilePathByRelativePath: Record<string, string> = {};
			for (const [index, document] of docs.entries()) {
				const inputFilePath = preAiWritten[index];
				if (inputFilePath) {
					inputFilePathByRelativePath[document.relativePath] = inputFilePath;
				}
			}

			const refactor =
				dependencies.refactorDocuments ?? refactorDocumentsWithOpenCode;
			const refactorResult = await refactor({
				documents: docs,
				inputFilePathByRelativePath,
				model: options.aiRefactor.model,
				variant: options.aiRefactor.variant,
			});
			outputDocs = refactorResult.documents;
			warnings.push(...refactorResult.warnings);
		}

		const written = await writeOutputDocuments(options.outputDir, outputDocs);
		filesWritten.push(...written);
	}

	return {
		booksProcessed: selectedBooks.length,
		filesWritten,
		warnings,
	};
}

function filterBooks<
	T extends { titleFromAnnot?: string; sourceAnnotPath: string },
>(books: T[], filters: string[] | undefined): T[] {
	if (!filters || filters.length === 0) {
		return books;
	}

	const normalizedFilters = filters.map((filter) => filter.toLowerCase());

	return books.filter((book) => {
		const title = (book.titleFromAnnot ?? "").toLowerCase();
		const fileName = path.basename(book.sourceAnnotPath).toLowerCase();
		const fullPath = book.sourceAnnotPath.toLowerCase();
		return normalizedFilters.some(
			(filter) =>
				title.includes(filter) ||
				fileName.includes(filter) ||
				fullPath.includes(filter),
		);
	});
}

function deriveFallbackChapters(
	annotations: { fragmentStart: string }[],
): ChapterRef[] {
	const chapterPaths = new Map<string, number>();

	for (const annotation of annotations) {
		const fragmentPath = decodeURIComponent(
			annotation.fragmentStart.split("#", 1)[0] ?? "",
		)
			.replaceAll("\\", "/")
			.toLowerCase();
		if (!chapterPaths.has(fragmentPath)) {
			chapterPaths.set(fragmentPath, chapterPaths.size);
		}
	}

	if (chapterPaths.size === 0) {
		return [
			ChapterRef.create({
				id: asChapterId("chapter-1"),
				title: "Unknown chapter",
				href: "unknown",
				order: 0,
			}),
		];
	}

	return [...chapterPaths.entries()].map(([fragmentPath, order]) => {
		const fileName = path.posix.basename(fragmentPath);
		const rawTitle = fileName
			.replace(/\.[^./]+$/, "")
			.replace(/([a-z])([0-9])/gi, "$1 $2")
			.replaceAll(/[-_]+/g, " ")
			.trim();
		const title = rawTitle ? toTitleCase(rawTitle) : `Chapter ${order + 1}`;
		return ChapterRef.create({
			id: asChapterId(`chapter-${order + 1}`),
			title,
			href: fragmentPath,
			order,
		});
	});
}

function capitalize(value: string): string {
	return value.charAt(0).toUpperCase() + value.slice(1);
}

function toTitleCase(value: string): string {
	return value
		.split(/\s+/)
		.filter(Boolean)
		.map((word) => capitalize(word.toLowerCase()))
		.join(" ");
}
