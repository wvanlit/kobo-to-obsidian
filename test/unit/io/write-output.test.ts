import { describe, expect, it } from "bun:test";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { sanitizePathSegment } from "../../../src/io/sanitize-path";
import { writeOutputDocuments } from "../../../src/io/write-output";

describe("sanitizePathSegment", () => {
	it("creates vault-safe path segments", () => {
		expect(sanitizePathSegment("  My:Book?*  ")).toBe("My-Book--");
		expect(sanitizePathSegment("CON")).toBe("CON-file");
		expect(sanitizePathSegment("   ")).toBe("Untitled");
	});
});

describe("writeOutputDocuments", () => {
	it("writes files and returns full output paths", async () => {
		const outputDir = await mkdtemp(join(tmpdir(), "write-output-"));
		const written = await writeOutputDocuments(outputDir as never, [
			{
				relativePath: "Book/01 - Chapter.md" as never,
				markdown: "# Chapter\n",
			},
		]);

		expect(written).toHaveLength(1);
		const content = await readFile(written[0] as never, "utf8");
		expect(content).toBe("# Chapter\n");
	});
});
