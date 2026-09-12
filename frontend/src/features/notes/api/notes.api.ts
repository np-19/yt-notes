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

const decodeEntities = (text: string): string => {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
};

const parseTranscriptXml = (xml: string, lang = 'en') => {
  try {
    const results = [];
    const pRegex = /<p\s+t="(\d+)"\s+d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;
    let match;
    while ((match = pRegex.exec(xml)) !== null) {
      const startMs = parseInt(match[1], 10);
      const durMs = parseInt(match[2], 10);
      const inner = match[3];
      let text = '';
      const sRegex = /<s[^>]*>([^<]*)<\/s>/g;
      let sMatch;
      while ((sMatch = sRegex.exec(inner)) !== null) {
        text += sMatch[1];
      }
      if (!text) {
        text = inner.replace(/<[^>]+>/g, '');
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

    const RE_XML_TRANSCRIPT = /<text\s+start="([^"]*)"\s+dur="([^"]*)"[^>]*>([^<]*)<\/text>/g;
    const classicResults = [...xml.matchAll(RE_XML_TRANSCRIPT)];
    return classicResults
      .map((res) => ({
        text: decodeEntities(res[3]).trim(),
        duration: Math.round(parseFloat(res[2]) * 1000),
        offset: Math.round(parseFloat(res[1]) * 1000),
        lang,
      }))
      .filter((e) => Boolean(e.text));
  } catch (err) {
    return [];
  }
};

export const fetchBrowserTranscript = async (
  videoId: string
): Promise<Array<{ text: string; offset: number; duration: number; lang: string }> | undefined> => {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      return new Promise((resolve) => {
        chrome.storage.local.get([`transcript_${videoId}`], (res) => {
          const stored = res?.[`transcript_${videoId}`];
          if (Array.isArray(stored) && stored.length > 0) {
            resolve(stored);
          } else {
            resolve(undefined);
          }
        });
      });
    }
  } catch (err) {
    // ignore
  }
  return undefined;
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

export const notesApi = {
  fetchNotes: async (): Promise<Note[]> => {
    return getSavedLocalNotes();
  },

  fetchNoteById: async (id: string): Promise<Note | null> => {
    const notes = await notesApi.fetchNotes();
    return notes.find((n) => n.id === id) || null;
  },

  generateNotes: async (params: GenerateNotesParams): Promise<{ html: string; title: string }> => {
    const extractedId = extractYouTubeId(params.youtubeUrl);
    if (!extractedId) {
      throw new Error('Please enter a valid YouTube video URL or 11-character video ID.');
    }
    const videoId = extractedId;

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

    let titleCandidate = params.customTopic?.trim();
    if (!titleCandidate) {
      if (params.youtubeUrl.includes('pWO3HyVG-xg') || params.youtubeUrl.toLowerCase().includes('electricity')) {
        titleCandidate = 'Current Electricity & Circuit Laws Masterclass';
      } else {
        titleCandidate = `Lecture Notes — ${videoId}`;
      }
    }

    const effectiveTranscript =
      params.transcript && params.transcript.length > 0
        ? params.transcript
        : await fetchBrowserTranscript(videoId);

    const payload = {
      videoId,
      videoTitle: titleCandidate,
      customPrompt: params.customPrompt || undefined,
      transcript: effectiveTranscript && effectiveTranscript.length > 0 ? effectiveTranscript : undefined,
      detailLevel: detailLevelMap[params.settings?.detailLevel || 'detailed'] || 'standard',
      diagramDensity: diagramDensityMap[params.settings?.diagramDensity || 'balanced'] || 'balanced',
      examples: examplesMap[params.settings?.examples || 'many'] || 'normal',
      includeCode: params.settings?.includeCode !== false,
      detailedMath: params.settings?.detailedMath !== false,
    };

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
    const extractedId = extractYouTubeId(params.youtubeUrl);
    if (!extractedId) {
      onError('Please enter a valid YouTube video URL or 11-character video ID.');
      return;
    }
    const videoId = extractedId;

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

    let titleCandidate = params.customTopic?.trim();
    if (!titleCandidate) {
      if (params.youtubeUrl.includes('pWO3HyVG-xg') || params.youtubeUrl.toLowerCase().includes('electricity')) {
        titleCandidate = 'Current Electricity & Circuit Laws Masterclass';
      } else {
        titleCandidate = `Lecture Notes — ${videoId}`;
      }
    }

    const effectiveTranscript =
      params.transcript && params.transcript.length > 0
        ? params.transcript
        : await fetchBrowserTranscript(videoId);

    const payload = {
      videoId,
      videoTitle: titleCandidate,
      customPrompt: params.customPrompt || undefined,
      transcript: effectiveTranscript && effectiveTranscript.length > 0 ? effectiveTranscript : undefined,
      detailLevel: detailLevelMap[params.settings?.detailLevel || 'detailed'] || 'standard',
      diagramDensity: diagramDensityMap[params.settings?.diagramDensity || 'balanced'] || 'balanced',
      examples: examplesMap[params.settings?.examples || 'many'] || 'normal',
      includeCode: params.settings?.includeCode !== false,
      detailedMath: params.settings?.detailedMath !== false,
    };

    try {
      const response = await fetch(`${env.backendUrl}/api/notes/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
      if (response.data?.data?.html) {
        return { html: response.data.data.html };
      }
      return { html: htmlContent };
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
