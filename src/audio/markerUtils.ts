/**
 * Utilities for converting audio markers to Remotion frame timeline
 */

import type { TimelineMarker, AudioMarkers, FrameMarkers } from "./types";

/**
 * Convert time-based markers to frame-based markers
 * @param markers - Array of timeline markers with time in seconds
 * @param audioStartFrame - Frame when audio starts playing
 * @param fps - Frames per second of the composition
 * @param offset - Optional frame offset for anticipation/delay
 */
export function markersToFrames(
  markers: TimelineMarker[],
  audioStartFrame: number,
  fps: number,
  offset: number = 0,
): Map<number, TimelineMarker[]> {
  const frameMap = new Map<number, TimelineMarker[]>();

  markers.forEach((marker) => {
    // Convert time to frame number
    const frame = Math.round(audioStartFrame + marker.time * fps + offset);

    // Add frame number to marker
    const markerWithFrame = {
      ...marker,
      frame,
    };

    // Group markers by frame
    if (!frameMap.has(frame)) {
      frameMap.set(frame, []);
    }
    frameMap.get(frame)!.push(markerWithFrame);
  });

  return frameMap;
}

/**
 * Convert all audio markers to frame markers
 */
export function audioMarkersToFrames(
  audioMarkers: AudioMarkers,
  audioStartFrame: number,
  fps: number,
  offsets?: {
    beat?: number;
    onset?: number;
    downbeat?: number;
    pattern?: number;
    harmonic?: number;
  },
): FrameMarkers {
  const frameMarkers: FrameMarkers = {};

  // Convert each marker type with optional offset
  const beatFrames = markersToFrames(
    audioMarkers.beats,
    audioStartFrame,
    fps,
    offsets?.beat || 0,
  );

  const onsetFrames = markersToFrames(
    audioMarkers.onsets,
    audioStartFrame,
    fps,
    offsets?.onset || 0,
  );

  const downbeatFrames = markersToFrames(
    audioMarkers.downbeats,
    audioStartFrame,
    fps,
    offsets?.downbeat || 0,
  );

  // Merge all frame markers
  const allFrameMaps = [beatFrames, onsetFrames, downbeatFrames];

  allFrameMaps.forEach((frameMap) => {
    frameMap.forEach((markers, frame) => {
      if (!frameMarkers[frame]) {
        frameMarkers[frame] = [];
      }
      frameMarkers[frame].push(...markers);
    });
  });

  return frameMarkers;
}

/**
 * Get markers for current frame with lookahead/lookbehind
 * @param frameMarkers - All frame markers
 * @param currentFrame - Current frame number
 * @param window - Number of frames to look ahead/behind (default 0)
 */
export function getMarkersForFrame(
  frameMarkers: FrameMarkers,
  currentFrame: number,
  window: number = 0,
): TimelineMarker[] {
  const markers: TimelineMarker[] = [];

  for (
    let frame = currentFrame - window;
    frame <= currentFrame + window;
    frame++
  ) {
    if (frameMarkers[frame]) {
      markers.push(...frameMarkers[frame]);
    }
  }

  return markers;
}

/**
 * Get markers within a time range
 */
export function getMarkersInTimeRange(
  markers: TimelineMarker[],
  startTime: number,
  endTime: number,
): TimelineMarker[] {
  return markers.filter(
    (marker) => marker.time >= startTime && marker.time <= endTime,
  );
}

/**
 * Get markers within a frame range
 */
export function getMarkersInFrameRange(
  frameMarkers: FrameMarkers,
  startFrame: number,
  endFrame: number,
): TimelineMarker[] {
  const markers: TimelineMarker[] = [];

  for (let frame = startFrame; frame <= endFrame; frame++) {
    if (frameMarkers[frame]) {
      markers.push(...frameMarkers[frame]);
    }
  }

  return markers;
}

/**
 * Check if current frame is on a specific marker type
 */
export function isOnMarker(
  frameMarkers: FrameMarkers,
  currentFrame: number,
  markerType?: "beat" | "onset" | "downbeat" | "pattern" | "harmonic",
  tolerance: number = 0,
): boolean {
  for (
    let frame = currentFrame - tolerance;
    frame <= currentFrame + tolerance;
    frame++
  ) {
    const markers = frameMarkers[frame];
    if (markers) {
      if (!markerType) {
        return true; // Any marker type
      }
      return markers.some((m) => m.type === markerType);
    }
  }
  return false;
}

