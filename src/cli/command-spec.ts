import type { DirectoryPath, OutputMode } from "../domain/shared";
import type { AiRefactorOptions } from "../refactor/ai-refactor-config";

/**
 * Parsed and validated CLI request
 */
export type CliRequest = ConvertRequest | ListBooksRequest;

export interface ConvertRequest {
	command: "convert";
	input?: string;
	output: DirectoryPath;
	mode: OutputMode;
	interactive: boolean;
	selectAll: boolean;
	bookFilters: string[];
	aiRefactor?: AiRefactorOptions;
	dryRun?: boolean;
	verbose?: boolean;
	noColor?: boolean;
	failOnWarning?: boolean;
}

export interface ListBooksRequest {
	command: "list-books";
	input?: string;
	verbose?: boolean;
	noColor?: boolean;
}
