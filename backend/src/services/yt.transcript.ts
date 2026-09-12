import { fetchTranscript } from "youtube-transcript";
import type { TranscriptResponse } from "youtube-transcript";
import { ProxyAgent, fetch as undiciFetch } from "undici";

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

const normalizeProxyUrl = (entry: string): string | null => {
  const trimmed = entry.trim();
  if (!trimmed) return null;
  // Format: ip:port:username:password
  const parts = trimmed.split(":");
  if (parts.length === 4) {
    const [ip, port, user, pass] = parts;
    return `http://${user}:${pass}@${ip}:${port}`;
  }
  if (/^https?:\/\//i.test(trimmed) || /^socks5:\/\//i.test(trimmed)) return trimmed;
  return `http://${trimmed}`;
};

const getProxyDispatchers = (): ProxyAgent[] => {
  const raw =
    process.env.YOUTUBE_PROXY_URL ||
    process.env.YOUTUBE_PROXIES ||
    process.env.HTTPS_PROXY ||
    process.env.HTTP_PROXY ||
    "";
  if (!raw.trim()) return [];
  return raw
    .split(/[\r\n,]+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .reduce<ProxyAgent[]>((acc, entry) => {
      const url = normalizeProxyUrl(entry);
      if (!url) return acc;
      try {
        acc.push(new ProxyAgent(url));
      } catch (e) {
        console.warn("[yt.transcript] Invalid proxy URL skipped:", entry, e);
      }
      return acc;
    }, []);
};

const proxyAgents = getProxyDispatchers();
let currentProxyIndex = 0;

function getNextProxyAgent(): ProxyAgent | undefined {
  if (proxyAgents.length === 0) return undefined;
  const agent = proxyAgents[currentProxyIndex % proxyAgents.length];
  currentProxyIndex = (currentProxyIndex + 1) % proxyAgents.length;
  return agent;
}

async function proxyFetch(url: string, init: any = {}): Promise<Response> {
  const agent = getNextProxyAgent();
  if (agent) {
    try {
      return (await undiciFetch(url, { ...init, dispatcher: agent })) as unknown as Response;
    } catch (err) {
      console.warn("[yt.transcript] Proxy request failed, trying direct:", err);
    }
  }
  return fetch(url, init);
}

// ── Transcript XML parser ──────────────────────────────────────────────────

const decodeEntities = (text: string): string =>
  text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));

export const parseTranscriptXml = (xml: string, lang = "en"): TranscriptEntry[] => {
  try {
    // New format: <p t="offsetMs" d="durMs"><s>word</s></p>
    const newResults: TranscriptEntry[] = [];
    const pRegex = /<p\s+[^>]*?\bt="(\d+)"[^>]*?\bd="(\d+)"[^>]*?>([\s\S]*?)<\/p>/gi;
    let match: RegExpExecArray | null;

    while ((match = pRegex.exec(xml)) !== null) {
      const inner = match[3] || "";
      let text = "";
      const sRegex = /<s[^>]*>([^<]*)<\/s>/gi;
      let sMatch: RegExpExecArray | null;
      while ((sMatch = sRegex.exec(inner)) !== null) {
        if (sMatch[1]) text += sMatch[1];
      }
      if (!text) text = inner.replace(/<[^>]+>/g, "");
      text = decodeEntities(text).trim();
      if (text)
        newResults.push({ text, duration: parseInt(match[2] || "0", 10), offset: parseInt(match[1] || "0", 10), lang });
    }
    if (newResults.length > 0) return newResults;

    // Classic format: <text start="s" dur="s">text</text>
    const RE = /<text\s+start="([^"]*)"\s+dur="([^"]*)"[^>]*>([^<]*)<\/text>/gi;
    return [...xml.matchAll(RE)]
      .map((res) => ({
        text: decodeEntities(res[3] || "").trim(),
        duration: Math.round(parseFloat(res[2] || "0") * 1000),
        offset: Math.round(parseFloat(res[1] || "0") * 1000),
        lang,
      }))
      .filter((e) => Boolean(e.text));
  } catch {
    return [];
  }
};

// ── InnerTube client definitions ───────────────────────────────────────────
//
// Each entry maps to a real YouTube client.
// CRITICAL: X-YouTube-Client-Name (numeric ID) is REQUIRED by YouTube's API.
// Without it, caption tracks are silently omitted from the response.

type InnerTubeClient = {
  clientName: string;
  clientId: number;       // X-YouTube-Client-Name header value
  clientVersion: string;
  userAgent: string;
  origin?: string;        // Required for WEB-family clients
  referer?: string;
};

const INNERTUBE_CLIENTS: InnerTubeClient[] = [
  {
    // TV Embedded — no auth needed, most reliable for caption access
    clientName: "TVHTML5_SIMPLY_EMBEDDED_PLAYER",
    clientId: 85,
    clientVersion: "2.0",
    userAgent:
      "Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0) AppleWebKit/538.1 (KHTML, like Gecko) SamsungBrowser/3.1 TV Safari/538.1",
    origin: "https://www.youtube.com",
    referer: "https://www.youtube.com",
  },
  {
    // Android — separate IP pool, bypasses many datacenter rate-limits
    clientName: "ANDROID",
    clientId: 3,
    clientVersion: "19.29.37",
    userAgent: "com.google.android.youtube/19.29.37 (Linux; U; Android 14) gzip",
  },
  {
    // Web embedded player — works when embedded player restrictions are relaxed
    clientName: "WEB_EMBEDDED_PLAYER",
    clientId: 56,
    clientVersion: "1.20231121.01.00",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    origin: "https://www.youtube.com",
    referer: "https://www.youtube.com",
  },
  {
    // Standard Web — last resort
    clientName: "WEB",
    clientId: 1,
    clientVersion: "2.20231121.08.00",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    origin: "https://www.youtube.com",
    referer: "https://www.youtube.com",
  },
];

