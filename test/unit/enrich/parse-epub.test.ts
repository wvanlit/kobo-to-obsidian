import { describe, expect, it } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { zipSync } from "fflate";

import { parseEpubMetadata } from "../../../src/enrich/parse-epub";

describe("parseEpubMetadata", () => {
	it("extracts title, author and chapters from nav.xhtml", async () => {
		const epubPath = await writeFixtureEpub("nav");
		const metadata = await parseEpubMetadata(epubPath as never);

		expect(metadata.title).toBe("Fixture Book");
		expect(metadata.author).toBe("Fixture Author");
		expect(metadata.chapters).toHaveLength(2);
		expect(metadata.chapters[0]?.title).toBe("Chapter One");
		expect(metadata.chapters[1]?.href).toContain("OEBPS/Text/ch02.xhtml");
	});

	it("supports toc.ncx chapter extraction", async () => {
		const epubPath = await writeFixtureEpub("ncx");
		const metadata = await parseEpubMetadata(epubPath as never);

		expect(metadata.chapters).toHaveLength(2);
		expect(metadata.chapters[0]?.title).toBe("Chapter One");
		expect(metadata.chapters[1]?.title).toBe("Chapter Two");
	});
});

async function writeFixtureEpub(kind: "nav" | "ncx"): Promise<string> {
	const tempDir = await mkdtemp(join(tmpdir(), `epub-${kind}-`));
	const epubPath = join(tempDir, `${kind}.epub`);

	const opfNav = `<?xml version="1.0" encoding="utf-8"?>
<package version="3.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <metadata>
    <dc:title>Fixture Book</dc:title>
    <dc:creator>Fixture Author</dc:creator>
  </metadata>
  <manifest>
    <item id="chap1" href="Text/ch01.xhtml" media-type="application/xhtml+xml" />
    <item id="chap2" href="Text/ch02.xhtml" media-type="application/xhtml+xml" />
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav" />
  </manifest>
  <spine>
    <itemref idref="chap1" />
    <itemref idref="chap2" />
  </spine>
</package>`;

	const opfNcx = `<?xml version="1.0" encoding="utf-8"?>
<package version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <metadata>
    <dc:title>Fixture Book</dc:title>
    <dc:creator>Fixture Author</dc:creator>
  </metadata>
  <manifest>
    <item id="chap1" href="Text/ch01.xhtml" media-type="application/xhtml+xml" />
    <item id="chap2" href="Text/ch02.xhtml" media-type="application/xhtml+xml" />
    <item id="toc" href="toc.ncx" media-type="application/x-dtbncx+xml" />
  </manifest>
  <spine toc="toc">
    <itemref idref="chap1" />
    <itemref idref="chap2" />
  </spine>
</package>`;

	const navXhtml = `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <body>
    <nav>
      <ol>
        <li><a href="Text/ch01.xhtml">Chapter One</a></li>
        <li><a href="Text/ch02.xhtml">Chapter Two</a></li>
      </ol>
    </nav>
  </body>
</html>`;

	const tocNcx = `<?xml version="1.0" encoding="utf-8"?>
<ncx>
  <navMap>
    <navPoint id="n1" playOrder="1">
      <navLabel><text>Chapter One</text></navLabel>
      <content src="Text/ch01.xhtml" />
    </navPoint>
    <navPoint id="n2" playOrder="2">
      <navLabel><text>Chapter Two</text></navLabel>
      <content src="Text/ch02.xhtml" />
    </navPoint>
  </navMap>
</ncx>`;

	const archive = zipSync({
		"META-INF/container.xml": encode(
			`<?xml version="1.0"?>
<container version="1.0">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml" />
  </rootfiles>
</container>`,
		),
		"OEBPS/content.opf": encode(kind === "nav" ? opfNav : opfNcx),
		"OEBPS/nav.xhtml": encode(navXhtml),
		"OEBPS/toc.ncx": encode(tocNcx),
		"OEBPS/Text/ch01.xhtml": encode(
			"<html><body><p>Chapter 1</p></body></html>",
		),
		"OEBPS/Text/ch02.xhtml": encode(
			"<html><body><p>Chapter 2</p></body></html>",
		),
	});

	await writeFile(epubPath, archive);
	return epubPath;
}

function encode(value: string): Uint8Array {
	return new TextEncoder().encode(value);
}
