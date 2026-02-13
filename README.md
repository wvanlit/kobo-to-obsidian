# Kobo to Obsidian Markdown Converter

A Bun-first CLI to convert Kobo annotations and notes into Markdown suitable for Obsidian.

## Usage

1) Run the conversion command:

```
bun run convert -- --output /path/to/obsidian/vault
```

2) If `--input` is omitted on Linux, the tool tries to auto-detect a mounted Kobo device.

3) Use optional flags for non-interactive automation:

```
--input <dir>
--mode single|by-chapter
--yes
--select-all
--book <pattern>
```

## End-to-End Harness

Run a fixture conversion and inspect generated output:

```
bun run e2e
```

Output is written to `.tmp/e2e-output/<timestamp>/`.

## Features

1) Conversion to Markdown format compatible with Obsidian.
2) Diverse output options
  - A single `.md` file for the entire book
  - A `.md` file per chapter inside a folder named after the book
3) Data enrichment from the actual e-book file, such as:
   - Book title
   - Chapter titles
4) Linux Kobo mount auto-discovery with explicit `--input` override.
