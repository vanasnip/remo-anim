/**
 * React hook for audio marker integration with Remotion
 */

import { useEffect, useState, useMemo, useCallback } from "react";
import { useCurrentFrame, useVideoConfig, staticFile } from "remotion";
import { AudioMarkerExtractor } from "../AudioMarkerExtractor";
import {
  audioMarkersToFrames,
  getMarkersForFrame,
  isOnMarker,
  getNextMarker,
  getPreviousMarker,
  interpolateBetweenMarkers,
} from "../markerUtils";
import type {
  AudioMarkers,
  FrameMarkers,
  TimelineMarker,
  AudioAnalysisConfig,
} from "../types";

interface UseAudioMarkersOptions {
  audioSrc: string;
  audioStartFrame?: number;
  config?: Partial<AudioAnalysisConfig>;
  window?: number; // Frame window for marker detection
  cacheKey?: string; // Cache key for marker data
}

interface UseAudioMarkersReturn {
  markers: AudioMarkers | null;
  frameMarkers: FrameMarkers | null;
  currentMarkers: TimelineMarker[];
  isOnBeat: boolean;
  isOnOnset: boolean;
  isOnDownbeat: boolean;
  nextBeat: TimelineMarker | null;
  previousBeat: TimelineMarker | null;
  beatProgress: number; // 0-1 progress between beats
  bpm: number | undefined;
  isLoading: boolean;
  error: Error | null;
  // Utility functions
  isOnMarker: (type?: TimelineMarker["type"], tolerance?: number) => boolean;
  getNextMarker: (type?: TimelineMarker["type"]) => TimelineMarker | null;
  getPreviousMarker: (type?: TimelineMarker["type"]) => TimelineMarker | null;
}

// Cache for analyzed audio markers
const markerCache = new Map<string, AudioMarkers>();

/**
 * Hook to integrate audio markers with Remotion timeline
 */
export function useAudioMarkers(
  options: UseAudioMarkersOptions,
): UseAudioMarkersReturn {
  const {
    audioSrc,
    audioStartFrame = 0,
    config,
    window = 0,
    cacheKey,
  } = options;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const [markers, setMarkers] = useState<AudioMarkers | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Create cache key
  const effectiveCacheKey = cacheKey || audioSrc;

  // Load and analyze audio
  useEffect(() => {
    let mounted = true;
    let extractor: AudioMarkerExtractor | null = null;

    const analyzeAudio = async () => {
      try {
        // Check cache first
        if (markerCache.has(effectiveCacheKey)) {
          if (mounted) {
            setMarkers(markerCache.get(effectiveCacheKey)!);
            setIsLoading(false);
          }
          return;
        }

        setIsLoading(true);
        setError(null);

        // Create extractor
        extractor = new AudioMarkerExtractor(config);
        await extractor.initialize();

        // Load audio using fetch and decode
        let response: Response;
        let arrayBuffer: ArrayBuffer;
        let audioContext: AudioContext;
        let audioBuffer: AudioBuffer;

        try {
          response = await fetch(staticFile(audioSrc));
          if (!response.ok) {
            throw new Error(`Failed to fetch audio file: ${response.status} ${response.statusText}`);
          }
          arrayBuffer = await response.arrayBuffer();
        } catch (fetchError) {
          console.warn("Failed to fetch audio file, using synthetic audio for demo:", fetchError);
          // Create synthetic audio buffer for demo purposes
          audioBuffer = createSyntheticAudioBuffer();
        }

        // Create AudioBuffer if not already created
        if (!audioBuffer) {
          const AudioContextClass =
            (window as any).AudioContext || (window as any).webkitAudioContext;
          
          if (!AudioContextClass) {
            throw new Error("Web Audio API not supported in this browser");
          }

          audioContext = new AudioContextClass();
          audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        }

        // Extract markers
        const extractedMarkers = await extractor.extractMarkers(
          audioBuffer,
          audioBuffer.sampleRate,
        );

        // Cache the results
        markerCache.set(effectiveCacheKey, extractedMarkers);

        if (mounted) {
          setMarkers(extractedMarkers);
          setIsLoading(false);
        }

        // Clean up audio context
        if (audioContext) {
          audioContext.close();
        }
      } catch (err) {
        console.error("Error analyzing audio:", err);
        if (mounted) {
          // Instead of failing completely, provide fallback synthetic markers
          const fallbackMarkers = createFallbackMarkers();
          setMarkers(fallbackMarkers);
          setError(new Error(`Audio analysis failed, using fallback: ${(err as Error).message}`));
          setIsLoading(false);
          console.warn("Using fallback synthetic audio markers for demo");
        }
      }
    };

    analyzeAudio();

    return () => {
      mounted = false;
      if (extractor) {
        extractor.dispose();
      }
    };
  }, [audioSrc, effectiveCacheKey, config]);

  // Convert markers to frame-based markers
  const frameMarkers = useMemo(() => {
    if (!markers) return null;
    return audioMarkersToFrames(markers, audioStartFrame, fps);
  }, [markers, audioStartFrame, fps]);

  // Get markers for current frame
  const currentMarkers = useMemo(() => {
    if (!frameMarkers) return [];
    return getMarkersForFrame(frameMarkers, frame, window);
  }, [frameMarkers, frame, window]);

  // Check if current frame is on specific marker types
  const isOnBeat = useMemo(() => {
    if (!frameMarkers) return false;
    return isOnMarker(frameMarkers, frame, "beat", window);
  }, [frameMarkers, frame, window]);

  const isOnOnset = useMemo(() => {
    if (!frameMarkers) return false;
    return isOnMarker(frameMarkers, frame, "onset", window);
  }, [frameMarkers, frame, window]);

  const isOnDownbeat = useMemo(() => {
    if (!frameMarkers) return false;
    return isOnMarker(frameMarkers, frame, "downbeat", window);
  }, [frameMarkers, frame, window]);

  // Get next and previous beats
  const nextBeat = useMemo(() => {
    if (!frameMarkers) return null;
    return getNextMarker(frameMarkers, frame, "beat");
  }, [frameMarkers, frame]);

  const previousBeat = useMemo(() => {
    if (!frameMarkers) return null;
    return getPreviousMarker(frameMarkers, frame, "beat");
  }, [frameMarkers, frame]);

  // Calculate beat progress (0-1 between beats)
  const beatProgress = useMemo(() => {
    if (!frameMarkers) return 0;
    return interpolateBetweenMarkers(frameMarkers, frame, "beat");
  }, [frameMarkers, frame]);

  // Utility functions
  const isOnMarkerFn = useCallback(
    (type?: TimelineMarker["type"], tolerance: number = window) => {
      if (!frameMarkers) return false;
      return isOnMarker(frameMarkers, frame, type, tolerance);
    },
    [frameMarkers, frame, window],
  );

  const getNextMarkerFn = useCallback(
    (type?: TimelineMarker["type"]) => {
      if (!frameMarkers) return null;
      return getNextMarker(frameMarkers, frame, type);
    },
    [frameMarkers, frame],
  );

  const getPreviousMarkerFn = useCallback(
    (type?: TimelineMarker["type"]) => {
      if (!frameMarkers) return null;
      return getPreviousMarker(frameMarkers, frame, type);
    },
    [frameMarkers, frame],
  );

  return {
    markers,
    frameMarkers,
    currentMarkers,
    isOnBeat,
    isOnOnset,
    isOnDownbeat,
    nextBeat,
    previousBeat,
    beatProgress,
    bpm: markers?.bpm,
    isLoading,
    error,
    isOnMarker: isOnMarkerFn,
    getNextMarker: getNextMarkerFn,
    getPreviousMarker: getPreviousMarkerFn,
  };
}

