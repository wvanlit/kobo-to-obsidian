import { describe, expect, it } from "bun:test";
import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { InputResolutionError } from "../../../src/domain/errors";
import { discoverKoboMountLinux } from "../../../src/ingest/discover-kobo-mount";
import { resolveInputSource } from "../../../src/ingest/resolve-input-source";

describe("discoverKoboMountLinux", () => {
	it("finds mount path when marker exists", async () => {
		const root = await mkdtemp(join(tmpdir(), "kobo-root-"));
		const mountPath = join(root, "KOBOeReader");
		await mkdir(join(mountPath, ".kobo"), { recursive: true });

		const discovered = await discoverKoboMountLinux({ searchRoots: [root] });
		expect(String(discovered)).toBe(mountPath);
	});
});

describe("resolveInputSource", () => {
	it("prefers explicit input directory", async () => {
		const explicit = await mkdtemp(join(tmpdir(), "explicit-input-"));
		const result = await resolveInputSource({
			explicitInputDir: explicit,
			platform: "linux",
			discoverKoboMount: async () => "/ignored" as never,
		});

		expect(result.kind).toBe("directory");
		if (result.kind === "directory") {
			expect(String(result.path)).toBe(explicit);
		}
	});

	it("fails with clear error when no kobo mount is found", async () => {
		await expect(
			resolveInputSource({
				platform: "linux",
				discoverKoboMount: async () => undefined,
			}),
		).rejects.toThrow(InputResolutionError);
	});
});
