import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { $ } from "bun";

import type { OutputDocument } from "../convert/build-export-plan";
import { DEFAULT_AI_REFACTOR_MODEL } from "./ai-refactor-config";

export interface RefactorDocumentsWithOpenCodeOptions {
	documents: OutputDocument[];
	model?: string;
}

export interface RefactorDocumentsWithOpenCodeResult {
	documents: OutputDocument[];
	warnings: string[];
}

export interface RunOpenCodeRequest {
	markdown: string;
	relativePath: string;
	model: string;
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
	const warnings: string[] = [];
	const documents: OutputDocument[] = [];

	for (const document of options.documents) {
		try {
			const refactored = normalizeRefactorOutput(
				await runOpenCode({
					markdown: document.markdown,
					relativePath: document.relativePath,
					model,
				}),
			);

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
	const tempDirectory = await mkdtemp(path.join(tmpdir(), "kobo-opencode-"));
	const inputPath = path.join(tempDirectory, "document.md");

	try {
		await writeFile(inputPath, request.markdown, "utf8");

		return await $`opencode run --model ${request.model} --file ${inputPath} -- ${buildRefactorPrompt(request.relativePath)}`.text();
	} finally {
		await rm(tempDirectory, { recursive: true, force: true });
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
		"",
		"Output requirements:",
		"- Return only the final markdown document.",
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
