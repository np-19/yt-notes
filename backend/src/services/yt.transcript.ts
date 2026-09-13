import { executeWithModelFallback, FAST_LOW_COST_MODELS } from "./gemini.service.js";

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
  return executeWithModelFallback(
    "getVideoDetailsAndTranscript",
    async (model) => {
    const prompt = `You are a YouTube video transcription and metadata extraction engine.
YouTube Video ID: "${videoId}"

Tasks:
1. Determine the exact Title and Channel/Author name for this video ID.
2. Extract or generate the COMPLETE, FULL transcript of the entire video from start to finish.

Transcript Rules (follow in order of priority):
- If official subtitles/closed captions exist for this video, return them VERBATIM and IN FULL. Do NOT summarize, paraphrase, condense, or skip any part. Include every single subtitle entry exactly as it appears.
- If no subtitles/captions exist, transcribe the entire video yourself word-for-word from beginning to end. Capture every spoken word, pause, and segment. Do NOT skip, summarize, or abbreviate any section.
- The transcript MUST cover the ENTIRE duration of the video — from the very first second to the very last. Do NOT truncate or stop early.
- Each segment should be roughly 5-15 seconds of speech. Prefer more, shorter segments over fewer, longer ones for precision.
- There is NO limit on the number of transcript segments. A 10-minute video should have at minimum 40-120 segments. A 1-hour video should have hundreds.

Format your output STRICTLY as valid JSON with no markdown wrapping:
{
  "title": "string (exact video title)",
  "author": "string (exact channel name)",
  "hasSubtitles": true/false (whether official subtitles were available),
  "transcript": [
    { "text": "string (spoken text)", "offset": 0, "duration": 5000, "lang": "en" }
  ]
}

- "offset" is in milliseconds from video start.
- "duration" is the length of the segment in milliseconds.
- "lang" is the ISO 639-1 language code.
- Output ONLY raw JSON. No explanations, no markdown fences, no extra text.`;

    const response = await model.generateContent(prompt);
    const raw = response.response.text().trim();
    const jsonText = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
    const data = JSON.parse(jsonText);

    const transcript: TranscriptEntry[] = Array.isArray(data?.transcript)
      ? data.transcript.map((item: any, idx: number) => ({
          text: String(item.text || ""),
          offset: Number(item.offset ?? idx * 5000),
          duration: Number(item.duration ?? 5000),
          lang: String(item.lang || "en"),
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
