import { ChapterWithSections } from "./chapter-list";
import { KoboAnnotation } from "./parser";
import { KoboToMarkdownSettings } from "./settings";

export default class MarkdownWriter {
    markdown: string = "";

    settings: KoboToMarkdownSettings;
    annotations: KoboAnnotation[];
    chapters: ChapterWithSections[];
    activeSections: string[];

    sectionHeading: string;
    chapterHeading: string;

    constructor(
        annotations: KoboAnnotation[],
        chapters: ChapterWithSections[],
        activeSections: string[],
        settings: KoboToMarkdownSettings,
    ) {
        this.settings = settings;
        this.annotations = annotations;
        this.chapters = chapters;
        this.activeSections = activeSections;

        const chapterHeadingLevel = parseInt(
            this.settings.chapterHeadingLevel.replace("h", ""),
        );
        this.chapterHeading = "#".repeat(chapterHeadingLevel);
        this.sectionHeading = "#".repeat(chapterHeadingLevel + 1);
    }

    writeMarkdown() {
        for (const chapter of this.chapters) {
            const activeChapterSections = chapter.sections.filter((section) =>
                this.activeSections.includes(section.file)
            );

            if (activeChapterSections.length === 0) {
                continue;
            }

            this.writeChapter(
                chapter,
                activeChapterSections.map((section) => section.file),
            );
        }

        return this.markdown;
    }

    writeChapter(chapter: ChapterWithSections, activeSections: string[]) {
        this.markdown += `${this.chapterHeading} ${chapter.chapter}\n\n`;

        for (const section of activeSections) {
            this.writeSection(section);
        }
    }

    writeSection(file: string) {
        const annotations = this.annotations.filter((annotation) =>
            annotation.chapter?.file === file
        );

        this.markdown += `${this.sectionHeading} ${file}\n\n`;

        for (const annotation of annotations) {
            this.writeAnnotation(annotation);
        }
    }

    writeAnnotation(annotation: KoboAnnotation) {
        this.markdown += `${annotation.text}\n`;
    }
}
