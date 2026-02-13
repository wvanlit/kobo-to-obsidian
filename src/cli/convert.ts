import { runConversion } from "../app/run-conversion";
import { discoverAnnotFiles } from "../ingest/discover-annot-files";
import { parseAnnotFile } from "../ingest/parse-annot";
import { resolveInputSource } from "../ingest/resolve-input-source";
import { parseArgs } from "./parse-args";
import { promptBookSelection } from "./prompts";

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const input = args.input
		? await resolveInputSource({
				explicitInputDir: args.input,
				platform: process.platform,
			})
		: undefined;
	let resolvedInput = input;

	let includeBooks = args.bookFilters;
	if (args.interactive && !args.selectAll && includeBooks.length === 0) {
		const inputSource =
			resolvedInput ??
			(await resolveInputSource({
				platform: process.platform,
			}));
		resolvedInput = inputSource;
		const annotFiles = await discoverAnnotFiles(inputSource);
		const books = await Promise.all(
			annotFiles.map((annotPath) => parseAnnotFile(annotPath)),
		);
		const selected = await promptBookSelection(books);
		includeBooks = selected.map((book) => book.sourceAnnotPath);
	}

	const result = await runConversion({
		input: resolvedInput,
		outputDir: args.output,
		mode: args.mode,
		interactive: args.interactive,
		selectAll: args.selectAll,
		includeBooks,
	});

	console.log(`Books processed: ${result.booksProcessed}`);
	console.log(`Files written: ${result.filesWritten.length}`);
	if (result.warnings.length > 0) {
		console.warn("Warnings:");
		for (const warning of result.warnings) {
			console.warn(`- ${warning}`);
		}
	}
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
