import { opendir, stat } from "node:fs/promises";
import { join } from "node:path";

import { asKoboMountPath, type KoboMountPath } from "../domain/shared";

const KOBO_MARKER = ".kobo";

export interface DiscoverKoboMountOptions {
	searchRoots?: string[];
	user?: string;
}

export async function discoverKoboMountLinux(
	options: DiscoverKoboMountOptions = {},
): Promise<KoboMountPath | undefined> {
	const candidates = await getSearchRoots(options);

	for (const candidate of candidates) {
		if (await hasKoboMarker(candidate)) {
			return asKoboMountPath(candidate);
		}
	}

	return undefined;
}

async function getSearchRoots(
	options: DiscoverKoboMountOptions,
): Promise<string[]> {
	const roots: string[] = [];
	const user = options.user ?? process.env.USER;

	if (options.searchRoots && options.searchRoots.length > 0) {
		roots.push(...options.searchRoots);
	} else {
		if (user) {
			roots.push(`/run/media/${user}`);
			roots.push(`/media/${user}`);
		}

		roots.push("/mnt");
	}

	const mountedPaths: string[] = [];
	for (const root of roots) {
		try {
			const rootStat = await stat(root);
			if (!rootStat.isDirectory()) {
				continue;
			}

			for await (const dirent of await opendir(root)) {
				if (dirent.isDirectory()) {
					mountedPaths.push(join(root, dirent.name));
				}
			}
		} catch {}
	}

	return mountedPaths;
}

async function hasKoboMarker(path: string): Promise<boolean> {
	try {
		const markerStat = await stat(join(path, KOBO_MARKER));
		return markerStat.isDirectory();
	} catch {
		return false;
	}
}
