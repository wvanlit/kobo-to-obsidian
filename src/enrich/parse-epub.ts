import { readFile } from "node:fs/promises";
import path from "node:path";
import { XMLParser } from "fast-xml-parser";
import { unzipSync } from "fflate";

import { ParseEpubError } from "../domain/errors";
import { BookMetadata, ChapterRef } from "../domain/models";
import { asChapterId, type EpubFilePath } from "../domain/shared";

const parser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: "@",
	trimValues: true,
});

interface ManifestItem {
	id: string;
	href: string;
	mediaType?: string;
	properties?: string;
}

export async function parseEpubMetadata(
	epubPath: EpubFilePath,
): Promise<BookMetadata> {
	try {
		const bytes = await readFile(epubPath);
		const archive = unzipSync(new Uint8Array(bytes));

		const containerXml = asText(archive["META-INF/container.xml"]);
		if (!containerXml) {
			throw new ParseEpubError("Missing META-INF/container.xml");
		}

		const containerDoc = parser.parse(containerXml) as Record<string, unknown>;
		const opfPath = readOpfPath(containerDoc);
		if (!opfPath) {
			throw new ParseEpubError("Could not find OPF path in container.xml");
		}

		const opfXml = asText(archive[opfPath]);
		if (!opfXml) {
			throw new ParseEpubError(`Missing OPF file at ${opfPath}`);
		}

		const opfDoc = parser.parse(opfXml) as Record<string, unknown>;
		const manifest = readManifest(opfDoc);
		const spine = readSpine(opfDoc);
		const metadata = readMetadata(opfDoc);

		const opfDir = path.posix.dirname(opfPath);
		const navChapters = readNavChapters(archive, manifest, opfDir);
		const chapters =
			navChapters.length > 0
				? navChapters
				: deriveChaptersFromSpine(spine, manifest, opfDir);

		return BookMetadata.create({
			chapters,
			title: metadata.title,
			author: metadata.author,
		});
	} catch (cause) {
		if (cause instanceof ParseEpubError) {
			throw cause;
		}

		throw new ParseEpubError(`Failed to parse EPUB metadata: ${epubPath}`, {
			cause,
		});
	}
}

function readOpfPath(
	containerDoc: Record<string, unknown>,
): string | undefined {
	const rootfile = findFirstRecordByKey(containerDoc, "rootfile");
	if (!rootfile) {
		return undefined;
	}

	const fullPath = rootfile["@full-path"];
	return typeof fullPath === "string" ? fullPath : undefined;
}

function readMetadata(opfDoc: Record<string, unknown>): {
	title?: string;
	author?: string;
} {
	const title = readFirstText(opfDoc, ["dc:title", "title"]);
	const author = readFirstText(opfDoc, ["dc:creator", "creator"]);
	return { title, author };
}

function readManifest(opfDoc: Record<string, unknown>): ManifestItem[] {
	const manifestNode = findFirstRecordByKey(opfDoc, "manifest");
	if (!manifestNode) {
		return [];
	}

	const rawItems = manifestNode.item;
	if (!rawItems) {
		return [];
	}

	const items = Array.isArray(rawItems) ? rawItems : [rawItems];
	return items
		.filter((item): item is Record<string, unknown> => isRecord(item))
		.map((item) => ({
			id: asString(item["@id"]),
			href: asString(item["@href"]),
			mediaType: asOptionalString(item["@media-type"]),
			properties: asOptionalString(item["@properties"]),
		}))
		.filter((item) => item.id && item.href) as ManifestItem[];
}

function readSpine(opfDoc: Record<string, unknown>): string[] {
	const spineNode = findFirstRecordByKey(opfDoc, "spine");
	if (!spineNode) {
		return [];
	}

	const itemRefs = spineNode.itemref;
	if (!itemRefs) {
		return [];
	}

	const values = Array.isArray(itemRefs) ? itemRefs : [itemRefs];
	return values
		.filter((value): value is Record<string, unknown> => isRecord(value))
		.map((value) => asOptionalString(value["@idref"]))
		.filter((value): value is string => Boolean(value));
}

function readNavChapters(
	archive: Record<string, Uint8Array>,
	manifest: ManifestItem[],
	opfDir: string,
): ChapterRef[] {
	const navItems = manifest.filter((item) => isNavigationManifestItem(item));
	if (navItems.length === 0) {
		return [];
	}

	const candidates = navItems
		.map((item) => readChapterCandidate(archive, item, opfDir))
		.filter((candidate): candidate is ChapterRef[] => candidate.length > 0);

	if (candidates.length === 0) {
		return [];
	}

	return pickBestChapterCandidate(candidates);
}

