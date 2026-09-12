import { YouTubeTranscriptApi } from "@hallelx/youtube-transcript";

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
  const api = new YouTubeTranscriptApi();

  let transcript: TranscriptEntry[] = [];

  try {
    const fetched = await api.fetch(videoId, { languages: ['en'] });
    transcript = fetched.snippets.map((s) => ({
      text: s.text,
      offset: Math.round(s.start * 1000),
      duration: Math.round(s.duration * 1000),
      lang: fetched.languageCode || 'en',
    }));
  } catch {
    // Try without language preference
    try {
      const fetched = await api.fetch(videoId);
      transcript = fetched.snippets.map((s) => ({
        text: s.text,
        offset: Math.round(s.start * 1000),
        duration: Math.round(s.duration * 1000),
        lang: fetched.languageCode || 'en',
      }));
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
