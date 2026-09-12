import { combineReducers } from '@reduxjs/toolkit';
import notesReducer from '../features/notes/store/notes.slice';

export const rootReducer = combineReducers({
  notes: notesReducer,
});

export type RootState = ReturnType<typeof rootReducer>;
