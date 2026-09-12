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

function buildApi(): YouTubeTranscriptApi {
  const username = process.env.WEBSHARE_PROXY_USERNAME;
  const password = process.env.WEBSHARE_PROXY_PASSWORD;

  if (username && password) {
    return new YouTubeTranscriptApi({
      proxyConfig: new WebshareProxyConfig({
        proxyUsername: username,
        proxyPassword: password,
      }),
    });
  }

  return new YouTubeTranscriptApi();
}

// Lazily build once (picks up env vars after dotenv loads)
let _api: YouTubeTranscriptApi | null = null;
const getApi = () => {
  if (!_api) _api = buildApi();
  return _api;
};

const toEntries = (fetched: Awaited<ReturnType<YouTubeTranscriptApi["fetch"]>>): TranscriptEntry[] =>
  fetched.snippets.map((s) => ({
    text: s.text,
    offset: Math.round(s.start * 1000),
    duration: Math.round(s.duration * 1000),
    lang: fetched.languageCode || "en",
  }));

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
  const api = getApi();
  let transcript: TranscriptEntry[] = [];

  try {
    transcript = toEntries(await api.fetch(videoId, { languages: ["en"] }));
  } catch {
    try {
      transcript = toEntries(await api.fetch(videoId));
    } catch {
      // No transcript available — caller will surface the error
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
