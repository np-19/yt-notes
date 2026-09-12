import { useAppDispatch, useAppSelector } from '../../../app/store';
import {
  fetchAllNotes,
  generateNewNotes,
  saveNoteAsync,
  deleteNoteAsync,
  setCurrentNote,
  setActiveThemeId,
  updateCurrentNoteContent,
  restoreNoteVersion,
  clearNotesError,
} from '../store/notes.slice';
import { Note, GenerateNotesParams } from '../types/notes.types';

export const useNotes = () => {
  const dispatch = useAppDispatch();
  const notesState = useAppSelector((state) => state.notes);

  const getNotes = () => dispatch(fetchAllNotes());
  const generate = (params: GenerateNotesParams) => dispatch(generateNewNotes(params));
  const saveNote = (note: Note) => dispatch(saveNoteAsync(note));
  const deleteNote = (id: string) => dispatch(deleteNoteAsync(id));
  const selectNote = (note: Note | null) => dispatch(setCurrentNote(note));
  const setTheme = (themeId: string) => dispatch(setActiveThemeId(themeId));
  const clearError = () => dispatch(clearNotesError());
  const updateContent = (htmlContent: string, versionLabel?: string) =>
    dispatch(updateCurrentNoteContent({ htmlContent, versionLabel }));
  const restoreVersion = (versionId: string) => dispatch(restoreNoteVersion(versionId));

  return {
    ...notesState,
    getNotes,
    generate,
    saveNote,
    deleteNote,
    selectNote,
    setTheme,
    clearError,
    updateContent,
    restoreVersion,
  };
};
