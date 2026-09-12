import React from 'react';
import { Note } from '../types/notes.types';
import { NoteCard } from './NoteCard';
import { Spinner } from '../../../components/ui/Spinner';

export interface NoteListProps {
  notes: Note[];
  isLoading: boolean;
  onSelectNote: (note: Note) => void;
  onDeleteNote: (id: string) => void;
}

export const NoteList: React.FC<NoteListProps> = ({
  notes,
  isLoading,
  onSelectNote,
  onDeleteNote,
}) => {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Spinner size="lg" />
        <p className="mt-4 text-sm text-stone-500 font-mono">Loading saved lecture notes...</p>
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div className="text-center py-16 bg-amber-50/50 border border-dashed border-amber-200/80 rounded-xl p-8">
        <h3 className="font-serif font-bold text-lg text-stone-800 mb-2">No Lecture Notes Saved</h3>
        <p className="text-sm text-stone-600 max-w-md mx-auto mb-4">
          Paste a YouTube URL above to synthesize transcript into clean, standalone A4 PDF ready academic notes.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {notes.map((note) => (
        <NoteCard
          key={note.id}
          note={note}
          onSelect={onSelectNote}
          onDelete={onDeleteNote}
        />
      ))}
    </div>
  );
};
