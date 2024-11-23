import { KoboToMarkdownSettings } from "./settings";

export default class AnnotationParser {
	annotations: KoboAnnotation[];
	settings: KoboToMarkdownSettings;
	pointRegex = /\/(\d+)\/(\d+)\/(\d+)/;

	constructor(file: string, settings: KoboToMarkdownSettings) {
		this.annotations = [];
		this.settings = settings;

		this.parseAnnotations(file);
	}

	parseAnnotations(fileContents: string) {
		const doc = new DOMParser().parseFromString(fileContents, "text/xml");

		this.annotations = Array.from(doc.querySelectorAll("annotation target"))
			.map((e) => this.parseElement(e))
			.filter((a) => a.text.length > 0);

		if (this.settings.sortAnnotations) {
			this.annotations.sort(this.sortAnnotationsByChapter);
		}
	}

	getSections() {
		return [
			...new Set(
				this.annotations
					.map((a) => a.chapter?.file)
					.filter(Boolean) as string[],
			),
		];
	}

	private parseElement(e: Element): KoboAnnotation {
		const start = e
			.querySelector("fragment")
			?.attributes.getNamedItem("start")?.value;

		const text = e.querySelector("text")?.textContent ?? "";

		let chapter = null;
		if (start) {
			// Example title: "0321125215_ch04lev1sec1.html#point(/1/4/59:1)"
			const [file, point] = start.split("#");
			const output = point.match(this.pointRegex);
			if (!output) {
				return {
					chapter: null,
					text: text,
				};
			}

			const [, chapterStr, sectionStr, positionStr] = output;

			const position =
				parseInt(chapterStr) * 10000 +
				parseInt(sectionStr) * 100 +
				parseInt(positionStr);

			chapter = {
				file,
				position,
			};
		}

		return {
			chapter: chapter ?? null,
			text: text,
		};
	}

	private sortAnnotationsByChapter(a: KoboAnnotation, b: KoboAnnotation) {
		if (a.chapter === null && b.chapter === null) {
			return 0;
		}
		if (a.chapter === null) {
			return 1;
		}
		if (b.chapter === null) {
			return -1;
		}

		const fileDiff = a.chapter.file.localeCompare(b.chapter.file);
		if (fileDiff !== 0) {
			return fileDiff;
		}

		return a.chapter.position - b.chapter.position;
	}
}

export type KoboChapter = { file: string; position: number } | null;

export type KoboAnnotation = {
	text: string;
	chapter: KoboChapter;
};
