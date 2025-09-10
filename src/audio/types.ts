/**
 * Audio Analysis Types for Timeline Trigger System
 */

export interface TimelineMarker {
  time: number; // Time in seconds
  frame?: number; // Calculated frame number
  type: "beat" | "onset" | "downbeat" | "pattern" | "harmonic";
  confidence?: number; // 0-1 confidence score
  strength?: number; // 0-1 strength/intensity
  data?: any; // Additional type-specific data
}

export interface RhythmicPattern {
  startTime: number;
  endTime: number;
  pattern: string; // e.g., "eighth-eighth-quarter"
  timeSignature?: {
    numerator: number;
    denominator: number;
  };
}

export interface HarmonicMarker {
  time: number;
  frequency: number; // Dominant frequency in Hz
  spectralCentroid: number; // Brightness indicator
  energy: number; // Overall energy level
  chroma?: number[]; // 12-element chroma vector for pitch content
}

export interface AudioMarkers {
  beats: TimelineMarker[];
  onsets: TimelineMarker[];
  downbeats: TimelineMarker[];
  patterns: RhythmicPattern[];
  harmonicEvents: HarmonicMarker[];
  bpm?: number;
  key?: string;
  timeSignature?: {
    numerator: number;
    denominator: number;
  };
}

export interface AudioAnalysisConfig {
  // Beat detection settings
  beatTracking: {
    enabled: boolean;
    method?: "multifeature" | "degara" | "simple";
    sensitivity?: number; // 0-1
  };

  // Onset detection settings
  onsetDetection: {
    enabled: boolean;
    method?: "complex" | "hfc" | "flux" | "superflux";
    threshold?: number;
  };

  // Harmonic analysis settings
  harmonicAnalysis: {
    enabled: boolean;
    windowSize?: number; // FFT window size
    hopSize?: number; // Hop size for analysis
  };

  // Pattern detection settings
  patternDetection: {
    enabled: boolean;
    minPatternLength?: number; // Minimum beats for pattern
    maxPatternLength?: number; // Maximum beats for pattern
  };
}

export interface FrameMarkers {
  [frame: number]: TimelineMarker[];
}

export interface MarkerRenderConfig {
  type: "beat" | "onset" | "downbeat" | "pattern" | "harmonic";
  render: (marker: TimelineMarker) => React.ReactNode;
  priority?: number; // Higher priority renders on top
  offset?: number; // Frame offset for anticipation/delay
}