/**
 * Tests for marker utility functions
 */

import {
  markersToFrames,
  audioMarkersToFrames,
  getMarkersForFrame,
  getMarkersInTimeRange,
  getMarkersInFrameRange,
  isOnMarker,
  getNextMarker,
  getPreviousMarker,
  interpolateBetweenMarkers,
  groupMarkersByType,
  filterMarkersByConfidence,
  createMarkerSearcher,
} from "../../audio/markerUtils";
import type {
  TimelineMarker,
  AudioMarkers,
  FrameMarkers,
} from "../../audio/types";

describe("markerUtils", () => {
  const mockMarkers: TimelineMarker[] = [
    { time: 0.5, type: "beat", confidence: 0.9, strength: 0.8 },
    { time: 1.0, type: "onset", confidence: 0.7, strength: 0.6 },
    { time: 1.5, type: "beat", confidence: 0.95, strength: 0.9 },
    { time: 2.0, type: "downbeat", confidence: 1.0, strength: 1.0 },
    { time: 2.5, type: "beat", confidence: 0.85, strength: 0.75 },
  ];

  describe("markersToFrames", () => {
    it("should convert time-based markers to frame-based markers", () => {
      const frameMap = markersToFrames(mockMarkers, 0, 30); // 30 fps

      expect(frameMap.size).toBeGreaterThan(0);
      expect(frameMap.has(15)).toBe(true); // 0.5s * 30fps = frame 15
      expect(frameMap.has(30)).toBe(true); // 1.0s * 30fps = frame 30
      expect(frameMap.has(45)).toBe(true); // 1.5s * 30fps = frame 45
      expect(frameMap.has(60)).toBe(true); // 2.0s * 30fps = frame 60
      expect(frameMap.has(75)).toBe(true); // 2.5s * 30fps = frame 75
    });

    it("should handle audio start frame offset", () => {
      const frameMap = markersToFrames(mockMarkers, 30, 30); // Start at frame 30

      expect(frameMap.has(45)).toBe(true); // 30 + (0.5s * 30fps) = frame 45
      expect(frameMap.has(60)).toBe(true); // 30 + (1.0s * 30fps) = frame 60
    });

    it("should apply frame offset for anticipation", () => {
      const frameMap = markersToFrames(mockMarkers, 0, 30, -5); // 5 frames early

      expect(frameMap.has(10)).toBe(true); // 15 - 5 = frame 10
      expect(frameMap.has(25)).toBe(true); // 30 - 5 = frame 25
    });

    it("should group multiple markers on the same frame", () => {
      const markers: TimelineMarker[] = [
        { time: 1.0, type: "beat", confidence: 0.9 },
        { time: 1.0, type: "onset", confidence: 0.8 },
      ];

      const frameMap = markersToFrames(markers, 0, 30);
      const frame30Markers = frameMap.get(30);

      expect(frame30Markers).toBeDefined();
      expect(frame30Markers?.length).toBe(2);
      expect(frame30Markers?.[0].type).toBe("beat");
      expect(frame30Markers?.[1].type).toBe("onset");
    });

    it("should add frame number to markers", () => {
      const frameMap = markersToFrames(mockMarkers, 0, 30);
      const frame15Markers = frameMap.get(15);

      expect(frame15Markers?.[0].frame).toBe(15);
    });
  });

  describe("audioMarkersToFrames", () => {
    it("should convert all audio marker types to frames", () => {
      const audioMarkers: AudioMarkers = {
        beats: [
          { time: 0.5, type: "beat" },
          { time: 1.5, type: "beat" },
        ],
        onsets: [{ time: 1.0, type: "onset" }],
        downbeats: [{ time: 2.0, type: "downbeat" }],
        patterns: [],
        harmonicEvents: [],
        bpm: 120,
      };

      const frameMarkers = audioMarkersToFrames(audioMarkers, 0, 30);

      expect(frameMarkers[15]).toBeDefined(); // Beat at 0.5s
      expect(frameMarkers[30]).toBeDefined(); // Onset at 1.0s
      expect(frameMarkers[45]).toBeDefined(); // Beat at 1.5s
      expect(frameMarkers[60]).toBeDefined(); // Downbeat at 2.0s
    });

    it("should apply different offsets per marker type", () => {
      const audioMarkers: AudioMarkers = {
        beats: [{ time: 1.0, type: "beat" }],
        onsets: [{ time: 1.0, type: "onset" }],
        downbeats: [],
        patterns: [],
        harmonicEvents: [],
      };

      const frameMarkers = audioMarkersToFrames(audioMarkers, 0, 30, {
        beat: -2, // 2 frames early
        onset: 3, // 3 frames late
      });

      expect(frameMarkers[28]).toBeDefined(); // Beat at frame 30-2
      expect(frameMarkers[33]).toBeDefined(); // Onset at frame 30+3
    });
  });

  describe("getMarkersForFrame", () => {
    const frameMarkers: FrameMarkers = {
      15: [{ time: 0.5, type: "beat", frame: 15 }],
      30: [{ time: 1.0, type: "onset", frame: 30 }],
      45: [{ time: 1.5, type: "beat", frame: 45 }],
    };

    it("should get markers for exact frame", () => {
      const markers = getMarkersForFrame(frameMarkers, 30);

      expect(markers.length).toBe(1);
      expect(markers[0].type).toBe("onset");
    });

    it("should get markers with lookahead/lookbehind window", () => {
      const markers = getMarkersForFrame(frameMarkers, 31, 1); // Frame 31 with ±1 window

      expect(markers.length).toBe(1); // Should include frame 30
      expect(markers[0].frame).toBe(30);
    });

    it("should return empty array for frames without markers", () => {
      const markers = getMarkersForFrame(frameMarkers, 100);

      expect(markers).toEqual([]);
    });

    it("should handle window spanning multiple markers", () => {
      const markers = getMarkersForFrame(frameMarkers, 30, 15); // Wide window

      expect(markers.length).toBe(3); // Should include frames 15, 30, 45
    });
  });

  describe("getMarkersInTimeRange", () => {
    it("should return markers within time range", () => {
      const markers = getMarkersInTimeRange(mockMarkers, 0.5, 1.5);

      expect(markers.length).toBe(3);
      expect(markers[0].time).toBe(0.5);
      expect(markers[1].time).toBe(1.0);
      expect(markers[2].time).toBe(1.5);
    });

    it("should include boundary values", () => {
      const markers = getMarkersInTimeRange(mockMarkers, 1.0, 2.0);

      expect(markers.length).toBe(3);
      expect(markers[0].time).toBe(1.0);
      expect(markers[2].time).toBe(2.0);
    });

    it("should return empty array for range without markers", () => {
      const markers = getMarkersInTimeRange(mockMarkers, 10.0, 20.0);

      expect(markers).toEqual([]);
    });
  });

  describe("getMarkersInFrameRange", () => {
    const frameMarkers: FrameMarkers = {
      15: [{ time: 0.5, type: "beat", frame: 15 }],
      30: [{ time: 1.0, type: "onset", frame: 30 }],
      45: [{ time: 1.5, type: "beat", frame: 45 }],
      60: [{ time: 2.0, type: "downbeat", frame: 60 }],
    };

    it("should return markers within frame range", () => {
      const markers = getMarkersInFrameRange(frameMarkers, 20, 50);

      expect(markers.length).toBe(2);
      expect(markers[0].frame).toBe(30);
      expect(markers[1].frame).toBe(45);
    });

    it("should include boundary frames", () => {
      const markers = getMarkersInFrameRange(frameMarkers, 15, 45);

      expect(markers.length).toBe(3);
    });
  });

  describe("isOnMarker", () => {
    const frameMarkers: FrameMarkers = {
      15: [{ time: 0.5, type: "beat", frame: 15 }],
      30: [{ time: 1.0, type: "onset", frame: 30 }],
      45: [{ time: 1.5, type: "beat", frame: 45 }],
    };

    it("should detect marker on exact frame", () => {
      expect(isOnMarker(frameMarkers, 15)).toBe(true);
      expect(isOnMarker(frameMarkers, 30)).toBe(true);
      expect(isOnMarker(frameMarkers, 20)).toBe(false);
    });

    it("should detect specific marker type", () => {
      expect(isOnMarker(frameMarkers, 15, "beat")).toBe(true);
      expect(isOnMarker(frameMarkers, 15, "onset")).toBe(false);
      expect(isOnMarker(frameMarkers, 30, "onset")).toBe(true);
    });

    it("should detect markers with tolerance", () => {
      expect(isOnMarker(frameMarkers, 14, undefined, 1)).toBe(true); // Within ±1 of frame 15
      expect(isOnMarker(frameMarkers, 17, undefined, 2)).toBe(true); // Within ±2 of frame 15
      expect(isOnMarker(frameMarkers, 18, undefined, 2)).toBe(false); // Outside ±2 range
    });
  });

  describe("getNextMarker", () => {
    const frameMarkers: FrameMarkers = {
      15: [{ time: 0.5, type: "beat", frame: 15 }],
      30: [{ time: 1.0, type: "onset", frame: 30 }],
      45: [{ time: 1.5, type: "beat", frame: 45 }],
      60: [{ time: 2.0, type: "downbeat", frame: 60 }],
    };

    it("should get next marker after current frame", () => {
      const marker = getNextMarker(frameMarkers, 20);

      expect(marker).toBeDefined();
      expect(marker?.frame).toBe(30);
    });

    it("should get next marker of specific type", () => {
      const marker = getNextMarker(frameMarkers, 20, "beat");

      expect(marker).toBeDefined();
      expect(marker?.frame).toBe(45); // Skip onset at frame 30
    });

    it("should return null if no next marker", () => {
      const marker = getNextMarker(frameMarkers, 70);

      expect(marker).toBeNull();
    });

    it("should return null if no next marker of specific type", () => {
      const marker = getNextMarker(frameMarkers, 40, "onset");

      expect(marker).toBeNull(); // No onset after frame 40
    });
  });

  describe("getPreviousMarker", () => {
    const frameMarkers: FrameMarkers = {
      15: [{ time: 0.5, type: "beat", frame: 15 }],
      30: [{ time: 1.0, type: "onset", frame: 30 }],
      45: [{ time: 1.5, type: "beat", frame: 45 }],
    };

    it("should get previous marker before current frame", () => {
      const marker = getPreviousMarker(frameMarkers, 40);

      expect(marker).toBeDefined();
      expect(marker?.frame).toBe(30);
    });

    it("should get previous marker of specific type", () => {
      const marker = getPreviousMarker(frameMarkers, 40, "beat");

      expect(marker).toBeDefined();
      expect(marker?.frame).toBe(15); // Skip onset at frame 30
    });

    it("should return null if no previous marker", () => {
      const marker = getPreviousMarker(frameMarkers, 10);

      expect(marker).toBeNull();
    });
  });

  describe("interpolateBetweenMarkers", () => {
    const frameMarkers: FrameMarkers = {
      30: [{ time: 1.0, type: "beat", frame: 30 }],
      60: [{ time: 2.0, type: "beat", frame: 60 }],
    };

    it("should calculate interpolation between markers", () => {
      const progress = interpolateBetweenMarkers(frameMarkers, 45, "beat");

      expect(progress).toBe(0.5); // Halfway between frame 30 and 60
    });

    it("should return 0 at previous marker", () => {
      const progress = interpolateBetweenMarkers(frameMarkers, 30, "beat");

      expect(progress).toBe(0);
    });

    it("should approach 1 near next marker", () => {
      const progress = interpolateBetweenMarkers(frameMarkers, 59, "beat");

      expect(progress).toBeCloseTo(0.967, 2); // 29/30
    });

    it("should return 0 if no surrounding markers", () => {
      const progress = interpolateBetweenMarkers(frameMarkers, 100, "onset");

      expect(progress).toBe(0);
    });
  });

  describe("groupMarkersByType", () => {
    it("should group markers by type", () => {
      const grouped = groupMarkersByType(mockMarkers);

      expect(grouped["beat"]).toBeDefined();
      expect(grouped["beat"].length).toBe(3);
      expect(grouped["onset"]).toBeDefined();
      expect(grouped["onset"].length).toBe(1);
      expect(grouped["downbeat"]).toBeDefined();
      expect(grouped["downbeat"].length).toBe(1);
    });

    it("should handle empty array", () => {
      const grouped = groupMarkersByType([]);

      expect(grouped).toEqual({});
    });
  });

  describe("filterMarkersByConfidence", () => {
    it("should filter markers by confidence threshold", () => {
      const filtered = filterMarkersByConfidence(mockMarkers, 0.9);

      expect(filtered.length).toBe(3); // Only markers with confidence >= 0.9
      expect(filtered.every((m) => !m.confidence || m.confidence >= 0.9)).toBe(
        true,
      );
    });

    it("should include markers without confidence", () => {
      const markers: TimelineMarker[] = [
        { time: 1.0, type: "beat" }, // No confidence
        { time: 2.0, type: "beat", confidence: 0.5 },
      ];

      const filtered = filterMarkersByConfidence(markers, 0.8);

      expect(filtered.length).toBe(1);
      expect(filtered[0].time).toBe(1.0); // Marker without confidence passes
    });

    it("should use default threshold of 0.5", () => {
      const filtered = filterMarkersByConfidence(mockMarkers);

      expect(filtered.length).toBe(5); // All markers have confidence >= 0.5
    });
  });

  describe("createMarkerSearcher", () => {
    const frameMarkers: FrameMarkers = {
      15: [{ time: 0.5, type: "beat", frame: 15 }],
      30: [{ time: 1.0, type: "onset", frame: 30 }],
      45: [{ time: 1.5, type: "beat", frame: 45 }],
      60: [{ time: 2.0, type: "downbeat", frame: 60 }],
    };

    it("should create a searcher with binary search methods", () => {
      const searcher = createMarkerSearcher(frameMarkers);

      expect(searcher.findNearestMarkerFrame).toBeDefined();
      expect(searcher.hasMarkers).toBeDefined();
      expect(searcher.getAllMarkerFrames).toBeDefined();
    });

    it("should find nearest marker frame", () => {
      const searcher = createMarkerSearcher(frameMarkers);

      expect(searcher.findNearestMarkerFrame(14)).toBe(15);
      expect(searcher.findNearestMarkerFrame(16)).toBe(15);
      expect(searcher.findNearestMarkerFrame(22)).toBe(15); // Closer to 15 than 30
      expect(searcher.findNearestMarkerFrame(23)).toBe(30); // Closer to 30
      expect(searcher.findNearestMarkerFrame(30)).toBe(30); // Exact match
    });

    it("should check if frame has markers efficiently", () => {
      const searcher = createMarkerSearcher(frameMarkers);

      expect(searcher.hasMarkers(15)).toBe(true);
      expect(searcher.hasMarkers(30)).toBe(true);
      expect(searcher.hasMarkers(25)).toBe(false);
      expect(searcher.hasMarkers(100)).toBe(false);
    });

    it("should get all marker frames", () => {
      const searcher = createMarkerSearcher(frameMarkers);
      const allFrames = searcher.getAllMarkerFrames();

      expect(allFrames).toEqual([15, 30, 45, 60]);
    });

    it("should handle empty frame markers", () => {
      const searcher = createMarkerSearcher({});

      expect(searcher.findNearestMarkerFrame(50)).toBeNull();
      expect(searcher.hasMarkers(50)).toBe(false);
      expect(searcher.getAllMarkerFrames()).toEqual([]);
    });
  });
});
