export type NoteTheme =
  | "violet"
  | "cobalt"
  | "emerald"
  | "ruby"
  | "amber"
  | "teal"
  | "coral"
  | "indigo";

export type Settings = {
  detailLevel: "quick" | "short" | "standard" | "detailed" | "deep_dive";
  diagramDensity: "minimal" | "balanced" | "aggressive";
  examples: "minimal" | "normal" | "many";
  includeCode: boolean;
  detailedMath: boolean;
  backendUrl: string;
};

export type Video = { id: string; title: string; channel: string; thumbnail: string };
export type NoteVersion = { id: string; html: string; createdAt: string; instruction: string };
export type Note = {
  videoId: string;
  title: string;
  html: string;
  theme?: NoteTheme;
  createdAt: string;
  updatedAt: string;
  settings: Settings;
  versions: NoteVersion[];
  activeVersion: number;
};
