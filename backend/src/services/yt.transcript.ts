import { executeWithModelFallback, SUPPORTED_MODELS } from "./gemini.service.js";
import { buildTranscriptPrompt } from "../configs/prompts.js";

export type TranscriptEntry = {
  text: string;
  offset: number;
};

export interface VideoDetailsResult {
  videoId: string;
  title: string;
  author: string;
  transcript: TranscriptEntry[];
  hasSubtitles: boolean;
}

/**
 * Fetch public video metadata using YouTube's oEmbed endpoint
 */
export async function fetchOEmbedDetails(videoId: string): Promise<{ title?: string | undefined; author?: string | undefined }> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&format=json`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        signal: AbortSignal.timeout(5000),
      }
    );

    if (res.ok) {
      const data = (await res.json()) as { title?: string; author_name?: string };
      return {
        title: data.title?.trim() || undefined,
        author: data.author_name?.trim() || undefined,
      };
    }
  } catch (err) {
    console.warn(`[oEmbed] Failed to fetch oembed metadata for ${videoId}:`, err instanceof Error ? err.message : err);
  }
  return {};
}

/**
 * Extract full transcript and details using Gemini text-based synthesis and oEmbed metadata
 */
export async function getVideoDetailsAndTranscript(videoId: string): Promise<VideoDetailsResult> {
  const oembed = await fetchOEmbedDetails(videoId);

  return executeWithModelFallback(
    "getVideoDetailsAndTranscript",
    async (ai, modelName) => {
      const prompt = buildTranscriptPrompt(videoId, oembed.title, oembed.author);

      // Prompt Gemini directly without multimodal video file attachment
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
      });

      const raw = (response.text || "").trim();
      const jsonText = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
      const data = JSON.parse(jsonText);

      const transcript: TranscriptEntry[] = Array.isArray(data?.transcript)
        ? data.transcript
            .map((item: any, idx: number) => ({
              text: String(item.text || ""),
              offset: Number(item.offset ?? idx * 30000),
            }))
            .filter((e: TranscriptEntry) => Boolean(e.text))
        : [];

      return {
        videoId,
        title: oembed.title || data?.title || `Lecture Notes — ${videoId}`,
        author: oembed.author || data?.author || "",
        transcript,
        hasSubtitles: data?.hasSubtitles ?? transcript.length > 0,
      };
    },
    SUPPORTED_MODELS
  );
}