// ── Core InnerTube fetch ───────────────────────────────────────────────────

async function fetchInnerTube(
  videoId: string,
  client: InnerTubeClient
): Promise<{ transcript: TranscriptEntry[]; title: string; author: string } | null> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      // These two are the headers YouTube actually validates:
      "X-YouTube-Client-Name": String(client.clientId),
      "X-YouTube-Client-Version": client.clientVersion,
      "User-Agent": client.userAgent,
    };
    if (client.origin) {
      headers["Origin"] = client.origin;
      headers["Referer"] = client.referer ?? client.origin;
    }

    const res = await proxyFetch(
      "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          context: {
            client: {
              clientName: client.clientName,
              clientVersion: client.clientVersion,
              hl: "en",
              gl: "US",
            },
          },
          videoId,
        }),
      }
    );

    if (!res.ok) {
      console.warn(`[yt.transcript/innertube] Client ${client.clientName} returned HTTP ${res.status}`);
      return null;
    }

    const data = (await res.json()) as any;
    const title: string = data?.videoDetails?.title || "";
    const author: string = data?.videoDetails?.author || "";
    const playabilityStatus = data?.playabilityStatus?.status;

    if (playabilityStatus && playabilityStatus !== "OK") {
      console.warn(`[yt.transcript/innertube] Client ${client.clientName} playability: ${playabilityStatus} (${data?.playabilityStatus?.reason || "no reason"})`);
    }

    const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

    if (!Array.isArray(tracks) || tracks.length === 0) {
      console.log(`[yt.transcript/innertube] Client ${client.clientName} returned no caption tracks`);
      return { transcript: [], title, author };
    }

    console.log(`[yt.transcript/innertube] Client ${client.clientName} found ${tracks.length} caption tracks`);

    const chosen =
      tracks.find((t: any) => t.languageCode === "en" || t.vssId?.includes(".en")) ||
      tracks[0];

    if (!chosen?.baseUrl) return { transcript: [], title, author };

    const trackRes = await proxyFetch(chosen.baseUrl);
    if (!trackRes.ok) {
      console.warn(`[yt.transcript/innertube] Failed to fetch caption XML from baseUrl: HTTP ${trackRes.status}`);
      return { transcript: [], title, author };
    }

    const xml = await trackRes.text();
    const transcript = parseTranscriptXml(xml, chosen.languageCode || "en");
    return { transcript, title, author };
  } catch (err: any) {
    console.warn(`[yt.transcript/innertube] Client ${client.clientName} error:`, err?.message || err);
    return null;
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function fetchOEmbedMetadata(
  videoId: string
): Promise<{ title: string; author: string }> {
  try {
    const res = await proxyFetch(
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

export async function getVideoDetailsAndTranscript(videoId: string): Promise<VideoInfo> {
  let title = "";
  let author = "";
  let transcript: TranscriptEntry[] = [];

  console.log(`[yt.transcript] Fetching details & transcript for video ${videoId} (proxy dispatchers: ${proxyAgents.length})`);

  // Try each InnerTube client in order until we get a transcript
  for (const client of INNERTUBE_CLIENTS) {
    if (transcript.length > 0) break;
    try {
      const result = await fetchInnerTube(videoId, client);
      if (!result) continue;
      if (!title && result.title) title = result.title;
      if (!author && result.author) author = result.author;
      if (result.transcript.length > 0) {
        transcript = result.transcript;
        console.log(`[yt.transcript] Successfully retrieved ${transcript.length} lines via InnerTube client ${client.clientName}`);
      }
    } catch (err: any) {
      console.warn(`[yt.transcript] InnerTube client ${client.clientName} failed:`, err?.message || err);
    }
  }

  // Fallback: youtube-transcript package (uses a completely different fetch strategy)
  if (transcript.length === 0) {
    console.log(`[yt.transcript] InnerTube returned no transcript. Trying youtube-transcript fallback...`);
    try {
      const entries: TranscriptResponse[] = await fetchTranscript(videoId);
      if (entries.length > 0) {
        transcript = entries.map((e) => ({
          text: decodeEntities(e.text),
          duration: e.duration,
          offset: e.offset,
          lang: e.lang || "en",
        }));
        console.log(`[yt.transcript] youtube-transcript fallback succeeded (${transcript.length} lines)`);
      }
    } catch (err: any) {
      console.warn(`[yt.transcript] youtube-transcript fallback failed:`, err?.message || err);
      try {
        const entries: TranscriptResponse[] = await fetchTranscript(videoId, { lang: "en" });
        if (entries.length > 0) {
          transcript = entries.map((e) => ({
            text: decodeEntities(e.text),
            duration: e.duration,
            offset: e.offset,
            lang: "en",
          }));
          console.log(`[yt.transcript] youtube-transcript fallback with lang:en succeeded (${transcript.length} lines)`);
        }
      } catch (err2: any) {
        console.warn(`[yt.transcript] youtube-transcript lang:en fallback failed:`, err2?.message || err2);
      }
    }
  }

  // Get title from oEmbed if InnerTube didn't return one
  if (!title) {
    const oembed = await fetchOEmbedMetadata(videoId);
    if (oembed.title) title = oembed.title;
    if (oembed.author) author = oembed.author;
  }

  return {
    videoId,
    title: title || `Lecture Notes — ${videoId}`,
    author,
    transcript,
    hasSubtitles: transcript.length > 0,
  };
}
