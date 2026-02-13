import { ValidationError } from "./errors";
import type {
	AnnotationColor,
	AnnotationId,
	AnnotFilePath,
	BookId,
	ChapterId,
	ProgressRatio,
} from "./shared";

export class Annotation {
	private constructor(
		readonly id: AnnotationId,
		readonly createdAt: Date,
		readonly highlightedText: string,
		readonly fragmentStart: string,
		readonly fragmentEnd: string,
		readonly noteText?: string,
		readonly progress?: ProgressRatio,
		readonly color?: AnnotationColor,
	) {}

	static create(props: {
		id: AnnotationId;
		createdAt: Date;
		highlightedText: string;
		fragmentStart: string;
		fragmentEnd: string;
		noteText?: string;
		progress?: ProgressRatio;
		color?: AnnotationColor;
	}): Annotation {
		if (Number.isNaN(props.createdAt.getTime())) {
			throw new ValidationError("Annotation createdAt must be a valid date");
		}

		if (!props.highlightedText.trim()) {
			throw new ValidationError("Annotation highlightedText cannot be empty");
		}

		if (!props.fragmentStart.trim() || !props.fragmentEnd.trim()) {
			throw new ValidationError("Annotation fragments cannot be empty");
		}

		return new Annotation(
			props.id,
			props.createdAt,
			props.highlightedText,
			props.fragmentStart,
			props.fragmentEnd,
			props.noteText,
			props.progress,
			props.color,
		);
	}
}

export class BookAggregate {
	private constructor(
		readonly sourceAnnotPath: AnnotFilePath,
		readonly annotations: Annotation[],
		readonly bookId?: BookId,
		readonly titleFromAnnot?: string,
		readonly authorFromAnnot?: string,
	) {}

	static create(props: {
		sourceAnnotPath: AnnotFilePath;
		annotations: Annotation[];
		bookId?: BookId;
		titleFromAnnot?: string;
		authorFromAnnot?: string;
	}): BookAggregate {
		const sortedAnnotations = [...props.annotations].sort(compareAnnotations);

		return new BookAggregate(
			props.sourceAnnotPath,
			sortedAnnotations,
			props.bookId,
			props.titleFromAnnot,
			props.authorFromAnnot,
		);
	}
}

function compareAnnotations(a: Annotation, b: Annotation): number {
	if (
		a.progress !== undefined &&
		b.progress !== undefined &&
		a.progress !== b.progress
	) {
		return a.progress - b.progress;
	}

	const byFragmentPath = normalizeFragmentPath(a.fragmentStart).localeCompare(
		normalizeFragmentPath(b.fragmentStart),
		undefined,
		{ numeric: true, sensitivity: "base" },
	);
	if (byFragmentPath !== 0) {
		return byFragmentPath;
	}

	const byPoint = comparePointLocation(a.fragmentStart, b.fragmentStart);
	if (byPoint !== 0) {
		return byPoint;
	}

	const byTime = a.createdAt.getTime() - b.createdAt.getTime();
	if (byTime !== 0) {
		return byTime;
	}

	return a.id.localeCompare(b.id);
}

function normalizeFragmentPath(fragmentStart: string): string {
	const beforeHash = fragmentStart.split("#", 1)[0] ?? "";
	return decodeURIComponent(beforeHash)
		.replaceAll("\\", "/")
		.replace(/^\.\//, "")
		.toLowerCase();
}

function comparePointLocation(
	fragmentStartA: string,
	fragmentStartB: string,
): number {
	const pointA = parsePointLocation(fragmentStartA);
	const pointB = parsePointLocation(fragmentStartB);

	const length = Math.max(pointA.path.length, pointB.path.length);
	for (let index = 0; index < length; index += 1) {
		const segmentA = pointA.path[index] ?? -1;
		const segmentB = pointB.path[index] ?? -1;
		if (segmentA !== segmentB) {
			return segmentA - segmentB;
		}
	}

	if (pointA.offset !== pointB.offset) {
		return pointA.offset - pointB.offset;
	}

	return 0;
}

function parsePointLocation(fragmentStart: string): {
	path: number[];
	offset: number;
} {
	const match = /#point\(([^)]*)\)/i.exec(fragmentStart);
	if (!match) {
		return { path: [], offset: -1 };
	}

	const location = match[1] ?? "";
	const [pathPart, offsetPart] = location.split(":", 2);
	const path = (pathPart ?? "")
		.split("/")
		.filter(Boolean)
		.map((segment) => Number(segment))
		.filter((segment) => Number.isFinite(segment));
	const offset = Number(offsetPart);

	return {
		path,
		offset: Number.isFinite(offset) ? offset : -1,
	};
}

export class ChapterRef {
	private constructor(
		readonly id: ChapterId,
		readonly title: string,
		readonly href: string,
		readonly order: number,
	) {}

	static create(props: {
		id: ChapterId;
		title: string;
		href: string;
		order: number;
	}): ChapterRef {
		if (props.order < 0) {
			throw new ValidationError("Chapter order cannot be negative");
		}

		if (!props.href.trim()) {
			throw new ValidationError("Chapter href cannot be empty");
		}

		return new ChapterRef(
			props.id,
			props.title.trim() || "Untitled",
			props.href,
			props.order,
		);
	}
}

export class BookMetadata {
	private constructor(
		readonly chapters: ChapterRef[],
		readonly title?: string,
		readonly author?: string,
	) {}

	static create(props: {
		chapters: ChapterRef[];
		title?: string;
		author?: string;
	}): BookMetadata {
		const chapters = [...props.chapters].sort((a, b) => a.order - b.order);
		return new BookMetadata(chapters, props.title, props.author);
	}
}

export class EnrichedBook {
	private constructor(
		readonly book: BookAggregate,
		readonly metadata: BookMetadata,
		readonly chapterByAnnotationId: Map<AnnotationId, ChapterRef | undefined>,
	) {}

	static create(props: {
		book: BookAggregate;
		metadata: BookMetadata;
		chapterByAnnotationId: Map<AnnotationId, ChapterRef | undefined>;
	}): EnrichedBook {
		return new EnrichedBook(
			props.book,
			props.metadata,
			props.chapterByAnnotationId,
		);
	}
}
