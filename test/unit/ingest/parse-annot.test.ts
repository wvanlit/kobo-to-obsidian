import { describe, expect, it } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { parseAnnotFile } from "../../../src/ingest/parse-annot";

describe("parseAnnotFile", () => {
	it("parses publication metadata and annotations", async () => {
		const parsed = await parseAnnotFile(
			"test/fixtures/annot/sample.annot" as never,
		);

		expect(parsed.titleFromAnnot).toBe("Sample Book");
		expect(parsed.authorFromAnnot).toBe("Ada Lovelace");
		expect(String(parsed.bookId)).toBe("book-123");
		expect(parsed.annotations).toHaveLength(2);
		expect(parsed.annotations[0]?.highlightedText).toBe("First highlight line");
		expect(parsed.annotations[0]?.noteText).toBe("Important note");
		expect(Number(parsed.annotations[0]?.progress)).toBe(0.25);
		expect(parsed.annotations[0]?.color).toBe(2);
	});

	it("handles missing optional fields", async () => {
		const tempDir = await mkdtemp(join(tmpdir(), "annot-"));
		const annotPath = join(tempDir, "minimal.annot");
		await writeFile(
			annotPath,
			`<?xml version="1.0" encoding="UTF-8"?>
<annotations>
  <annotation>
    <id>a-10</id>
    <date>2024-01-03T00:00:00Z</date>
    <target>
      <fragment start="Text/ch01.xhtml#x" end="Text/ch01.xhtml#y" />
    </target>
    <highlight>Only highlight</highlight>
  </annotation>
</annotations>`,
			"utf8",
		);

		const parsed = await parseAnnotFile(annotPath as never);
		expect(parsed.annotations).toHaveLength(1);
		expect(parsed.annotations[0]?.noteText).toBeUndefined();
		expect(parsed.annotations[0]?.progress).toBeUndefined();
		expect(parsed.annotations[0]?.color).toBeUndefined();
	});
});
