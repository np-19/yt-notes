import apiClient from '../../../lib/axios';
import { env } from '../../../config/env';
import { Note, GenerateNotesParams } from '../types/notes.types';

const LOCAL_STORAGE_KEY = 'yt_saved_notes';

export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  if (match) return match[1];
  if (/^[A-Za-z0-9_-]{11}$/.test(url.trim())) return url.trim();
  return null;
}

type TranscriptEntry = { text: string; offset: number; duration: number; lang: string };

const decodeEntities = (s: string) =>
  s.replace(/&amp;/g, '&')
   .replace(/&lt;/g, '<')
   .replace(/&gt;/g, '>')
   .replace(/&quot;/g, '"')
   .replace(/&#39;/g, "'")
   .replace(/&apos;/g, "'")
   .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
   .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)));

const parseTranscriptXml = (xml: string, lang = 'en'): TranscriptEntry[] => {
  // New format: <p t="offsetMs" d="durMs"><s>word</s></p>
  const newResults: TranscriptEntry[] = [];
  const pRe = /<p\s+[^>]*\bt="(\d+)"[^>]*\bd="(\d+)"[^>]*>([\s\S]*?)<\/p>/gi;
  let m: RegExpExecArray | null;
  while ((m = pRe.exec(xml)) !== null) {
    const inner = m[3];
    let text = '';
    const sRe = /<s[^>]*>([^<]*)<\/s>/gi;
    let sm: RegExpExecArray | null;
    while ((sm = sRe.exec(inner)) !== null) text += sm[1];
    if (!text) text = inner.replace(/<[^>]+>/g, '');
    text = decodeEntities(text).trim();
    if (text) newResults.push({ text, offset: parseInt(m[1], 10), duration: parseInt(m[2], 10), lang });
  }
  if (newResults.length > 0) return newResults;

  // Classic format: <text start="s" dur="s">text</text>
  const cRe = /<text\s+start="([^"]*)"\s+dur="([^"]*)"[^>]*>([^<]*)<\/text>/gi;
  const classicResults: TranscriptEntry[] = [];
  while ((m = cRe.exec(xml)) !== null) {
    const text = decodeEntities(m[3]).trim();
    if (text) classicResults.push({
      text,
      offset: Math.round(parseFloat(m[1]) * 1000),
      duration: Math.round(parseFloat(m[2]) * 1000),
      lang,
    });
  }
  return classicResults;
};

// 1. Read transcript from chrome.storage (populated by extension content.js)
export const fetchBrowserTranscript = async (
  videoId: string
): Promise<TranscriptEntry[] | undefined> => {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      return new Promise((resolve) => {
        chrome.storage.local.get([`transcript_${videoId}`], (res) => {
          const stored = res?.[`transcript_${videoId}`];
          resolve(Array.isArray(stored) && stored.length > 0 ? stored : undefined);
        });
      });
    }
  } catch (err) {
    // ignore
  }
  return undefined;
};

// 2. Fetch transcript directly from YouTube in the browser.
//    Browser IPs are not datacenter IPs → far less likely to be rate-limited.
//    Extension host_permissions (https://*/*) let this bypass CORS entirely.
const fetchYouTubeTranscriptClientSide = async (
  videoId: string
): Promise<TranscriptEntry[] | undefined> => {
  try {
    // InnerTube WEB client — gets caption track list
    const playerRes = await fetch(
      'https://www.youtube.com/youtubei/v1/player?prettyPrint=false',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: {
            client: { clientName: 'WEB', clientVersion: '2.20240101.01.00', hl: 'en', gl: 'US' },
          },
          videoId,
        }),
      }
    );
    if (!playerRes.ok) return undefined;

    const data = await playerRes.json();
    const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!Array.isArray(tracks) || tracks.length === 0) return undefined;

    const chosen =
      tracks.find((t: any) => t.languageCode === 'en' || t.vssId?.includes('.en')) || tracks[0];
    if (!chosen?.baseUrl) return undefined;

    const trackRes = await fetch(chosen.baseUrl);
    if (!trackRes.ok) return undefined;

    const xml = await trackRes.text();
    const transcript = parseTranscriptXml(xml, chosen.languageCode || 'en');

    // Cache in chrome.storage so future requests skip this fetch
    if (transcript.length > 0 && typeof chrome !== 'undefined' && chrome.storage?.local) {
      try { chrome.storage.local.set({ [`transcript_${videoId}`]: transcript }); } catch (_) {}
    }

    return transcript.length > 0 ? transcript : undefined;
  } catch (e) {
    return undefined; // CORS blocked outside extension, or network error — server will try its own fetch
  }
};

const getSavedLocalNotes = (): Note[] => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const notes: Note[] = JSON.parse(raw);
    const cleaned = notes.filter((n) => n.id !== 'kafka-masterclass-sample');
    if (cleaned.length !== notes.length) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch (e) {
    return [];
  }
};

const saveLocalNotes = (notes: Note[]) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(notes));
  } catch (e) {
    console.error('Failed to save notes to local storage', e);
  }
};

const detailLevelMap: Record<string, 'quick' | 'short' | 'standard' | 'detailed' | 'deep_dive'> = {
  summary: 'short',
  detailed: 'standard',
  comprehensive: 'deep_dive',
};

