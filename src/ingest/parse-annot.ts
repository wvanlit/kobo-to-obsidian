import { readFile } from "node:fs/promises";

import { XMLParser } from "fast-xml-parser";

import { ParseAnnotError } from "../domain/errors";
import { Annotation, BookAggregate } from "../domain/models";
import {
	type AnnotationColor,
	type AnnotFilePath,
	asAnnotationId,
	asAnnotFilePath,
	asBookId,
	asProgressRatio,
} from "../domain/shared";

const parser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: "@",
	trimValues: false,
	parseTagValue: true,
	allowBooleanAttributes: true,
});

export async function parseAnnotFile(
	path: AnnotFilePath,
): Promise<BookAggregate> {
	try {
		const xml = await readFile(path, "utf8");
		const parsed = parser.parse(xml) as Record<string, unknown>;

		const titleFromAnnot = firstText(parsed, [
			"title",
			"bookTitle",
			"book_title",
		]);
		const authorFromAnnot = firstText(parsed, [
			"author",
			"creator",
			"bookAuthor",
			"book_author",
		]);
		const bookId = firstText(parsed, [
			"bookId",
			"book_id",
			"volumeid",
			"contentid",
			"identifier",
		]);

		const annotationNodes = collectAnnotationNodes(parsed);
		const annotations = annotationNodes
			.map((node, index) => parseAnnotationNode(node, index))
			.filter((value): value is Annotation => value !== undefined);

		return BookAggregate.create({
			sourceAnnotPath: asAnnotFilePath(path),
			annotations,
			bookId: bookId ? asBookId(bookId) : undefined,
			titleFromAnnot,
			authorFromAnnot,
		});
	} catch (cause) {
		throw new ParseAnnotError(`Failed to parse annot file: ${path}`, { cause });
	}
}

function parseAnnotationNode(
	node: Record<string, unknown>,
	index: number,
): Annotation | undefined {
	const highlightedTextRaw = firstText(node, [
		"highlight",
		"text",
		"selection",
	]);
	const highlightedText = normalizeText(highlightedTextRaw ?? "");
	if (!highlightedText) {
		return undefined;
	}

	const start =
		readFragment(node, "start") ?? firstText(node, ["fragmentStart", "start"]);
	const end =
		readFragment(node, "end") ?? firstText(node, ["fragmentEnd", "end"]);
	if (!start || !end) {
		return undefined;
	}

	const id =
		firstText(node, [
			"id",
			"uuid",
			"identifier",
			"annotationId",
			"annotation_id",
		]) ?? `annotation-${index + 1}`;
	const dateValue =
		firstText(node, ["date", "createdAt", "created", "timestamp"]) ??
		new Date(0).toISOString();
	const createdAt = new Date(dateValue);

	const noteText = normalizeOptionalText(readContentText(node));
	const progress = parseProgress(firstText(node, ["progress", "percent"]));
	const color = parseColor(firstText(node, ["color"]));

	return Annotation.create({
		id: asAnnotationId(id),
		createdAt,
		highlightedText,
		fragmentStart: start,
		fragmentEnd: end,
		noteText,
		progress,
		color,
	});
}

function collectAnnotationNodes(
	node: unknown,
	found: Record<string, unknown>[] = [],
): Record<string, unknown>[] {
	if (Array.isArray(node)) {
		for (const value of node) {
			collectAnnotationNodes(value, found);
		}
		return found;
	}

	if (!isRecord(node)) {
		return found;
	}

	for (const [key, value] of Object.entries(node)) {
		if (key.toLowerCase() === "annotation") {
			if (Array.isArray(value)) {
				for (const valueNode of value) {
					if (isRecord(valueNode)) {
						found.push(valueNode);
					}
				}
			} else if (isRecord(value)) {
				found.push(value);
			}
		}

		collectAnnotationNodes(value, found);
	}

	return found;
}

function readContentText(node: Record<string, unknown>): string | undefined {
	const content = node.content;
	if (isRecord(content)) {
		return firstText(content, ["text", "note"]);
	}

	return firstText(node, ["note", "noteText", "annotationNote"]);
}

