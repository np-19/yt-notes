import React, { useState, useEffect, useRef } from 'react';
import { Note } from '../types/notes.types';
import { NOTE_THEMES } from '../../../constants';
import { parseMarkdownToHtml, extractMarkdownHeadings } from '../../../lib/markdown';
import { Button } from '../../../components/ui/Button';
import { notesApi } from '../api/notes.api';
import { useNoteRenderer } from '../hooks/useNoteRenderer';
import { FloatingRefineToolbar } from './FloatingRefineToolbar';
import { RefinePanel } from './RefinePanel';
import { triggerNotePrint } from '../services/printService';

export interface NoteEditorProps {
  note: Note;
  activeThemeId: string;
  isStreaming?: boolean;
  onThemeChange: (themeId: string) => void;
  onUpdateContent: (newHtml: string, label?: string) => void;
  onRestoreVersion: (versionId: string) => void;
  onBackToLibrary?: () => void;
}

export const NoteEditor: React.FC<NoteEditorProps> = ({
  note,
  activeThemeId,
  isStreaming = false,
  onThemeChange,
  onUpdateContent,
  onRestoreVersion,
  onBackToLibrary,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editableHtml, setEditableHtml] = useState(note.htmlContent);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiRefining, setIsAiRefining] = useState(false);
  const [activeTab, setActiveTab] = useState<'content' | 'toc' | 'history'>('content');

  // Multi-Chunk Selection State
  const [selectedChunks, setSelectedChunks] = useState<string[]>([]);
  const [selectedText, setSelectedText] = useState<string>('');
  const [selectionRect, setSelectionRect] = useState<{ top: number; left: number } | null>(null);
  const [floatingPrompt, setFloatingPrompt] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);
  const floatingBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setEditableHtml(note.htmlContent);
  }, [note.htmlContent]);

  const renderedHtml = parseMarkdownToHtml(editableHtml);
  const headings = extractMarkdownHeadings(editableHtml);
  const selectedTheme = NOTE_THEMES.find((t) => t.id === activeThemeId) || NOTE_THEMES[0];

  // Initialize KaTeX, Prism, Mermaid, and dynamic highlights
  useNoteRenderer({
    containerRef,
    renderedHtml,
    activeThemeId,
    isStreaming,
    selectedChunks,
  });

  const addChunkToSelection = (textToAdd?: string) => {
    const text = (textToAdd || selectedText).trim();
    if (text && !selectedChunks.includes(text)) {
      setSelectedChunks((prev) => [...prev, text]);
    }
    setSelectedText('');
    window.getSelection()?.removeAllRanges();
  };

  const removeChunk = (index: number) => {
    setSelectedChunks((prev) => prev.filter((_, i) => i !== index));
  };

  const clearAllChunks = () => {
    setSelectedChunks([]);
    setSelectedText('');
    setSelectionRect(null);
    window.getSelection()?.removeAllRanges();
  };

  // Handle Mouse Text Selection
  useEffect(() => {
    const handleMouseUp = (e: MouseEvent) => {
      if (floatingBarRef.current && floatingBarRef.current.contains(e.target as Node)) {
        return;
      }

      const selection = window.getSelection();
      const text = selection?.toString().trim();

      if (text && text.length >= 2 && containerRef.current && containerRef.current.contains(selection?.anchorNode || null)) {
        try {
          const range = selection!.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          setSelectedText(text);
          setSelectionRect({
            top: rect.top + window.scrollY - 54,
            left: Math.max(20, rect.left + rect.width / 2),
          });
        } catch {
          setSelectedText(text);
        }
      } else {
        if (!(e.target as HTMLElement)?.closest('.ai-refine-interactive')) {
          setSelectedText('');
          if (selectedChunks.length === 0) {
            setSelectionRect(null);
          }
        }
      }
    };

    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [selectedChunks.length]);

  const executeRefine = async (instruction: string, targetSelection?: string | string[]) => {
    if (!instruction.trim()) return;

    setIsAiRefining(true);
    try {
      const response = await notesApi.refineNotes(editableHtml, instruction, targetSelection);
      if (response && response.html && response.html.trim().length > 0) {
        const newMarkdown = response.html.trim();
        onUpdateContent(newMarkdown, `AI Edit: ${instruction.slice(0, 24)}...`);
        setEditableHtml(newMarkdown);
      }
      setAiPrompt('');
      setFloatingPrompt('');
      setSelectedText('');
      setSelectedChunks([]);
      setSelectionRect(null);
    } catch (err) {
      console.warn('AI Refinement failed:', err);
    } finally {
      setIsAiRefining(false);
    }
  };

  const handleRefineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targets =
      selectedChunks.length > 0
        ? selectedChunks
        : selectedText
        ? [selectedText]
        : undefined;
    await executeRefine(aiPrompt, targets);
  };

  const handleSaveEdit = () => {
    onUpdateContent(editableHtml, 'Manual Edit');
    setIsEditing(false);
  };

  const handlePrintPdf = () => {
    const noteEl = document.querySelector('.note-content') as HTMLElement;
    triggerNotePrint(noteEl, activeThemeId);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 print:p-0 print:max-w-full print:m-0">
      {/* Top Action Bar */}
      <div className="no-print bg-stone-900 text-stone-100 p-4 rounded-xl shadow-md mb-6 flex flex-wrap items-center justify-between gap-4 border border-stone-800">
        <div className="flex items-center space-x-3">
          {onBackToLibrary && (
            <Button variant="ghost" size="sm" onClick={onBackToLibrary} className="text-stone-300 hover:text-white">
              ← Back
            </Button>
          )}
          <h2 className="font-serif font-bold text-lg text-white truncate max-w-xs sm:max-w-md">
            {note.title}
          </h2>
        </div>

        <div className="flex items-center space-x-2 flex-wrap gap-y-2">
          {isStreaming && (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              Live Streaming...
            </span>
          )}

          {/* Theme Palette Switcher */}
          <div className="flex items-center space-x-1.5 bg-stone-800 p-1.5 rounded-lg border border-stone-700">
            <span className="text-[11px] font-mono text-stone-400 px-1">Theme:</span>
            {NOTE_THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => onThemeChange(t.id)}
                className={`w-5 h-5 rounded-full border transition-transform ${
                  activeThemeId === t.id ? 'scale-125 ring-2 ring-amber-400 ring-offset-1 ring-offset-stone-900' : 'opacity-70 hover:opacity-100'
                }`}
                style={{ backgroundColor: t.primary, borderColor: t.secondary }}
                title={t.name}
              />
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditing(!isEditing)}
            className="bg-stone-800 text-stone-200 border-stone-700 hover:bg-stone-700 hover:text-white"
          >
            {isEditing ? 'Preview Document' : 'Edit Source Markdown'}
          </Button>

          <Button variant="secondary" size="sm" onClick={handlePrintPdf}>
            Export to PDF (A4)
          </Button>
        </div>
      </div>

      {/* Editor & Refinement Tabs */}
      <div className="no-print flex border-b border-stone-200 mb-6">
        <button
          onClick={() => setActiveTab('content')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'content'
              ? 'border-amber-600 text-amber-900 font-bold'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          Document View
        </button>
        <button
          onClick={() => setActiveTab('toc')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'toc'
              ? 'border-amber-600 text-amber-900 font-bold'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          Table of Contents ({headings.length})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'history'
              ? 'border-amber-600 text-amber-900 font-bold'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          Version History ({note.versions?.length || 1})
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'toc' && (
        <div className="no-print bg-amber-50/70 p-6 rounded-xl border border-amber-200/80 mb-6">
          <h3 className="font-serif font-bold text-stone-900 text-lg mb-3 border-b border-amber-200/60 pb-2">
            Table of Contents
          </h3>
          <ul className="space-y-2">
            {headings.map((h, i) => (
              <li
                key={i}
                className="text-sm font-medium text-stone-700 hover:text-amber-800 cursor-pointer"
                style={{ paddingLeft: `${(h.level - 1) * 16}px` }}
                onClick={() => {
                  const el = document.getElementById(h.id);
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                  setActiveTab('content');
                }}
              >
                • {h.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="no-print bg-amber-50/70 p-6 rounded-xl border border-amber-200/80 mb-6">
          <h3 className="font-serif font-bold text-stone-900 text-lg mb-3 border-b border-amber-200/60 pb-2">
            Version Snapshots
          </h3>
          <div className="space-y-3">
            {note.versions?.map((v) => (
              <div key={v.id} className="flex items-center justify-between p-3 bg-white border border-stone-200 rounded-lg">
                <div>
                  <p className="font-medium text-sm text-stone-900">{v.label}</p>
                  <p className="text-xs text-stone-500 font-mono">
                    {new Date(v.timestamp).toLocaleString()}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => onRestoreVersion(v.id)}>
                  Restore Version
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Refine Control Box */}
      <RefinePanel
        selectedChunks={selectedChunks}
        selectedText={selectedText}
        aiPrompt={aiPrompt}
        isAiRefining={isAiRefining}
        onAiPromptChange={setAiPrompt}
        onAddChunk={() => addChunkToSelection()}
        onRemoveChunk={removeChunk}
        onClearAllChunks={clearAllChunks}
        onSubmit={handleRefineSubmit}
      />

      {/* Floating Selection Refine Toolbar */}
      {selectionRect && (selectedText || selectedChunks.length > 0) && !isEditing && (
        <FloatingRefineToolbar
          floatingBarRef={floatingBarRef}
          selectionRect={selectionRect}
          selectedText={selectedText}
          selectedChunks={selectedChunks}
          floatingPrompt={floatingPrompt}
          isAiRefining={isAiRefining}
          onFloatingPromptChange={setFloatingPrompt}
          onAddChunk={() => addChunkToSelection()}
          onClearAllChunks={clearAllChunks}
          onExecuteRefine={executeRefine}
          onDismiss={() => {
            setSelectedText('');
            setSelectionRect(null);
          }}
        />
      )}

      {/* Raw Markdown Editor or Document Preview */}
      {isEditing ? (
        <div className="no-print space-y-4">
          <textarea
            value={editableHtml}
            onChange={(e) => setEditableHtml(e.target.value)}
            placeholder="# Write or edit Markdown here..."
            className="w-full h-[600px] p-4 font-mono text-xs bg-stone-900 text-amber-100 rounded-xl border border-stone-800 shadow-inner focus:outline-none focus:ring-2 focus:ring-amber-500 leading-relaxed"
          />
          <div className="flex justify-end space-x-3">
            <Button variant="ghost" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveEdit}>
              Save Changes
            </Button>
          </div>
        </div>
      ) : (
        <div
          ref={containerRef}
          className={`note-content theme-${activeThemeId || 'amber'} print-container bg-white shadow-xl rounded-xl p-8 border border-stone-200 min-h-[900px] font-sans antialiased text-stone-900`}
          style={
            {
              '--theme-primary': selectedTheme.primary,
              '--theme-secondary': selectedTheme.secondary,
              '--theme-accent': selectedTheme.accent,
              '--theme-bg': selectedTheme.bg,
            } as React.CSSProperties
          }
          dangerouslySetInnerHTML={{ __html: renderedHtml }}
        />
      )}
    </div>
  );
};
