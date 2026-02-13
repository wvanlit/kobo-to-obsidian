import { describe, expect, it } from "bun:test";

import { parseArgs } from "../../../src/cli/parse-args";
import { DEFAULT_AI_REFACTOR_MODEL } from "../../../src/refactor/ai-refactor-config";

describe("parseArgs", () => {
	it("does not enable ai refactor by default", () => {
		const args = parseArgs(["--output", "/tmp/out"]);

		expect(args.aiRefactor).toBeUndefined();
	});

	it("enables ai refactor with the default model", () => {
		const args = parseArgs(["--output", "/tmp/out", "--ai-refactor"]);

		expect(args.aiRefactor).toEqual({
			model: DEFAULT_AI_REFACTOR_MODEL,
		});
	});

	it("accepts a custom ai refactor model", () => {
		const args = parseArgs([
			"--output",
			"/tmp/out",
			"--ai-refactor",
			"--ai-refactor-model",
			"openai/gpt-5.1-codex-mini",
		]);

		expect(args.aiRefactor).toEqual({
			model: "openai/gpt-5.1-codex-mini",
		});
	});

	it("fails when ai-refactor-model is provided without ai-refactor", () => {
		expect(() =>
			parseArgs([
				"--output",
				"/tmp/out",
				"--ai-refactor-model",
				"openai/gpt-5.1-codex-mini",
			]),
		).toThrow("--ai-refactor-model requires --ai-refactor");
	});

	it("fails when ai-refactor-model does not receive a value", () => {
		expect(() =>
			parseArgs(["--output", "/tmp/out", "--ai-refactor-model"]),
		).toThrow(
			"Missing required argument: --ai-refactor-model <provider/model>",
		);
	});
});
