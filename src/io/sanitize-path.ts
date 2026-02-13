const INVALID_CHARS = /[<>:"/\\|?*]/g;
const RESERVED_WINDOWS_NAMES = new Set([
	"con",
	"prn",
	"aux",
	"nul",
	"com1",
	"com2",
	"com3",
	"com4",
	"com5",
	"com6",
	"com7",
	"com8",
	"com9",
	"lpt1",
	"lpt2",
	"lpt3",
	"lpt4",
	"lpt5",
	"lpt6",
	"lpt7",
	"lpt8",
	"lpt9",
]);

export function sanitizePathSegment(input: string): string {
	const trimmed = input.trim();
	if (!trimmed) {
		return "Untitled";
	}

	const normalized = trimmed
		.normalize("NFKC")
		.split("")
		.filter((char) => char.charCodeAt(0) >= 32)
		.join("")
		.replaceAll(INVALID_CHARS, "-")
		.replaceAll(/\s+/g, " ")
		.replaceAll(/\.+$/g, "")
		.trim();

	if (!normalized) {
		return "Untitled";
	}

	if (RESERVED_WINDOWS_NAMES.has(normalized.toLowerCase())) {
		return `${normalized}-file`;
	}

	return normalized;
}
