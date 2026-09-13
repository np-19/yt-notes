import { GoogleGenerativeAI } from "@google/generative-ai";
import { GeminiApiKey, GeminiModel } from "../configs/constants.js";
import { buildNotesPrompt, buildEditPrompt } from "../configs/prompts.js";
import { ExpressError } from "../utils/expressError.js";
import type { NoteSettings } from "../types/notes.js";
import type { TranscriptEntry } from "./yt.transcript.js";

const FAST_LOW_COST_MODELS = [
  GeminiModel || "gemini-3.6-flash",
  "gemini-3.6-flash",
  "gemini-flash-latest",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
].filter((m, idx, arr) => Boolean(m) && arr.indexOf(m) === idx);

const SYNTHESIS_MODELS = [
  GeminiModel || "gemini-3.6-flash",
  "gemini-3.6-flash",
  "gemini-flash-latest",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
].filter((m, idx, arr) => Boolean(m) && arr.indexOf(m) === idx);

function getGenAI() {
  if (!GeminiApiKey) throw new ExpressError("Gemini is not configured. Add GEMINI_API_KEY to backend/.env.", 503);
  return new GoogleGenerativeAI(GeminiApiKey);
}

export async function executeWithModelFallback<T>(
  actionName: string,
  fn: (model: any) => Promise<T | null | undefined>,
  candidates: string[] = SYNTHESIS_MODELS
): Promise<T> {
  const ai = getGenAI();
  let lastError: any = null;

  for (const modelName of candidates) {
    try {
      const model = ai.getGenerativeModel({ model: modelName });
      const result = await fn(model);
      if (result !== undefined && result !== null) return result;
    } catch (error: any) {
      lastError = error;
      console.warn(`[${actionName}] Model ${modelName} failed, trying fallback:`, error?.message || error);
    }
  }

  throw new ExpressError(`The AI service encountered an error (${actionName}): ${lastError?.message || "All models failed."}`, 502, lastError);
}

export { FAST_LOW_COST_MODELS };

export async function generateNotes(
  videoId: string,
  transcript: TranscriptEntry[],
  settings: NoteSettings & { videoTitle?: string | undefined; customPrompt?: string | undefined }
): Promise<string> {
  const prompt = buildNotesPrompt(videoId, transcript, settings);
  return executeWithModelFallback("generateNotes", async (model) => {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
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
  return executeWithModelFallback("generateNotesStream", async (model) => {
    const streamingResult = await model.generateContentStream(prompt);
    let fullText = "";
    for await (const chunk of streamingResult.stream) {
      const text = chunk.text();
      fullText += text;
      onChunk(text);
    }
    return fullText.trim().length > 0 ? fullText : null;
  });
}

export async function editNotes(markdown: string, instruction: string, selection?: string): Promise<string> {
  const prompt = buildEditPrompt(markdown, instruction, selection);

  return executeWithModelFallback("editNotes", async (model) => {
    const result = await model.generateContent(prompt);
    let text = result.response.text().trim();
    if (text.startsWith("```markdown")) {
      text = text.replace(/^```markdown\s*/i, "").replace(/```$/i, "").trim();
    } else if (text.startsWith("```")) {
      text = text.replace(/^```\w*\s*/i, "").replace(/```$/i, "").trim();
    }
    return text && text.length > 50 ? text : markdown;
  });
}
