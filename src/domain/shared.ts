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
export type ProgressRatio = Brand<number, "ProgressRatio">;

export type OutputMode = "single" | "by-chapter";
export type AnnotationColor = 0 | 1 | 2 | 3 | 4;

export type InputSource =
	| { kind: "kobo-device"; mountPath: KoboMountPath }
	| { kind: "directory"; path: DirectoryPath };

export const asFilePath = (value: string): FilePath => value as FilePath;
export const asDirectoryPath = (value: string): DirectoryPath =>
	value as DirectoryPath;
export const asAnnotFilePath = (value: string): AnnotFilePath =>
	value as AnnotFilePath;
export const asEpubFilePath = (value: string): EpubFilePath =>
	value as EpubFilePath;
export const asKoboMountPath = (value: string): KoboMountPath =>
	value as KoboMountPath;
export const asBookId = (value: string): BookId => value as BookId;
export const asAnnotationId = (value: string): AnnotationId =>
	value as AnnotationId;
export const asChapterId = (value: string): ChapterId => value as ChapterId;

export function asProgressRatio(value: number): ProgressRatio {
	if (!Number.isFinite(value) || value < 0 || value > 1) {
		throw new Error(
			`Progress ratio must be between 0 and 1. Received: ${value}`,
		);
	}

	return value as ProgressRatio;
}

export function asIsoUtcDate(value: string): IsoUtcDate {
	const asDate = new Date(value);
	if (Number.isNaN(asDate.getTime())) {
		throw new Error(`Invalid ISO date: ${value}`);
	}

	return asDate.toISOString() as IsoUtcDate;
}
