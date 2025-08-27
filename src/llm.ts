/**
 * Contains all the code for calling LLMS
 */
import OpenAI from "openai";
import type {
  EpubTableOfContents,
  Publication,
  Annotation,
} from "./extraction";

const MODEL = "gpt-5-mini";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ProcessedNotes {
  notes: string;
}

/**
 * Process a single chapter worth of annotations with the LLM.
 * Returns a markdown section starting with "## {chapterTitle}" and bullet points below.
 * No YAML frontmatter, no extra commentary.
 */
export async function processChapterNotesWithLLM(
  publication: Publication,
  chapterTitle: string,
  annotations: Annotation[]
): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }

  const annotationsText = annotations
    .map((annotation, index) => `${index + 1}. "${annotation.text}"`)
    .join("\n\n");

  const systemPrompt = `You are a highly skilled note processor. Your task is to process ONLY the annotations for a single chapter into clean, well-structured Obsidian markdown.

IMPORTANT:
- Return ONLY the notes for this one chapter.
- Start with a chapter heading in the form: ## ${chapterTitle}
- Then provide bullet points for key insights (use sub-bullets when helpful).
- Do NOT include YAML frontmatter.
- Do NOT include any other text, explanations, or commentary.
- Do NOT include notes for any other chapter.`;

  const userPrompt = `Book: "${publication.title}" by ${publication.creator}
Current Chapter: ${chapterTitle}

Raw Annotations for this Chapter:
${annotationsText}

Process THESE annotations into organized notes for this chapter only.`;

  const approxTokens = Math.max(256, Math.round(annotationsText.length * 0.33));
  console.log(
    `Calling OpenAI for chapter "${chapterTitle}" with ${annotationsText.length} chars, max tokens: ${approxTokens}`
  );

  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      reasoning_effort: "low",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_completion_tokens: approxTokens,
    });

    const processed = completion.choices[0]?.message?.content?.trim();
    if (!processed) {
      throw new Error("No response received from OpenAI for chapter");
    }
    return processed;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Failed to process chapter with OpenAI: ${error.message}`
      );
    }
    throw new Error("An unknown error occurred while processing chapter notes");
  }
}

export async function processNotesWithLLM(
  publication: Publication,
  toc: EpubTableOfContents,
  annotations: Annotation[]
): Promise<ProcessedNotes> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }

  const tocText = toc.map((chapter) => `- ${chapter.chapter}`).join("\n");

  const annotationsText = annotations
    .map((annotation, index) => `${index + 1}. "${annotation.text}"`)
    .join("\n\n");

  const systemPrompt = `You are a highly skilled note processor. Your task is to organize and process book annotations into coherent, well-structured notes that will go into Obsidian.

IMPORTANT: You must ONLY return the processed notes in Obsidian markdown format. Do not include any other text, explanations, or commentary. Return ONLY the notes themselves.

Your goal is to:
1. Sort the annotations into their appropriate chapters based on the table of contents
2. Transform the raw highlights into cohesive bullet points
3. Group related concepts together
4. Remove redundancy and improve clarity
5. Maintain the original meaning and insights

Format the output as markdown with:
- Chapter headings (## Chapter Name)
- Bullet points for key insights
- Sub-bullets for supporting details where appropriate

Include a YAML frontmatter block at the top of the file, before any other content, with the following structure:
\`\`\`
---
tags:
  - book
author:
  - ${publication.creator}
---
\`\`\`

Split author names into a list if there are multiple authors.

Return ONLY the processed note. No introduction, no conclusion, no meta-commentary.`;

  const userPrompt = `Book: "${publication.title}" by ${publication.creator}

Table of Contents:
${tocText}

Raw Annotations to Process:
${annotationsText}

Process these annotations into organized, coherent notes following the chapter structure.`;

  const max_tokens = Math.round(annotationsText.length * 0.33) + 500;

  console.log(
    `Calling OpenAI with ${annotationsText.length} characters of annotations, max tokens: ${max_tokens}`
  );

  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      reasoning_effort: "low",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      max_completion_tokens: Math.round(annotationsText.length * 0.33),
    });

    const processedNotes = completion.choices[0]?.message?.content;

    if (!processedNotes) {
      throw new Error("No response received from OpenAI");
    }

    return {
      notes: processedNotes.trim(),
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to process notes with OpenAI: ${error.message}`);
    }
    throw new Error("An unknown error occurred while processing notes");
  }
}