function isNavigationManifestItem(item: ManifestItem): boolean {
	if (item.properties?.split(" ").includes("nav")) {
		return true;
	}

	if (item.mediaType === "application/x-dtbncx+xml") {
		return true;
	}

	const href = item.href.toLowerCase();
	return href.includes("nav") || href.includes("toc");
}

function readChapterCandidate(
	archive: Record<string, Uint8Array>,
	manifestItem: ManifestItem,
	opfDir: string,
): ChapterRef[] {
	const navPath = normalizeArchivePath(
		path.posix.join(opfDir, manifestItem.href),
	);
	const navXml = asText(archive[navPath]);
	if (!navXml) {
		return [];
	}

	const navDoc = parser.parse(navXml) as Record<string, unknown>;

	if (
		manifestItem.mediaType === "application/x-dtbncx+xml" ||
		navPath.endsWith(".ncx")
	) {
		return readNcxChapters(navDoc, opfDir);
	}

	return readXhtmlNavChapters(navDoc, opfDir);
}

function pickBestChapterCandidate(candidates: ChapterRef[][]): ChapterRef[] {
	let best = candidates[0] ?? [];
	let bestScore = scoreChapterCandidate(best);

	for (const candidate of candidates.slice(1)) {
		const score = scoreChapterCandidate(candidate);
		if (score > bestScore) {
			best = candidate;
			bestScore = score;
		}
	}

	return best;
}

function scoreChapterCandidate(chapters: ChapterRef[]): number {
	if (chapters.length === 0) {
		return Number.NEGATIVE_INFINITY;
	}

	return chapters.reduce(
		(score, chapter) => score + scoreChapterTitle(chapter.title),
		0,
	);
}

function scoreChapterTitle(title: string): number {
	const normalized = title.trim().toLowerCase();
	if (!normalized) {
		return -4;
	}

	if (looksLikeSplitLabel(normalized)) {
		return -5;
	}

	if (/^chapter\s+\d+$/i.test(normalized)) {
		return -2;
	}

	let score = 0;
	if (normalized.split(/\s+/).length >= 3) {
		score += 2;
	}
	if (/[?!.:]$/.test(normalized)) {
		score += 1;
	}
	if (/[a-z]{4,}\s+[a-z]{4,}/i.test(normalized)) {
		score += 1;
	}

	const digitCount = (normalized.match(/\d/g) ?? []).length;
	if (digitCount > 0) {
		score -= Math.min(2, digitCount);
	}

	return score;
}

function looksLikeSplitLabel(title: string): boolean {
	if (/^part\s*\d+\s*split\s*\d+$/i.test(title)) {
		return true;
	}

	const compact = title.replaceAll(/[_-]+/g, " ").replaceAll(/\s+/g, " ");
	return /part\s*\d+/i.test(compact) && /split\s*\d+/i.test(compact);
}

function readXhtmlNavChapters(
	navDoc: Record<string, unknown>,
	opfDir: string,
): ChapterRef[] {
	const links = collectLinks(navDoc);

	return links.map((link, index) =>
		ChapterRef.create({
			id: asChapterId(`chapter-${index + 1}`),
			title: link.text || `Chapter ${index + 1}`,
			href: normalizeArchivePath(path.posix.join(opfDir, link.href)),
			order: index,
		}),
	);
}

function collectLinks(
	node: unknown,
	found: { href: string; text: string }[] = [],
): { href: string; text: string }[] {
	if (Array.isArray(node)) {
		for (const value of node) {
			collectLinks(value, found);
		}
		return found;
	}

	if (!isRecord(node)) {
		return found;
	}

	if ("a" in node) {
		const links = Array.isArray(node.a) ? node.a : [node.a];
		for (const link of links) {
			if (!isRecord(link)) {
				continue;
			}
			const href = asOptionalString(link["@href"]);
			if (!href) {
				continue;
			}

			found.push({ href, text: readInlineText(link) });
		}
	}

	for (const value of Object.values(node)) {
		collectLinks(value, found);
	}

	return uniqueByHref(found);
}

function uniqueByHref<T extends { href: string }>(links: T[]): T[] {
	const seen = new Set<string>();
	const unique: T[] = [];

	for (const link of links) {
		if (seen.has(link.href)) {
			continue;
		}

		seen.add(link.href);
		unique.push(link);
	}

	return unique;
}

