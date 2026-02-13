import {
	asDirectoryPath,
	type DirectoryPath,
	type OutputMode,
} from "../domain/shared";
import {
	type AiRefactorOptions,
	DEFAULT_AI_REFACTOR_MODEL,
} from "../refactor/ai-refactor-config";

export interface CliArgs {
	input?: string;
	output: DirectoryPath;
	mode: OutputMode;
	interactive: boolean;
	selectAll: boolean;
	bookFilters: string[];
	aiRefactor?: AiRefactorOptions;
}

export function parseArgs(argv: string[]): CliArgs {
	let input: string | undefined;
	let output: string | undefined;
	let mode: OutputMode = "single";
	let interactive = true;
	let selectAll = false;
	const bookFilters: string[] = [];
	let aiRefactor = false;
	let aiRefactorModel: string | undefined;

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (!arg) {
			continue;
		}

		if (arg === "--input") {
			input = argv[index + 1];
			index += 1;
			continue;
		}

		if (arg === "--output") {
			output = argv[index + 1];
			index += 1;
			continue;
		}

		if (arg === "--mode") {
			const maybeMode = argv[index + 1];
			if (maybeMode === "single" || maybeMode === "by-chapter") {
				mode = maybeMode;
			}
			index += 1;
			continue;
		}

		if (arg === "--yes") {
			interactive = false;
			continue;
		}

		if (arg === "--select-all") {
			selectAll = true;
			continue;
		}

		if (arg === "--book") {
			const filter = argv[index + 1];
			if (filter) {
				bookFilters.push(filter);
			}
			index += 1;
			continue;
		}

		if (arg === "--ai-refactor") {
			aiRefactor = true;
			continue;
		}

		if (arg === "--ai-refactor-model") {
			const model = argv[index + 1];
			if (!model || model.startsWith("--")) {
				throw new Error(
					"Missing required argument: --ai-refactor-model <provider/model>",
				);
			}
			aiRefactorModel = model;
			index += 1;
		}
	}

	if (!output) {
		throw new Error("Missing required argument: --output <directory>");
	}

	if (aiRefactorModel && !aiRefactor) {
		throw new Error("--ai-refactor-model requires --ai-refactor");
	}

	return {
		input,
		output: asDirectoryPath(output),
		mode,
		interactive,
		selectAll,
		bookFilters,
		aiRefactor: aiRefactor
			? {
					model: aiRefactorModel ?? DEFAULT_AI_REFACTOR_MODEL,
				}
			: undefined,
	};
}