const diagramDensityMap: Record<string, 'minimal' | 'balanced' | 'aggressive'> = {
  none: 'minimal',
  balanced: 'balanced',
  heavy: 'aggressive',
};

const examplesMap: Record<string, 'minimal' | 'normal' | 'many'> = {
  concise: 'minimal',
  many: 'many',
};

async function buildNotePayload(params: GenerateNotesParams) {
  const videoId = extractYouTubeId(params.youtubeUrl);
  if (!videoId) {
    throw new Error('Please enter a valid YouTube video URL or 11-character video ID.');
  }

  let titleCandidate = params.customTopic?.trim() || `Lecture Notes — ${videoId}`;

  // Transcript priority: caller-supplied → chrome.storage (extension) → browser InnerTube fetch → let server handle it
  let effectiveTranscript: TranscriptEntry[] | undefined =
    params.transcript && params.transcript.length > 0
      ? params.transcript.map((e) => ({ text: e.text, offset: e.offset ?? 0, duration: e.duration ?? 0, lang: e.lang ?? 'en' }))
      : undefined;


  if (!effectiveTranscript) effectiveTranscript = await fetchBrowserTranscript(videoId);
  if (!effectiveTranscript) effectiveTranscript = await fetchYouTubeTranscriptClientSide(videoId);

  return {
    videoId,
    titleCandidate,
    payload: {
      videoId,
      videoTitle: titleCandidate,
      customPrompt: params.customPrompt || undefined,
      transcript: effectiveTranscript && effectiveTranscript.length > 0 ? effectiveTranscript : undefined,
      detailLevel: detailLevelMap[params.settings?.detailLevel || 'detailed'] || 'standard',
      diagramDensity: diagramDensityMap[params.settings?.diagramDensity || 'balanced'] || 'balanced',
      examples: examplesMap[params.settings?.examples || 'many'] || 'normal',
      includeCode: params.settings?.includeCode !== false,
      detailedMath: params.settings?.detailedMath !== false,
    },
  };
}

export const notesApi = {
  fetchNotes: async (): Promise<Note[]> => {
    return getSavedLocalNotes();
  },

  fetchNoteById: async (id: string): Promise<Note | null> => {
    const notes = await notesApi.fetchNotes();
    return notes.find((n) => n.id === id) || null;
  },

  generateNotes: async (params: GenerateNotesParams): Promise<{ html: string; title: string }> => {
    const { titleCandidate, payload } = await buildNotePayload(params);

    const response = await apiClient.post<{
      success: boolean;
      data: { videoId: string; title: string; html: string };
    }>('/api/notes', payload);

    if (response.data?.data?.html) {
      return {
        html: response.data.data.html,
        title: response.data.data.title || titleCandidate,
      };
    }

    throw new Error('Empty response received from the note synthesis service.');
  },

  streamGenerateNotes: async (
    params: GenerateNotesParams,
    onChunk: (chunk: string, cumulative: string) => void,
    onDone: (finalMarkdown: string, title: string) => void,
    onError: (error: string) => void
  ): Promise<void> => {
    let titleCandidate = '';
    let payload: any = null;

    try {
      const prepared = await buildNotePayload(params);
      titleCandidate = prepared.titleCandidate;
      payload = prepared.payload;
    } catch (err: any) {
      onError(err?.message || 'Invalid video parameter.');
      return;
    }

    try {
      const response = await fetch(`${env.backendUrl}/api/notes/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Server responded with status ${response.status}`);
      }

      if (!response.body) {
        throw new Error('ReadableStream not supported by browser.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let cumulativeText = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;

          try {
            const data = JSON.parse(trimmed.slice(5).trim());
            if (data.type === 'chunk' && data.text) {
              cumulativeText += data.text;
              onChunk(data.text, cumulativeText);
            } else if (data.type === 'done') {
              onDone(data.markdown || cumulativeText, data.title || titleCandidate);
              return;
            } else if (data.type === 'error') {
              onError(data.message || 'Error occurred during streaming generation.');
              return;
            }
          } catch (e) {}
        }
      }

      if (cumulativeText) {
        onDone(cumulativeText, titleCandidate);
      }
    } catch (err: any) {
      onError(err?.message || 'Failed to stream notes synthesis.');
    }
  },

  refineNotes: async (htmlContent: string, instruction: string, selection?: string): Promise<{ html: string }> => {
    try {
      const response = await apiClient.post<{ success: boolean; data: { html: string } }>('/api/notes/edit', {
        html: htmlContent,
        instruction,
        selection: selection || undefined,
      });
      return { html: response.data?.data?.html || htmlContent };
    } catch (err: any) {
      console.warn('Refinement API error:', err);
      return { html: htmlContent };
    }
  },

  saveNote: async (note: Note): Promise<Note> => {
    const notes = getSavedLocalNotes();
    const index = notes.findIndex((n) => n.id === note.id);
    if (index >= 0) {
      notes[index] = note;
    } else {
      notes.unshift(note);
    }
    saveLocalNotes(notes);
    return note;
  },

  deleteNote: async (id: string): Promise<boolean> => {
    const notes = getSavedLocalNotes();
    const filtered = notes.filter((n) => n.id !== id);
    saveLocalNotes(filtered);
    return true;
  },
};
