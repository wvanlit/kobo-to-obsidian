# Architecture Plan: Kobo -> Obsidian Converter

## Goal

Build a Bun-first CLI that converts Kobo `.annot` exports into Obsidian-friendly Markdown, with optional enrichment from the source `.epub` (book title, chapter titles), and supports:

1. One Markdown file per book.
2. One Markdown file per chapter (inside a book folder).
3. Interactive selection of what to export.

This plan follows an 80/20, deep-modules approach: small public interfaces, strong internals, minimal dependencies.

Default input behavior: on Linux, first try to auto-detect a mounted Kobo device; if none is found, fail with a clear message and require `--input`.

## Product Scope

### In scope

- Parse Kobo `.annot` XML files.
- Map highlights + notes into normalized domain records.
- Optionally read `.epub` metadata + table of contents for enrichment.
- Render Markdown for Obsidian.
- Write files to vault-safe paths.
- Unit tests + e2e harness with inspectable output in a git-ignored folder.

### Out of scope (for first iteration)

- Full fidelity recreation of every EPUB formatting detail.
- OCR/image extraction workflows.
- Bidirectional sync back to Kobo.

## Dependency Strategy (minimal)

Favor Bun native APIs for runtime, filesystem, CLI, and tests. Add only small focused deps where Bun has no native equivalent.

- Use Bun/native:
  - `Bun.file`, `Bun.write`, `Bun.Glob`, `bun:test`, `process.argv`.
  - Node stdlib from Bun runtime: `node:path`, `node:fs/promises`, `node:readline/promises`.
- Add packages (likely 2 total):
  1. `fast-xml-parser` - robust XML parsing for `.annot` and EPUB XML docs.
  2. `fflate` - lightweight ZIP reading for `.epub` container extraction.

Reason: Bun currently has no native XML parser and no native ZIP container API for `.epub` files.

## High-Level Flow

1. CLI parses args (`--output`, optional `--input`, `--mode`, etc.).
2. Resolve input source (explicit path or auto-detected Kobo mount on Linux).
3. Discover candidate `.annot` files.
4. Parse each `.annot` into normalized `BookAggregate`.
5. Optionally enrich with `.epub` metadata and chapter map.
6. Prompt user to select books (or use non-interactive flags).
7. Build export plan (single-file or chapter-split).
8. Render markdown documents.
9. Write files and print a conversion report.

## Proposed Repo Structure

```text
src/
  cli/
    convert.ts
    parse-args.ts
    prompts.ts
  domain/
    shared.ts
    models.ts
    errors.ts
  ingest/
    discover-kobo-mount.ts
    resolve-input-source.ts
    discover-annot-files.ts
    parse-annot.ts
  enrich/
    locate-epub.ts
    parse-epub.ts
    map-annotations-to-chapters.ts
  convert/
    build-export-plan.ts
    render-markdown.ts
  io/
    sanitize-path.ts
    write-output.ts
  app/
    run-conversion.ts

test/
  unit/
    ingest/
    enrich/
    convert/
    io/
    app/
  fixtures/
    annot/
    epub/
    expected/

scripts/
  e2e.ts
```

## Module Interfaces (define these first)

```ts
// src/domain/shared.ts
export type Brand<T, TBrand extends string> = T & { readonly __brand: TBrand };

export type FilePath = Brand<string, "FilePath">;
export type DirectoryPath = Brand<string, "DirectoryPath">;
export type AnnotFilePath = Brand<FilePath, "AnnotFilePath">;
export type EpubFilePath = Brand<FilePath, "EpubFilePath">;
export type KoboMountPath = Brand<DirectoryPath, "KoboMountPath">;

export type BookId = Brand<string, "BookId">;
export type AnnotationId = Brand<string, "AnnotationId">;
export type ChapterId = Brand<string, "ChapterId">;

export type IsoUtcDate = Brand<string, "IsoUtcDate">;
export type ProgressRatio = Brand<number, "ProgressRatio">; // 0..1

export type OutputMode = "single" | "by-chapter";
export type AnnotationColor = 0 | 1 | 2 | 3 | 4;

export type InputSource =
  | { kind: "kobo-device"; mountPath: KoboMountPath }
  | { kind: "directory"; path: DirectoryPath };

// src/domain/models.ts
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
  }): Annotation;
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
  }): BookAggregate;
}

export class ChapterRef {
  private constructor(
    readonly id: ChapterId,
    readonly title: string,
    readonly href: string,
    readonly order: number,
  ) {}

  static create(props: { id: ChapterId; title: string; href: string; order: number }): ChapterRef;
}

export class BookMetadata {
  private constructor(
    readonly chapters: ChapterRef[],
    readonly title?: string,
    readonly author?: string,
  ) {}

  static create(props: { chapters: ChapterRef[]; title?: string; author?: string }): BookMetadata;
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
  }): EnrichedBook;
}
```

