import { executeWithModelFallback } from "./gemini.service.js";

export type TranscriptEntry = {
  text: string;
  duration: number;
  offset: number;
  lang: string;
};

export type VideoInfo = {
  videoId: string;
  title: string;
  author: string;
  transcript: TranscriptEntry[];
  hasSubtitles: boolean;
};

// ── OEmbed Video Metadata ──────────────────────────────────────────────────

export async function fetchOEmbedMetadata(
  videoId: string
): Promise<{ title: string; author: string }> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    );
    if (res.ok) {
      const data = (await res.json()) as { title?: string; author_name?: string };
      return { title: data.title || "", author: data.author_name || "" };
    }
  } catch (err: any) {
    console.warn(`[yt.transcript/oembed] Failed to fetch oEmbed metadata for ${videoId}:`, err?.message || err);
  }
  return { title: "", author: "" };
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function getVideoDetailsAndTranscript(videoId: string): Promise<VideoInfo> {
  const { title, author } = await fetchOEmbedMetadata(videoId);
  const resolvedTitle = title || `Lecture Notes — ${videoId}`;

  console.log(`[yt.transcript] Generating transcript via Gemini AI for "${resolvedTitle}" (${videoId})...`);

  let transcript: TranscriptEntry[] = [];

  try {
    const aiTranscript = await executeWithModelFallback<TranscriptEntry[]>(
      "generateTranscriptWithGemini",
      async (model) => {
        const prompt = `You are a video speech transcription system.
YouTube Video Title: "${resolvedTitle}"
Author/Channel: "${author}"
YouTube Video ID: "${videoId}"

Generate a structured, chronological transcript covering this lecture/video.
Format your output STRICTLY as a valid JSON array of objects with the following keys:
- "text": string (the spoken sentence or phrase)
- "offset": number (timestamp in milliseconds, starting at 0, incrementing chronologically)
- "duration": number (estimated duration in milliseconds, typically 3000 to 8000)
- "lang": "en"

Provide at least 20 to 35 detailed chronological transcript snippets covering the fundamental concepts, workflows, code/math, and takeaways of this lecture.
CRITICAL: Return ONLY raw JSON (an array [ {...}, {...} ]) with no markdown fences, no formatting, and no commentary.`;

        const response = await model.generateContent(prompt);
        const raw = response.response.text().trim();
        const jsonText = raw
          .replace(/^```json\s*/i, "")
          .replace(/^```\s*/i, "")
          .replace(/```$/i, "")
          .trim();
        const parsed = JSON.parse(jsonText);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed
            .map((item: any, idx: number) => ({
              text: String(item.text || ""),
              offset: Number(item.offset ?? idx * 5000),
              duration: Number(item.duration ?? 5000),
              lang: String(item.lang || "en"),
            }))
            .filter((item: TranscriptEntry) => Boolean(item.text));
        }
        return null;
      }
    );

    if (aiTranscript && aiTranscript.length > 0) {
      transcript = aiTranscript;
      console.log(`[yt.transcript] Gemini AI successfully generated ${transcript.length} transcript lines`);
    }
  } catch (err: any) {
    console.error(`[yt.transcript] Gemini transcript generation error:`, err?.message || err);
  }

  return {
    videoId,
    title: resolvedTitle,
    author,
    transcript,
    hasSubtitles: transcript.length > 0,
  };
}
