import { describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { locateEpubForAnnot } from "../../../src/enrich/locate-epub";

describe("locateEpubForAnnot", () => {
	it("matches sibling epub for .epub.annot files", async () => {
		const root = await mkdtemp(join(tmpdir(), "locate-epub-sibling-"));
		const folder = join(root, "Annotations", "Books");
		await mkdir(folder, { recursive: true });

		const annotPath = join(folder, "My Book.epub.annot");
		const epubPath = join(folder, "My Book.epub");
		await writeFile(annotPath, "", "utf8");
		await writeFile(epubPath, "", "utf8");

		const located = await locateEpubForAnnot(annotPath as never);
		expect(String(located)).toBe(epubPath);
	});

	it("finds epub in mount Books tree for Kobo annotation paths", async () => {
		const mountRoot = await mkdtemp(join(tmpdir(), "locate-epub-mount-"));
		const annotFolder = join(
			mountRoot,
			"Digital Editions",
			"Annotations",
			"Books",
			"Non Fiction",
		);
		const booksFolder = join(mountRoot, "Books", "Non Fiction");
		await mkdir(annotFolder, { recursive: true });
		await mkdir(booksFolder, { recursive: true });

		const annotPath = join(annotFolder, "A System for Writing.epub.annot");
		const epubPath = join(booksFolder, "A System for Writing.epub");
		await writeFile(annotPath, "", "utf8");
		await writeFile(epubPath, "", "utf8");

		const located = await locateEpubForAnnot(annotPath as never);
		expect(String(located)).toBe(epubPath);
	});

	it("uses explicit search root when annotation path is not Kobo-shaped", async () => {
		const root = await mkdtemp(join(tmpdir(), "locate-epub-root-"));
		const annotFolder = join(root, "incoming");
		const booksFolder = join(root, "library");
		await mkdir(annotFolder, { recursive: true });
		await mkdir(booksFolder, { recursive: true });

		const annotPath = join(annotFolder, "Flow.epub.annot");
		const epubPath = join(booksFolder, "Flow.epub");
		await writeFile(annotPath, "", "utf8");
		await writeFile(epubPath, "", "utf8");

		const located = await locateEpubForAnnot(annotPath as never, {
			searchRoot: root,
		});
		expect(String(located)).toBe(epubPath);
	});
});
