import { stat } from "node:fs/promises";

import { InputResolutionError } from "../domain/errors";
import {
	asDirectoryPath,
	type InputSource,
	type KoboMountPath,
} from "../domain/shared";
import { discoverKoboMountLinux } from "./discover-kobo-mount";

export interface ResolveInputSourceOptions {
	explicitInputDir?: string;
	platform: NodeJS.Platform;
	discoverKoboMount?: () => Promise<KoboMountPath | undefined>;
}

export async function resolveInputSource(
	options: ResolveInputSourceOptions,
): Promise<InputSource> {
	if (options.explicitInputDir) {
		await assertDirectoryExists(options.explicitInputDir);
		return {
			kind: "directory",
			path: asDirectoryPath(options.explicitInputDir),
		};
	}

	if (options.platform === "linux") {
		const mountPath = await (
			options.discoverKoboMount ?? discoverKoboMountLinux
		)();
		if (!mountPath) {
			throw new InputResolutionError(
				"No Kobo mount found; pass --input <directory>",
			);
		}

		return { kind: "kobo-device", mountPath };
	}

	throw new InputResolutionError(
		"No input directory provided. Pass --input <directory> on this platform.",
	);
}

async function assertDirectoryExists(path: string): Promise<void> {
	const pathStat = await stat(path).catch(() => undefined);
	if (!pathStat || !pathStat.isDirectory()) {
		throw new InputResolutionError(`Input directory does not exist: ${path}`);
	}
}
