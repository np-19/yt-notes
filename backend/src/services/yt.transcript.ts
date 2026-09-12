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
  const pool = getProxies();
  const maxAttempts = pool.length > 0 ? Math.min(pool.length, 5) : 1;
  let transcript: TranscriptEntry[] = [];
  let lastError: any = null;

  console.log(`[yt.transcript] Fetching transcript for video ${videoId} (available proxies: ${pool.length})`);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const api = buildApi();
    try {
      try {
        transcript = toEntries(await api.fetch(videoId, { languages: ["en"] }));
      } catch {
        transcript = toEntries(await api.fetch(videoId));
      }
      if (transcript.length > 0) {
        console.log(`[yt.transcript] Successfully fetched ${transcript.length} transcript lines on attempt ${attempt + 1}`);
        break;
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`[yt.transcript] Attempt ${attempt + 1}/${maxAttempts} failed for video ${videoId}:`, err?.message || err);
    }
  }

  if (transcript.length === 0 && lastError) {
    console.error(`[yt.transcript] All ${maxAttempts} proxy attempts failed for video ${videoId}:`, lastError?.message || lastError);
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
