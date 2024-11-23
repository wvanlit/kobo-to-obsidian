import { findCommonPrefix, findCommonSuffix, groupByPrefix } from "./string";

export type Section = { file: string; pretty: string };
export type ChapterWithSections = { chapter: string; sections: Section[] };

export default class ChapterList {
	chapters: ChapterWithSections[];

	constructor(sections: string[]) {
		this.chapters = this.sectionsToChapters(sections);
	}

	sectionsToChapters(sections: string[]): ChapterWithSections[] {
		const commonPrefix = findCommonPrefix(sections);
		const commonSuffix = findCommonSuffix(sections);
		const prettySections = sections.map((section) =>
			section.slice(
				commonPrefix.length,
				section.length - commonSuffix.length,
			)
		);

		const grouped = groupByPrefix(prettySections);

		return grouped.map((node) => {
			return {
				chapter: node.prefix,
				sections: node.items.map((pc) => {
					const i = prettySections.indexOf(pc);

					return {
						file: sections[i],
						pretty: pc,
					};
				}),
			};
		});
	}

	create(section: HTMLElement) {
		section.createEl("h2", { text: "Select chapters to include" });

		const chapterList = section.createEl("div", {
			attr: {
				class: "kobo-chapter-list",
			},
		});

		for (const chapter of this.chapters) {
			this.createChapterCheckbox(chapterList, chapter);

			for (const section of chapter.sections) {
				this.createSectionCheckbox(
					chapterList,
					section.file,
					section.pretty,
				);
			}
		}
	}

	createChapterCheckbox(parent: HTMLElement, chapter: ChapterWithSections) {
		const container = parent.createEl("div", {
			attr: {
				class: "kobo-chapter-checkbox-container",
			},
		});

		const checkbox = container.createEl("input", {
			attr: {
				type: "checkbox",
				class: "kobo-chapter-checkbox",
			},
		});

		checkbox.value = "NOT IMPORTANT";
		container.createEl("label", { text: "Chapter: " + chapter.chapter });

		checkbox.onchange = (ev) => {
			const checked = (ev.target as HTMLInputElement).checked;
			for (const s of chapter.sections) {
				const sectionCheckbox = parent.querySelector(
					`input[value="${s.file}"]`,
				) as HTMLInputElement;
				sectionCheckbox.checked = checked;
			}
		};
	}

	createSectionCheckbox(
		parent: HTMLElement,
		section: string,
		prettyText: string,
	) {
		const container = parent.createEl("div", {
			attr: {
				class: "kobo-section-checkbox-container",
			},
		});

		const checkbox = container.createEl("input", {
			attr: {
				type: "checkbox",
				class: "kobo-section-checkbox",
			},
		});

		checkbox.value = section;
		container.createEl("label", { text: "Section: " + prettyText });
	}
}
