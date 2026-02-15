import { describe, expect, it } from "bun:test";
import { cp, mkdtemp, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runConversion } from "../../../src/app/run-conversion";

describe("runConversion", () => {
	it("runs pipeline end-to-end with file I/O", async () => {
		const inputDir = await mkdtemp(join(tmpdir(), "conversion-input-"));
		const outputDir = await mkdtemp(join(tmpdir(), "conversion-output-"));
		await cp(
			"test/fixtures/annot/sample.annot",
			join(inputDir, "sample.annot"),
		);

		const result = await runConversion({
			input: { kind: "directory", path: inputDir as never },
			outputDir: outputDir as never,
			mode: "single",
			interactive: false,
			selectAll: true,
		});

		expect(result.booksProcessed).toBe(1);
		expect(result.filesWritten.length).toBe(1);

		const markdown = await readFile(result.filesWritten[0] as never, "utf8");
		expect(markdown).toContain("# Sample Book");
		expect(markdown).toContain("## Ch 01");
	});

	it("applies ai refactor output and collects warnings", async () => {
		const inputDir = await mkdtemp(join(tmpdir(), "conversion-input-"));
		const outputDir = await mkdtemp(join(tmpdir(), "conversion-output-"));
		let capturedInputPathMap: Readonly<Record<string, string>> | undefined;
		await cp(
			"test/fixtures/annot/sample.annot",
			join(inputDir, "sample.annot"),
		);

		const result = await runConversion(
			{
				input: { kind: "directory", path: inputDir as never },
				outputDir: outputDir as never,
				mode: "single",
				interactive: false,
				selectAll: true,
				aiRefactor: {
					model: "openai/gpt-5.2",
					variant: "medium",
				},
			},
			{
				refactorDocuments: async ({
					documents,
					inputFilePathByRelativePath,
				}) => {
					capturedInputPathMap = inputFilePathByRelativePath;
					return {
						documents: documents.map((document) => ({
							...document,
							markdown: "# Refactored\n",
						})),
						warnings: ["AI warning"],
					};
				},
			},
		);

		expect(result.warnings).toContain("AI warning");
		expect(result.filesWritten).toHaveLength(1);
		expect(capturedInputPathMap).toBeDefined();
		expect(capturedInputPathMap?.["Sample Book.md"]).toBe(
			join(outputDir, "Sample Book.md"),
		);
		const markdown = await readFile(result.filesWritten[0] as never, "utf8");
		expect(markdown).toBe("# Refactored\n");
	});

	it("writes pre-ai markdown before refactor call", async () => {
		const inputDir = await mkdtemp(join(tmpdir(), "conversion-input-"));
		const outputDir = await mkdtemp(join(tmpdir(), "conversion-output-"));
		await cp(
			"test/fixtures/annot/sample.annot",
			join(inputDir, "sample.annot"),
		);

		await expect(
			runConversion(
				{
					input: { kind: "directory", path: inputDir as never },
					outputDir: outputDir as never,
					mode: "single",
					interactive: false,
					selectAll: true,
					aiRefactor: {
						model: "openai/gpt-5.2",
						variant: "medium",
					},
				},
				{
					refactorDocuments: async () => {
						throw new Error("boom");
					},
				},
			),
		).rejects.toThrow("boom");

		const files = await readdir(outputDir);
		expect(files).toEqual(["Sample Book.md"]);
		const markdown = await readFile(join(outputDir, files[0] as never), "utf8");
		expect(markdown).toContain("# Sample Book");
	});
});
