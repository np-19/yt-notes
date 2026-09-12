import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useNotes } from '../hooks/useNotes';
import { NoteEditor } from '../components/NoteEditor';
import { MainLayout } from '../../../components/layout/MainLayout';
import { Spinner } from '../../../components/ui/Spinner';
import { Button } from '../../../components/ui/Button';
import { Note } from '../types/notes.types';
import { notesApi } from '../api/notes.api';
import { GenerationErrorAlert } from '../components/GenerationErrorAlert';

export const NotePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isStreamingQuery = searchParams.get('streaming') === '1';

  const navigate = useNavigate();
  const [activeDocument, setActiveDocument] = useState<Note | null>(null);
  const [isLoadingDoc, setIsLoadingDoc] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  const streamStartedRef = useRef(false);

  const {
    activeThemeId,
    setTheme,
    updateContent,
    restoreVersion,
  } = useNotes();

  const startStreamingSynthesis = async (noteId: string, draftData: any) => {
    setIsStreaming(true);
    setStreamError(null);

    const initialPlaceholder: Note = {
      id: noteId,
      title: draftData.customTopic || 'Synthesized Academic Notes',
      videoUrl: draftData.youtubeUrl,
      htmlContent: `<header class="note-cover">
  <h1>${draftData.customTopic || 'Synthesized Academic Notes'}</h1>
  <p class="subtitle">Complete Technical Study Guide & Architecture Whitepaper</p>
  <p class="description">Live synthesizing educational notes with diagrams, equations, and executive summary...</p>
  <div class="badge-pill">⚡ Initializing Gemini Stream...</div>
</header>`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      themeId: activeThemeId || 'amber',
      versions: [],
    };

    setActiveDocument(initialPlaceholder);
    setIsLoadingDoc(false);

    await notesApi.streamGenerateNotes(
      {
        youtubeUrl: draftData.youtubeUrl,
        customTopic: draftData.customTopic,
        customPrompt: draftData.customPrompt,
        settings: draftData.settings,
      },
      (_chunk, cumulative) => {
        setActiveDocument((prev) => (prev ? { ...prev, htmlContent: cumulative } : prev));
      },
      async (finalMarkdown, resolvedTitle) => {
        const now = new Date().toISOString();
        const finalNote: Note = {
          id: noteId,
          title: resolvedTitle || draftData.customTopic || 'Synthesized Academic Notes',
          videoUrl: draftData.youtubeUrl,
          htmlContent: finalMarkdown,
          createdAt: now,
          updatedAt: now,
          themeId: activeThemeId || 'amber',
          versions: [
            {
              id: `v-${Date.now()}`,
              timestamp: now,
              label: 'Initial Synthesis',
              htmlContent: finalMarkdown,
            },
          ],
        };

        await notesApi.saveNote(finalNote);
        sessionStorage.removeItem(`pending_note_gen_${noteId}`);
        setActiveDocument(finalNote);
        setIsStreaming(false);
      },
      (err) => {
        setStreamError(err);
        setIsStreaming(false);
      }
    );
  };

  useEffect(() => {
    let isMounted = true;

    const initPage = async () => {
      if (!id) {
        setIsLoadingDoc(false);
        return;
      }

      // 1. Check if there is an imported note payload in the URL (from extension)
      const importParam = searchParams.get('import');
      if (importParam) {
        try {
          const raw = decodeURIComponent(atob(decodeURIComponent(importParam)));
          const importedNote: Note = JSON.parse(raw);
          if (importedNote && (importedNote.id || importedNote.htmlContent)) {
            const finalNote: Note = {
              ...importedNote,
              id: id,
            };
            await notesApi.saveNote(finalNote);
            if (isMounted) {
              setActiveDocument(finalNote);
              setIsLoadingDoc(false);
              navigate(`/notes/${id}`, { replace: true });
              return;
            }
          }
        } catch (e) {
          console.warn('Failed to parse transferred note from extension:', e);
        }
      }

      // 2. Check if there's a pending stream generation for this note ID (session or local storage)
      const pendingRaw = sessionStorage.getItem(`pending_note_gen_${id}`) || localStorage.getItem(`pending_note_gen_${id}`);
      if (pendingRaw) {
        try {
          const draftData = JSON.parse(pendingRaw);
          if (!streamStartedRef.current) {
            streamStartedRef.current = true;
            await startStreamingSynthesis(id, draftData);
          }
          return;
        } catch (e) {
          console.warn('Failed to parse pending draft data:', e);
        }
      }

      // If stream has already been started, do not overwrite with null
      if (streamStartedRef.current) {
        return;
      }

      // 3. Otherwise load existing saved note from storage/backend
      setIsLoadingDoc(true);
      const found = await notesApi.fetchNoteById(id);
      if (isMounted) {
        setActiveDocument(found);
        setIsLoadingDoc(false);
      }
    };

    initPage();

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (isLoadingDoc) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <Spinner size="lg" />
          <p className="mt-4 text-sm text-stone-500 font-mono">Synthesizing requested document...</p>
        </div>
      </MainLayout>
    );
  }

  if (!activeDocument && !isStreaming) {
    return (
      <MainLayout>
        <div className="max-w-md mx-auto my-20 p-8 bg-amber-50/70 border border-amber-200/80 rounded-2xl text-center shadow-sm">
          <h2 className="font-serif font-bold text-xl text-stone-900 mb-2">No Active Note</h2>
          <p className="text-sm text-stone-600 mb-6">
            Enter a YouTube link on the homepage to generate new structured academic notes.
          </p>
          <Button variant="primary" onClick={() => navigate('/')}>
            + Create New Note
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto px-4 py-4 space-y-4">
        {streamError && (
          <GenerationErrorAlert
            error={streamError}
            onRetry={() => {
              if (id) {
                const pendingRaw = sessionStorage.getItem(`pending_note_gen_${id}`);
                if (pendingRaw) {
                  const draftData = JSON.parse(pendingRaw);
                  startStreamingSynthesis(id, draftData);
                }
              }
            }}
            onUseSample={async (sampleUrl) => {
              if (id) {
                const sampleDraft = {
                  id,
                  youtubeUrl: sampleUrl,
                  customTopic: 'Current Electricity & Circuit Laws Masterclass',
                  settings: {
                    detailLevel: 'detailed',
                    diagramDensity: 'balanced',
                    examples: 'many',
                    includeCode: true,
                    detailedMath: true,
                  },
                };
                sessionStorage.setItem(`pending_note_gen_${id}`, JSON.stringify(sampleDraft));
                startStreamingSynthesis(id, sampleDraft);
              }
            }}
            onDismiss={() => setStreamError(null)}
          />
        )}

        {activeDocument && (
          <NoteEditor
            note={activeDocument}
            activeThemeId={activeThemeId}
            isStreaming={isStreaming}
            onThemeChange={setTheme}
            onUpdateContent={(html, label) => {
              updateContent(html, label);
              setActiveDocument((prev) => (prev ? { ...prev, htmlContent: html } : prev));
            }}
            onRestoreVersion={restoreVersion}
            onBackToLibrary={() => navigate('/notes')}
          />
        )}
      </div>
    </MainLayout>
  );
};
