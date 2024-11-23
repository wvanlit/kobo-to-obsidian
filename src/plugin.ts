import { Editor, MarkdownView, Plugin } from "obsidian";
import { KoboAnnotationSelectionModal } from "./modal";
import {
	DEFAULT_SETTINGS,
	KoboToMarkdownSettings,
	KoboToMarkdownSettingTab,
} from "./settings";

export default class KoboToMarkdownPlugin extends Plugin {
	settings: KoboToMarkdownSettings;

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: "paste-kobo-as-markdown",
			name: "Paste Kobo annotations as Markdown",
			editorCallback: (editor: Editor, view: MarkdownView) => {
				new KoboAnnotationSelectionModal(
					this.app,
					this.settings,
				).open();
			},
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new KoboToMarkdownSettingTab(this.app, this));
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData(),
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
