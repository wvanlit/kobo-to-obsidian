export const DEFAULT_AI_REFACTOR_MODEL = "openai/gpt-5.2";
export const DEFAULT_AI_REFACTOR_VARIANT = "medium";

export interface AiRefactorOptions {
	model: string;
	variant: string;
}
