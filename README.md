# Kobo to Obsidian Markdown Converter

A Bun-first CLI to convert Kobo annotations and notes into Markdown suitable for Obsidian.

## Usage

### Quick Start

Run the conversion in interactive mode:

```bash
bun run convert -- --output /path/to/obsidian/vault
```

The CLI will:
- Auto-detect your Kobo device (Linux) or prompt for an input directory
- Let you select which books to convert using a searchable multiselect
- Show a preflight summary before conversion
- Display progress with spinners
- Report results with warnings

### Commands

#### `convert` (default)

Convert Kobo annotations to Obsidian markdown.

```bash
# Interactive mode (default)
bun run convert -- --output /path/to/vault

# Non-interactive mode
bun run convert -- --input .examples --output /tmp/out --yes --select-all

# Filter specific books by title or path
bun run convert -- --output /tmp/out --book "pragmatic" --book "staff engineer" --yes

# Convert with AI refactoring
bun run convert -- --output /tmp/out --ai-refactor openai/gpt-5.2/high --yes
```

**Options:**

- `--input <directory>` - Input directory or Kobo mount path (auto-detected on Linux)
- `--output <directory>` - Output directory for generated markdown files (required)
- `--mode <mode>` - Output mode: `single` or `by-chapter` (default: `single`)
- `--yes` - Skip interactive prompts
- `--select-all` - Select all books without prompting
- `--book <filter>` - Filter books by title or path (repeatable)
- `--ai-refactor [model]` - Enable AI refactoring with optional model
- `--ai-refacotr [model]` - Alias for `--ai-refactor` (common typo)
- `--ai-refactor-model <model>` - AI model in format: `provider/model[/variant]`
- `--dry-run` - Preview changes without writing files
- `--verbose` - Enable verbose output
- `--no-color` - Disable colored output
- `--fail-on-warning` - Exit with error code if warnings occur

#### `list-books`

List all available books without converting.

```bash
bun run convert -- list-books --input .examples --verbose
```

**Options:**

- `--input <directory>` - Input directory or Kobo mount path
- `--verbose` - Enable verbose output
- `--no-color` - Disable colored output

### AI Refactoring

When `--ai-refactor` is enabled, generated Markdown is refined per output file via your local `opencode` CLI.

- Default model: `openai/gpt-5.2`
- Default variant: `medium`

Specify a custom model:

```bash
bun run convert -- --output /tmp/out --ai-refactor openai/gpt-4o/high --yes
```

### Help

View help for any command:

```bash
bun run convert -- --help
bun run convert -- convert --help
bun run convert -- list-books --help
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
