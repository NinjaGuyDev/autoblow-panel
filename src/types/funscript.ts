// Core funscript types
export interface FunscriptAction {
  pos: number;  // Position 0-100
  at: number;   // Time in milliseconds
}

export interface Funscript {
  version: string;
  inverted: boolean;
  range: number;
  actions: FunscriptAction[];
}

// Application state types
export interface LoadedVideo {
  file: File;
  name: string;
  blobUrl: string;
  duration?: number;  // Set after video loads metadata
}

export interface LoadedFunscript {
  file: File;
  name: string;
  data: Funscript;
}

export interface WorkSession {
  id?: number;
  videoName: string | null;
  funscriptName: string | null;
  funscriptData: string;  // JSON stringified Funscript
  lastModified: Date;
}
