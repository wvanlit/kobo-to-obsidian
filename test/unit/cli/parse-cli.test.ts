import { describe, expect, it } from "bun:test";
import { parseCli } from "../../../src/cli/parse-cli";
import {
	DEFAULT_AI_REFACTOR_MODEL,
	DEFAULT_AI_REFACTOR_VARIANT,
} from "../../../src/refactor/ai-refactor-config";

describe("parseCli", () => {
	describe("convert command", () => {
		it("parses minimal convert command with required output", () => {
			const result = parseCli(["convert", "--output", "/tmp/out"]);

			expect(result).toMatchObject({
				command: "convert",
				output: "/tmp/out",
				mode: "single",
				interactive: true,
				selectAll: false,
				bookFilters: [],
			});
			expect(result.command).toBe("convert");
		});

		it("parses convert as default command when omitted", () => {
			const result = parseCli(["--output", "/tmp/out"]);

			expect(result.command).toBe("convert");
		});

		it("parses input option", () => {
			const result = parseCli([
				"convert",
				"--input",
				"/mnt/kobo",
				"--output",
				"/tmp/out",
			]);

			if (result.command !== "convert") throw new Error("Expected convert");
			expect(result.input).toBe("/mnt/kobo");
		});

		it("parses mode option", () => {
			const result = parseCli([
				"convert",
				"--output",
				"/tmp/out",
				"--mode",
				"by-chapter",
			]);

			if (result.command !== "convert") throw new Error("Expected convert");
			expect(result.mode).toBe("by-chapter");
		});

		it("fails with invalid mode", () => {
			expect(() =>
				parseCli(["convert", "--output", "/tmp/out", "--mode", "invalid"]),
			).toThrow("Invalid --mode value: invalid");
		});

		it("parses --yes flag for non-interactive mode", () => {
			const result = parseCli(["convert", "--output", "/tmp/out", "--yes"]);

			if (result.command !== "convert") throw new Error("Expected convert");
			expect(result.interactive).toBe(false);
		});

		it("parses --select-all flag", () => {
			const result = parseCli([
				"convert",
				"--output",
				"/tmp/out",
				"--select-all",
			]);

			if (result.command !== "convert") throw new Error("Expected convert");
			expect(result.selectAll).toBe(true);
		});

		it("parses multiple --book filters", () => {
			const result = parseCli([
				"convert",
				"--output",
				"/tmp/out",
				"--book",
				"atomic",
				"--book",
				"habits",
			]);

			if (result.command !== "convert") throw new Error("Expected convert");
			expect(result.bookFilters).toEqual(["atomic", "habits"]);
		});

		it("enables ai refactor with default model", () => {
			const result = parseCli([
				"convert",
				"--output",
				"/tmp/out",
				"--ai-refactor",
			]);

			if (result.command !== "convert") throw new Error("Expected convert");
			expect(result.aiRefactor).toEqual({
				model: DEFAULT_AI_REFACTOR_MODEL,
				variant: DEFAULT_AI_REFACTOR_VARIANT,
			});
		});

		it("accepts custom ai refactor model inline", () => {
			const result = parseCli([
				"convert",
				"--output",
				"/tmp/out",
				"--ai-refactor",
				"openai/gpt-5.2/high",
			]);

			if (result.command !== "convert") throw new Error("Expected convert");
			expect(result.aiRefactor).toEqual({
				model: "openai/gpt-5.2",
				variant: "high",
			});
		});

		it("accepts custom ai refactor model with --ai-refactor-model", () => {
			const result = parseCli([
				"convert",
				"--output",
				"/tmp/out",
				"--ai-refactor",
				"--ai-refactor-model",
				"openai/gpt-5.2/low",
			]);

			if (result.command !== "convert") throw new Error("Expected convert");
			expect(result.aiRefactor).toEqual({
				model: "openai/gpt-5.2",
				variant: "low",
			});
		});

		it("uses default variant when custom model omits variant", () => {
			const result = parseCli([
				"convert",
				"--output",
				"/tmp/out",
				"--ai-refactor",
				"openai/gpt-5.2",
			]);

			if (result.command !== "convert") throw new Error("Expected convert");
			expect(result.aiRefactor).toEqual({
				model: "openai/gpt-5.2",
				variant: DEFAULT_AI_REFACTOR_VARIANT,
			});
		});

		it("accepts --ai-refacotr alias for ai-refactor", () => {
			const result = parseCli([
				"convert",
				"--output",
				"/tmp/out",
				"--ai-refacotr",
				"openai/gpt-5.2/low",
			]);

			if (result.command !== "convert") throw new Error("Expected convert");
			expect(result.aiRefactor).toEqual({
				model: "openai/gpt-5.2",
				variant: "low",
			});
		});

		it("fails when ai-refactor-model is provided without ai-refactor", () => {
			expect(() =>
				parseCli([
					"convert",
					"--output",
					"/tmp/out",
					"--ai-refactor-model",
					"openai/gpt-5.2",
				]),
			).toThrow("--ai-refactor-model requires --ai-refactor");
		});

		it("fails when ai-refactor-model has invalid format", () => {
			expect(() =>
				parseCli([
					"convert",
					"--output",
					"/tmp/out",
					"--ai-refactor",
					"openai/gpt-5.2/high/extra",
				]),
			).toThrow("Invalid --ai-refactor-model value");
		});

		it("fails when output is missing", () => {
			expect(() => parseCli(["convert"])).toThrow(
				"Missing required option: --output",
			);
		});

		it("parses --dry-run flag", () => {
			const result = parseCli(["convert", "--output", "/tmp/out", "--dry-run"]);

			if (result.command !== "convert") throw new Error("Expected convert");
			expect(result.dryRun).toBe(true);
		});

		it("parses --verbose flag", () => {
			const result = parseCli(["convert", "--output", "/tmp/out", "--verbose"]);

			if (result.command !== "convert") throw new Error("Expected convert");
			expect(result.verbose).toBe(true);
		});

		it("parses --no-color flag", () => {
			const result = parseCli([
				"convert",
				"--output",
				"/tmp/out",
				"--no-color",
			]);

			if (result.command !== "convert") throw new Error("Expected convert");
			expect(result.noColor).toBe(true);
		});

		it("parses --fail-on-warning flag", () => {
			const result = parseCli([
				"convert",
				"--output",
				"/tmp/out",
				"--fail-on-warning",
			]);

			if (result.command !== "convert") throw new Error("Expected convert");
			expect(result.failOnWarning).toBe(true);
		});
	});

	describe("list-books command", () => {
		it("parses list-books command", () => {
			const result = parseCli(["list-books"]);

			expect(result).toMatchObject({
				command: "list-books",
			});
		});

		it("parses list-books with input", () => {
			const result = parseCli(["list-books", "--input", "/mnt/kobo"]);

			expect(result).toMatchObject({
				command: "list-books",
				input: "/mnt/kobo",
			});
		});

		it("parses list-books with verbose", () => {
			const result = parseCli(["list-books", "--verbose"]);

			if (result.command !== "list-books")
				throw new Error("Expected list-books");
			expect(result.verbose).toBe(true);
		});

		it("parses list-books with no-color", () => {
			const result = parseCli(["list-books", "--no-color"]);

			if (result.command !== "list-books")
				throw new Error("Expected list-books");
			expect(result.noColor).toBe(true);
		});
	});
});
