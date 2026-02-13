import { readdir } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";

import type { AnnotFilePath, EpubFilePath } from "../domain/shared";
import { asEpubFilePath } from "../domain/shared";

export async function locateEpubForAnnot(
	annotPath: AnnotFilePath,
): Promise<EpubFilePath | undefined> {
	const folder = dirname(annotPath);
	const annotBaseName = basename(annotPath, extname(annotPath)).toLowerCase();
	const entries = await readdir(folder, { withFileTypes: true }).catch(
		() => [],
	);
	const epubFiles = entries
		.filter(
			(entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".epub"),
		)
		.map((entry) => entry.name);

	const directMatch = epubFiles.find(
		(entry) => basename(entry, ".epub").toLowerCase() === annotBaseName,
	);
	if (directMatch) {
		return asEpubFilePath(join(folder, directMatch));
	}

	const first = epubFiles[0];
	if (!first) {
		return undefined;
	}

	return asEpubFilePath(join(folder, first));
}
