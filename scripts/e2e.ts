import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";

import { runConversion } from "../src/app/run-conversion";
import { asDirectoryPath } from "../src/domain/shared";

interface E2eArgs {
	mode: "single" | "by-chapter";
	clean: boolean;
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const outputRoot = path.resolve(".tmp/e2e-output");

	if (args.clean) {
		await rm(outputRoot, { recursive: true, force: true });
	}

	const runDir = path.join(outputRoot, timestamp());
	await mkdir(runDir, { recursive: true });

	const result = await runConversion({
		input: {
			kind: "directory",
			path: asDirectoryPath(path.resolve("test/fixtures/annot")),
		},
		outputDir: asDirectoryPath(runDir),
		mode: args.mode,
		interactive: false,
		selectAll: true,
	});

	console.log(`E2E output: ${runDir}`);
	console.log(`Books processed: ${result.booksProcessed}`);
	console.log("Generated files:");
	await printTree(runDir, runDir);
}

function parseArgs(argv: string[]): E2eArgs {
	let mode: "single" | "by-chapter" = "single";
	let clean = false;

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === "--mode") {
			const maybeMode = argv[index + 1];
			if (maybeMode === "single" || maybeMode === "by-chapter") {
				mode = maybeMode;
			}
			index += 1;
			continue;
		}

		if (arg === "--clean") {
			clean = true;
		}
	}

	return { mode, clean };
}

async function printTree(root: string, current: string): Promise<void> {
	const entries = await readdir(current, { withFileTypes: true });

	for (const entry of entries) {
		const fullPath = path.join(current, entry.name);
		if (entry.isDirectory()) {
			await printTree(root, fullPath);
			continue;
		}

		console.log(`- ${path.relative(root, fullPath)}`);
	}
}

function timestamp(): string {
	return new Date().toISOString().replaceAll(":", "-");
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