function readFragment(
	node: Record<string, unknown>,
	key: "start" | "end",
): string | undefined {
	const target = node.target;
	if (!isRecord(target)) {
		return undefined;
	}

	const fragmentNode = target.fragment;
	if (!isRecord(fragmentNode)) {
		return undefined;
	}

	const fromAttribute = fragmentNode[`@${key}`];
	if (typeof fromAttribute === "string" && fromAttribute.trim()) {
		return fromAttribute.trim();
	}

	const fromValue = fragmentNode[key];
	if (typeof fromValue === "string" && fromValue.trim()) {
		return fromValue.trim();
	}

	return undefined;
}

function firstText(node: unknown, candidateKeys: string[]): string | undefined {
	if (Array.isArray(node)) {
		for (const value of node) {
			const fromArray = firstText(value, candidateKeys);
			if (fromArray) {
				return fromArray;
			}
		}
		return undefined;
	}

	if (!isRecord(node)) {
		return undefined;
	}

	for (const [key, value] of Object.entries(node)) {
		if (matchesAnyCandidateKey(key, candidateKeys)) {
			if (typeof value === "string") {
				const trimmed = value.trim();
				if (trimmed) {
					return trimmed;
				}
			}

			if (typeof value === "number" || typeof value === "boolean") {
				return String(value);
			}
		}

		const nested = firstText(value, candidateKeys);
		if (nested) {
			return nested;
		}
	}

	return undefined;
}

function normalizeText(value: string): string {
	const cleanedLines = stripLowSignalBoundaryLines(
		value
			.replaceAll("\r\n", "\n")
			.split("\n")
			.map((line) => line.trim().replaceAll(/\s+/g, " ")),
	);

	return cleanedLines
		.filter(
			(line, index, array) =>
				!(line === "" && index > 0 && array[index - 1] === ""),
		)
		.join("\n")
		.trim();
}

function normalizeOptionalText(value: string | undefined): string | undefined {
	if (!value) {
		return undefined;
	}

	const normalized = normalizeText(value);
	return normalized || undefined;
}

function parseProgress(value: string | undefined) {
	if (!value) {
		return undefined;
	}

	const parsed = Number(value);
	if (!Number.isFinite(parsed)) {
		return undefined;
	}

	if (parsed > 1) {
		const normalized = parsed / 100;
		if (normalized >= 0 && normalized <= 1) {
			return asProgressRatio(normalized);
		}
	}

	if (parsed >= 0 && parsed <= 1) {
		return asProgressRatio(parsed);
	}

	return undefined;
}

function parseColor(value: string | undefined): AnnotationColor | undefined {
	if (!value) {
		return undefined;
	}

	const parsed = Number(value);
	if (Number.isInteger(parsed) && parsed >= 0 && parsed <= 4) {
		return parsed as AnnotationColor;
	}

	return undefined;
}

function stripLowSignalBoundaryLines(lines: string[]): string[] {
	let start = 0;
	let end = lines.length;

	while (
		start < end &&
		isLowSignalLine(lines[start] ?? "") &&
		hasSubstantiveLine(lines, start + 1, end)
	) {
		start += 1;
	}

	while (
		end > start &&
		isLowSignalLine(lines[end - 1] ?? "") &&
		hasSubstantiveLine(lines, start, end - 1)
	) {
		end -= 1;
	}

	return lines.slice(start, end);
}

function hasSubstantiveLine(
	lines: string[],
	start: number,
	end: number,
): boolean {
	for (let index = start; index < end; index += 1) {
		const line = lines[index] ?? "";
		if (line && !isLowSignalLine(line)) {
			return true;
		}
	}

	return false;
}

function isLowSignalLine(line: string): boolean {
	const compact = line.replaceAll(/\s+/g, "").trim();
	if (compact.length === 0 || compact.length > 3) {
		return false;
	}

	return !/[\p{L}\p{N}]/u.test(compact);
}

function matchesAnyCandidateKey(key: string, candidateKeys: string[]): boolean {
	const normalizedKey = normalizeKey(key);
	return candidateKeys.some(
		(candidateKey) => normalizeKey(candidateKey) === normalizedKey,
	);
}

function normalizeKey(value: string): string {
	const withoutAttributes = value.replace(/^@+/, "").toLowerCase();
	const segments = withoutAttributes.split(":");
	return segments[segments.length - 1] ?? withoutAttributes;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
