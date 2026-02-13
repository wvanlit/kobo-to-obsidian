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
		const sortedAnnotations = [...props.annotations].sort((a, b) => {
			const byTime = a.createdAt.getTime() - b.createdAt.getTime();
			if (byTime !== 0) {
				return byTime;
			}

			return a.id.localeCompare(b.id);
		});

		return new BookAggregate(
			props.sourceAnnotPath,
			sortedAnnotations,
			props.bookId,
			props.titleFromAnnot,
			props.authorFromAnnot,
		);
	}
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
