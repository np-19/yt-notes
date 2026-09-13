import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { NotesState, Note, GenerateNotesParams } from '../types/notes.types';
import { notesApi } from '../api/notes.api';

const initialState: NotesState = {
  notes: [],
  currentNote: null,
  activeThemeId: 'amber',
  isLoading: false,
  isGenerating: false,
  error: null,
};

export const fetchAllNotes = createAsyncThunk('notes/fetchAll', async () => {
  return await notesApi.fetchNotes();
});

export const generateNewNotes = createAsyncThunk(
  'notes/generate',
  async (params: GenerateNotesParams, { rejectWithValue }) => {
    try {
      const result = await notesApi.generateNotes(params);
      const newNote: Note = {
        id: `note-${Date.now()}`,
        title: result.title || 'Synthesized Academic Notes',
        videoUrl: params.youtubeUrl,
        htmlContent: result.html,
        createdAt: new Date().toISOString(),
        themeId: 'amber',
        versions: [
          {
            id: `v-${Date.now()}`,
            timestamp: new Date().toISOString(),
            label: 'Initial Generation',
            htmlContent: result.html,
          },
        ],
      };
      await notesApi.saveNote(newNote);
      return newNote;
    } catch (err: any) {
      // Backend structured error response
      const serverMessage = err?.response?.data?.error;
      if (serverMessage) {
        return rejectWithValue(serverMessage);
      }
      // Axios network/timeout errors
      if (err?.code === 'ERR_NETWORK' || !err?.response) {
        return rejectWithValue('Cannot connect to the note synthesis backend. Please verify that the backend server is running.');
      }
      return rejectWithValue(err?.message || 'Failed to generate notes');
    }
  }
);

export const saveNoteAsync = createAsyncThunk('notes/save', async (note: Note) => {
  return await notesApi.saveNote(note);
});

export const deleteNoteAsync = createAsyncThunk('notes/delete', async (id: string) => {
  await notesApi.deleteNote(id);
  return id;
});

export const notesSlice = createSlice({
  name: 'notes',
  initialState,
  reducers: {
    clearNotesError: (state) => {
      state.error = null;
    },
    setCurrentNote: (state, action: PayloadAction<Note | null>) => {
      state.currentNote = action.payload;
    },
    setActiveThemeId: (state, action: PayloadAction<string>) => {
      state.activeThemeId = action.payload;
      if (state.currentNote) {
        state.currentNote.themeId = action.payload;
      }
    },
    updateCurrentNoteContent: (
      state,
      action: PayloadAction<{ htmlContent: string; versionLabel?: string }>
    ) => {
      if (state.currentNote) {
        const newHtml = action.payload.htmlContent;
        const label = action.payload.versionLabel || `Refined ${new Date().toLocaleTimeString()}`;
        const newVersion = {
          id: `v-${Date.now()}`,
          timestamp: new Date().toISOString(),
          label,
          htmlContent: newHtml,
        };
        state.currentNote.htmlContent = newHtml;
        state.currentNote.updatedAt = new Date().toISOString();
        state.currentNote.versions = [newVersion, ...(state.currentNote.versions || [])];
        const idx = state.notes.findIndex((n) => n.id === state.currentNote!.id);
        if (idx >= 0) {
          state.notes[idx] = { ...state.currentNote };
        }
      }
    },
    restoreNoteVersion: (state, action: PayloadAction<string>) => {
      if (state.currentNote && state.currentNote.versions) {
        const version = state.currentNote.versions.find((v) => v.id === action.payload);
        if (version) {
          state.currentNote.htmlContent = version.htmlContent;
          state.currentNote.updatedAt = new Date().toISOString();
          const idx = state.notes.findIndex((n) => n.id === state.currentNote!.id);
          if (idx >= 0) {
            state.notes[idx] = { ...state.currentNote };
          }
        }
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAllNotes.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchAllNotes.fulfilled, (state, action: PayloadAction<Note[]>) => {
        state.isLoading = false;
        state.notes = action.payload;
      })
      .addCase(fetchAllNotes.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to load notes';
      })
      .addCase(generateNewNotes.pending, (state) => {
        state.isGenerating = true;
        state.error = null;
      })
      .addCase(generateNewNotes.fulfilled, (state, action: PayloadAction<Note>) => {
        state.isGenerating = false;
        state.currentNote = action.payload;
        state.notes.unshift(action.payload);
      })
      .addCase(generateNewNotes.rejected, (state, action) => {
        state.isGenerating = false;
        state.error = action.payload as string;
      })
      .addCase(saveNoteAsync.fulfilled, (state, action: PayloadAction<Note>) => {
        const idx = state.notes.findIndex((n) => n.id === action.payload.id);
        if (idx >= 0) {
          state.notes[idx] = action.payload;
        } else {
          state.notes.unshift(action.payload);
        }
      })
      .addCase(deleteNoteAsync.fulfilled, (state, action: PayloadAction<string>) => {
        state.notes = state.notes.filter((n) => n.id !== action.payload);
        if (state.currentNote?.id === action.payload) {
          state.currentNote = null;
        }
      });
  },
});

export const {
  clearNotesError,
  setCurrentNote,
  setActiveThemeId,
  updateCurrentNoteContent,
  restoreNoteVersion,
} = notesSlice.actions;

export default notesSlice.reducer;
