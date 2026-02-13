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

	it("parses Kobo namespaced metadata and fragment attributes", async () => {
		const parsed = await parseAnnotFile(
			"test/fixtures/annot/kobo-namespaced.annot" as never,
		);

		expect(parsed.titleFromAnnot).toBe(
			"A System for Writing: How an Unconventional Approach to Note-Making Can Help You Capture Ideas",
		);
		expect(parsed.authorFromAnnot).toBe("Bob Doto");
		expect(String(parsed.bookId)).toBe("B0D18J83VB");

		expect(parsed.annotations).toHaveLength(2);
		expect(String(parsed.annotations[0]?.id)).toBe("urn:uuid:2");
		expect(parsed.annotations[0]?.createdAt.toISOString()).toBe(
			"2025-09-21T12:48:16.000Z",
		);
		expect(Number(parsed.annotations[0]?.progress)).toBe(0.1);
		expect(parsed.annotations[0]?.color).toBe(2);

		expect(String(parsed.annotations[1]?.id)).toBe("urn:uuid:1");
		expect(Number(parsed.annotations[1]?.progress)).toBe(0.9);
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

	it("drops low-signal boundary lines from highlight text", async () => {
		const tempDir = await mkdtemp(join(tmpdir(), "annot-"));
		const annotPath = join(tempDir, "text-cleanup.annot");
		await writeFile(
			annotPath,
			`<?xml version="1.0" encoding="UTF-8"?>
<annotations>
  <annotation>
    <id>a-1</id>
    <date>2024-01-03T00:00:00Z</date>
    <target>
      <fragment start="Text/ch01.xhtml#x" end="Text/ch01.xhtml#y" />
    </target>
    <highlight>
.
Write it down.
Know you'll need to transform it.
    </highlight>
  </annotation>
</annotations>`,
			"utf8",
		);

		const parsed = await parseAnnotFile(annotPath as never);
		expect(parsed.annotations[0]?.highlightedText).toBe(
			"Write it down.\nKnow you'll need to transform it.",
		);
	});
});
