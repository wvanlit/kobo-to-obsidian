import { describe, expect, it } from "bun:test";
import { cp, mkdtemp, readFile } from "node:fs/promises";
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
		expect(markdown).toContain("## Ch01");
	});
});
