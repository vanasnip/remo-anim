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
        const response = await fetch(staticFile(audioSrc));
        const arrayBuffer = await response.arrayBuffer();

        // Create AudioBuffer
        const AudioContextClass =
          (window as any).AudioContext || (window as any).webkitAudioContext;
        const audioContext = new AudioContextClass();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

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
        audioContext.close();
      } catch (err) {
        console.error("Error analyzing audio:", err);
        if (mounted) {
          setError(err as Error);
          setIsLoading(false);
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