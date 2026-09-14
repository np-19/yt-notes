import { GoogleGenAI } from "@google/genai";
import { GeminiApiKey, GeminiModel } from "../configs/constants.js";
import { buildNotesPrompt, buildEditPrompt } from "../configs/prompts.js";
import { ExpressError } from "../utils/expressError.js";
import type { NoteSettings, TranscriptEntry } from "../types/notes.js";

export const SUPPORTED_MODELS = [
  GeminiModel || "gemini-3.6-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-flash-latest",
].filter((m, idx, arr) => Boolean(m) && arr.indexOf(m) === idx);

function getGenAI(): GoogleGenAI {
  if (!GeminiApiKey) {
    throw new ExpressError("Gemini is not configured. Add GEMINI_API_KEY to backend/.env.", 503);
  }
  return new GoogleGenAI({ apiKey: GeminiApiKey });
}

export async function executeWithModelFallback<T>(
  actionName: string,
  fn: (ai: GoogleGenAI, modelName: string) => Promise<T | null | undefined>,
  candidates: string[] = SUPPORTED_MODELS
): Promise<T> {
  const ai = getGenAI();
  let lastError: any = null;

  for (const modelName of candidates) {
    try {
      const result = await fn(ai, modelName);
      if (result !== undefined && result !== null) return result;
    } catch (error: any) {
      lastError = error;
      console.warn(`[${actionName}] Model ${modelName} failed, trying fallback:`, error?.message || error);
    }
  }

  throw new ExpressError(
    `The AI service encountered an error (${actionName}): ${lastError?.message || "All models failed."}`,
    502,
    lastError
  );
}

export async function generateNotes(
  videoId: string,
  transcript: TranscriptEntry[],
  settings: NoteSettings & { videoTitle?: string | undefined; customPrompt?: string | undefined }
): Promise<string> {
  const prompt = buildNotesPrompt(videoId, transcript, settings);

  return executeWithModelFallback("generateNotes", async (ai, modelName) => {
    const result = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
    });
    const text = result.text;
    return text && text.trim().length > 0 ? text : null;
  });
}

export async function generateNotesStream(
  videoId: string,
  transcript: TranscriptEntry[],
  settings: NoteSettings & { videoTitle?: string | undefined; customPrompt?: string | undefined },
  onChunk: (chunkText: string) => void
): Promise<string> {
  const prompt = buildNotesPrompt(videoId, transcript, settings);

  return executeWithModelFallback("generateNotesStream", async (ai, modelName) => {
    const streamingResult = await ai.models.generateContentStream({
      model: modelName,
      contents: prompt,
    });
    let fullText = "";
    for await (const chunk of streamingResult) {
      const text = chunk.text || "";
      fullText += text;
      onChunk(text);
    }
    return fullText.trim().length > 0 ? fullText : null;
  });
}

export async function editNotes(
  markdown: string,
  instruction: string,
  selection?: string | string[]
): Promise<string> {
  const prompt = buildEditPrompt(markdown, instruction, selection);

  return executeWithModelFallback("editNotes", async (ai, modelName) => {
    const result = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction: `You are an expert technical note editor and markdown formatting repair specialist.
Your primary mandate is to output 100% syntactically valid Markdown, flawless KaTeX mathematics, and error-free Mermaid diagrams while strictly executing the user's edits.
- Only use LaTeX ($...$ or $$...$$) for true mathematical and Big-O notation.
- NEVER leave SQL queries, code, or API paths in LaTeX math delimiters.
- Double-quote every Mermaid node label containing parentheses, colons, or punctuation.
- Ensure all tables have valid header rows and code fences have language tags.
- Return the full updated document text only with no conversational wrapper.`,
        temperature: 0.15,
      },
    });
    let text = (result.text || "").trim();
    if (text.startsWith("```markdown")) {
      text = text.replace(/^```markdown\s*/i, "").replace(/```$/i, "").trim();
    } else if (text.startsWith("```")) {
      text = text.replace(/^```\w*\s*/i, "").replace(/```$/i, "").trim();
    }
    return text && text.length > 50 ? text : markdown;
  });
}
