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
      title: draftData.customTopic || 'Synthesizing Notes...',
      videoUrl: draftData.youtubeUrl,
      htmlContent: '',
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
        localStorage.removeItem(`pending_note_gen_${noteId}`);
        setActiveDocument(finalNote);
        setIsStreaming(false);
        navigate(`/notes/${noteId}`, { replace: true });
      },
      (err) => {
        setStreamError(err);
        setIsStreaming(false);
        sessionStorage.removeItem(`pending_note_gen_${noteId}`);
        localStorage.removeItem(`pending_note_gen_${noteId}`);
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

      // 2. Check if this note is already saved in storage
      const existingNote = await notesApi.fetchNoteById(id);
      if (existingNote && existingNote.htmlContent) {
        if (isMounted) {
          setActiveDocument(existingNote);
          setIsLoadingDoc(false);
          sessionStorage.removeItem(`pending_note_gen_${id}`);
          localStorage.removeItem(`pending_note_gen_${id}`);
          if (searchParams.get('streaming')) {
            navigate(`/notes/${id}`, { replace: true });
          }
          return;
        }
      }

      // 3. If not already saved, check if there's a pending stream generation
      const pendingRaw = sessionStorage.getItem(`pending_note_gen_${id}`) || localStorage.getItem(`pending_note_gen_${id}`);
      if (pendingRaw) {
        try {
          const draftData = JSON.parse(pendingRaw);
          sessionStorage.removeItem(`pending_note_gen_${id}`);
          localStorage.removeItem(`pending_note_gen_${id}`);
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

      // 4. Fallback if note doesn't exist
      if (isMounted) {
        setActiveDocument(null);
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

        {isStreaming && (!activeDocument || !activeDocument.htmlContent) && (
          <div className="max-w-xl mx-auto my-16 p-10 bg-amber-50/60 dark:bg-stone-900/60 border border-amber-200/80 dark:border-stone-800 rounded-2xl shadow-sm text-center">
            <div className="flex justify-center mb-4">
              <Spinner size="lg" />
            </div>
            <h3 className="font-serif font-bold text-lg text-stone-900 dark:text-stone-100 mb-2">
              Synthesizing Notes with Gemini
            </h3>
            <p className="text-xs text-stone-500 font-mono">
              Ingesting video stream and streaming structured notes & diagrams...
            </p>
          </div>
        )}

        {activeDocument && activeDocument.htmlContent && (
          <NoteEditor
            note={activeDocument}
            activeThemeId={activeThemeId}
            isStreaming={isStreaming}
            onThemeChange={setTheme}
            onUpdateContent={async (html, label) => {
              updateContent(html, label);
              const now = new Date().toISOString();
              const versionLabel = label || `Refined ${new Date().toLocaleTimeString()}`;
              const newVersion = {
                id: `v-${Date.now()}`,
                timestamp: now,
                label: versionLabel,
                htmlContent: html,
              };
              const updatedDoc: Note = {
                ...activeDocument,
                htmlContent: html,
                updatedAt: now,
                versions: [newVersion, ...(activeDocument.versions || [])],
              };
              setActiveDocument(updatedDoc);
              await notesApi.saveNote(updatedDoc);
            }}
            onRestoreVersion={async (versionId) => {
              restoreVersion(versionId);
              const target = activeDocument.versions?.find((v) => v.id === versionId);
              if (target) {
                const updatedDoc: Note = {
                  ...activeDocument,
                  htmlContent: target.htmlContent,
                  updatedAt: new Date().toISOString(),
                };
                setActiveDocument(updatedDoc);
                await notesApi.saveNote(updatedDoc);
              }
            }}
            onBackToLibrary={() => navigate('/notes')}
          />
        )}
      </div>
    </MainLayout>
  );
};
