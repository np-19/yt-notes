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

  const addChunkToSelection = (textToAdd?: string) => {
    const text = (textToAdd || selectedText).trim();
    if (text && !selectedChunks.includes(text)) {
      setSelectedChunks((prev) => [...prev, text]);
    }
    setSelectedText('');
    setSelectionRect(null);
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
        // Only clear active highlighted text if not clicking inside refinement UI
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
      if (!isStreaming) {
        const renderMermaidDiagrams = async () => {
          try {
            if (!containerRef.current) return;
            const mermaidNodes = Array.from(
              containerRef.current.querySelectorAll('.mermaid, pre code.language-mermaid, pre.language-mermaid')
            );
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

              // Process sequentially using a for loop to avoid concurrent rendering collisions in Mermaid's singleton parser
              for (let i = 0; i < mermaidNodes.length; i++) {
                const node = mermaidNodes[i];
                if (!containerRef.current || !containerRef.current.contains(node)) continue;
                if (node.getAttribute('data-processed') === 'true') continue;

                const rawText = node.textContent?.trim() || '';
                if (!rawText) continue;

                let targetContainer = node as HTMLElement;
                if (node.tagName === 'CODE' && node.parentElement?.tagName === 'PRE') {
                  const div = document.createElement('div');
                  div.className = 'mermaid';
                  node.parentElement.replaceWith(div);
                  targetContainer = div;
                } else if (node.tagName === 'PRE') {
                  const div = document.createElement('div');
                  div.className = 'mermaid';
                  node.replaceWith(div);
                  targetContainer = div;
                }

                let cleanDiagram = rawText.replace(/^```mermaid\s*/i, '').replace(/```$/i, '').trim();
                if (
                  !cleanDiagram.startsWith('graph') &&
                  !cleanDiagram.startsWith('flowchart') &&
                  !cleanDiagram.startsWith('sequenceDiagram') &&
                  !cleanDiagram.startsWith('classDiagram') &&
                  !cleanDiagram.startsWith('stateDiagram') &&
                  !cleanDiagram.startsWith('erDiagram') &&
                  !cleanDiagram.startsWith('gantt') &&
                  !cleanDiagram.startsWith('pie')
                ) {
                  cleanDiagram = `graph TD\n${cleanDiagram}`;
                }

                // Auto-repair unquoted node labels like B[Text (with parens & symbols)] -> B["Text (with parens & symbols)"]
                cleanDiagram = cleanDiagram.replace(/([\w-]+)\[([^"\]\n]+)\]/g, (_, id, label) => {
                  return `${id}["${label.replace(/"/g, "'")}"]`;
                });

                const renderId = `mermaid-svg-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`;
                try {
                  const { svg } = await mermaid.render(renderId, cleanDiagram);
                  if (targetContainer && document.body.contains(targetContainer)) {
                    targetContainer.innerHTML = svg;
                    targetContainer.setAttribute('data-processed', 'true');

                    // Force direct inline centering on the container and rendered SVG
                    targetContainer.style.display = 'flex';
                    targetContainer.style.justifyContent = 'center';
                    targetContainer.style.alignItems = 'center';
                    targetContainer.style.margin = '24px auto';
                    targetContainer.style.width = '100%';
                    targetContainer.style.textAlign = 'center';

                    const svgEl = targetContainer.querySelector('svg');
                    if (svgEl) {
                      svgEl.style.display = 'block';
                      svgEl.style.marginLeft = 'auto';
                      svgEl.style.marginRight = 'auto';
                      svgEl.style.maxWidth = '100%';
                      svgEl.style.maxHeight = '420px';
                      svgEl.style.width = 'auto';
                    }
                  }
                } catch (diagramErr) {
                  console.warn('Skipping unparseable Mermaid diagram (will retry if updated):', diagramErr);
                  // Do NOT mark data-processed="true" so updates or complete inputs can render
                  // Clean up any lingering error element created by Mermaid in document
                  const errEls = document.querySelectorAll(`[id^="d${renderId}"], [id^="${renderId}"]`);
                  errEls.forEach((el) => el.remove());
                }
              }
            }
          } catch (e) {
            console.warn('Mermaid initialization error:', e);
          }
        };

        renderMermaidDiagrams();
      }

      // 5. Force center on all mermaid SVGs & flow diagrams
      try {
        const allSvgs = containerRef.current.querySelectorAll('.mermaid svg, svg.flowchart, [id^="mermaid-svg"]');
        allSvgs.forEach((svg) => {
          const svgEl = svg as SVGElement;
          svgEl.style.setProperty('margin', '0 auto', 'important');
          svgEl.style.setProperty('display', 'block', 'important');
          svgEl.style.setProperty('max-width', '100%', 'important');
          svgEl.style.setProperty('max-height', '420px', 'important');
          svgEl.style.setProperty('width', 'auto', 'important');
          if (svgEl.parentElement) {
            svgEl.parentElement.style.setProperty('text-align', 'center', 'important');
            svgEl.parentElement.style.setProperty('display', 'flex', 'important');
            svgEl.parentElement.style.setProperty('justify-content', 'center', 'important');
            svgEl.parentElement.style.setProperty('margin', '20px auto', 'important');
          }
        });

        const flowDiagrams = containerRef.current.querySelectorAll('.flow-diagram');
        flowDiagrams.forEach((fd) => {
          const el = fd as HTMLElement;
          el.style.setProperty('display', 'flex', 'important');
          el.style.setProperty('justify-content', 'center', 'important');
          el.style.setProperty('align-items', 'center', 'important');
          el.style.setProperty('margin', '20px auto', 'important');
          el.style.setProperty('width', '100%', 'important');
        });
      } catch (e) {}
    }
  }, [renderedHtml, activeTab, isEditing, activeThemeId, isStreaming]);

  const handlePrintPdf = () => {
    const isInsideSidePanel = window.self !== window.top || window.location.hash.includes('sidepanel');
    const noteEl = document.querySelector('.note-content');

    if (isInsideSidePanel && noteEl) {
      const printWindow = window.open('', '_blank', 'width=1050,height=950');
      if (printWindow) {
        const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
          .map((el) => el.outerHTML)
          .join('\n');

        const html = `<!DOCTYPE html>
<html>
<head>
  <title>${(note.title || 'Lecture Study Notes').replace(/"/g, '&quot;')}</title>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  ${styles}
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 14mm;
    }
    html, body {
      background: #f1f5f9 !important;
      color: #0f172a !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow-x: hidden !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    .print-bar {
      position: sticky;
      top: 0;
      left: 0;
      right: 0;
      z-index: 999999;
      background: #0f172a;
      color: #ffffff;
      padding: 12px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 3px solid #f59e0b;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    }
    .print-action-btn {
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
      color: #ffffff;
      border: none;
      padding: 10px 24px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 14px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 2px 10px rgba(245, 158, 11, 0.4);
      transition: all 0.15s ease;
      user-select: none;
    }
    .print-action-btn:hover {
      filter: brightness(1.1);
      transform: translateY(-1px);
    }
    .close-action-btn {
      background: #1e293b;
      color: #cbd5e1;
      border: 1px solid #334155;
      padding: 10px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      user-select: none;
    }
    .close-action-btn:hover {
      background: #334155;
      color: #ffffff;
    }
    .floating-print-action-btn {
      position: fixed;
      bottom: 28px;
      right: 28px;
      z-index: 999999;
      background: #0f172a;
      color: #ffffff;
      border: 2px solid #f59e0b;
      padding: 12px 20px;
      border-radius: 50px;
      font-weight: 700;
      font-size: 14px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 6px 20px rgba(0,0,0,0.35);
      transition: all 0.15s ease;
      user-select: none;
    }
    .floating-print-action-btn:hover {
      background: #1e293b;
      transform: scale(1.04);
    }
    .note-content {
      width: 100% !important;
      max-width: 210mm !important;
      margin: 24px auto !important;
      background: #ffffff !important;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08) !important;
      border: 1px solid #e2e8f0 !important;
      padding: 36px 40px !important;
      border-radius: 12px !important;
      box-sizing: border-box !important;
    }
    @media print {
      body {
        background: #ffffff !important;
      }
      .no-print, .print-bar, .floating-print-action-btn {
        display: none !important;
      }
      .note-content {
        max-width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        border: none !important;
        box-shadow: none !important;
        border-radius: 0 !important;
      }
    }
  </style>
</head>
<body class="theme-${activeThemeId || 'amber'}">
  <div class="print-bar no-print">
    <div style="display: flex; align-items: center; gap: 12px;">
      <span style="font-weight: 800; font-size: 16px; color: #ffffff; letter-spacing: -0.01em;">📄 YouTube Notes</span>
      <span style="font-size: 12px; color: #94a3b8; background: #1e293b; padding: 3px 10px; border-radius: 6px; font-weight: 500;">A4 Document Ready</span>
    </div>
    <div style="display: flex; align-items: center; gap: 12px;">
      <button class="print-action-btn" id="top-print-btn">
        🖨️ Print / Save as PDF
      </button>
      <button class="close-action-btn" id="top-close-btn">
        ✕ Close
      </button>
    </div>
  </div>

  <button class="floating-print-action-btn no-print" id="floating-print-btn">
    🖨️ Print / Save as PDF
  </button>

  <div class="note-content">
    ${noteEl.innerHTML}
  </div>
</body>
</html>`;

        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();

        // Programmatically attach click handlers directly on DOM elements
        const doPrint = () => {
          try {
            printWindow.focus();
            printWindow.print();
          } catch (err) {
            console.error('Print trigger failed:', err);
          }
        };

        const topBtn = printWindow.document.getElementById('top-print-btn');
        if (topBtn) topBtn.addEventListener('click', doPrint);

        const floatBtn = printWindow.document.getElementById('floating-print-btn');
        if (floatBtn) floatBtn.addEventListener('click', doPrint);

        const closeBtn = printWindow.document.getElementById('top-close-btn');
        if (closeBtn) {
          closeBtn.addEventListener('click', () => {
            printWindow.close();
          });
        }

        setTimeout(() => {
          doPrint();
        }, 500);

        return;
      }
    }

    window.print();
  };

  const handleSaveEdit = () => {
    onUpdateContent(editableHtml, 'Manual Edit');
    setIsEditing(false);
  };

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

      {/* Refinement Control Box with Multi-Chunk Selection Indicator */}
      <div className="no-print bg-stone-50 border border-stone-200/90 rounded-xl p-3.5 shadow-xs mb-6 space-y-3 ai-refine-interactive">
        {(selectedChunks.length > 0 || selectedText) && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] font-semibold tracking-wide text-stone-600 uppercase">
                Targeted Selection ({selectedChunks.length + (selectedText && !selectedChunks.includes(selectedText) ? 1 : 0)} {selectedChunks.length + (selectedText && !selectedChunks.includes(selectedText) ? 1 : 0) === 1 ? 'chunk' : 'chunks'})
              </span>
              <button
                type="button"
                onClick={clearAllChunks}
                className="text-stone-500 hover:text-stone-800 font-mono text-[11px] underline cursor-pointer"
              >
                Clear (Apply to Entire Document)
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {selectedChunks.map((chunk, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 bg-white border border-stone-300/80 px-3 py-1 rounded-lg text-xs max-w-full sm:max-w-md shadow-2xs"
                >
                  <span className="font-mono font-medium text-[10px] text-stone-600 bg-stone-100 px-1.5 py-0.5 rounded flex-shrink-0">
                    #{idx + 1}
                  </span>
                  <span className="text-stone-800 truncate text-xs flex-1">
                    "{chunk.slice(0, 50)}{chunk.length > 50 ? '...' : ''}"
                  </span>
                  <button
                    type="button"
                    onClick={() => removeChunk(idx)}
                    className="text-stone-400 hover:text-stone-800 hover:bg-stone-100 p-0.5 rounded flex-shrink-0 font-mono text-xs cursor-pointer ml-1"
                    title="Remove chunk"
                  >
                    ✕
                  </button>
                </div>
              ))}

              {selectedText && !selectedChunks.includes(selectedText) && (
                <div className="flex items-center gap-2 bg-stone-100/70 border border-stone-300 border-dashed px-3 py-1 rounded-lg text-xs max-w-full sm:max-w-md">
                  <span className="font-mono font-medium text-[10px] text-stone-500 bg-stone-200/70 px-1.5 py-0.5 rounded flex-shrink-0">
                    Active
                  </span>
                  <span className="text-stone-600 truncate text-xs flex-1">
                    "{selectedText.slice(0, 45)}{selectedText.length > 45 ? '...' : ''}"
                  </span>
                  <button
                    type="button"
                    onClick={() => addChunkToSelection()}
                    className="text-stone-800 hover:text-black font-mono text-[11px] font-semibold px-2 py-0.5 bg-stone-200 hover:bg-stone-300 rounded cursor-pointer whitespace-nowrap ml-1 transition-colors"
                  >
                    + Pin Chunk
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleRefineSubmit} className="flex gap-2.5 w-full items-center">
          <input
            type="text"
            placeholder={
              selectedChunks.length > 0
                ? `Specify edits for the ${selectedChunks.length} selected chunks (e.g., format as comparison table, rewrite concisely)...`
                : selectedText
                ? "Describe edit (e.g., expand details, format code, fix equation)..."
                : "Ask to refine notes (e.g., expand section 2, add code example, simplify math)..."
            }
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            className="flex-1 px-3.5 py-2.5 text-sm bg-white border border-stone-300 rounded-lg text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all shadow-2xs font-sans"
          />
          <Button type="submit" variant="secondary" size="md" isLoading={isAiRefining} className="px-5 font-semibold">
            {selectedChunks.length > 0
              ? `Refine Selection (${selectedChunks.length})`
              : selectedText
              ? 'Refine Selection'
              : 'Refine Notes'}
          </Button>
        </form>
      </div>

      {/* Floating Selection Toolbar - Rounded-Full Minimalist Pill Design */}
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
          className="ai-refine-interactive bg-[#232326] text-white shadow-2xl border border-neutral-700/70 rounded-full pl-3.5 pr-2 py-1.5 flex items-center gap-2 w-[540px] max-w-[94vw] ring-1 ring-black/50 backdrop-blur-md"
        >
          {/* Word Count */}
          <span className="text-neutral-400 text-xs font-mono select-none flex-shrink-0">
            {selectedText.split(/\s+/).filter(Boolean).length}w
          </span>

          {/* Vertical Divider */}
          <div className="h-4 w-[1px] bg-neutral-700/80 flex-shrink-0" />

          {/* Pin Chunk Action */}
          <button
            type="button"
            onClick={() => addChunkToSelection()}
            className="flex items-center gap-1.5 text-neutral-300 hover:text-white text-xs font-medium px-2 py-1 rounded-full hover:bg-neutral-800/80 transition-colors cursor-pointer flex-shrink-0"
            title="Pin snippet for multi-chunk refinement"
          >
            <svg className="w-3.5 h-3.5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            <span>Pin</span>
            {selectedChunks.length > 0 && (
              <span className="bg-orange-500 text-white text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full">
                {selectedChunks.length}
              </span>
            )}
          </button>

          {/* Prompt Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const targets = selectedChunks.length > 0 ? [...selectedChunks, selectedText] : selectedText;
              executeRefine(floatingPrompt, targets);
            }}
            className="flex items-center gap-2 flex-1 min-w-0"
          >
            <input
              type="text"
              value={floatingPrompt}
              onChange={(e) => setFloatingPrompt(e.target.value)}
              placeholder="Refine selection..."
              className="flex-1 min-w-0 bg-transparent text-white placeholder-neutral-500 text-xs sm:text-sm focus:outline-none font-sans px-1"
              autoFocus
            />

            {/* Circular Orange Action Button */}
            <button
              type="submit"
              disabled={isAiRefining}
              className="w-7 h-7 rounded-full bg-orange-600 hover:bg-orange-500 text-white flex items-center justify-center transition-all flex-shrink-0 disabled:opacity-50 shadow-sm active:scale-95 cursor-pointer"
              title="Apply Refinement"
            >
              {isAiRefining ? (
                <svg className="animate-spin w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              )}
            </button>
          </form>

          {/* Dismiss Button */}
          <button
            type="button"
            onClick={() => {
              setSelectedText('');
              setSelectionRect(null);
            }}
            className="text-neutral-500 hover:text-neutral-200 p-1 rounded-full transition-colors flex-shrink-0 cursor-pointer text-xs"
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
