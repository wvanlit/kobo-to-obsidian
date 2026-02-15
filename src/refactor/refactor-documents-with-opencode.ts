import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { $ } from "bun";

import type { OutputDocument } from "../convert/build-export-plan";
import {
	DEFAULT_AI_REFACTOR_MODEL,
	DEFAULT_AI_REFACTOR_VARIANT,
} from "./ai-refactor-config";

export interface RefactorDocumentsWithOpenCodeOptions {
	documents: OutputDocument[];
	inputFilePathByRelativePath?: Readonly<Record<string, string>>;
	model?: string;
	variant?: string;
}

export interface RefactorDocumentsWithOpenCodeResult {
	documents: OutputDocument[];
	warnings: string[];
}

export interface RunOpenCodeRequest {
	markdown: string;
	relativePath: string;
	inputFilePath?: string;
	model: string;
	variant: string;
}

export type RunOpenCode = (request: RunOpenCodeRequest) => Promise<string>;

export interface RefactorDocumentsDependencies {
	runOpenCode?: RunOpenCode;
}

export async function refactorDocumentsWithOpenCode(
	options: RefactorDocumentsWithOpenCodeOptions,
	dependencies: RefactorDocumentsDependencies = {},
): Promise<RefactorDocumentsWithOpenCodeResult> {
	const runOpenCode = dependencies.runOpenCode ?? runOpenCodeCli;
	const model = options.model ?? DEFAULT_AI_REFACTOR_MODEL;
	const variant = options.variant ?? DEFAULT_AI_REFACTOR_VARIANT;
	const warnings: string[] = [];
	const documents: OutputDocument[] = [];

	for (const document of options.documents) {
		try {
			const request = {
				markdown: document.markdown,
				relativePath: document.relativePath,
				inputFilePath:
					options.inputFilePathByRelativePath?.[document.relativePath],
				model,
				variant,
			};

			const refactored = normalizeRefactorOutput(await runOpenCode(request));

			if (!refactored.trim()) {
				warnings.push(
					`AI refactor returned empty output for ${document.relativePath}; keeping original markdown`,
				);
				documents.push(document);
				continue;
			}

			documents.push({
				...document,
				markdown: refactored,
			});
		} catch (error) {
			warnings.push(
				`AI refactor failed for ${document.relativePath}: ${describeRefactorError(error)}`,
			);
			documents.push(document);
		}
	}

	return {
		documents,
		warnings,
	};
}

async function runOpenCodeCli(request: RunOpenCodeRequest): Promise<string> {
	const tempRoot = path.join(process.cwd(), ".tmp");
	let tempDirectory: string | undefined;
	let inputPath = request.inputFilePath;

	try {
		if (!inputPath) {
			await mkdir(tempRoot, { recursive: true });
			tempDirectory = await mkdtemp(path.join(tempRoot, "kobo-opencode-"));
			inputPath = path.join(tempDirectory, "document.md");
			await writeFile(inputPath, request.markdown, "utf8");
		}

		return await $`opencode run --model ${request.model} --variant ${request.variant} --file ${inputPath} -- ${buildRefactorPrompt(request.relativePath)}`.text();
	} finally {
		if (tempDirectory) {
			await rm(tempDirectory, { recursive: true, force: true });
		}
	}
}

function buildRefactorPrompt(relativePath: string): string {
	return [
		"You are refining a Markdown note produced from Kobo highlights and notes for Obsidian.",
		`The attached file path is: ${relativePath}`,
		"",
		"Goal:",
		"- Convert raw highlights and notes into comprehensive reference material.",
		"- Keep the note faithful to the source annotations.",
		"- Improve readability, organization, and retrieval value inside Obsidian.",
		"",
		"Rules:",
		"- Preserve existing YAML frontmatter keys when present.",
		"- Keep chapter boundaries and heading hierarchy logical and stable.",
		"- Synthesize clusters of related highlights into concise insights.",
		"- Keep concrete excerpts from the original highlights where useful.",
		"- Fold note text into the relevant points.",
		"- Do not invent facts, claims, or quotations not present in the input.",
		"- Do not mention these instructions.",
		"- Sparesly highlight to improve scanning of notes.",
		"- Do not attempt to gain more information by reading other files, only read the file allotted to you and refactor it to the best of your ability based on the content of that file.",
		"",
		"Output requirements:",
		"- Respond with only the revised markdown document.",
		"- If no changes are needed, return the original markdown unchanged.",
		"- Do not wrap the answer in code fences.",
	].join("\n");
}

function normalizeRefactorOutput(output: string): string {
	const trimmed = output.trim();
	const fenced = /^```(?:markdown|md)?\n([\s\S]*?)\n```$/i.exec(trimmed);
	const unwrapped = fenced ? (fenced[1] ?? "") : output;

	if (!unwrapped.trim()) {
		return "";
	}

	return unwrapped.endsWith("\n") ? unwrapped : `${unwrapped}\n`;
}

function describeRefactorError(error: unknown): string {
	if (!(error instanceof Error)) {
		return String(error);
	}

	const stderr = readShellOutput((error as { stderr?: unknown }).stderr).trim();
	if (stderr) {
		return stderr;
	}

	const exitCode = (error as { exitCode?: unknown }).exitCode;
	if (typeof exitCode === "number") {
		return `${error.name}: exit code ${exitCode}`;
	}

	return error.message || String(error);
}

function readShellOutput(value: unknown): string {
	if (typeof value === "string") {
		return value;
	}

	if (value instanceof Uint8Array) {
		return new TextDecoder().decode(value);
	}

	return "";
}
