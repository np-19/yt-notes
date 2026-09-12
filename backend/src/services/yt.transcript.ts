import "../configs/constants.js";
import { YouTubeTranscriptApi, GenericProxyConfig } from "@hallelx/youtube-transcript";

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

// ── Proxy pool ─────────────────────────────────────────────────────────────
// Parses "ip:port:user:pass" or any http(s):// / socks5:// URL

function parseProxyUrl(entry: string): string | null {
  const s = entry.trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s) || /^socks5:\/\//i.test(s)) return s;
  const parts = s.split(":");
  if (parts.length === 4 && parts[0] && parts[1] && parts[2] && parts[3]) {
    const [ip, port, user, pass] = parts;
    return `http://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${ip}:${port}`;
  }
  return `http://${s}`;
}

function loadProxies(): string[] {
  const raw =
    process.env.YOUTUBE_PROXY_URL ||
    process.env.YOUTUBE_PROXIES ||
    process.env.HTTPS_PROXY ||
    process.env.HTTP_PROXY ||
    "";
  return raw
    .split(/[\r\n,]+/)
    .map(parseProxyUrl)
    .filter((u): u is string => u !== null && u.length > 0);
}

function getProxies(): string[] {
  return loadProxies();
}

let proxyIndex = 0;

function getNextProxyConfig(): GenericProxyConfig | undefined {
  const proxies = getProxies();
  if (proxies.length === 0) return undefined;
  const url = proxies[proxyIndex % proxies.length];
  if (!url) return undefined;
  proxyIndex = (proxyIndex + 1) % proxies.length;
  return new GenericProxyConfig({ httpUrl: url, httpsUrl: url });
}

function buildApi(proxyConfig?: GenericProxyConfig): YouTubeTranscriptApi {
  const proxy = proxyConfig ?? getNextProxyConfig();
  return proxy
    ? new YouTubeTranscriptApi({ proxyConfig: proxy })
    : new YouTubeTranscriptApi();
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
  // Each call picks the next proxy in the pool (round-robin)
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
