import {fetchTranscript} from "youtube-transcript";
import type {TranscriptResponse} from "youtube-transcript";
import { ExpressError } from "../utils/expressError.js";

export type TranscriptEntry = { text: string; duration: number; offset: number; lang: string };

export async function getTranscript(videoId: string): Promise<TranscriptEntry[]> {
  try {
    const transcript : TranscriptResponse[] = await fetchTranscript(videoId);
    return transcript.map((entry) => ({ text: entry.text, duration: entry.duration, offset: entry.offset, lang: entry.lang ?? "und" }));
  } catch (error) {
    throw new ExpressError("A transcript is not available for this video.", 422, error);
  }
}