/**
 * Simplified hook for beat-only detection
 */
export function useBeats(audioSrc: string, audioStartFrame: number = 0) {
  return useAudioMarkers({
    audioSrc,
    audioStartFrame,
    config: {
      beatTracking: { enabled: true },
      onsetDetection: { enabled: false },
      harmonicAnalysis: { enabled: false },
      patternDetection: { enabled: false },
    },
  });
}

/**
 * Hook for rhythm visualization
 */
export function useRhythm(audioSrc: string, audioStartFrame: number = 0) {
  return useAudioMarkers({
    audioSrc,
    audioStartFrame,
    config: {
      beatTracking: { enabled: true },
      onsetDetection: { enabled: true },
      harmonicAnalysis: { enabled: false },
      patternDetection: { enabled: true },
    },
  });
}

/**
 * Hook for full audio analysis including harmonic content
 */
export function useFullAudioAnalysis(
  audioSrc: string,
  audioStartFrame: number = 0,
) {
  return useAudioMarkers({
    audioSrc,
    audioStartFrame,
    config: {
      beatTracking: { enabled: true },
      onsetDetection: { enabled: true },
      harmonicAnalysis: { enabled: true },
      patternDetection: { enabled: true },
    },
  });
}

/**
 * Create synthetic audio buffer for demo purposes
 */
function createSyntheticAudioBuffer(): AudioBuffer {
  const AudioContextClass =
    (window as any).AudioContext || (window as any).webkitAudioContext;
  
  if (!AudioContextClass) {
    throw new Error("Web Audio API not supported");
  }

  const audioContext = new AudioContextClass();
  const duration = 10; // 10 seconds
  const sampleRate = audioContext.sampleRate;
  const buffer = audioContext.createBuffer(1, duration * sampleRate, sampleRate);
  
  const channelData = buffer.getChannelData(0);
  
  // Generate a simple rhythm pattern with beeps
  for (let i = 0; i < channelData.length; i++) {
    const time = i / sampleRate;
    const beatTime = time % 0.5; // Beat every 0.5 seconds (120 BPM)
    
    if (beatTime < 0.1) {
      // Create a short beep sound
      const frequency = 440; // A note
      const amplitude = 0.1 * Math.sin(2 * Math.PI * frequency * time) * 
                        Math.exp(-beatTime * 20); // Decay envelope
      channelData[i] = amplitude;
    }
  }
  
  audioContext.close();
  return buffer;
}

/**
 * Create fallback markers for demo purposes when audio analysis fails
 */
function createFallbackMarkers(): AudioMarkers {
  const beats: TimelineMarker[] = [];
  const onsets: TimelineMarker[] = [];
  const downbeats: TimelineMarker[] = [];
  
  // Generate synthetic beats every 0.5 seconds (120 BPM)
  for (let i = 0; i < 20; i++) {
    const time = i * 0.5;
    beats.push({
      time,
      type: "beat",
      confidence: 0.9,
      strength: 0.8,
    });
    
    // Every 4th beat is a downbeat
    if (i % 4 === 0) {
      downbeats.push({
        time,
        type: "downbeat",
        confidence: 0.95,
        strength: 1.0,
      });
    }
    
    // Add some onsets between beats
    if (i > 0) {
      onsets.push({
        time: time - 0.25,
        type: "onset",
        confidence: 0.7,
        strength: 0.6,
      });
    }
  }
  
  return {
    beats,
    onsets,
    downbeats,
    patterns: [],
    harmonicEvents: [],
    bpm: 120,
  };
}