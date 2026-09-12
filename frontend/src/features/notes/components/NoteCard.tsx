import React from 'react';
import { Note } from '../types/notes.types';
import { Button } from '../../../components/ui/Button';

export interface NoteCardProps {
  note: Note;
  onSelect: (note: Note) => void;
  onDelete: (id: string) => void;
}

export const NoteCard: React.FC<NoteCardProps> = ({ note, onSelect, onDelete }) => {
  const formattedDate = new Date(note.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between text-xs text-stone-500 mb-2 font-mono">
          <span>{formattedDate}</span>
          {note.versions && note.versions.length > 0 && (
            <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded text-[11px] font-sans font-medium">
              {note.versions.length} {note.versions.length === 1 ? 'version' : 'versions'}
            </span>
          )}
        </div>
        <h3 className="font-serif font-bold text-lg text-stone-900 line-clamp-2 mb-2 leading-snug">
          {note.title}
        </h3>
        {note.videoUrl && (
          <p className="text-xs text-stone-600 truncate font-mono mb-4">
            {note.videoUrl}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-amber-200/60 pt-3 mt-2">
        <Button variant="secondary" size="sm" onClick={() => onSelect(note)}>
          Open Document
        </Button>
        <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => onDelete(note.id)}>
          Delete
        </Button>
      </div>
    </div>
  );
};
