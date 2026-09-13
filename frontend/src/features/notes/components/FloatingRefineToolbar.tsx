import React, { RefObject } from 'react';

export interface FloatingRefineToolbarProps {
  floatingBarRef: RefObject<HTMLDivElement | null>;
  selectionRect: { top: number; left: number };
  selectedText: string;
  selectedChunks: string[];
  floatingPrompt: string;
  isAiRefining: boolean;
  onFloatingPromptChange: (prompt: string) => void;
  onAddChunk: () => void;
  onClearAllChunks: () => void;
  onExecuteRefine: (prompt: string, targets: string | string[]) => void;
  onDismiss: () => void;
}

export const FloatingRefineToolbar: React.FC<FloatingRefineToolbarProps> = ({
  floatingBarRef,
  selectionRect,
  selectedText,
  selectedChunks,
  floatingPrompt,
  isAiRefining,
  onFloatingPromptChange,
  onAddChunk,
  onClearAllChunks,
  onExecuteRefine,
  onDismiss,
}) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const targets =
      selectedChunks.length > 0
        ? selectedText && !selectedChunks.includes(selectedText)
          ? [...selectedChunks, selectedText]
          : selectedChunks
        : selectedText;
    onExecuteRefine(floatingPrompt, targets);
  };

  return (
    <div
      ref={floatingBarRef}
      style={{
        position: 'absolute',
        top: `${selectionRect.top}px`,
        left: `${selectionRect.left}px`,
        transform: 'translateX(-50%)',
        zIndex: 50,
        backgroundColor: '#1e1e20',
      }}
      className="ai-refine-interactive text-white shadow-2xl border border-neutral-700/60 rounded-full pl-3.5 pr-2 py-1.5 flex items-center gap-2.5 w-[580px] max-w-[95vw] ring-1 ring-black/60 backdrop-blur-lg h-11"
    >
      {/* Word Count / Pinned Badge */}
      {selectedText ? (
        <span className="text-neutral-400 text-xs font-mono select-none flex-shrink-0 leading-none">
          {selectedText.split(/\s+/).filter(Boolean).length}w
        </span>
      ) : (
        <span className="flex items-center gap-1.5 text-orange-400 text-xs font-mono font-semibold select-none flex-shrink-0 leading-none">
          <svg className="w-3.5 h-3.5 text-orange-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
          {selectedChunks.length} pinned
        </span>
      )}

      {/* Vertical Divider */}
      <div className="h-4 w-[1px] bg-neutral-700/70 flex-shrink-0" />

      {/* Pin Chunk Action or Clear Action */}
      {selectedText ? (
        <button
          type="button"
          onClick={onAddChunk}
          className="flex items-center gap-1.5 text-neutral-300 hover:text-white text-xs font-medium px-2 py-1 rounded-full hover:bg-neutral-800/80 transition-colors cursor-pointer flex-shrink-0 leading-none"
          title="Pin snippet for multi-chunk refinement"
        >
          <svg className="w-3.5 h-3.5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
          <span>Pin</span>
          {selectedChunks.length > 0 && (
            <span className="bg-[#f95721] text-white text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full leading-tight">
              {selectedChunks.length}
            </span>
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={onClearAllChunks}
          className="text-neutral-400 hover:text-white text-xs font-mono underline px-1.5 py-0.5 rounded cursor-pointer flex-shrink-0 leading-none"
          title="Clear all pinned chunks"
        >
          Clear
        </button>
      )}

      {/* Prompt Form */}
      <form onSubmit={handleSubmit} style={{ margin: 0, padding: 0 }} className="flex items-center gap-2 flex-1 min-w-0 h-full">
        <input
          type="text"
          value={floatingPrompt}
          onChange={(e) => onFloatingPromptChange(e.target.value)}
          placeholder={
            selectedChunks.length > 0
              ? selectedText
                ? `Refine ${selectedChunks.length + 1} chunks...`
                : `Refine ${selectedChunks.length} pinned ${selectedChunks.length === 1 ? 'chunk' : 'chunks'}...`
              : 'Refine selection...'
          }
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.35)',
            color: '#ffffff',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            outline: 'none',
            boxShadow: 'none',
            margin: 0,
            height: '28px',
            padding: '0 12px',
            fontSize: '13px',
            fontFamily: 'inherit',
            lineHeight: '28px',
            borderRadius: '9999px',
            boxSizing: 'border-box',
          }}
          className="flex-1 min-w-0 text-white placeholder-neutral-400 focus:border-neutral-500 transition-all"
          autoFocus
        />

        {/* Circular Orange Action Button */}
        <button
          type="submit"
          disabled={isAiRefining}
          className="w-7 h-7 rounded-full bg-[#f95721] hover:bg-[#ff6b37] text-white flex items-center justify-center transition-all flex-shrink-0 disabled:opacity-50 shadow-sm active:scale-95 cursor-pointer"
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
        onClick={onDismiss}
        className="text-neutral-400 hover:text-white p-1 rounded-full transition-colors flex-shrink-0 cursor-pointer text-xs leading-none"
        title="Dismiss selection"
      >
        ✕
      </button>
    </div>
  );
};
