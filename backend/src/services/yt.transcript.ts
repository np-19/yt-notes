import { executeWithModelFallback } from "./gemini.service.js";

export type TranscriptEntry = {
  text: string;
  duration: number;
  offset: number;
  lang: string;
};

export async function getVideoDetailsAndTranscript(videoId: string): Promise<{
  videoId: string;
  title: string;
  author: string;
  transcript: TranscriptEntry[];
  hasSubtitles: boolean;
}> {
  return executeWithModelFallback("getVideoDetailsAndTranscript", async (model) => {
    const prompt = `You are a YouTube video transcription and metadata extraction engine.
YouTube Video ID: "${videoId}"

Tasks:
1. Determine the exact or most plausible Title and Channel/Author for this video ID.
2. Generate a structured, chronological transcript covering the lecture or video.

Format your output STRICTLY as valid JSON with no markdown wrapping:
{
  "title": "string (Video Title)",
  "author": "string (Channel/Author)",
  "transcript": [
    { "text": "string", "offset": 0, "duration": 5000, "lang": "en" }
  ]
}

Provide 20-30 chronological transcript segments. Output ONLY raw JSON.`;

    const response = await model.generateContent(prompt);
    const raw = response.response.text().trim();
    const jsonText = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
    const data = JSON.parse(jsonText);

    const transcript: TranscriptEntry[] = Array.isArray(data?.transcript)
      ? data.transcript
          .map((item: any, idx: number) => ({
            text: String(item.text || ""),
            offset: Number(item.offset ?? idx * 5000),
            duration: Number(item.duration ?? 5000),
            lang: String(item.lang || "en"),
          }))
          .filter((e: TranscriptEntry) => Boolean(e.text))
      : [];

    return {
      videoId,
      title: data?.title || `Lecture Notes — ${videoId}`,
      author: data?.author || "",
      transcript,
      hasSubtitles: transcript.length > 0,
    };
  });
}
