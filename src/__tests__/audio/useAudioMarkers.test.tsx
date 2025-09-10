/**
 * Tests for useAudioMarkers React hook
 */

import { renderHook, waitFor } from "@testing-library/react";
import * as Remotion from "remotion";
import {
  useAudioMarkers,
  useBeats,
  useRhythm,
  useFullAudioAnalysis,
} from "../../audio/hooks/useAudioMarkers";

// Mock Remotion hooks
jest.mock("remotion");

// Mock AudioMarkerExtractor
jest.mock("../../audio/AudioMarkerExtractor", () => ({
  AudioMarkerExtractor: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    extractMarkers: jest.fn().mockResolvedValue({
      beats: [
        { time: 0.5, type: "beat", confidence: 0.9 },
        { time: 1.0, type: "beat", confidence: 0.95 },
        { time: 1.5, type: "beat", confidence: 0.85 },
      ],
      onsets: [
        { time: 0.3, type: "onset", confidence: 0.8 },
        { time: 0.8, type: "onset", confidence: 0.75 },
      ],
      downbeats: [
        { time: 0.5, type: "downbeat", confidence: 1.0 },
        { time: 2.0, type: "downbeat", confidence: 1.0 },
      ],
      patterns: [],
      harmonicEvents: [],
      bpm: 120,
    }),
    dispose: jest.fn(),
  })),
}));

// Mock fetch for audio loading
global.fetch = jest.fn(() =>
  Promise.resolve({
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
  } as Response),
);

// Mock AudioContext
const mockDecodeAudioData = jest.fn().mockResolvedValue({
  sampleRate: 44100,
  length: 44100,
  duration: 1,
  numberOfChannels: 1,
  getChannelData: jest.fn(() => new Float32Array(44100)),
  copyFromChannel: jest.fn(),
  copyToChannel: jest.fn(),
});

(global as any).AudioContext = jest.fn().mockImplementation(() => ({
  decodeAudioData: mockDecodeAudioData,
  close: jest.fn(),
}));

