// Core funscript types
export interface FunscriptAction {
  pos: number;  // Position 0-100
  at: number;   // Time in milliseconds
}

export interface FunscriptMetadata {
  title?: string;
  description?: string;
  performers?: string[];
  video_url?: string;
  tags?: string[];
  duration?: number;
  average_speed?: number;
  creator?: string;
}

export interface Funscript {
  // Original format fields (optional)
  version?: string;
  inverted?: boolean;
  range?: number;
  // New format field (optional)
  metadata?: FunscriptMetadata;
  // Common to both formats
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
