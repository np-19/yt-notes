export const detailLevels = ["quick", "short", "standard", "detailed", "deep_dive"] as const;
export const diagramDensities = ["minimal", "balanced", "aggressive"] as const;
export const exampleDensities = ["minimal", "normal", "many"] as const;

export type NoteSettings = {
  detailLevel: (typeof detailLevels)[number];
  diagramDensity: (typeof diagramDensities)[number];
  examples: (typeof exampleDensities)[number];
  includeCode: boolean;
  detailedMath: boolean;
};

export type TranscriptEntry = {
  text: string;
  offset: number; // milliseconds
};