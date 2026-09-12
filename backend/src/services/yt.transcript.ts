import { fetchTranscript } from "youtube-transcript";
import type { TranscriptResponse } from "youtube-transcript";

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

const decodeEntities = (text: string): string => {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
};

export const parseTranscriptXml = (xml: string, lang = "en"): TranscriptEntry[] => {
  try {
    const results: TranscriptEntry[] = [];
    const pRegex = /<p\s+[^>]*?>([\s\S]*?)<\/p>/gi;
    let match: RegExpExecArray | null;

    while ((match = pRegex.exec(xml)) !== null) {
      const fullTag = match[0];
      const inner = match[1] || "";

      const tMatch = fullTag.match(/\bt="(\d+)"/i);
      const dMatch = fullTag.match(/\bd="(\d+)"/i);
      const startMs = tMatch && tMatch[1] ? parseInt(tMatch[1], 10) : 0;
      const durMs = dMatch && dMatch[1] ? parseInt(dMatch[1], 10) : 0;

      let text = "";
      const sRegex = /<s[^>]*>([^<]*)<\/s>/gi;
      let sMatch: RegExpExecArray | null;
      while ((sMatch = sRegex.exec(inner)) !== null) {
        if (sMatch[1]) text += sMatch[1];
      }
      if (!text) {
        text = inner.replace(/<[^>]+>/g, "");
      }
      text = decodeEntities(text).trim();
      if (text) {
        results.push({
          text,
          duration: durMs,
          offset: startMs,
          lang,
        });
      }
    }
    if (results.length > 0) return results;

    const RE_XML_TRANSCRIPT = /<text\s+start="([^"]*)"\s+dur="([^"]*)"[^>]*>([^<]*)<\/text>/gi;
    const classicResults = [...xml.matchAll(RE_XML_TRANSCRIPT)];
    return classicResults
      .map((res) => ({
        text: decodeEntities(res[3] || "").trim(),
        duration: Math.round(parseFloat(res[2] || "0") * 1000),
        offset: Math.round(parseFloat(res[1] || "0") * 1000),
        lang,
      }))
      .filter((e) => Boolean(e.text));
  } catch (err) {
    return [];
  }
};

export async function fetchOEmbedMetadata(videoId: string): Promise<{ title: string; author: string }> {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    if (res.ok) {
      const data = (await res.json()) as { title?: string; author_name?: string };
      return {
        title: data.title || "",
        author: data.author_name || "",
      };
    }
  } catch (e) {
    // ignore
  }
  return { title: "", author: "" };
}

async function fetchInnerTube(
  videoId: string,
  clientConfig: { clientName: string; clientVersion: string; userAgent: string }
): Promise<{ transcript: TranscriptEntry[]; title: string; author: string } | null> {
  try {
    const res = await fetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": clientConfig.userAgent,
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: clientConfig.clientName,
            clientVersion: clientConfig.clientVersion,
            hl: "en",
            gl: "US",
          },
        },
        videoId,
      }),
    });

    if (res.ok) {
      const data = (await res.json()) as any;
      const title = data?.videoDetails?.title || "";
      const author = data?.videoDetails?.author || "";
      const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

      if (Array.isArray(tracks) && tracks.length > 0) {
        const chosen =
          tracks.find((t: any) => t.languageCode === "en" || t.vssId?.includes("en")) ||
          tracks[0];
        if (chosen && chosen.baseUrl) {
          const trackRes = await fetch(chosen.baseUrl);
          const xml = await trackRes.text();
          const parsed = parseTranscriptXml(xml, chosen.languageCode || "en");
          if (parsed.length > 0) {
            return { transcript: parsed, title, author };
          }
        }
      }
      return { transcript: [], title, author };
    }
  } catch (e) {
    // ignore
  }
  return null;
}

export async function getVideoDetailsAndTranscript(videoId: string): Promise<VideoInfo> {
  let title = "";
  let author = "";
  let transcript: TranscriptEntry[] = [];

  // Strategy 1: YouTube InnerTube Android Client (bypasses datacenter rate-limits)
  try {
    const androidResult = await fetchInnerTube(videoId, {
      clientName: "ANDROID",
      clientVersion: "20.10.38",
      userAgent: "com.google.android.youtube/20.10.38 (Linux; U; Android 14)",
    });

    if (androidResult) {
      if (androidResult.title) title = androidResult.title;
      if (androidResult.author) author = androidResult.author;
      if (androidResult.transcript.length > 0) {
        transcript = androidResult.transcript;
      }
    }
  } catch (e) {
    // ignore
  }

  // Strategy 2: InnerTube WEB client
  if (transcript.length === 0) {
    try {
      const webResult = await fetchInnerTube(videoId, {
        clientName: "WEB",
        clientVersion: "2.20240101.01.00",
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      });
      if (webResult) {
        if (!title && webResult.title) title = webResult.title;
        if (!author && webResult.author) author = webResult.author;
        if (webResult.transcript.length > 0) {
          transcript = webResult.transcript;
        }
      }
    } catch (e) {
      // ignore
    }
  }

  // Strategy 3: youtube-transcript package
  if (transcript.length === 0) {
    try {
      const ytEntries: TranscriptResponse[] = await fetchTranscript(videoId);
      if (ytEntries && ytEntries.length > 0) {
        transcript = ytEntries.map((e) => ({
          text: decodeEntities(e.text),
          duration: e.duration,
          offset: e.offset,
          lang: e.lang || "en",
        }));
      }
    } catch (e) {
      try {
        const ytEntriesEn: TranscriptResponse[] = await fetchTranscript(videoId, { lang: "en" });
        if (ytEntriesEn && ytEntriesEn.length > 0) {
          transcript = ytEntriesEn.map((e) => ({
            text: decodeEntities(e.text),
            duration: e.duration,
            offset: e.offset,
            lang: "en",
          }));
        }
      } catch (err) {
        // ignore
      }
    }
  }

  // If title is still missing, query official YouTube oEmbed API
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

export async function getTranscript(videoId: string): Promise<TranscriptEntry[]> {
  const result = await getVideoDetailsAndTranscript(videoId);
  return result.transcript;
}