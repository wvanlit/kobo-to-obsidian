# CLI Experience Redesign Plan

## Goal

Deliver a better CLI UX for converting Kobo annotations to Obsidian markdown, while keeping the implementation pragmatic (80/20), modular, and testable.

## Current Pain Points

- `--help` is not implemented and currently errors because `--output` is required.
- Argument parsing is hand-rolled, making validation and discoverability weak.
- Interactive selection UX is basic (number parsing only, no searchable multiselect).
- Errors are stack-heavy by default and not user-friendly.
- No preflight summary before conversion starts.

## Library Choice

Recommended stack:

- `commander` for command/option parsing, help text, and validation.
- `@clack/prompts` for interactive prompts, multiselect, and spinners.

Rationale:

- Improves UX immediately with minimal custom code.
- Keeps architecture simple and modular.
- Works well with Bun and TypeScript.

## CLI Shape

Commands:

- `convert` (default): run conversion flow.
- `list-books`: discover and print selectable books without writing files.

Flags (preserve + extend):

- Existing: `--input`, `--output`, `--mode`, `--yes`, `--select-all`, `--book`, `--ai-refactor`, `--ai-refactor-model`, `--ai-refacotr` alias.
- New: `--dry-run`, `--verbose`, `--no-color`, `--fail-on-warning`.

## UX Flow (convert)

1. Parse and validate CLI args with helpful errors.
2. Resolve input source and display what was detected.
3. If interactive and no book filters: show searchable multiselect book picker.
4. Show preflight summary:
   - input source
   - output directory
   - mode
   - books selected
   - AI refactor config (if enabled)
5. Execute conversion with task/spinner phases:
   - discover
   - parse
   - enrich
   - render/refactor
   - write
6. Print success summary with counts and warnings.

## Module Interfaces First

Define these interfaces before implementation details:

- `src/cli/command-spec.ts`
  - Declarative command + option spec.
- `src/cli/parse-cli.ts`
  - `parseCli(argv): CliRequest`
  - Maps parsed CLI input to typed app requests.
- `src/cli/ui.ts`
  - `info`, `warn`, `error`, `success`
  - `selectBooks(books)`
  - `confirmPreflight(summary)`
  - `withTask(name, fn)`
- `src/cli/run-cli.ts`
  - Orchestrates parse -> prompt -> runConversion -> report.

Core conversion stays in deep modules under `src/app` and related domains.

## TDD Rollout

1. Add parser/help/version tests for new CLI entry behavior.
2. Add tests for command mapping (`CliRequest`) including backward-compatible flags.
3. Add tests for interactive branching (mock UI layer).
4. Add tests for output/report behavior with warnings and failures.
5. Confirm existing conversion tests still pass.

## Implementation Phases

### Phase 1: Parsing and Help

- Introduce `commander`.
- Implement proper `--help`, `--version`, and validation.
- Preserve current flag semantics.

### Phase 2: Interactive UX

- Replace manual readline prompts with `@clack/prompts`.
- Add searchable multiselect and cancellation handling.
- Add preflight summary confirmation.

### Phase 3: Additional Command

- Implement `list-books` command to preview title/path selection targets.

### Phase 4: Polish

- Add `--dry-run`, `--verbose`, `--no-color`, `--fail-on-warning`.
- Improve error messages and exit codes.
- Update `README.md` usage docs.

## Acceptance Criteria

- `bun run convert -- --help` prints clear usage and exits successfully.
- Existing common invocation still works.
- Interactive mode supports robust multiselect and cancel flow.
- Non-interactive mode remains deterministic for automation.
- New command `list-books` works against fixture and real inputs.
- `bun test` and `bun check` pass.
