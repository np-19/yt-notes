import React, { useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { NotesPage } from '../features/notes/pages/NotesPage';
import { NotePage } from '../features/notes/pages/NotePage';
import { MainLayout } from '../components/layout/MainLayout';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { QUICK_ACTIONS } from '../constants';
import { NoteSettings } from '../features/notes/types/notes.types';

const HomePage: React.FC = () => {
  const [transcriptText, setTranscriptText] = useState('');
  const [customTopic, setCustomTopic] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [showSettings, setShowSettings] = useState(true);

  // Settings Sliders State
  const [detailLevel, setDetailLevel] = useState<'summary' | 'detailed' | 'comprehensive'>('detailed');
  const [diagramDensity, setDiagramDensity] = useState<'none' | 'balanced' | 'heavy'>('balanced');
  const [examples, setExamples] = useState<'concise' | 'many'>('many');
  const [includeCode, setIncludeCode] = useState(true);
  const [detailedMath, setDetailedMath] = useState(true);

  const navigate = useNavigate();

  const handleGenerate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!transcriptText.trim() && !youtubeUrl.trim()) return;

    const newNoteId = `note-${Date.now()}`;
    const settings: NoteSettings = {
      detailLevel,
      diagramDensity,
      examples,
      includeCode,
      detailedMath,
    };

    const topicTitle = customTopic.trim() || 'Synthesized Academic Notes';

    const pendingDraft = {
      id: newNoteId,
      youtubeUrl: youtubeUrl.trim() || undefined,
      transcriptText: transcriptText.trim(),
      customTopic: topicTitle,
      customPrompt: customPrompt.trim() || '',
      settings,
    };

    sessionStorage.setItem(`pending_note_gen_${newNoteId}`, JSON.stringify(pendingDraft));
    localStorage.setItem(`pending_note_gen_${newNoteId}`, JSON.stringify(pendingDraft));
    navigate(`/notes/${newNoteId}?streaming=1`);
  };

  const handlePresetClick = (presetTopic: string) => {
    setCustomTopic(presetTopic);
  };

  const wordCount = transcriptText.trim() ? transcriptText.trim().split(/\s+/).length : 0;
  const lineCount = transcriptText.trim() ? transcriptText.trim().split('\n').length : 0;

  return (
    <MainLayout showSidebar>
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="text-center mb-8">
          <div className="inline-block px-3 py-1 bg-amber-100/80 text-amber-900 border border-amber-300/80 rounded-full text-xs font-mono font-semibold uppercase tracking-wider mb-3">
            Academic Transcript Synthesizer
          </div>
          <h1 className="font-serif font-bold text-4xl text-stone-900 tracking-tight sm:text-5xl mb-3">
            Turn Raw Transcripts into Flawless Academic Notes
          </h1>
          <p className="text-base text-stone-600 max-w-2xl mx-auto leading-relaxed">
            Paste any YouTube or lecture transcript below to generate structured, textbook-styled notes with KaTeX math, Mermaid diagrams, and concise cheat-sheets.
          </p>
        </div>

        <form onSubmit={handleGenerate} className="bg-amber-50/70 border border-amber-200/80 p-8 rounded-2xl shadow-sm space-y-6">
          {/* Main Transcript Textarea */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-serif font-bold text-stone-900 flex items-center gap-2">
                📝 Paste Lecture Transcript <span className="text-red-500">*</span>
              </label>
              <div className="text-xs font-mono text-stone-500">
                {wordCount > 0 ? (
                  <span>
                    <strong className="text-amber-800">{wordCount.toLocaleString()}</strong> words •{' '}
                    <strong className="text-amber-800">{lineCount.toLocaleString()}</strong> lines
                  </span>
                ) : (
                  <span>Paste raw or timestamped transcript</span>
                )}
              </div>
            </div>

            <textarea
              rows={9}
              required
              value={transcriptText}
              onChange={(e) => setTranscriptText(e.target.value)}
              placeholder="Paste YouTube transcript, lecture text, or meeting transcript here...&#10;&#10;Example:&#10;00:00 Welcome to today's masterclass on System Design and Distributed Systems.&#10;00:15 First, let's explore horizontal scaling vs vertical scaling..."
              className="w-full font-mono text-xs sm:text-sm p-4 rounded-xl border border-amber-300/80 bg-white shadow-inner focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-700 leading-relaxed resize-y placeholder:text-stone-400 placeholder:font-sans"
            />
          </div>

          {/* Optional Title & Topic Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Topic / Subject Title (Optional)"
              type="text"
              placeholder="e.g. System Design: Scalability & Load Balancing"
              value={customTopic}
              onChange={(e) => setCustomTopic(e.target.value)}
            />
            <Input
              label="YouTube Video Link (Optional)"
              type="url"
              placeholder="https://www.youtube.com/watch?v=..."
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              helperText="Optional reference link attached to your notes"
            />
          </div>

          <Input
            label="Custom AI Focus Instructions (Optional)"
            type="text"
            placeholder="e.g. Focus on database indexing trade-offs and include architecture flowcharts"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
          />

          {/* Quick Topic Presets */}
          <div>
            <p className="text-xs font-mono text-stone-500 mb-2 font-medium">Quick Topic Recipes:</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => handlePresetClick(action.label)}
                  className="px-3 py-1 bg-white hover:bg-amber-100/60 border border-amber-200 text-stone-700 hover:text-stone-900 text-xs rounded-lg transition-colors font-medium cursor-pointer"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>

          {/* Settings Sliders Panel */}
          <div className="border-t border-amber-200/80 pt-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif font-bold text-base text-stone-900 flex items-center gap-2">
                ⚙️ Synthesis Detail & Diagram Settings
              </h3>
              <button
                type="button"
                onClick={() => setShowSettings(!showSettings)}
                className="text-xs font-mono text-amber-800 hover:underline cursor-pointer"
              >
                {showSettings ? 'Hide Settings' : 'Customize Settings'}
              </button>
            </div>

            {showSettings && (
              <div className="space-y-5 bg-white/80 p-5 rounded-xl border border-amber-200/60">
                {/* 1. Detail Level Selector */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-stone-700">
                      Depth & Detail Level
                    </label>
                    <span className="text-xs font-mono text-amber-800 font-bold uppercase">{detailLevel}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(['summary', 'detailed', 'comprehensive'] as const).map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setDetailLevel(lvl)}
                        className={`py-2 px-3 text-xs font-medium rounded-lg border transition-all capitalize cursor-pointer ${
                          detailLevel === lvl
                            ? 'bg-amber-700 text-white border-amber-800 shadow-sm font-semibold'
                            : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Diagram Density Selector */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-stone-700">
                      Diagram & Flowchart Density
                    </label>
                    <span className="text-xs font-mono text-amber-800 font-bold uppercase">{diagramDensity}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(['none', 'balanced', 'heavy'] as const).map((density) => (
                      <button
                        key={density}
                        type="button"
                        onClick={() => setDiagramDensity(density)}
                        className={`py-2 px-3 text-xs font-medium rounded-lg border transition-all capitalize cursor-pointer ${
                          diagramDensity === density
                            ? 'bg-amber-700 text-white border-amber-800 shadow-sm font-semibold'
                            : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        {density === 'none' ? 'Minimal' : density === 'balanced' ? 'Balanced' : 'Heavy Architecture'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Worked Examples Selector */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-stone-700">
                      Worked Examples Depth
                    </label>
                    <span className="text-xs font-mono text-amber-800 font-bold uppercase">{examples}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(['concise', 'many'] as const).map((ex) => (
                      <button
                        key={ex}
                        type="button"
                        onClick={() => setExamples(ex)}
                        className={`py-2 px-3 text-xs font-medium rounded-lg border transition-all capitalize cursor-pointer ${
                          examples === ex
                            ? 'bg-amber-700 text-white border-amber-800 shadow-sm font-semibold'
                            : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        {ex === 'concise' ? 'Concise Examples' : 'In-Depth Worked Examples'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4. Toggles */}
                <div className="flex flex-wrap gap-6 pt-1 border-t border-stone-200/80">
                  <label className="flex items-center space-x-2 cursor-pointer text-xs font-medium text-stone-800">
                    <input
                      type="checkbox"
                      checked={includeCode}
                      onChange={(e) => setIncludeCode(e.target.checked)}
                      className="rounded border-stone-300 text-amber-600 focus:ring-amber-500 w-4 h-4"
                    />
                    <span>Include Code Snippets</span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer text-xs font-medium text-stone-800">
                    <input
                      type="checkbox"
                      checked={detailedMath}
                      onChange={(e) => setDetailedMath(e.target.checked)}
                      className="rounded border-stone-300 text-amber-600 focus:ring-amber-500 w-4 h-4"
                    />
                    <span>Include Detailed Math Formulas (LaTeX)</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full font-semibold text-stone-100 bg-stone-900 hover:bg-stone-800 py-3 shadow-md cursor-pointer"
          >
            ⚡ Synthesize Complete Academic Notes
          </Button>
        </form>
      </div>
    </MainLayout>
  );
};

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/notes" element={<NotesPage />} />
      <Route path="/notes/:id" element={<NotePage />} />
      <Route path="*" element={<HomePage />} />
    </Routes>
  );
};

export default AppRoutes;