describe("useAudioMarkers", () => {
  beforeEach(() => {
    // Setup Remotion mocks
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(30); // Frame 30
    (Remotion.useVideoConfig as jest.Mock).mockReturnValue({
      fps: 30,
      durationInFrames: 300,
      width: 1920,
      height: 1080,
    });
    (Remotion.staticFile as jest.Mock).mockImplementation(
      (path: string) => `/static/${path}`,
    );

    // Clear mocks
    jest.clearAllMocks();
  });

  describe("basic functionality", () => {
    it("should load and analyze audio on mount", async () => {
      const { result } = renderHook(() =>
        useAudioMarkers({
          audioSrc: "audio/test.mp3",
          audioStartFrame: 0,
        }),
      );

      // Initially loading
      expect(result.current.isLoading).toBe(true);
      expect(result.current.markers).toBeNull();

      // Wait for analysis to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should have markers
      expect(result.current.markers).toBeDefined();
      expect(result.current.markers?.beats.length).toBe(3);
      expect(result.current.markers?.bpm).toBe(120);
      expect(result.current.error).toBeNull();
    });

    it("should convert markers to frame-based markers", async () => {
      const { result } = renderHook(() =>
        useAudioMarkers({
          audioSrc: "audio/test.mp3",
          audioStartFrame: 0,
        }),
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.frameMarkers).toBeDefined();
      // At 30 fps: 0.5s = frame 15, 1.0s = frame 30, 1.5s = frame 45
      expect(result.current.frameMarkers?.[15]).toBeDefined();
      expect(result.current.frameMarkers?.[30]).toBeDefined();
      expect(result.current.frameMarkers?.[45]).toBeDefined();
    });

    it("should cache analysis results", async () => {
      const { result: result1 } = renderHook(() =>
        useAudioMarkers({
          audioSrc: "audio/test.mp3",
          audioStartFrame: 0,
          cacheKey: "test-cache",
        }),
      );

      await waitFor(() => {
        expect(result1.current.isLoading).toBe(false);
      });

      // Second hook with same cache key
      const { result: result2 } = renderHook(() =>
        useAudioMarkers({
          audioSrc: "audio/test.mp3",
          audioStartFrame: 0,
          cacheKey: "test-cache",
        }),
      );

      // Should load from cache immediately
      await waitFor(() => {
        expect(result2.current.isLoading).toBe(false);
      });

      // Should have same markers
      expect(result2.current.markers).toEqual(result1.current.markers);
    });
  });

  describe("current frame detection", () => {
    it("should detect markers for current frame", async () => {
      (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(15); // Frame 15 = 0.5s

      const { result } = renderHook(() =>
        useAudioMarkers({
          audioSrc: "audio/test.mp3",
          audioStartFrame: 0,
          window: 0,
        }),
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Frame 15 has a beat at 0.5s
      expect(result.current.currentMarkers.length).toBeGreaterThan(0);
      expect(result.current.isOnBeat).toBe(true);
      expect(result.current.isOnDownbeat).toBe(true);
    });

    it("should handle frame window tolerance", async () => {
      (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(14); // Frame 14 (just before beat)

      const { result } = renderHook(() =>
        useAudioMarkers({
          audioSrc: "audio/test.mp3",
          audioStartFrame: 0,
          window: 1, // ±1 frame tolerance
        }),
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should detect beat at frame 15 with ±1 tolerance
      expect(result.current.isOnBeat).toBe(true);
    });

    it("should not detect markers outside window", async () => {
      (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(10); // Frame 10

      const { result } = renderHook(() =>
        useAudioMarkers({
          audioSrc: "audio/test.mp3",
          audioStartFrame: 0,
          window: 0,
        }),
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.currentMarkers.length).toBe(0);
      expect(result.current.isOnBeat).toBe(false);
      expect(result.current.isOnOnset).toBe(false);
      expect(result.current.isOnDownbeat).toBe(false);
    });
  });

  describe("navigation functions", () => {
    it("should find next and previous beats", async () => {
      (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(20); // Between beats

      const { result } = renderHook(() =>
        useAudioMarkers({
          audioSrc: "audio/test.mp3",
          audioStartFrame: 0,
        }),
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Previous beat at frame 15 (0.5s)
      expect(result.current.previousBeat).toBeDefined();
      expect(result.current.previousBeat?.time).toBe(0.5);

      // Next beat at frame 30 (1.0s)
      expect(result.current.nextBeat).toBeDefined();
      expect(result.current.nextBeat?.time).toBe(1.0);
    });

    it("should calculate beat progress", async () => {
      (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(22); // Between frames 15 and 30

      const { result } = renderHook(() =>
        useAudioMarkers({
          audioSrc: "audio/test.mp3",
          audioStartFrame: 0,
        }),
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Progress from frame 15 to 30: (22-15)/(30-15) = 7/15 ≈ 0.467
      expect(result.current.beatProgress).toBeCloseTo(0.467, 1);
    });
  });

  describe("utility functions", () => {
    it("should provide isOnMarker function", async () => {
      (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(15);

      const { result } = renderHook(() =>
        useAudioMarkers({
          audioSrc: "audio/test.mp3",
          audioStartFrame: 0,
        }),
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isOnMarker("beat")).toBe(true);
      expect(result.current.isOnMarker("onset")).toBe(false);
      expect(result.current.isOnMarker()).toBe(true); // Any marker
    });

    it("should provide getNextMarker function", async () => {
      (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(20);

      const { result } = renderHook(() =>
        useAudioMarkers({
          audioSrc: "audio/test.mp3",
          audioStartFrame: 0,
        }),
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const nextBeat = result.current.getNextMarker("beat");
      expect(nextBeat).toBeDefined();
      expect(nextBeat?.time).toBe(1.0);

      const nextOnset = result.current.getNextMarker("onset");
      expect(nextOnset).toBeDefined();
    });

    it("should provide getPreviousMarker function", async () => {
      (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(40);

      const { result } = renderHook(() =>
        useAudioMarkers({
          audioSrc: "audio/test.mp3",
          audioStartFrame: 0,
        }),
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const prevBeat = result.current.getPreviousMarker("beat");
      expect(prevBeat).toBeDefined();
    });
  });

  describe("error handling", () => {
    it("should handle fetch errors", async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error("Network error"),
      );

      const { result } = renderHook(() =>
        useAudioMarkers({
          audioSrc: "audio/test.mp3",
          audioStartFrame: 0,
        }),
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.error?.message).toContain("Network error");
      expect(result.current.markers).toBeNull();
    });

    it("should handle audio decode errors", async () => {
      mockDecodeAudioData.mockRejectedValueOnce(
        new Error("Invalid audio format"),
      );

      const { result } = renderHook(() =>
        useAudioMarkers({
          audioSrc: "audio/test.mp3",
          audioStartFrame: 0,
        }),
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.error?.message).toContain("Invalid audio format");
    });
  });

  describe("configuration options", () => {
    it("should pass config to AudioMarkerExtractor", async () => {
      const AudioMarkerExtractor =
        require("../../audio/AudioMarkerExtractor").AudioMarkerExtractor;

      const config = {
        beatTracking: { enabled: true, sensitivity: 0.8 },
        onsetDetection: { enabled: false },
      };

      renderHook(() =>
        useAudioMarkers({
          audioSrc: "audio/test.mp3",
          audioStartFrame: 0,
          config,
        }),
      );

      await waitFor(() => {
        expect(AudioMarkerExtractor).toHaveBeenCalledWith(config);
      });
    });

    it("should handle audio start frame offset", async () => {
      const { result } = renderHook(() =>
        useAudioMarkers({
          audioSrc: "audio/test.mp3",
          audioStartFrame: 30, // Start at frame 30
        }),
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Beats should be offset by 30 frames
      expect(result.current.frameMarkers?.[45]).toBeDefined(); // 30 + 15
      expect(result.current.frameMarkers?.[60]).toBeDefined(); // 30 + 30
    });
  });
});

describe("specialized hooks", () => {
  beforeEach(() => {
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(30);
    (Remotion.useVideoConfig as jest.Mock).mockReturnValue({
      fps: 30,
      durationInFrames: 300,
    });
    (Remotion.staticFile as jest.Mock).mockImplementation(
      (path: string) => `/static/${path}`,
    );
  });

  describe("useBeats", () => {
    it("should only enable beat tracking", async () => {
      const AudioMarkerExtractor =
        require("../../audio/AudioMarkerExtractor").AudioMarkerExtractor;

      renderHook(() => useBeats("audio/test.mp3"));

      await waitFor(() => {
        expect(AudioMarkerExtractor).toHaveBeenCalledWith(
          expect.objectContaining({
            beatTracking: { enabled: true },
            onsetDetection: { enabled: false },
            harmonicAnalysis: { enabled: false },
            patternDetection: { enabled: false },
          }),
        );
      });
    });
  });

  describe("useRhythm", () => {
    it("should enable rhythm-related features", async () => {
      const AudioMarkerExtractor =
        require("../../audio/AudioMarkerExtractor").AudioMarkerExtractor;

      renderHook(() => useRhythm("audio/test.mp3"));

      await waitFor(() => {
        expect(AudioMarkerExtractor).toHaveBeenCalledWith(
          expect.objectContaining({
            beatTracking: { enabled: true },
            onsetDetection: { enabled: true },
            harmonicAnalysis: { enabled: false },
            patternDetection: { enabled: true },
          }),
        );
      });
    });
  });

  describe("useFullAudioAnalysis", () => {
    it("should enable all analysis features", async () => {
      const AudioMarkerExtractor =
        require("../../audio/AudioMarkerExtractor").AudioMarkerExtractor;

      renderHook(() => useFullAudioAnalysis("audio/test.mp3"));

      await waitFor(() => {
        expect(AudioMarkerExtractor).toHaveBeenCalledWith(
          expect.objectContaining({
            beatTracking: { enabled: true },
            onsetDetection: { enabled: true },
            harmonicAnalysis: { enabled: true },
            patternDetection: { enabled: true },
          }),
        );
      });
    });
  });
});
