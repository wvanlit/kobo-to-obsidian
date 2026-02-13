import { describe, expect, it } from "bun:test";

import { ChapterRef } from "../../../src/domain/models";
import { asAnnotationId, asChapterId } from "../../../src/domain/shared";
import { mapAnnotationsToChapters } from "../../../src/enrich/map-annotations-to-chapters";

describe("mapAnnotationsToChapters", () => {
	it("maps known hrefs and leaves unknown paths unmapped", () => {
		const chapters = [
			ChapterRef.create({
				id: asChapterId("chapter-1"),
				title: "Chapter One",
				href: "OEBPS/Text/ch01.xhtml",
				order: 0,
			}),
			ChapterRef.create({
				id: asChapterId("chapter-2"),
				title: "Chapter Two",
				href: "OEBPS/Text/ch02.xhtml",
				order: 1,
			}),
		];

		const mapping = mapAnnotationsToChapters(
			[
				{
					id: asAnnotationId("a-1"),
					fragmentStart: "OEBPS/Text/ch01.xhtml#point(/1/4/2:0)",
				},
				{
					id: asAnnotationId("a-2"),
					fragmentStart: "OEBPS/Text/unknown.xhtml#point(/1/4/2:0)",
				},
			],
			chapters,
		);

		expect(mapping.get(asAnnotationId("a-1"))?.title).toBe("Chapter One");
		expect(mapping.get(asAnnotationId("a-2"))).toBeUndefined();
	});
});
