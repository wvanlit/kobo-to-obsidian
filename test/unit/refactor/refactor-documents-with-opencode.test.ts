import { describe, expect, it } from "bun:test";

import type { OutputDocument } from "../../../src/convert/build-export-plan";
import { asFilePath } from "../../../src/domain/shared";
import { DEFAULT_AI_REFACTOR_MODEL } from "../../../src/refactor/ai-refactor-config";
import { refactorDocumentsWithOpenCode } from "../../../src/refactor/refactor-documents-with-opencode";

describe("refactorDocumentsWithOpenCode", () => {
	it("refactors every generated file", async () => {
		const calls: { relativePath: string; model: string }[] = [];
		const docs = fixtureDocs();

		const result = await refactorDocumentsWithOpenCode(
			{
				documents: docs,
				model: "openai/gpt-5.1-codex-mini",
			},
			{
				runOpenCode: async (request) => {
					calls.push({
						relativePath: request.relativePath,
						model: request.model,
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
				model: "openai/gpt-5.1-codex-mini",
			},
			{
				relativePath: "Book/01 - Chapter.md",
				model: "openai/gpt-5.1-codex-mini",
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
					return "# Refactored Book\n";
				},
			},
		);

		expect(result.documents[0]?.markdown).toBe("# Refactored Book\n");
		expect(result.documents[1]?.markdown).toBe("# Chapter 01\n");
		expect(result.warnings).toHaveLength(1);
		expect(result.warnings[0]).toContain("Book/01 - Chapter.md");
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
