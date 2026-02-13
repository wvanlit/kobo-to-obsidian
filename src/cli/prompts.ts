import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";

import type { OutputMode } from "../domain/shared";

export async function promptMode(defaultMode: OutputMode): Promise<OutputMode> {
	const prompt = createInterface({ input, output });
	try {
		const response = await prompt.question(
			`Output mode? [single/by-chapter] (default ${defaultMode}): `,
		);
		const normalized = response.trim().toLowerCase();
		if (normalized === "single" || normalized === "by-chapter") {
			return normalized;
		}

		return defaultMode;
	} finally {
		prompt.close();
	}
}

export async function promptBookSelection<
	T extends { titleFromAnnot?: string; sourceAnnotPath: string },
>(books: T[]): Promise<T[]> {
	if (books.length === 0) {
		return books;
	}

	const prompt = createInterface({ input, output });
	try {
		output.write(
			"Select books to export (comma-separated numbers, empty = all):\n",
		);
		for (const [index, book] of books.entries()) {
			output.write(
				`${index + 1}) ${book.titleFromAnnot ?? book.sourceAnnotPath}\n`,
			);
		}

		const response = await prompt.question("> ");
		const values = response
			.split(",")
			.map((value) => Number(value.trim()))
			.filter(
				(value) =>
					Number.isInteger(value) && value > 0 && value <= books.length,
			);

		if (values.length === 0) {
			return books;
		}

		const selectedIndexes = new Set(values.map((value) => value - 1));
		return books.filter((_, index) => selectedIndexes.has(index));
	} finally {
		prompt.close();
	}
}
