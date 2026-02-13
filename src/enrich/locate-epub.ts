import { readdir } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";

import type { AnnotFilePath, EpubFilePath } from "../domain/shared";
import { asEpubFilePath } from "../domain/shared";

const epubFilesByRootCache = new Map<string, Promise<string[]>>();

export interface LocateEpubForAnnotOptions {
	searchRoot?: string;
}

export async function locateEpubForAnnot(
	annotPath: AnnotFilePath,
	options: LocateEpubForAnnotOptions = {},
): Promise<EpubFilePath | undefined> {
	const folder = dirname(annotPath);
	const annotBaseName = normalizeNameForMatch(
		basename(annotPath, extname(annotPath)),
	);

	const siblingEpub = await findMatchingEpubInDirectory(folder, annotBaseName);
	if (siblingEpub) {
		return asEpubFilePath(siblingEpub);
	}

	const searchRoots = collectSearchRoots(annotPath, options.searchRoot);
	for (const root of searchRoots) {
		const matched = await findMatchingEpubUnderRoot(root, annotBaseName);
		if (matched) {
			return asEpubFilePath(matched);
		}
	}

	return undefined;
}

function collectSearchRoots(
	annotPath: string,
	explicitRoot?: string,
): string[] {
	const roots = new Set<string>();

	if (explicitRoot) {
		roots.add(explicitRoot);
		roots.add(join(explicitRoot, "Books"));
	}

	const inferredMountRoot = inferKoboMountRootFromAnnotPath(annotPath);
	if (inferredMountRoot) {
		roots.add(inferredMountRoot);
		roots.add(join(inferredMountRoot, "Books"));
	}

	return [...roots];
}

function inferKoboMountRootFromAnnotPath(
	annotPath: string,
): string | undefined {
	const normalized = annotPath.replaceAll("\\", "/");
	const marker = "/digital editions/annotations/";
	const markerIndex = normalized.toLowerCase().indexOf(marker);
	if (markerIndex < 0) {
		return undefined;
	}

	const prefix = normalized.slice(0, markerIndex);
	return prefix || undefined;
}

async function findMatchingEpubInDirectory(
	folder: string,
	annotBaseName: string,
): Promise<string | undefined> {
	const entries = await readdir(folder, { withFileTypes: true }).catch(
		() => [],
	);
	const epubFiles = entries
		.filter(
			(entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".epub"),
		)
		.map((entry) => entry.name);

	const directMatch = epubFiles.find(
		(entry) => normalizeNameForMatch(entry) === annotBaseName,
	);
	if (directMatch) {
		return join(folder, directMatch);
	}

	const first = epubFiles[0];
	if (!first) {
		return undefined;
	}

	return join(folder, first);
}

async function findMatchingEpubUnderRoot(
	root: string,
	annotBaseName: string,
): Promise<string | undefined> {
	const epubFiles = await getEpubFilesUnderRoot(root);

	for (const epubPath of epubFiles) {
		if (normalizeNameForMatch(basename(epubPath)) === annotBaseName) {
			return epubPath;
		}
	}

	return undefined;
}

async function getEpubFilesUnderRoot(root: string): Promise<string[]> {
	if (!epubFilesByRootCache.has(root)) {
		epubFilesByRootCache.set(root, walkForEpubFiles(root));
	}

	return (await epubFilesByRootCache.get(root)) ?? [];
}

async function walkForEpubFiles(root: string): Promise<string[]> {
	const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
	const files: string[] = [];

	for (const entry of entries) {
		const fullPath = join(root, entry.name);
		if (entry.isDirectory()) {
			if (shouldSkipDirectory(entry.name)) {
				continue;
			}
			files.push(...(await walkForEpubFiles(fullPath)));
			continue;
		}

		if (entry.isFile() && entry.name.toLowerCase().endsWith(".epub")) {
			files.push(fullPath);
		}
	}

	return files;
}

function shouldSkipDirectory(name: string): boolean {
	return name.startsWith(".");
}

function normalizeNameForMatch(fileName: string): string {
	const withoutAnnot = fileName.replace(/\.annot$/i, "");
	const withoutEpub = withoutAnnot.replace(/\.epub$/i, "");

	return withoutEpub
		.toLowerCase()
		.replaceAll(/[_-]+/g, " ")
		.replaceAll(/\s+/g, " ")
		.trim();
}
