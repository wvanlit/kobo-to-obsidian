import {
	asDirectoryPath,
	type DirectoryPath,
	type OutputMode,
} from "../domain/shared";

export interface CliArgs {
	input?: string;
	output: DirectoryPath;
	mode: OutputMode;
	interactive: boolean;
	selectAll: boolean;
	bookFilters: string[];
}

export function parseArgs(argv: string[]): CliArgs {
	let input: string | undefined;
	let output: string | undefined;
	let mode: OutputMode = "single";
	let interactive = true;
	let selectAll = false;
	const bookFilters: string[] = [];

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
		}
	}

	if (!output) {
		throw new Error("Missing required argument: --output <directory>");
	}

	return {
		input,
		output: asDirectoryPath(output),
		mode,
		interactive,
		selectAll,
		bookFilters,
	};
}
