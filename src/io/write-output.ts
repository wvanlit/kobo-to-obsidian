import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { OutputDocument } from "../convert/build-export-plan";
import type { DirectoryPath, FilePath } from "../domain/shared";
import { asFilePath } from "../domain/shared";

export async function writeOutputDocuments(
	outputDir: DirectoryPath,
	docs: OutputDocument[],
): Promise<FilePath[]> {
	const written: FilePath[] = [];

	for (const doc of docs) {
		const fullPath = join(outputDir, doc.relativePath);
		await mkdir(dirname(fullPath), { recursive: true });
		await writeFile(fullPath, doc.markdown, "utf8");
		written.push(asFilePath(fullPath));
	}

	return written;
}
