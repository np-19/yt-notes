import React from 'react';
import { Button } from '../../../components/ui/Button';

export interface RefinePanelProps {
  selectedChunks: string[];
  selectedText: string;
  aiPrompt: string;
  isAiRefining: boolean;
  onAiPromptChange: (prompt: string) => void;
  onAddChunk: () => void;
  onRemoveChunk: (index: number) => void;
  onClearAllChunks: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const RefinePanel: React.FC<RefinePanelProps> = ({
  selectedChunks,
  selectedText,
  aiPrompt,
  isAiRefining,
  onAiPromptChange,
  onAddChunk,
  onRemoveChunk,
  onClearAllChunks,
  onSubmit,
}) => {
  return (
    <div className="no-print bg-stone-50 border border-stone-200/90 rounded-xl p-3.5 shadow-xs mb-6 space-y-3 ai-refine-interactive">
      {(selectedChunks.length > 0 || selectedText) && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] font-semibold tracking-wide text-stone-600 uppercase">
              Targeted Selection ({selectedChunks.length + (selectedText && !selectedChunks.includes(selectedText) ? 1 : 0)}{' '}
              {selectedChunks.length + (selectedText && !selectedChunks.includes(selectedText) ? 1 : 0) === 1 ? 'chunk' : 'chunks'})
            </span>
            <button
              type="button"
              onClick={onClearAllChunks}
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
                  onClick={() => onRemoveChunk(idx)}
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
                  onClick={onAddChunk}
                  className="text-stone-800 hover:text-black font-mono text-[11px] font-semibold px-2 py-0.5 bg-stone-200 hover:bg-stone-300 rounded cursor-pointer whitespace-nowrap ml-1 transition-colors"
                >
                  + Pin Chunk
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <form onSubmit={onSubmit} className="flex gap-2.5 w-full items-center">
        <input
          type="text"
          placeholder={
            selectedChunks.length > 0
              ? `Specify edits for the ${selectedChunks.length} selected chunks (e.g., format as comparison table, rewrite concisely)...`
              : selectedText
              ? 'Describe edit (e.g., expand details, format code, fix equation)...'
              : 'Ask to refine notes (e.g., expand section 2, add code example, simplify math)...'
          }
          value={aiPrompt}
          onChange={(e) => onAiPromptChange(e.target.value)}
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
  );
};