/**
 * Get next marker after current frame
 */
export function getNextMarker(
  frameMarkers: FrameMarkers,
  currentFrame: number,
  markerType?: "beat" | "onset" | "downbeat" | "pattern" | "harmonic",
): TimelineMarker | null {
  const sortedFrames = Object.keys(frameMarkers)
    .map(Number)
    .sort((a, b) => a - b);

  for (const frame of sortedFrames) {
    if (frame > currentFrame) {
      const markers = frameMarkers[frame];
      if (markerType) {
        const marker = markers.find((m) => m.type === markerType);
        if (marker) return marker;
      } else {
        return markers[0]; // Return first marker
      }
    }
  }

  return null;
}

/**
 * Get previous marker before current frame
 */
export function getPreviousMarker(
  frameMarkers: FrameMarkers,
  currentFrame: number,
  markerType?: "beat" | "onset" | "downbeat" | "pattern" | "harmonic",
): TimelineMarker | null {
  const sortedFrames = Object.keys(frameMarkers)
    .map(Number)
    .sort((a, b) => b - a); // Reverse sort

  for (const frame of sortedFrames) {
    if (frame < currentFrame) {
      const markers = frameMarkers[frame];
      if (markerType) {
        const marker = markers.find((m) => m.type === markerType);
        if (marker) return marker;
      } else {
        return markers[0]; // Return first marker
      }
    }
  }

  return null;
}

/**
 * Calculate interpolation value between markers
 * Useful for smooth animations between beat points
 */
export function interpolateBetweenMarkers(
  frameMarkers: FrameMarkers,
  currentFrame: number,
  markerType?: "beat" | "onset" | "downbeat" | "pattern" | "harmonic",
): number {
  const previous = getPreviousMarker(frameMarkers, currentFrame, markerType);
  const next = getNextMarker(frameMarkers, currentFrame, markerType);

  if (!previous || !next || !previous.frame || !next.frame) {
    return 0;
  }

  const totalDistance = next.frame - previous.frame;
  const currentDistance = currentFrame - previous.frame;

  return currentDistance / totalDistance;
}

/**
 * Group markers by type for easier access
 */
export function groupMarkersByType(
  markers: TimelineMarker[],
): Record<string, TimelineMarker[]> {
  const grouped: Record<string, TimelineMarker[]> = {};

  markers.forEach((marker) => {
    if (!grouped[marker.type]) {
      grouped[marker.type] = [];
    }
    grouped[marker.type].push(marker);
  });

  return grouped;
}

/**
 * Filter markers by confidence threshold
 */
export function filterMarkersByConfidence(
  markers: TimelineMarker[],
  minConfidence: number = 0.5,
): TimelineMarker[] {
  return markers.filter(
    (marker) =>
      marker.confidence === undefined || marker.confidence >= minConfidence,
  );
}

/**
 * Create a binary search function for efficient marker lookup
 */
export function createMarkerSearcher(frameMarkers: FrameMarkers) {
  const sortedFrames = Object.keys(frameMarkers)
    .map(Number)
    .sort((a, b) => a - b);

  return {
    /**
     * Binary search for nearest marker frame
     */
    findNearestMarkerFrame(targetFrame: number): number | null {
      if (sortedFrames.length === 0) return null;

      let left = 0;
      let right = sortedFrames.length - 1;
      let nearest = sortedFrames[0];
      let minDistance = Math.abs(targetFrame - sortedFrames[0]);

      while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        const distance = Math.abs(targetFrame - sortedFrames[mid]);

        if (distance < minDistance) {
          minDistance = distance;
          nearest = sortedFrames[mid];
        }

        if (sortedFrames[mid] < targetFrame) {
          left = mid + 1;
        } else if (sortedFrames[mid] > targetFrame) {
          right = mid - 1;
        } else {
          return sortedFrames[mid]; // Exact match
        }
      }

      return nearest;
    },

    /**
     * Check if frame has markers efficiently
     */
    hasMarkers(frame: number): boolean {
      let left = 0;
      let right = sortedFrames.length - 1;

      while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        if (sortedFrames[mid] === frame) {
          return true;
        } else if (sortedFrames[mid] < frame) {
          left = mid + 1;
        } else {
          right = mid - 1;
        }
      }

      return false;
    },

    /**
     * Get all frames with markers
     */
    getAllMarkerFrames(): number[] {
      return sortedFrames;
    },
  };
}