```ts
// src/app/run-conversion.ts
export interface ConversionOptions {
  input?: InputSource;
  outputDir: DirectoryPath;
  mode: OutputMode;
  interactive: boolean;
  selectAll?: boolean;
  includeBooks?: string[]; // title/path filters for non-interactive automation
}

export interface ConversionResult {
  booksProcessed: number;
  filesWritten: FilePath[];
  warnings: string[];
}

export async function runConversion(options: ConversionOptions): Promise<ConversionResult>;
```

```ts
// src/ingest/resolve-input-source.ts
export interface ResolveInputSourceOptions {
  explicitInputDir?: string;
  platform: NodeJS.Platform;
}

export async function resolveInputSource(options: ResolveInputSourceOptions): Promise<InputSource>;
```

```ts
// src/ingest/discover-kobo-mount.ts
export async function discoverKoboMountLinux(): Promise<KoboMountPath | undefined>;
```

```ts
// src/ingest/parse-annot.ts
export async function parseAnnotFile(path: AnnotFilePath): Promise<BookAggregate>;
```

```ts
// src/enrich/parse-epub.ts
export async function parseEpubMetadata(epubPath: EpubFilePath): Promise<BookMetadata>;
```

```ts
// src/convert/build-export-plan.ts
export interface OutputDocument {
  relativePath: FilePath;
  markdown: string;
}

export function buildExportPlan(book: EnrichedBook, mode: OutputMode): OutputDocument[];
```

```ts
// src/io/write-output.ts
export async function writeOutputDocuments(outputDir: DirectoryPath, docs: OutputDocument[]): Promise<FilePath[]>;
```

These interfaces keep orchestration simple while hiding XML/ZIP/path complexity inside deep modules.

## Module Responsibilities

### 1) `ingest/discover-kobo-mount.ts` + `ingest/resolve-input-source.ts`

- Linux default search roots: `/run/media/<user>`, `/media/<user>`, `/mnt`.
- Detect Kobo via well-known markers (for example `.kobo/` directory).
- Return `InputSource` union (`kobo-device` or explicit `directory`).
- If auto-discovery fails, return actionable error (`No Kobo mount found; pass --input`).

### 2) `ingest/parse-annot.ts`

- Parse Kobo annotation XML into normalized records.
- Handle optional `<content><text>` as user notes.
- Normalize whitespace and preserve meaningful line breaks.
- Sort by date/progress for stable output.

### 3) `enrich/parse-epub.ts`

- Open `.epub` as ZIP.
- Read `META-INF/container.xml` -> OPF path.
- Parse OPF for title/author/spine/manifest.
- Parse nav/toc (`nav.xhtml` or `toc.ncx`) for chapter titles.
- Return a normalized chapter list.

### 4) `enrich/map-annotations-to-chapters.ts`

- Extract content path from annotation fragment start.
- Match path against chapter hrefs (normalized, URL-decoded).
- Provide best-effort mapping with graceful fallback (`Unknown chapter`).

### 5) `convert/render-markdown.ts`

- Render clean Obsidian markdown with deterministic formatting.
- Suggested template:
  - H1 book title.
  - Optional metadata/frontmatter (`source`, `author`, `convertedAt`).
  - Group by chapter with H2 headings.
  - Per annotation bullet/blockquote containing highlight + optional note.

