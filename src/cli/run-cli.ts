import * as clack from "@clack/prompts";
import { runConversion } from "../app/run-conversion";
import { discoverAnnotFiles } from "../ingest/discover-annot-files";
import { parseAnnotFile } from "../ingest/parse-annot";
import { resolveInputSource } from "../ingest/resolve-input-source";
import type { CliRequest } from "./command-spec";
import { parseCli } from "./parse-cli";
import {
	confirmPreflight,
	displayConversionSummary,
	error,
	info,
	selectBooks,
	type UiContext,
	withTask,
} from "./ui";

export async function runCli(argv: string[]): Promise<void> {
	let request: CliRequest;

	try {
		request = parseCli(argv);
	} catch (err) {
		error(String(err));
		process.exitCode = 1;
		return;
	}

	const context: UiContext = {
		noColor: request.command === "convert" ? request.noColor : request.noColor,
		verbose: request.command === "convert" ? request.verbose : request.verbose,
	};

	try {
		if (request.command === "list-books") {
			await handleListBooks(request, context);
		} else {
			await handleConvert(request, context);
		}
	} catch (err) {
		error(String(err), context);
		process.exitCode = 1;
	}
}

async function handleListBooks(
	request: Extract<CliRequest, { command: "list-books" }>,
	context: UiContext,
): Promise<void> {
	clack.intro("List Books");

	const inputSource = await withTask(
		"Resolving input source",
		async () =>
			await resolveInputSource({
				explicitInputDir: request.input,
				platform: process.platform,
			}),
		context,
	);

	info(
		`Input source: ${inputSource.kind === "directory" ? inputSource.path : inputSource.mountPath}`,
		context,
	);

	const annotFiles = await withTask(
		"Discovering annotation files",
		async () => await discoverAnnotFiles(inputSource),
		context,
	);

	const books = await withTask(
		"Parsing books",
		async () =>
			await Promise.all(annotFiles.map((path) => parseAnnotFile(path))),
		context,
	);

	clack.outro(`Found ${books.length} books:`);

	for (const [index, book] of books.entries()) {
		const title = book.titleFromAnnot ?? "Unknown";
		const author = book.authorFromAnnot ?? "Unknown";
		const path = book.sourceAnnotPath;

		if (context.verbose) {
			console.log(`${index + 1}. ${title} by ${author}`);
			console.log(`   Path: ${path}`);
			console.log(`   Annotations: ${book.annotations.length}`);
		} else {
			console.log(`${index + 1}. ${title} by ${author}`);
		}
	}
}

async function handleConvert(
	request: Extract<CliRequest, { command: "convert" }>,
	context: UiContext,
): Promise<void> {
	clack.intro("Kobo to Obsidian Converter");

	const inputSource = await withTask(
		"Resolving input source",
		async () =>
			await resolveInputSource({
				explicitInputDir: request.input,
				platform: process.platform,
			}),
		context,
	);

	info(
		`Input source: ${inputSource.kind === "directory" ? inputSource.path : inputSource.mountPath}`,
		context,
	);

	let includeBooks = request.bookFilters;

	if (request.interactive && !request.selectAll && includeBooks.length === 0) {
		const annotFiles = await withTask(
			"Discovering books",
			async () => await discoverAnnotFiles(inputSource),
			context,
		);

		const books = await withTask(
			"Loading book metadata",
			async () =>
				await Promise.all(annotFiles.map((path) => parseAnnotFile(path))),
			context,
		);

		const selected = await selectBooks(books, context);
		includeBooks = selected.map((book) => book.sourceAnnotPath);
	}

	const totalBooks = await withTask(
		"Counting total books",
		async () => {
			const annotFiles = await discoverAnnotFiles(inputSource);
			return annotFiles.length;
		},
		context,
	);

	const booksToProcess =
		includeBooks.length > 0 ? includeBooks.length : totalBooks;

	if (request.interactive) {
		const confirmed = await confirmPreflight(
			{
				inputSource:
					inputSource.kind === "directory"
						? inputSource.path
						: inputSource.mountPath,
				outputDir: request.output,
				mode: request.mode,
				booksSelected: booksToProcess,
				totalBooks,
				aiRefactor: request.aiRefactor,
				dryRun: request.dryRun,
			},
			context,
		);

		if (!confirmed) {
			clack.cancel("Conversion cancelled");
			return;
		}
	}

	const result = await withTask(
		"Converting books",
		async () =>
			await runConversion({
				input: inputSource,
				outputDir: request.output,
				mode: request.mode,
				interactive: request.interactive,
				selectAll: request.selectAll,
				includeBooks,
				aiRefactor: request.aiRefactor,
			}),
		context,
	);

	clack.outro("Conversion complete!");

	displayConversionSummary(
		{
			booksProcessed: result.booksProcessed,
			filesWritten: result.filesWritten.length,
			warnings: result.warnings,
			dryRun: request.dryRun,
		},
		context,
	);

	if (request.failOnWarning && result.warnings.length > 0) {
		process.exitCode = 1;
	}
}
