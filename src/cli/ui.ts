import * as clack from "@clack/prompts";
import type { OutputMode } from "../domain/shared";

export interface UiContext {
	noColor?: boolean;
	verbose?: boolean;
}

/**
 * Display informational message
 */
export function info(message: string, context?: UiContext): void {
	if (context?.noColor) {
		console.log(message);
	} else {
		clack.log.info(message);
	}
}

/**
 * Display warning message
 */
export function warn(message: string, context?: UiContext): void {
	if (context?.noColor) {
		console.warn(`Warning: ${message}`);
	} else {
		clack.log.warn(message);
	}
}

/**
 * Display error message
 */
export function error(message: string, context?: UiContext): void {
	if (context?.noColor) {
		console.error(`Error: ${message}`);
	} else {
		clack.log.error(message);
	}
}

/**
 * Display success message
 */
export function success(message: string, context?: UiContext): void {
	if (context?.noColor) {
		console.log(message);
	} else {
		clack.log.success(message);
	}
}

/**
 * Book selection item
 */
export interface SelectableBook {
	titleFromAnnot?: string;
	sourceAnnotPath: string;
}

/**
 * Interactive book selection with search
 */
export async function selectBooks<T extends SelectableBook>(
	books: T[],
	_context?: UiContext,
): Promise<T[]> {
	if (books.length === 0) {
		return books;
	}

	const options = books.map((book, index) => ({
		value: index,
		label: book.titleFromAnnot ?? book.sourceAnnotPath,
		hint: book.titleFromAnnot ? book.sourceAnnotPath : undefined,
	}));

	const selected = await clack.multiselect({
		message: "Select books to export:",
		options,
		required: false,
	});

	if (clack.isCancel(selected)) {
		clack.cancel("Operation cancelled");
		process.exit(0);
	}

	if (!selected || selected.length === 0) {
		return books;
	}

	return selected.map((index) => books[index] as T);
}

/**
 * Preflight summary information
 */
export interface PreflightSummary {
	inputSource: string;
	outputDir: string;
	mode: OutputMode;
	booksSelected: number;
	totalBooks: number;
	aiRefactor?: {
		model: string;
		variant: string;
	};
	dryRun?: boolean;
}

/**
 * Display preflight summary and ask for confirmation
 */
export async function confirmPreflight(
	summary: PreflightSummary,
	_context?: UiContext,
): Promise<boolean> {
	const details: string[] = [
		`Input: ${summary.inputSource}`,
		`Output: ${summary.outputDir}`,
		`Mode: ${summary.mode}`,
		`Books: ${summary.booksSelected} of ${summary.totalBooks}`,
	];

	if (summary.aiRefactor) {
		details.push(
			`AI Refactor: ${summary.aiRefactor.model} (${summary.aiRefactor.variant})`,
		);
	}

	if (summary.dryRun) {
		details.push("Dry run: enabled (no files will be written)");
	}

	clack.log.info("Preflight summary:");
	for (const detail of details) {
		console.log(`  ${detail}`);
	}

	const confirmed = await clack.confirm({
		message: "Proceed with conversion?",
	});

	if (clack.isCancel(confirmed)) {
		clack.cancel("Operation cancelled");
		return false;
	}

	return confirmed;
}

/**
 * Execute a task with a spinner
 */
export async function withTask<T>(
	name: string,
	fn: () => Promise<T>,
	context?: UiContext,
): Promise<T> {
	if (context?.noColor) {
		console.log(`${name}...`);
		const result = await fn();
		console.log(`${name} - done`);
		return result;
	}

	const spinner = clack.spinner();
	spinner.start(name);
	try {
		const result = await fn();
		spinner.stop(name);
		return result;
	} catch (err) {
		spinner.stop(`${name} - failed`);
		throw err;
	}
}

/**
 * Display conversion result summary
 */
export interface ConversionSummary {
	booksProcessed: number;
	filesWritten: number;
	warnings: string[];
	dryRun?: boolean;
}

export function displayConversionSummary(
	summary: ConversionSummary,
	context?: UiContext,
): void {
	const messages: string[] = [];

	if (summary.dryRun) {
		messages.push(
			`Dry run completed: would process ${summary.booksProcessed} books and write ${summary.filesWritten} files`,
		);
	} else {
		messages.push(`Books processed: ${summary.booksProcessed}`);
		messages.push(`Files written: ${summary.filesWritten}`);
	}

	for (const message of messages) {
		success(message, context);
	}

	if (summary.warnings.length > 0) {
		warn(`${summary.warnings.length} warnings:`, context);
		for (const warning of summary.warnings) {
			console.warn(`  - ${warning}`);
		}
	}
}
