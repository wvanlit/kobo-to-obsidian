import { Modal, App } from "obsidian";
import ChapterList from "./chapter-list";
import AnnotationParser, { KoboAnnotation } from "./parser";
import { KoboToMarkdownSettings } from "./settings";

export class KoboAnnotationSelectionModal extends Modal {
	annotations: KoboAnnotation[];
	settings: KoboToMarkdownSettings;
	chapterList: ChapterList;

	constructor(app: App, settings: KoboToMarkdownSettings) {
		super(app);
		this.annotations = [];
		this.settings = settings;
	}

	onOpen() {
		const { contentEl } = this;
		const section = contentEl.createEl("section", {
			attr: { style: "padding: 12px;" },
		});

		section.createEl("h2", { text: "Kobo Annotations to Markdown" });

		const filePicker = section.createEl("input", {
			attr: {
				type: "file",
				accept: ".annot",
				class: "kobo-annotation-file-picker",
			},
		});

		filePicker.addEventListener("change", (event) => {
			const file = (event.target as HTMLInputElement).files?.[0];
			if (!file) {
				return;
			}

			this.onFileSelected(file);
		});
	}

	onFileSelected(file: File) {
		const reader = new FileReader();
		reader.onload = (event) => {
			const fileContents = event.target?.result as string;
			this.parseAnnotations(fileContents);
		};
		reader.readAsText(file);
	}

	parseAnnotations(fileContents: string) {
		const parser = new AnnotationParser(fileContents, this.settings);
		this.annotations = parser.annotations;
		const sections = parser.getSections();

		this.chapterList = new ChapterList(sections);

		const section = this.contentEl.createEl("section", {
			attr: { style: "padding: 12px;" },
		});
		this.chapterList.create(section);

		const button = section.createEl("button", {
			text: "Write to editor",
		});

		button.addEventListener("click", () => {
			this.close();
		});
	}

	onClose() {
		const { contentEl } = this;

		const editor = this.app.workspace.activeEditor?.editor;

		if (!editor) {
			console.error("No active editor found");
			return;
		}

		const checkboxes = contentEl.querySelectorAll(
			".kobo-section-checkbox:checked",
		);
		const selectedSections = Array.from(checkboxes).map(
			(c) => (c as HTMLInputElement).value,
		);

		const sectionHeadingLevel =
			parseInt(this.settings.chapterHeadingLevel.replace("h", "")) + 1;
		const sectionHeading = "".padStart(sectionHeadingLevel, "#");

		const text = selectedSections
			.map((chapter) => {
				const annotations = this.annotations
					.filter((a) => a.chapter?.file === chapter)
					.map((a) => a.text);

				return `${sectionHeading} ${chapter}\n\n${annotations.join("\n\n")}`;
			})
			.join("\n\n");

		contentEl.empty();

		editor.replaceSelection(text);
	}
}
