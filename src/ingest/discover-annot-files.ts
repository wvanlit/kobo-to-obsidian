import { readdir } from "node:fs/promises";
import { join } from "node:path";

import {
	type AnnotFilePath,
	asAnnotFilePath,
	type InputSource,
} from "../domain/shared";

export async function discoverAnnotFiles(
	source: InputSource,
): Promise<AnnotFilePath[]> {
	const root = source.kind === "directory" ? source.path : source.mountPath;
	const files = await walkDirectory(root);

	return files
		.filter((filePath) => filePath.toLowerCase().endsWith(".annot"))
		.sort((a, b) => a.localeCompare(b))
		.map((filePath) => asAnnotFilePath(filePath));
}

async function walkDirectory(root: string): Promise<string[]> {
	const entries = await readdir(root, { withFileTypes: true });
	const results: string[] = [];

	for (const entry of entries) {
		const nextPath = join(root, entry.name);
		if (entry.isDirectory()) {
			results.push(...(await walkDirectory(nextPath)));
			continue;
		}

		if (entry.isFile()) {
			results.push(nextPath);
		}
	}

	return results;
}
