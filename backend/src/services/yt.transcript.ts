import "../configs/constants.js";
import { YouTubeTranscriptApi, WebshareProxyConfig } from "@hallelx/youtube-transcript";

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

// ── Proxy configuration ───────────────────────────────────────────────────

function buildApi(): YouTubeTranscriptApi {
  const proxyUsername = process.env.WEBSHARE_PROXY_USERNAME;
  const proxyPassword = process.env.WEBSHARE_PROXY_PASSWORD;

  if (proxyUsername && proxyPassword) {
    return new YouTubeTranscriptApi({
      proxyConfig: new WebshareProxyConfig({
        proxyUsername,
        proxyPassword,
        retriesWhenBlocked: 10,
      }),
    });
  }

  return new YouTubeTranscriptApi();
}

// ── Helpers ────────────────────────────────────────────────────────────────

const toEntries = (
  fetched: Awaited<ReturnType<YouTubeTranscriptApi["fetch"]>>
): TranscriptEntry[] =>
  fetched.snippets.map((s) => ({
    text: s.text,
    offset: Math.round(s.start * 1000),
    duration: Math.round(s.duration * 1000),
    lang: fetched.languageCode || "en",
  }));

// ── Public API ─────────────────────────────────────────────────────────────

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
  } catch {
    // ignore
  }
  return { title: "", author: "" };
}

export async function getVideoDetailsAndTranscript(videoId: string): Promise<VideoInfo> {
  const api = buildApi();
  let transcript: TranscriptEntry[] = [];

  try {
    transcript = toEntries(await api.fetch(videoId, { languages: ["en"] }));
  } catch {
    try {
      transcript = toEntries(await api.fetch(videoId));
    } catch {
      // No transcript available
    }
  }

  const { title, author } = await fetchOEmbedMetadata(videoId);

  return {
    videoId,
    title: title || `Lecture Notes — ${videoId}`,
    author,
    transcript,
    hasSubtitles: transcript.length > 0,
  };
}
