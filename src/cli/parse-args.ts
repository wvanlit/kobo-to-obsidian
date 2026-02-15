import {
	asDirectoryPath,
	type DirectoryPath,
	type OutputMode,
} from "../domain/shared";
import {
	type AiRefactorOptions,
	DEFAULT_AI_REFACTOR_MODEL,
	DEFAULT_AI_REFACTOR_VARIANT,
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
	let aiRefactorOptions: AiRefactorOptions | undefined;

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

		if (arg === "--ai-refactor" || arg === "--ai-refacotr") {
			aiRefactor = true;
			const value = argv[index + 1];
			if (value && !value.startsWith("--")) {
				aiRefactorOptions = parseAiRefactorModelArg(value);
				index += 1;
			}
			continue;
		}

		if (arg === "--ai-refactor-model") {
			const value = argv[index + 1];
			if (!value || value.startsWith("--")) {
				throw new Error(
					"Missing required argument: --ai-refactor-model <provider/model[/variant]>",
				);
			}
			aiRefactorOptions = parseAiRefactorModelArg(value);
			index += 1;
		}
	}

	if (!output) {
		throw new Error("Missing required argument: --output <directory>");
	}

	if (aiRefactorOptions && !aiRefactor) {
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
					model: aiRefactorOptions?.model ?? DEFAULT_AI_REFACTOR_MODEL,
					variant: aiRefactorOptions?.variant ?? DEFAULT_AI_REFACTOR_VARIANT,
				}
			: undefined,
	};
}

function parseAiRefactorModelArg(value: string): AiRefactorOptions {
	const [provider, model, variant, extra] = value.split("/");
	if (!provider || !model || extra) {
		throw new Error(
			"Invalid --ai-refactor-model value, expected <provider/model[/variant]>",
		);
	}

	return {
		model: `${provider}/${model}`,
		variant: variant || DEFAULT_AI_REFACTOR_VARIANT,
	};
}