### 6) `convert/build-export-plan.ts`

- Convert one enriched book into one or many output documents.
- Decide file paths:
  - `single`: `<Book Title>.md`
  - `by-chapter`: `<Book Title>/<NN - Chapter Title>.md`

### 7) `io/sanitize-path.ts` + `io/write-output.ts`

- Sanitize unsafe filename characters.
- Ensure directories exist.
- Write all files atomically enough for CLI use (mkdir + write).
- Return written paths for reporting and tests.

### 8) CLI layer (`cli/*`)

- Parse arguments and defaults.
- Interactive selection prompt when needed.
- Keep UI concerns out of domain modules.
- Convert raw arg strings into domain types via factories/guards.

## CLI Contract (proposed)

Keep the README behavior, but add non-interactive flags for automation and e2e.

```bash
bun run convert -- --output /path/to/vault
```

Additional flags:

- `--input <dir>` (optional; if omitted, auto-detect mounted Kobo on Linux)
- `--mode single|by-chapter` (default prompt or `single`)
- `--yes` (skip prompts)
- `--select-all` (convert all discovered books)
- `--book <pattern>` repeatable include filter

## Test Plan

### Unit tests (`test/unit`)

1. `parse-annot`:
   - Parses publication metadata.
   - Parses highlight text and optional note text.
   - Handles missing optional fields safely.
2. `parse-epub`:
   - Extracts title/author/chapter refs from fixture EPUB.
   - Supports nav.xhtml and toc.ncx fixture variants.
3. `map-annotations-to-chapters`:
   - Correctly maps known hrefs; unknown paths fall back.
4. `render-markdown`:
   - Snapshot or explicit string assertions for stable output.
5. `sanitize-path` + `write-output`:
   - Cross-platform-safe filenames and folder layout.
6. `discover-kobo-mount` + `resolve-input-source`:
   - Finds mounted Kobo path on Linux fixtures/mocks.
   - Prefers explicit `--input` when provided.
   - Fails clearly when no Kobo mount is found.
7. `run-conversion` (app-level unit/integration):
   - Pipeline works with mocked I/O boundaries.

### End-to-end harness (`scripts/e2e.ts`)

Purpose: let humans/agents run a real conversion and inspect generated markdown in a persistent, git-ignored sandbox.

- Output root: `.tmp/e2e-output/` (add to `.gitignore`).
- Behavior:
  1. Create run folder `.tmp/e2e-output/<timestamp>/`.
  2. Run converter in non-interactive mode against fixtures.
  3. Print the run directory and generated files.
  4. Keep files on disk for inspection.
- Easy run command:

```bash
bun run e2e
```

- Optional convenience flags:
  - `bun run e2e -- --mode by-chapter`
  - `bun run e2e -- --clean` (remove previous runs)

This is separate from unit tests: unit tests verify behavior; e2e harness verifies total output shape and readability.

## Package Scripts (planned)

```json
{
  "scripts": {
    "convert": "bun run src/cli/convert.ts",
    "test": "bun test",
    "e2e": "bun run scripts/e2e.ts",
    "check": "biome check --write && tsc --noEmit"
  }
}
```

## Rollout Plan

1. Define domain interfaces + `runConversion` contract.
2. Implement `parse-annot` + tests.
3. Implement markdown renderer + tests (without EPUB enrichment first).
4. Implement writer + path sanitizer + tests.
5. Implement Linux Kobo mount discovery + input source resolution.
6. Add CLI + interactive selection.
7. Add EPUB enrichment module + tests.
8. Add e2e harness script and `.tmp/e2e-output/` git-ignore.
9. Final pass: `bun test`, `bun check`, run `bun run e2e`, inspect output manually.

## Acceptance Criteria

- User can run conversion exactly as documented in README.
- Both output modes work and produce stable markdown.
- Metadata enrichment improves title/chapter naming when EPUB is present.
- Default input resolution auto-detects mounted Kobo on Linux.
- Unit tests cover core parsing/rendering logic.
- `bun run e2e` generates inspectable output under a git-ignored folder.
- Architecture remains modular, interface-first, and low-dependency.
