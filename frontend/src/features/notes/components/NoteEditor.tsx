import React, { useState, useEffect, useRef } from 'react';
import { Note } from '../types/notes.types';
import { NOTE_THEMES } from '../../../constants';
import { parseMarkdownToHtml, extractMarkdownHeadings } from '../../../lib/markdown';
import { Button } from '../../../components/ui/Button';
import katex from 'katex';
import renderMathInElement from 'katex/dist/contrib/auto-render.mjs';
import mermaid from 'mermaid';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';

import { notesApi } from '../api/notes.api';

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
  
  // Mouse Selection State
  const [selectedText, setSelectedText] = useState<string>('');
  const [selectionRect, setSelectionRect] = useState<{ top: number; left: number } | null>(null);
  const [floatingPrompt, setFloatingPrompt] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);
  const floatingBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setEditableHtml(note.htmlContent);
  }, [note.htmlContent]);

  // Handle Mouse Text Selection
  useEffect(() => {
    const handleMouseUp = (e: MouseEvent) => {
      // If clicking inside the floating toolbar, don't dismiss
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
        } catch (err) {
          setSelectedText(text);
        }
      } else {
        // Only clear if not clicking inside input
        if (!(e.target as HTMLElement)?.closest('.ai-refine-interactive')) {
          setSelectedText('');
          setSelectionRect(null);
        }
      }
    };

    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const renderedHtml = parseMarkdownToHtml(editableHtml);
  const headings = extractMarkdownHeadings(editableHtml);

  // Render KaTeX Math Equations & Mermaid Vector Flowcharts inside document preview
  useEffect(() => {
    if (containerRef.current) {
      // 1. Render all inline ($...$, \(...\)) and block ($$...$$, \[...\]) math formulas using KaTeX auto-render
      try {
        renderMathInElement(containerRef.current, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false },
            { left: '\\(', right: '\\)', display: false },
            { left: '\\[', right: '\\]', display: true },
          ],
          throwOnError: false,
          ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
          ignoredClasses: ['katex', 'no-mathjax'],
        });
      } catch (e) {
        console.warn('KaTeX auto-render error:', e);
      }

      // 2. Render explicit math containers (.math-block, .math, .equation, [data-latex])
      const mathElements = containerRef.current.querySelectorAll('.math-block, .math, .equation, [data-latex]');
      mathElements.forEach((el) => {
        try {
          if (!el.querySelector('.katex')) {
            const latex = el.getAttribute('data-latex') || el.textContent || '';
            const isDisplay = el.tagName === 'DIV' || el.classList.contains('math-block') || el.classList.contains('equation');
            el.innerHTML = katex.renderToString(latex, { displayMode: isDisplay, throwOnError: false });
          }
        } catch (e) {
          console.warn('KaTeX explicit rendering error:', e);
        }
      });

      // 3. Highlight code snippets
      try {
        Prism.highlightAllUnder(containerRef.current);
      } catch (e) {
        console.warn('Prism highlighting error:', e);
      }

      // 4. Render Mermaid Flowcharts safely with dynamic theme palette support
      try {
        const mermaidNodes = containerRef.current.querySelectorAll('.mermaid');
        if (mermaidNodes.length > 0) {
          mermaid.initialize({
            startOnLoad: false,
            theme: 'base',
            securityLevel: 'loose',
            suppressErrorRendering: true,
            flowchart: {
              curve: 'basis',
              padding: 16,
              nodeSpacing: 50,
              rankSpacing: 45,
              htmlLabels: true,
              useMaxWidth: true,
            },
            themeVariables: {
              fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
              fontSize: '13px',
              primaryColor: selectedTheme.bg,
              primaryBorderColor: selectedTheme.secondary,
              primaryTextColor: selectedTheme.primary,
              lineColor: selectedTheme.accent,
              secondaryColor: '#eff6ff',
              secondaryBorderColor: '#3b82f6',
              secondaryTextColor: '#1e3a8a',
              tertiaryColor: '#fafaf9',
              tertiaryBorderColor: '#e7e5e4',
              tertiaryTextColor: '#44403c',
              edgeLabelBackground: '#ffffff',
            },
          });

          mermaidNodes.forEach(async (node, index) => {
            try {
              if (node.getAttribute('data-processed') === 'true') return;
              const rawText = node.textContent?.trim() || '';
              if (!rawText) return;

              let cleanDiagram = rawText.replace(/^```mermaid\s*/i, '').replace(/```$/i, '').trim();
              if (
                !cleanDiagram.startsWith('graph') &&
                !cleanDiagram.startsWith('flowchart') &&
                !cleanDiagram.startsWith('sequenceDiagram') &&
                !cleanDiagram.startsWith('classDiagram') &&
                !cleanDiagram.startsWith('stateDiagram')
              ) {
                cleanDiagram = `graph TD\n${cleanDiagram}`;
              }

              // Auto-repair unquoted node labels like B[Text (with parens & symbols)] -> B["Text (with parens & symbols)"]
              cleanDiagram = cleanDiagram.replace(/([\w-]+)\[([^"\]\n]+)\]/g, (_, id, label) => {
                return `${id}["${label.replace(/"/g, "'")}"]`;
              });

              const id = `mermaid-svg-${Date.now()}-${index}`;
              const { svg } = await mermaid.render(id, cleanDiagram);
              node.innerHTML = svg;
              node.setAttribute('data-processed', 'true');
            } catch (diagramErr) {
              console.warn('Skipping unparseable Mermaid diagram:', diagramErr);
              node.setAttribute('data-processed', 'true');
            }
          });
        }
      } catch (e) {
        console.warn('Mermaid initialization error:', e);
      }
    }
  }, [renderedHtml, activeTab, isEditing, activeThemeId]);

  const handlePrintPdf = () => {
    window.print();
  };

  const handleSaveEdit = () => {
    onUpdateContent(editableHtml, 'Manual Edit');
    setIsEditing(false);
  };

  const executeRefine = async (instruction: string, targetSelection?: string) => {
    if (!instruction.trim()) return;

    setIsAiRefining(true);
    try {
      const response = await notesApi.refineNotes(editableHtml, instruction, targetSelection);
      if (response && response.html) {
        let newMarkdown = editableHtml;
        if (targetSelection && newMarkdown.includes(targetSelection)) {
          newMarkdown = newMarkdown.replace(targetSelection, response.html);
        } else if (response.html !== editableHtml) {
          newMarkdown = response.html;
        }
        onUpdateContent(newMarkdown, `AI Edit: ${instruction.slice(0, 24)}...`);
        setEditableHtml(newMarkdown);
      }
      setAiPrompt('');
      setFloatingPrompt('');
      setSelectedText('');
      setSelectionRect(null);
    } catch (err) {
      console.warn('AI Refinement failed:', err);
    } finally {
      setIsAiRefining(false);
    }
  };

  const handleRefineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeRefine(aiPrompt, selectedText || undefined);
  };

  const selectedTheme = NOTE_THEMES.find((t) => t.id === activeThemeId) || NOTE_THEMES[0];

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

      {/* AI Refinement Box with Active Target Selection Indicator */}
      <div className="no-print bg-white p-4 rounded-xl border border-stone-200 shadow-sm mb-6 space-y-2 ai-refine-interactive">
        {selectedText && (
          <div className="flex items-center justify-between gap-2 bg-amber-50 border border-amber-200/90 px-3 py-1.5 rounded-lg text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex-shrink-0 font-mono font-bold uppercase text-[10px] px-1.5 py-0.5 rounded bg-amber-200/80 text-amber-900">
                🎯 Target Selection ({selectedText.split(/\s+/).filter(Boolean).length} words)
              </span>
              <span className="text-stone-700 italic truncate font-sans text-xs">
                "{selectedText.slice(0, 100)}{selectedText.length > 100 ? '...' : ''}"
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedText('');
                setSelectionRect(null);
              }}
              className="text-stone-500 hover:text-stone-800 font-mono text-[11px] underline flex-shrink-0 cursor-pointer"
            >
              Clear (Refine All)
            </button>
          </div>
        )}

        <form onSubmit={handleRefineSubmit} className="flex gap-2 w-full">
          <input
            type="text"
            placeholder={
              selectedText
                ? "Ask AI to rewrite, expand, or simplify the selected text..."
                : "Ask AI to expand details, simplify section, or add code snippet..."
            }
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            className="flex-1 px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <Button type="submit" variant="secondary" isLoading={isAiRefining}>
            {selectedText ? 'Refine Selection' : 'Refine Notes'}
          </Button>
        </form>
      </div>

      {/* Floating Notion-Style Selection Toolbar */}
      {selectionRect && selectedText && !isEditing && (
        <div
          ref={floatingBarRef}
          style={{
            position: 'absolute',
            top: `${selectionRect.top}px`,
            left: `${selectionRect.left}px`,
            transform: 'translateX(-50%)',
            zIndex: 50,
          }}
          className="ai-refine-interactive bg-stone-900/95 backdrop-blur text-white shadow-2xl border border-stone-700 rounded-xl p-2 flex items-center gap-2"
        >
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold uppercase whitespace-nowrap">
            ✨ Selected ({selectedText.split(/\s+/).filter(Boolean).length}w)
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              executeRefine(floatingPrompt, selectedText);
            }}
            className="flex items-center gap-1.5"
          >
            <input
              type="text"
              value={floatingPrompt}
              onChange={(e) => setFloatingPrompt(e.target.value)}
              placeholder="e.g. Rewrite as bullet points, add formula..."
              className="px-2.5 py-1 text-xs bg-stone-800 border border-stone-700 rounded-lg text-white placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-amber-400 w-60 sm:w-72 font-sans"
              autoFocus
            />
            <button
              type="submit"
              disabled={isAiRefining}
              className="px-3 py-1 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-500 text-white transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
            >
              {isAiRefining ? 'Refining...' : 'Refine'}
            </button>
          </form>
          <button
            type="button"
            onClick={() => {
              setSelectedText('');
              setSelectionRect(null);
            }}
            className="text-stone-400 hover:text-white p-1 text-xs rounded hover:bg-stone-800 cursor-pointer"
            title="Dismiss selection"
          >
            ✕
          </button>
        </div>
      )}

      {/* Raw Markdown Editor Mode */}
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
        /* Standalone Academic Document Container for Preview & Clean A4 PDF Export */
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
