export class ConversionError extends Error {
	constructor(message: string, options?: { cause?: unknown }) {
		super(message, options);
		this.name = "ConversionError";
	}
}

export class InputResolutionError extends ConversionError {
	constructor(message: string, options?: { cause?: unknown }) {
		super(message, options);
		this.name = "InputResolutionError";
	}
}

export class ParseAnnotError extends ConversionError {
	constructor(message: string, options?: { cause?: unknown }) {
		super(message, options);
		this.name = "ParseAnnotError";
	}
}

export class ParseEpubError extends ConversionError {
	constructor(message: string, options?: { cause?: unknown }) {
		super(message, options);
		this.name = "ParseEpubError";
	}
}

export class ValidationError extends ConversionError {
	constructor(message: string, options?: { cause?: unknown }) {
		super(message, options);
		this.name = "ValidationError";
	}
}
