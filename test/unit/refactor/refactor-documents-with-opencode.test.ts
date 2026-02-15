import { describe, expect, it } from "bun:test";

import type { OutputDocument } from "../../../src/convert/build-export-plan";
import { asFilePath } from "../../../src/domain/shared";
import {
	DEFAULT_AI_REFACTOR_MODEL,
	DEFAULT_AI_REFACTOR_VARIANT,
} from "../../../src/refactor/ai-refactor-config";
import { refactorDocumentsWithOpenCode } from "../../../src/refactor/refactor-documents-with-opencode";

describe("refactorDocumentsWithOpenCode", () => {
	it("refactors every generated file", async () => {
		const calls: { relativePath: string; model: string; variant: string }[] =
			[];
		const docs = fixtureDocs();

		const result = await refactorDocumentsWithOpenCode(
			{
				documents: docs,
				model: "openai/gpt-5.2",
				variant: "high",
			},
			{
				runOpenCode: async (request) => {
					calls.push({
						relativePath: request.relativePath,
						model: request.model,
						variant: request.variant,
					});
					return `# Refactored ${request.relativePath}\n`;
				},
			},
		);

		expect(result.warnings).toHaveLength(0);
		expect(result.documents).toHaveLength(2);
		expect(result.documents[0]?.markdown).toBe("# Refactored Book.md\n");
		expect(result.documents[1]?.markdown).toBe(
			"# Refactored Book/01 - Chapter.md\n",
		);
		expect(calls).toEqual([
			{
				relativePath: "Book.md",
				model: "openai/gpt-5.2",
				variant: "high",
			},
			{
				relativePath: "Book/01 - Chapter.md",
				model: "openai/gpt-5.2",
				variant: "high",
			},
		]);
	});

	it("uses default model and keeps original markdown on failure", async () => {
		const docs = fixtureDocs();

		const result = await refactorDocumentsWithOpenCode(
			{
				documents: docs,
			},
			{
				runOpenCode: async (request) => {
					if (request.relativePath.includes("Chapter")) {
						throw new Error("boom");
					}
					expect(request.model).toBe(DEFAULT_AI_REFACTOR_MODEL);
					expect(request.variant).toBe(DEFAULT_AI_REFACTOR_VARIANT);
					return "# Refactored Book\n";
				},
			},
		);

		expect(result.documents[0]?.markdown).toBe("# Refactored Book\n");
		expect(result.documents[1]?.markdown).toBe("# Chapter 01\n");
		expect(result.warnings).toHaveLength(1);
		expect(result.warnings[0]).toContain("Book/01 - Chapter.md");
	});

	it("keeps original markdown when AI returns empty output", async () => {
		const docs = fixtureDocs();
		const calls: string[] = [];

		const result = await refactorDocumentsWithOpenCode(
			{
				documents: docs,
			},
			{
				runOpenCode: async (request) => {
					calls.push(request.relativePath);
					if (request.relativePath === "Book.md") {
						return "   \n";
					}
					return "# Chapter updated\n";
				},
			},
		);

		expect(calls).toEqual(["Book.md", "Book/01 - Chapter.md"]);
		expect(result.documents[0]?.markdown).toBe("# Book\n");
		expect(result.documents[1]?.markdown).toBe("# Chapter updated\n");
		expect(result.warnings).toEqual([
			"AI refactor returned empty output for Book.md; keeping original markdown",
		]);
	});

	it("passes through optional input file path per document", async () => {
		const docs = fixtureDocs();
		const inputFilePathByRelativePath = {
			"Book.md": "/tmp/Book.md",
			"Book/01 - Chapter.md": "/tmp/chapter.md",
		};
		const seen: Array<{ relativePath: string; inputFilePath?: string }> = [];

		const result = await refactorDocumentsWithOpenCode(
			{
				documents: docs,
				inputFilePathByRelativePath,
			},
			{
				runOpenCode: async (request) => {
					seen.push({
						relativePath: request.relativePath,
						inputFilePath: request.inputFilePath,
					});
					return `# ${request.relativePath}\n`;
				},
			},
		);

		expect(result.warnings).toHaveLength(0);
		expect(seen).toEqual([
			{ relativePath: "Book.md", inputFilePath: "/tmp/Book.md" },
			{
				relativePath: "Book/01 - Chapter.md",
				inputFilePath: "/tmp/chapter.md",
			},
		]);
	});
});

function fixtureDocs(): OutputDocument[] {
	return [
		{
			relativePath: asFilePath("Book.md"),
			markdown: "# Book\n",
		},
		{
			relativePath: asFilePath("Book/01 - Chapter.md"),
			markdown: "# Chapter 01\n",
		},
	];
}
