import { executeWithModelFallback, FAST_LOW_COST_MODELS } from "./gemini.service.js";
import { buildTranscriptPrompt } from "../configs/prompts.js";

export type TranscriptEntry = {
  text: string;
  offset: number;
};

export async function getVideoDetailsAndTranscript(videoId: string): Promise<{
  videoId: string;
  title: string;
  author: string;
  transcript: TranscriptEntry[];
  hasSubtitles: boolean;
}> {
  return executeWithModelFallback(
    "getVideoDetailsAndTranscript",
    async (model) => {
    const prompt = buildTranscriptPrompt(videoId);

    const response = await model.generateContent(prompt);
    const raw = response.response.text().trim();
    const jsonText = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
    const data = JSON.parse(jsonText);

    const transcript: TranscriptEntry[] = Array.isArray(data?.transcript)
      ? data.transcript.map((item: any, idx: number) => ({
          text: String(item.text || ""),
          offset: Number(item.offset ?? idx * 30000),
        })).filter((e: TranscriptEntry) => Boolean(e.text))
      : [];

    return {
      videoId,
      title: data?.title || `Lecture Notes — ${videoId}`,
      author: data?.author || "",
      transcript,
      hasSubtitles: data?.hasSubtitles ?? transcript.length > 0,
    };
  }, FAST_LOW_COST_MODELS);
}