function readNcxChapters(
	navDoc: Record<string, unknown>,
	opfDir: string,
): ChapterRef[] {
	const navPoints = collectNavPoints(navDoc);
	return navPoints.map((point, index) =>
		ChapterRef.create({
			id: asChapterId(`chapter-${index + 1}`),
			title: point.title || `Chapter ${index + 1}`,
			href: normalizeArchivePath(path.posix.join(opfDir, point.href)),
			order: index,
		}),
	);
}

function collectNavPoints(
	node: unknown,
	found: { href: string; title: string }[] = [],
): { href: string; title: string }[] {
	if (Array.isArray(node)) {
		for (const value of node) {
			collectNavPoints(value, found);
		}
		return found;
	}

	if (!isRecord(node)) {
		return found;
	}

	if ("navPoint" in node) {
		const values = Array.isArray(node.navPoint)
			? node.navPoint
			: [node.navPoint];
		for (const value of values) {
			if (!isRecord(value)) {
				continue;
			}

			const href = asOptionalString(
				findFirstRecordByKey(value, "content")?.["@src"],
			);
			if (!href) {
				continue;
			}

			const title = readFirstText(value, ["text"]) ?? "";
			found.push({ href, title });
		}
	}

	for (const value of Object.values(node)) {
		collectNavPoints(value, found);
	}

	return uniqueByHref(found);
}

function deriveChaptersFromSpine(
	spine: string[],
	manifest: ManifestItem[],
	opfDir: string,
): ChapterRef[] {
	const manifestById = new Map(manifest.map((item) => [item.id, item]));

	return spine
		.map((idRef, index) => {
			const item = manifestById.get(idRef);
			if (!item) {
				return undefined;
			}

			return ChapterRef.create({
				id: asChapterId(`chapter-${index + 1}`),
				title: `Chapter ${index + 1}`,
				href: normalizeArchivePath(path.posix.join(opfDir, item.href)),
				order: index,
			});
		})
		.filter((chapter): chapter is ChapterRef => Boolean(chapter));
}

function normalizeArchivePath(value: string): string {
	return value.replaceAll("\\", "/").replaceAll("./", "");
}

function readInlineText(node: Record<string, unknown>): string {
	const parts: string[] = [];
	for (const [key, value] of Object.entries(node)) {
		if (key.startsWith("@")) {
			continue;
		}

		if (typeof value === "string") {
			parts.push(value);
			continue;
		}

		if (Array.isArray(value)) {
			for (const item of value) {
				if (typeof item === "string") {
					parts.push(item);
				}
			}
		}
	}

	return parts.join(" ").replaceAll(/\s+/g, " ").trim();
}

function readFirstText(node: unknown, keys: string[]): string | undefined {
	if (Array.isArray(node)) {
		for (const value of node) {
			const nested = readFirstText(value, keys);
			if (nested) {
				return nested;
			}
		}
		return undefined;
	}

	if (!isRecord(node)) {
		return undefined;
	}

	for (const [key, value] of Object.entries(node)) {
		if (
			keys.some((candidate) => candidate.toLowerCase() === key.toLowerCase())
		) {
			if (typeof value === "string" && value.trim()) {
				return value.trim();
			}
		}

		const nested = readFirstText(value, keys);
		if (nested) {
			return nested;
		}
	}

	return undefined;
}

function findFirstRecordByKey(
	node: unknown,
	keyToFind: string,
): Record<string, unknown> | undefined {
	if (Array.isArray(node)) {
		for (const value of node) {
			const nested = findFirstRecordByKey(value, keyToFind);
			if (nested) {
				return nested;
			}
		}
		return undefined;
	}

	if (!isRecord(node)) {
		return undefined;
	}

	for (const [key, value] of Object.entries(node)) {
		if (key.toLowerCase() === keyToFind.toLowerCase() && isRecord(value)) {
			return value;
		}

		const nested = findFirstRecordByKey(value, keyToFind);
		if (nested) {
			return nested;
		}
	}

	return undefined;
}

function asText(value: Uint8Array | undefined): string | undefined {
	if (!value) {
		return undefined;
	}

	return new TextDecoder().decode(value);
}

function asString(value: unknown): string {
	if (typeof value === "string") {
		return value;
	}

	return "";
}

function asOptionalString(value: unknown): string | undefined {
	if (typeof value === "string" && value.trim()) {
		return value;
	}

	return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
