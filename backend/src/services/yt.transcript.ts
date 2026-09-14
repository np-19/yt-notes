import { YouTubeTranscriptApiKeys } from "../configs/constants.js";
import { ExpressError } from "../utils/expressError.js";

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

let keyIndex = 0;

/**
 * Execute request across configured API tokens with round-robin rotation and failover.
 */
async function executeWithTokenRotation<T>(fn: (token: string) => Promise<T>): Promise<T> {
  const keys = YouTubeTranscriptApiKeys;
  if (keys.length === 0) {
    throw new ExpressError(
      "YouTube Transcript API key not configured. Please add YOUTUBE_TRANSCRIPT_API_KEYS to backend/.env.",
      503
    );
  }

  let lastError: any = null;
  const start = keyIndex;

  for (let i = 0; i < keys.length; i++) {
    const idx = (start + i) % keys.length;
    const token = keys[idx];
    if (!token) continue;

    try {
      const result = await fn(token);
      keyIndex = (idx + 1) % keys.length;
      return result;
    } catch (err: any) {
      lastError = err;
      console.warn(`[TranscriptAPI] Token #${idx + 1}/${keys.length} error (${err?.message || err}). Trying next...`);
    }
  }

  throw new ExpressError(
    `Failed to fetch transcript from youtube-transcript.io: ${lastError?.message || "All API tokens failed or exhausted."}`,
    lastError?.status || 502,
    lastError
  );
}

/**
 * Fetch video metadata via YouTube oEmbed
 */
export async function fetchOEmbedDetails(
  videoId: string
): Promise<{ title?: string | undefined; author?: string | undefined }> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&format=json`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (res.ok) {
      const data = (await res.json()) as { title?: string; author_name?: string };
      return { title: data.title?.trim(), author: data.author_name?.trim() };
    }
  } catch (err) {
    console.warn(`[oEmbed] Metadata fetch failed for ${videoId}:`, err instanceof Error ? err.message : err);
  }
  return {};
}

/**
 * Normalize API response into TranscriptEntry[]
 */
function parseTranscriptResponse(data: any, videoId: string): {
  transcript: TranscriptEntry[];
  title?: string | undefined;
  author?: string | undefined;
} {
  if (!data) return { transcript: [] };

  const raw = Array.isArray(data) ? data.find((i) => i?.id === videoId || i?.videoId === videoId) || data[0] : data.data || data;
  const list: any[] =
    raw?.tracks?.[0]?.transcript ||
    raw?.transcript ||
    raw?.subtitles ||
    raw?.captions ||
    (Array.isArray(raw) ? raw : []);

  const transcript: TranscriptEntry[] = list
    .map((item: any, idx: number) => {
      const text = String(item?.text ?? item?.content ?? item?.utf8 ?? "").trim();
      if (!text) return null;
      const offset = typeof item?.offset === "number"
        ? Math.round(item.offset)
        : typeof item?.start === "number"
          ? Math.round(item.start * 1000)
          : idx * 10000;
      return { text, offset };
    })
    .filter((e): e is TranscriptEntry => e !== null);

  return {
    transcript,
    title: raw?.title?.trim() || undefined,
    author: raw?.author?.trim() || raw?.channelTitle?.trim() || undefined,
  };
}

/**
 * Fetch transcript from youtube-transcript.io API
 */
export async function fetchTranscriptFromApi(videoId: string): Promise<{
  transcript: TranscriptEntry[];
  title?: string | undefined;
  author?: string | undefined;
}> {
  return executeWithTokenRotation(async (token) => {
    const auth = token.startsWith("Basic ") ? token : `Basic ${token}`;
    const res = await fetch("https://www.youtube-transcript.io/api/transcripts", {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [videoId] }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      const err: any = new Error(`HTTP ${res.status}: ${res.statusText}${errText ? ` - ${errText}` : ""}`);
      err.status = res.status;
      throw err;
    }

    const json = await res.json();
    return parseTranscriptResponse(json, videoId);
  });
}

/**
 * Get video details and full transcript
 */
export async function getVideoDetailsAndTranscript(videoId: string): Promise<VideoDetailsResult> {
  const [oembed, apiResult] = await Promise.all([
    fetchOEmbedDetails(videoId),
    fetchTranscriptFromApi(videoId).catch((err) => {
      console.warn(`[getVideoDetailsAndTranscript] Failed for ${videoId}:`, err?.message || err);
      return { transcript: [] as TranscriptEntry[], title: undefined, author: undefined };
    }),
  ]);

  return {
    videoId,
    title: apiResult.title || oembed.title || `Lecture Notes — ${videoId}`,
    author: apiResult.author || oembed.author || "",
    transcript: apiResult.transcript,
    hasSubtitles: apiResult.transcript.length > 0,
  };
}


