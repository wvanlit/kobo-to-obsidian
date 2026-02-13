import path from "node:path";

interface ResolveBookTitleInput {
	metadataTitle?: string;
	annotTitle?: string;
	sourceAnnotPath: string;
}

export function resolveBookTitle(input: ResolveBookTitleInput): string {
	const explicitTitle = [input.metadataTitle, input.annotTitle].find(
		(value) => typeof value === "string" && value.trim().length > 0,
	);
	if (explicitTitle) {
		return explicitTitle.trim();
	}

	return deriveTitleFromAnnotPath(input.sourceAnnotPath) ?? "Untitled Book";
}

function deriveTitleFromAnnotPath(sourceAnnotPath: string): string | undefined {
	const baseName = decodeURIComponent(path.basename(sourceAnnotPath));
	const withoutAnnotExtension = baseName.replace(/\.annot$/i, "");
	const withoutBookExtension = withoutAnnotExtension.replace(
		/\.(epub|kepub|pdf)$/i,
		"",
	);
	const primaryCandidate = withoutBookExtension.split("_", 1)[0] ?? "";
	const normalized = (primaryCandidate || withoutBookExtension)
		.replaceAll(/[-_]+/g, " ")
		.replaceAll(/\s+/g, " ")
		.trim();

	return normalized || undefined;
}
