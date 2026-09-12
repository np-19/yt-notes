import type { NoteTheme, ThemeOption, Settings } from "../features/notes/types/notes.types";

export const NOTE_THEMES: ThemeOption[] = [
  {
    id: "amber",
    name: "Academic Warm Paper",
    hex: "#78350f",
    primary: "#78350f",
    secondary: "#f59e0b",
    accent: "#b45309",
    bg: "#fef3c7",
  },
  {
    id: "cobalt",
    name: "Slate Navy",
    hex: "#1e3a8a",
    primary: "#1e3a8a",
    secondary: "#3b82f6",
    accent: "#1d4ed8",
    bg: "#dbeafe",
  },
  {
    id: "emerald",
    name: "Forest Spruce",
    hex: "#14532d",
    primary: "#14532d",
    secondary: "#10b981",
    accent: "#047857",
    bg: "#d1fae5",
  },
  {
    id: "coral",
    name: "Sunset Coral",
    hex: "#7c2d12",
    primary: "#7c2d12",
    secondary: "#f97316",
    accent: "#c2410c",
    bg: "#ffedd5",
  },
  {
    id: "violet",
    name: "Royal Violet",
    hex: "#6a1b9a",
    primary: "#6a1b9a",
    secondary: "#a855f7",
    accent: "#7e22ce",
    bg: "#f3e8ff",
  },
];

export const DEFAULT_SETTINGS: Settings = {
  defaultTheme: "amber",
  autoSavePdf: true,
};

export const QUICK_ACTIONS = [
  { id: "q1", label: "Kafka Architecture & Event Streaming" },
  { id: "q2", label: "Distributed Consensus & Raft Protocol" },
  { id: "q3", label: "Database Indexing & B-Trees" },
  { id: "q4", label: "System Design & Microservices" },
];
