import { App, PluginSettingTab, Setting } from "obsidian";
import KoboToMarkdownPlugin from "./plugin";

export interface KoboToMarkdownSettings {
	sortAnnotations: boolean;
	chapterHeadingLevel: string;
}

export const DEFAULT_SETTINGS: KoboToMarkdownSettings = {
	sortAnnotations: false,
	chapterHeadingLevel: "h2",
};

export class KoboToMarkdownSettingTab extends PluginSettingTab {
	plugin: KoboToMarkdownPlugin;

	constructor(app: App, plugin: KoboToMarkdownPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Sort annotations")
			.setDesc("Sort annotations by chapter and position")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.sortAnnotations)
					.onChange(async (value) => {
						this.plugin.settings.sortAnnotations = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Chapter heading level")
			.setDesc("Heading level to use for chapter headings")
			.addDropdown((dropdown) =>
				dropdown
					.addOptions({
						h1: "h1",
						h2: "h2",
						h3: "h3",
						h4: "h4",
						h5: "h5",
						h6: "h6",
					})
					.setValue(this.plugin.settings.chapterHeadingLevel)
					.onChange(async (value) => {
						this.plugin.settings.chapterHeadingLevel = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
