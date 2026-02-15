import { describe, expect, it } from "bun:test";

import { parseArgs } from "../../../src/cli/parse-args";
import {
	DEFAULT_AI_REFACTOR_MODEL,
	DEFAULT_AI_REFACTOR_VARIANT,
} from "../../../src/refactor/ai-refactor-config";

describe("parseArgs", () => {
	it("does not enable ai refactor by default", () => {
		const args = parseArgs(["--output", "/tmp/out"]);

		expect(args.aiRefactor).toBeUndefined();
	});

	it("enables ai refactor with the default model", () => {
		const args = parseArgs(["--output", "/tmp/out", "--ai-refactor"]);

		expect(args.aiRefactor).toEqual({
			model: DEFAULT_AI_REFACTOR_MODEL,
			variant: DEFAULT_AI_REFACTOR_VARIANT,
		});
	});

	it("accepts a custom ai refactor model with explicit variant", () => {
		const args = parseArgs([
			"--output",
			"/tmp/out",
			"--ai-refactor",
			"openai/gpt-5.2/high",
		]);

		expect(args.aiRefactor).toEqual({
			model: "openai/gpt-5.2",
			variant: "high",
		});
	});

	it("uses default variant when custom model omits variant", () => {
		const args = parseArgs([
			"--output",
			"/tmp/out",
			"--ai-refactor",
			"openai/gpt-5.2",
		]);

		expect(args.aiRefactor).toEqual({
			model: "openai/gpt-5.2",
			variant: DEFAULT_AI_REFACTOR_VARIANT,
		});
	});

	it("fails when ai-refactor-model is provided without ai-refactor", () => {
		expect(() =>
			parseArgs([
				"--output",
				"/tmp/out",
				"--ai-refactor-model",
				"openai/gpt-5.2",
			]),
		).toThrow("--ai-refactor-model requires --ai-refactor");
	});

	it("fails when ai-refactor-model does not receive a value", () => {
		expect(() =>
			parseArgs(["--output", "/tmp/out", "--ai-refactor-model"]),
		).toThrow(
			"Missing required argument: --ai-refactor-model <provider/model[/variant]>",
		);
	});

	it("fails when ai-refactor-model has invalid format", () => {
		expect(() =>
			parseArgs([
				"--output",
				"/tmp/out",
				"--ai-refactor",
				"openai/gpt-5.2/high/extra",
			]),
		).toThrow(
			"Invalid --ai-refactor-model value, expected <provider/model[/variant]>",
		);
	});

	it("accepts misspelled ai-refacotr alias with model and variant", () => {
		const args = parseArgs([
			"--output",
			"/tmp/out",
			"--ai-refacotr",
			"openai/gpt-5.2/low",
		]);

		expect(args.aiRefactor).toEqual({
			model: "openai/gpt-5.2",
			variant: "low",
		});
	});
});
