import { fetchTranscript } from "youtube-transcript";
import type { TranscriptResponse } from "youtube-transcript";

export type TranscriptEntry = { text: string; duration: number; offset: number; lang: string };

export async function getTranscript(videoId: string): Promise<TranscriptEntry[]> {
  try {
    const transcript: TranscriptResponse[] = await fetchTranscript(videoId);
    if (transcript && transcript.length > 0) {
      return transcript.map((entry) => ({
        text: entry.text,
        duration: entry.duration,
        offset: entry.offset,
        lang: entry.lang ?? "en",
      }));
    }
  } catch (error) {
    try {
      const transcriptEn: TranscriptResponse[] = await fetchTranscript(videoId, { lang: "en" });
      if (transcriptEn && transcriptEn.length > 0) {
        return transcriptEn.map((entry) => ({
          text: entry.text,
          duration: entry.duration,
          offset: entry.offset,
          lang: entry.lang ?? "en",
        }));
      }
    } catch (e) {
      console.warn(`[getTranscript] Could not fetch transcript for ${videoId} (likely datacenter IP restriction or no CC):`, error);
    }
  }
  return [];
}