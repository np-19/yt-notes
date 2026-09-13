import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useNotes } from '../hooks/useNotes';
import { NoteEditor } from '../components/NoteEditor';
import { GenerationErrorAlert } from '../components/GenerationErrorAlert';
import { Spinner } from '../../../components/ui/Spinner';
import { Button } from '../../../components/ui/Button';
import { QUICK_ACTIONS } from '../../../constants';
import { Note, NoteSettings } from '../types/notes.types';
import { notesApi } from '../api/notes.api';
import { parseMarkdownToHtml } from '../../../lib/markdown';
import { env } from '../../../config/env';

export const SidePanelPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const videoId = searchParams.get('v') || '';
  const videoTitle = searchParams.get('title') || '';

  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [customTopic, setCustomTopic] = useState(videoTitle);
  const [customPrompt, setCustomPrompt] = useState('');
  
  // Full Configuration State matching HomePage
  const [detailLevel, setDetailLevel] = useState<'summary' | 'detailed' | 'comprehensive'>('detailed');
  const [diagramDensity, setDiagramDensity] = useState<'none' | 'balanced' | 'heavy'>('balanced');
  const [examples, setExamples] = useState<'concise' | 'many'>('many');
  const [includeCode, setIncludeCode] = useState(true);
  const [detailedMath, setDetailedMath] = useState(true);
  const [showConfig, setShowConfig] = useState(true);

  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedMarkdown, setStreamedMarkdown] = useState('');
  const [streamError, setStreamError] = useState<string | null>(null);

  const {
    activeThemeId,
    setTheme,
    updateContent,
    restoreVersion,
  } = useNotes();

  const streamContainerRef = useRef<HTMLDivElement>(null);

  const handleClose = () => {
    window.parent.postMessage({ type: 'CLOSE_LECTURE_PANEL' }, '*');
  };

  const resolveTranscript = async (vId: string): Promise<Array<{ text: string; offset?: number }> | undefined> => {
    if (!vId) return undefined;
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      try {
        const stored: { [key: string]: any } = await chrome.storage.local.get([`transcript_${vId}`]);
        const candidate = stored[`transcript_${vId}`];
        if (Array.isArray(candidate) && candidate.length > 0) {
          return candidate;
        }
      } catch (e) {}
    }

    // If not in storage yet, request from parent window (content script)
    return new Promise((resolve) => {
      let resolved = false;
      const msgHandler = (event: MessageEvent) => {
        if (event.data?.type === 'CLIENT_TRANSCRIPT_RESULT' && event.data?.videoId === vId) {
          window.removeEventListener('message', msgHandler);
          resolved = true;
          resolve(Array.isArray(event.data.transcript) && event.data.transcript.length > 0 ? event.data.transcript : undefined);
        }
      };

      window.addEventListener('message', msgHandler);
      window.parent.postMessage({ type: 'REQUEST_CLIENT_TRANSCRIPT', videoId: vId }, '*');

      setTimeout(() => {
        if (!resolved) {
          window.removeEventListener('message', msgHandler);
          resolve(undefined);
        }
      }, 1200);
    });
  };

  const handleOpenFullTab = async (streamInTab = false) => {
    const studioBase = env.webStudioUrl.replace(/\/+$/, '');

    if (streamInTab) {
      const newNoteId = `note-${Date.now()}`;
      const localTranscript = await resolveTranscript(videoId);
      const pendingDraft = {
        id: newNoteId,
        youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
        customTopic: customTopic || videoTitle || 'Synthesized Academic Notes',
        customPrompt: customPrompt || '',
        transcript: localTranscript && localTranscript.length > 0 ? localTranscript : undefined,
        settings: {
          detailLevel,
          diagramDensity,
          examples,
          includeCode,
          detailedMath,
        },
      };

      try {
        const draftPayload = encodeURIComponent(btoa(encodeURIComponent(JSON.stringify(pendingDraft))));
        const targetUrl = `${studioBase}/#/?v=${encodeURIComponent(videoId)}&title=${encodeURIComponent(customTopic || videoTitle)}&draft=${draftPayload}&auto=1`;
        window.open(targetUrl, '_blank', 'noopener,noreferrer');
      } catch (e) {
        const targetUrl = `${studioBase}/#/?v=${encodeURIComponent(videoId)}&title=${encodeURIComponent(customTopic || videoTitle)}&auto=1`;
        window.open(targetUrl, '_blank', 'noopener,noreferrer');
      }
    } else if (activeNote) {
      try {
        const payload = encodeURIComponent(btoa(encodeURIComponent(JSON.stringify(activeNote))));
        const targetUrl = `${studioBase}/#/notes/${activeNote.id}?import=${payload}`;
        window.open(targetUrl, '_blank', 'noopener,noreferrer');
      } catch (err) {
        const targetUrl = `${studioBase}/#/notes/${activeNote.id}`;
        window.open(targetUrl, '_blank', 'noopener,noreferrer');
      }
    } else if (videoId) {
      const targetUrl = `${studioBase}/#/?v=${encodeURIComponent(videoId)}&title=${encodeURIComponent(videoTitle)}`;
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    } else {
      const targetUrl = `${studioBase}/#/`;
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const startSynthesis = async (vId: string, title?: string) => {
    if (!vId) return;
    setStreamError(null);
    setIsStreaming(true);
    setStreamedMarkdown('');
    setShowConfig(false);

    const settings: NoteSettings = {
      detailLevel,
      diagramDensity,
      examples,
      includeCode,
      detailedMath,
    };

    const topicTitle = title || customTopic || (vId ? `Lecture Notes — ${vId}` : 'Synthesized Notes');

    const localTranscript = await resolveTranscript(vId);

    await notesApi.streamGenerateNotes(
      {
        youtubeUrl: `https://www.youtube.com/watch?v=${vId}`,
        customTopic: topicTitle,
        customPrompt: customPrompt || undefined,
        settings,
        transcript: localTranscript,
      },
      (_chunk, cumulative) => {
        setStreamedMarkdown(cumulative);
        if (streamContainerRef.current) {
          streamContainerRef.current.scrollTop = streamContainerRef.current.scrollHeight;
        }
      },
      async (finalMarkdown, resolvedTitle) => {
        const now = new Date().toISOString();
        const newNote: Note = {
          id: `note-${Date.now()}`,
          title: resolvedTitle || topicTitle,
          videoUrl: `https://www.youtube.com/watch?v=${vId}`,
          htmlContent: finalMarkdown,
          createdAt: now,
          updatedAt: now,
          themeId: activeThemeId || 'amber',
          versions: [
            {
              id: `v-${Date.now()}`,
              timestamp: now,
              label: 'Initial Generation',
              htmlContent: finalMarkdown,
            },
          ],
        };

        await notesApi.saveNote(newNote);
        setActiveNote(newNote);
        setIsStreaming(false);
      },
      (err) => {
        setStreamError(err);
        setIsStreaming(false);
      }
    );
  };

  useEffect(() => {
    if (videoTitle) setCustomTopic(videoTitle);

    // Check if a note already exists for this video
    const checkExisting = async () => {
      if (!videoId) return;
      const allNotes = await notesApi.fetchNotes();
      const match = allNotes.find((n) => n.videoUrl?.includes(videoId));
      if (match) {
        setActiveNote(match);
        setShowConfig(false);
      }
    };

    checkExisting();
  }, [videoId, videoTitle]);

  return (
    <div className="flex flex-col h-screen bg-stone-50 text-stone-900 font-sans overflow-hidden">
      {/* Top Header Bar */}
      <header className="no-print bg-stone-900 text-stone-100 px-4 py-3 border-b border-stone-800 flex items-center justify-between gap-2 flex-shrink-0 shadow-sm">
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-amber-600 flex items-center justify-center font-serif font-bold text-white shadow-inner text-sm flex-shrink-0">
            Y
          </div>
          <div className="min-w-0">
            <h1 className="font-serif text-sm font-bold text-stone-100 truncate">
              {activeNote ? activeNote.title : videoTitle || 'Lecture Notes Studio'}
            </h1>
            <p className="text-[10px] text-stone-400 uppercase font-mono tracking-wider">
              {isStreaming ? '⚡ Streaming Synthesis...' : 'YouTube Notes Assistant'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleOpenFullTab(false)}
            title="Open in full tab"
            className="text-stone-300 hover:text-white text-xs px-2 py-1 cursor-pointer"
          >
            ↗ Web Studio
          </Button>
          <button
            onClick={handleClose}
            className="p-1 text-stone-400 hover:text-white rounded-md hover:bg-stone-800 transition-colors text-lg leading-none w-7 h-7 flex items-center justify-center cursor-pointer"
            title="Close side panel"
          >
            ✕
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Streaming Live View */}
        {isStreaming && (
          <div className="space-y-4">
            <div className="bg-amber-50/90 border border-amber-300/80 rounded-xl p-4 flex items-center gap-3 shadow-xs">
              <Spinner size="md" />
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-stone-900 font-mono uppercase tracking-wider">
                  Streaming Live Study Guide
                </h4>
                <p className="text-[11px] text-stone-600 truncate">
                  Generating A4 Cover, Markdown, KaTeX equations, and vector flowcharts.
                </p>
              </div>
            </div>

            <div
              ref={streamContainerRef}
              className="note-content theme-amber bg-white shadow-md rounded-xl p-6 border border-stone-200 min-h-[400px] max-h-[calc(100vh-180px)] overflow-y-auto font-sans antialiased text-stone-900"
              dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(streamedMarkdown) || '<p class="text-xs text-stone-400 font-mono animate-pulse">Connecting to model stream...</p>' }}
            />
          </div>
        )}

        {streamError && (
          <GenerationErrorAlert
            error={streamError}
            onRetry={() => startSynthesis(videoId, customTopic)}
            onUseSample={() => {
              setStreamError(null);
              startSynthesis('pWO3HyVG-xg', 'Current Electricity & Circuit Laws Masterclass');
            }}
            onDismiss={() => setStreamError(null)}
          />
        )}

        {/* Saved Note View */}
        {!isStreaming && activeNote && !showConfig ? (
          <div className="space-y-3">
            <div className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-stone-200 shadow-xs">
              <span className="text-xs font-mono text-stone-500">Saved Document</span>
              <button
                onClick={() => setShowConfig(true)}
                className="text-xs font-semibold text-amber-700 hover:text-amber-800 hover:underline cursor-pointer"
              >
                + Configure / Generate New
              </button>
            </div>
            <NoteEditor
              note={activeNote}
              activeThemeId={activeThemeId}
              onThemeChange={setTheme}
              onUpdateContent={(html, label) => {
                updateContent(html, label);
                setActiveNote((prev) => (prev ? { ...prev, htmlContent: html } : prev));
              }}
              onRestoreVersion={restoreVersion}
            />
          </div>
        ) : null}

        {/* Full Configuration Form */}
        {!isStreaming && (showConfig || !activeNote) ? (
          <div className="bg-white border border-amber-200/90 rounded-2xl p-5 shadow-sm space-y-4">
            {/* Detected Video Card */}
            <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3.5 flex items-center gap-3">
              {videoId ? (
                <img
                  src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
                  alt={videoTitle}
                  className="w-16 h-12 object-cover rounded-lg border border-amber-300 shadow-inner flex-shrink-0"
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-900 rounded text-[9px] font-mono font-bold uppercase mb-1">
                  Active YouTube Lecture
                </span>
                <h3 className="font-serif font-bold text-xs text-stone-900 truncate">
                  {videoTitle || 'YouTube Video'}
                </h3>
              </div>
            </div>

            <div className="space-y-3">
              {/* Topic Title */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Topic / Subject Title
                </label>
                <input
                  type="text"
                  value={customTopic}
                  onChange={(e) => setCustomTopic(e.target.value)}
                  placeholder="e.g. Distributed Consensus & Raft Protocol"
                  className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-sans"
                />
              </div>

              {/* Quick Topic Presets */}
              <div>
                <p className="text-[11px] font-mono text-stone-500 mb-1.5 font-medium">Quick Topic Recipes:</p>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_ACTIONS.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => setCustomTopic(action.label)}
                      className="px-2 py-1 bg-stone-50 hover:bg-amber-50 border border-stone-200 text-stone-700 text-[10px] rounded-md transition-colors font-medium cursor-pointer truncate max-w-full"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom AI Focus Prompt */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Custom AI Focus (Optional)
                </label>
                <input
                  type="text"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="e.g. Include comprehensive code & architecture diagrams"
                  className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-sans"
                />
              </div>

              {/* 1. Depth & Detail Level */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-stone-700">
                    Depth & Detail Level
                  </label>
                  <span className="text-[10px] font-mono text-amber-800 font-bold uppercase">{detailLevel}</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['summary', 'detailed', 'comprehensive'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setDetailLevel(lvl)}
                      className={`py-1.5 px-2 text-[11px] font-medium rounded-lg border transition-all capitalize cursor-pointer ${
                        detailLevel === lvl
                          ? 'bg-amber-700 text-white border-amber-800 shadow-xs font-semibold'
                          : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Diagram & Flowchart Density */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-stone-700">
                    Diagram Density
                  </label>
                  <span className="text-[10px] font-mono text-amber-800 font-bold uppercase">{diagramDensity}</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['none', 'balanced', 'heavy'] as const).map((density) => (
                    <button
                      key={density}
                      type="button"
                      onClick={() => setDiagramDensity(density)}
                      className={`py-1.5 px-2 text-[11px] font-medium rounded-lg border transition-all capitalize cursor-pointer ${
                        diagramDensity === density
                          ? 'bg-amber-700 text-white border-amber-800 shadow-xs font-semibold'
                          : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                      }`}
                    >
                      {density === 'none' ? 'Minimal' : density === 'balanced' ? 'Balanced' : 'Heavy'}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Worked Examples */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-stone-700">
                    Worked Examples
                  </label>
                  <span className="text-[10px] font-mono text-amber-800 font-bold uppercase">{examples}</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['concise', 'many'] as const).map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => setExamples(ex)}
                      className={`py-1.5 px-2 text-[11px] font-medium rounded-lg border transition-all capitalize cursor-pointer ${
                        examples === ex
                          ? 'bg-amber-700 text-white border-amber-800 shadow-xs font-semibold'
                          : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                      }`}
                    >
                      {ex === 'concise' ? 'Concise' : 'In-Depth Many'}
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. Code & Math Toggles */}
              <div className="flex flex-wrap gap-4 pt-2 border-t border-stone-200">
                <label className="flex items-center space-x-1.5 cursor-pointer text-xs font-medium text-stone-800">
                  <input
                    type="checkbox"
                    checked={includeCode}
                    onChange={(e) => setIncludeCode(e.target.checked)}
                    className="rounded border-stone-300 text-amber-600 focus:ring-amber-500 w-3.5 h-3.5"
                  />
                  <span>Include Code</span>
                </label>

                <label className="flex items-center space-x-1.5 cursor-pointer text-xs font-medium text-stone-800">
                  <input
                    type="checkbox"
                    checked={detailedMath}
                    onChange={(e) => setDetailedMath(e.target.checked)}
                    className="rounded border-stone-300 text-amber-600 focus:ring-amber-500 w-3.5 h-3.5"
                  />
                  <span>Include Math (LaTeX)</span>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 space-y-2">
                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  onClick={() => startSynthesis(videoId, customTopic)}
                  className="w-full font-semibold text-white bg-amber-600 hover:bg-amber-700 py-2.5 shadow-sm cursor-pointer"
                >
                  ⚡ Synthesize Notes in Side Panel
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={() => handleOpenFullTab(true)}
                  className="w-full text-xs text-stone-700 border-stone-300 hover:bg-stone-100 cursor-pointer"
                >
                  ↗ Open & Stream in Full Studio Tab
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
};
