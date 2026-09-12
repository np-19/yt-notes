export type NoteTheme = 'amber' | 'cobalt' | 'emerald' | 'coral' | 'violet';

export interface ThemeOption {
  id: NoteTheme;
  name: string;
  hex: string;
  primary: string;
  secondary: string;
  accent: string;
  bg: string;
}

export interface NoteSettings {
  detailLevel: 'summary' | 'detailed' | 'comprehensive';
  diagramDensity: 'none' | 'balanced' | 'heavy';
  examples: 'concise' | 'many';
  includeCode: boolean;
  detailedMath: boolean;
}


export interface NoteVersion {
  id: string;
  timestamp: string;
  label: string;
  htmlContent: string;
}

export interface Note {
  id: string;
  title: string;
  videoUrl?: string;
  htmlContent: string;
  createdAt: string;
  updatedAt?: string;
  themeId?: string;
  versions?: NoteVersion[];
}

export interface GenerateNotesParams {
  youtubeUrl: string;
  customPrompt?: string;
  customTopic?: string;
  settings?: NoteSettings;
  transcript?: Array<{ text: string; offset?: number; duration?: number; lang?: string }>;
}

export interface NotesState {
  notes: Note[];
  currentNote: Note | null;
  activeThemeId: string;
  isLoading: boolean;
  isGenerating: boolean;
  error: string | null;
}
