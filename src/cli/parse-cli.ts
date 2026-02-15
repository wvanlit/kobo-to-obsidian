import { Command } from "commander";
import { asDirectoryPath } from "../domain/shared";
import {
	type AiRefactorOptions,
	DEFAULT_AI_REFACTOR_MODEL,
	DEFAULT_AI_REFACTOR_VARIANT,
} from "../refactor/ai-refactor-config";
import type {
	CliRequest,
	ConvertRequest,
	ListBooksRequest,
} from "./command-spec";

export function parseCli(argv: string[]): CliRequest {
	const program = new Command();

	program
		.name("kobo-to-obsidian")
		.description("Convert Kobo eReader annotations to Obsidian markdown")
		.version("1.0.0");

	// Convert command (default)
	program
		.command("convert", { isDefault: true })
		.description("Convert Kobo annotations to Obsidian markdown")
		.option("--input <directory>", "Input directory or Kobo mount path")
		.option(
			"--output <directory>",
			"Output directory for generated markdown files",
		)
		.option("--mode <mode>", "Output mode: single or by-chapter", "single")
		.option("--yes", "Skip interactive prompts", false)
		.option("--select-all", "Select all books without prompting", false)
		.option(
			"--book <filter>",
			"Filter books by title or path (repeatable)",
			collectMultiple,
			[],
		)
		.option(
			"--ai-refactor [model]",
			"Enable AI refactoring with optional model",
		)
		.option("--ai-refacotr [model]", "Alias for --ai-refactor (common typo)")
		.option(
			"--ai-refactor-model <model>",
			"AI model in format: provider/model[/variant]",
		)
		.option("--dry-run", "Preview changes without writing files", false)
		.option("--verbose", "Enable verbose output", false)
		.option("--no-color", "Disable colored output")
		.option(
			"--fail-on-warning",
			"Exit with error code if warnings occur",
			false,
		)
		.action((options) => {
			const convertRequest = parseConvertOptions(options);
			program.setOptionValueWithSource("__result", convertRequest, "cli");
		});

	// List-books command
	program
		.command("list-books")
		.description("List all available books without converting")
		.option("--input <directory>", "Input directory or Kobo mount path")
		.option("--verbose", "Enable verbose output", false)
		.option("--no-color", "Disable colored output")
		.action((options) => {
			const listRequest: ListBooksRequest = {
				command: "list-books",
				input: options.input,
				verbose: options.verbose,
				noColor: !options.color,
			};
			program.setOptionValueWithSource("__result", listRequest, "cli");
		});

	program.parse(argv, { from: "user" });

	const result = program.getOptionValue("__result") as CliRequest | undefined;
	if (!result) {
		throw new Error("No command executed");
	}

	return result;
}

function parseConvertOptions(options: Record<string, unknown>): ConvertRequest {
	const output = options.output as string | undefined;
	if (!output) {
		throw new Error("Missing required option: --output <directory>");
	}

	const mode = options.mode as string;
	if (mode !== "single" && mode !== "by-chapter") {
		throw new Error(
			`Invalid --mode value: ${mode}. Expected "single" or "by-chapter"`,
		);
	}

	let aiRefactor: AiRefactorOptions | undefined;
	const aiRefactorFlag = options.aiRefactor ?? options.aiRefacotr;
	const aiRefactorModel = options.aiRefactorModel as string | undefined;

	if (aiRefactorModel && !aiRefactorFlag) {
		throw new Error("--ai-refactor-model requires --ai-refactor");
	}

	if (aiRefactorFlag !== undefined) {
		if (typeof aiRefactorFlag === "string") {
			aiRefactor = parseAiRefactorModelArg(aiRefactorFlag);
		} else if (aiRefactorModel) {
			aiRefactor = parseAiRefactorModelArg(aiRefactorModel);
		} else {
			aiRefactor = {
				model: DEFAULT_AI_REFACTOR_MODEL,
				variant: DEFAULT_AI_REFACTOR_VARIANT,
			};
		}
	}

	return {
		command: "convert",
		input: options.input as string | undefined,
		output: asDirectoryPath(output),
		mode,
		interactive: !options.yes,
		selectAll: options.selectAll as boolean,
		bookFilters: (options.book as string[]) ?? [],
		aiRefactor,
		dryRun: options.dryRun as boolean | undefined,
		verbose: options.verbose as boolean | undefined,
		noColor: !options.color,
		failOnWarning: options.failOnWarning as boolean | undefined,
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

function collectMultiple(value: string, previous: string[]): string[] {
	return [...previous, value];
}
