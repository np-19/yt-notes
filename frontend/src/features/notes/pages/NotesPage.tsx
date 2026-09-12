import React, { useEffect } from 'react';
import { useNotes } from '../hooks/useNotes';
import { NoteList } from '../components/NoteList';
import { MainLayout } from '../../../components/layout/MainLayout';
import { useNavigate } from 'react-router-dom';
import { Note } from '../types/notes.types';

export const NotesPage: React.FC = () => {
  const { notes, isLoading, getNotes, selectNote, deleteNote } = useNotes();
  const navigate = useNavigate();

  useEffect(() => {
    getNotes();
  }, []);

  const handleSelect = (note: Note) => {
    selectNote(note);
    navigate(`/notes/${note.id}`);
  };

  return (
    <MainLayout showSidebar>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between border-b border-stone-200 pb-4 mb-6">
          <div>
            <h1 className="font-serif font-bold text-2xl text-stone-900">Academic Notes Library</h1>
            <p className="text-xs font-mono text-stone-500 mt-1">
              Synthesized technical documents formatted with clean SVG diagrams & KaTeX formulas.
            </p>
          </div>
        </div>

        <NoteList
          notes={notes}
          isLoading={isLoading}
          onSelectNote={handleSelect}
          onDeleteNote={deleteNote}
        />
      </div>
    </MainLayout>
  );
};
