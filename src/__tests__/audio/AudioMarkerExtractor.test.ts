/**
 * Tests for AudioMarkerExtractor
 */

import { AudioMarkerExtractor } from "../../audio/AudioMarkerExtractor";
import type { AudioAnalysisConfig } from "../../audio/types";

// Mock Essentia.js
jest.mock("essentia.js", () => ({
  __esModule: true,
  default: class MockEssentia {
    constructor() {
      return {
        arrayToVector: jest.fn((array: Float32Array) => ({
          size: () => array.length,
          get: (index: number) => array[index],
          delete: jest.fn(),
        })),
        BeatTrackerMultiFeature: jest.fn(() => ({
          ticks: {
            size: () => 4,
            get: (index: number) => index * 0.5, // Beat every 0.5 seconds
            delete: jest.fn(),
          },
          confidence: 0.9,
          bpm: {
            delete: jest.fn(),
          },
        })),
        BpmHistogram: jest.fn(() => ({
          bpm: 120,
          delete: jest.fn(),
        })),
        OnsetDetection: jest.fn(() => ({
          size: () => 3,
          get: (index: number) => index * 0.3 + 0.1, // Onsets at 0.1, 0.4, 0.7
          delete: jest.fn(),
        })),
        SuperFluxExtractor: jest.fn(() => ({
          size: () => 3,
          get: (index: number) => index * 0.25,
          delete: jest.fn(),
        })),
      };
    }
  },
}));

describe("AudioMarkerExtractor", () => {
  let extractor: AudioMarkerExtractor;
  let mockAudioBuffer: AudioBuffer;

  beforeEach(() => {
    // Create mock AudioBuffer
    const sampleRate = 44100;
    const length = sampleRate * 2; // 2 seconds of audio
    const audioData = new Float32Array(length);

    // Add some fake audio data
    for (let i = 0; i < length; i++) {
      audioData[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.5;
    }

    mockAudioBuffer = {
      sampleRate,
      length,
      duration: 2,
      numberOfChannels: 1,
      getChannelData: jest.fn(() => audioData),
      copyFromChannel: jest.fn(),
      copyToChannel: jest.fn(),
    } as unknown as AudioBuffer;
  });

  afterEach(() => {
    if (extractor) {
      extractor.dispose();
    }
  });

  describe("initialization", () => {
    it("should initialize with default config", async () => {
      extractor = new AudioMarkerExtractor();
      await extractor.initialize();
      expect(extractor).toBeDefined();
    });

    it("should initialize with custom config", async () => {
      const config: Partial<AudioAnalysisConfig> = {
        beatTracking: {
          enabled: true,
          method: "multifeature",
          sensitivity: 0.7,
        },
        onsetDetection: {
          enabled: false,
        },
      };

      extractor = new AudioMarkerExtractor(config);
      await extractor.initialize();
      expect(extractor).toBeDefined();
    });

    it("should handle multiple initialization calls", async () => {
      extractor = new AudioMarkerExtractor();
      await extractor.initialize();
      await extractor.initialize(); // Should not throw
      expect(extractor).toBeDefined();
    });
  });

  describe("extractMarkers", () => {
    beforeEach(async () => {
      extractor = new AudioMarkerExtractor();
      await extractor.initialize();
    });

    it("should extract beats from audio", async () => {
      const markers = await extractor.extractMarkers(mockAudioBuffer);

      expect(markers.beats).toBeDefined();
      expect(markers.beats.length).toBe(4);
      expect(markers.beats[0]).toMatchObject({
        time: 0,
        type: "beat",
        confidence: 0.9,
        strength: 1.0,
      });
    });

    it("should extract onsets from audio", async () => {
      const markers = await extractor.extractMarkers(mockAudioBuffer);

      expect(markers.onsets).toBeDefined();
      expect(markers.onsets.length).toBeGreaterThan(0);
      expect(markers.onsets[0]).toMatchObject({
        time: expect.any(Number),
        type: "onset",
        confidence: 0.8,
        strength: 0.7,
      });
    });

    it("should extract BPM", async () => {
      const markers = await extractor.extractMarkers(mockAudioBuffer);

      expect(markers.bpm).toBe(120);
    });

    it("should identify downbeats", async () => {
      const markers = await extractor.extractMarkers(mockAudioBuffer);

      expect(markers.downbeats).toBeDefined();
      expect(markers.downbeats.length).toBeGreaterThan(0);
      expect(markers.downbeats[0].type).toBe("downbeat");
    });

    it("should detect patterns when enabled", async () => {
      const markers = await extractor.extractMarkers(mockAudioBuffer);

      expect(markers.patterns).toBeDefined();
      expect(Array.isArray(markers.patterns)).toBe(true);
    });

    it("should extract harmonic markers when enabled", async () => {
      const markers = await extractor.extractMarkers(mockAudioBuffer);

      expect(markers.harmonicEvents).toBeDefined();
      expect(Array.isArray(markers.harmonicEvents)).toBe(true);

      if (markers.harmonicEvents.length > 0) {
        expect(markers.harmonicEvents[0]).toMatchObject({
          time: expect.any(Number),
          frequency: expect.any(Number),
          spectralCentroid: expect.any(Number),
          energy: expect.any(Number),
        });
      }
    });

    it("should skip beat extraction when disabled", async () => {
      const config: Partial<AudioAnalysisConfig> = {
        beatTracking: { enabled: false },
        onsetDetection: { enabled: true },
      };

      extractor = new AudioMarkerExtractor(config);
      await extractor.initialize();

      const markers = await extractor.extractMarkers(mockAudioBuffer);

      expect(markers.beats.length).toBe(0);
      expect(markers.bpm).toBeUndefined();
    });

    it("should skip onset extraction when disabled", async () => {
      const config: Partial<AudioAnalysisConfig> = {
        beatTracking: { enabled: true },
        onsetDetection: { enabled: false },
      };

      extractor = new AudioMarkerExtractor(config);
      await extractor.initialize();

      const markers = await extractor.extractMarkers(mockAudioBuffer);

      expect(markers.onsets.length).toBe(0);
    });

    it("should handle stereo audio", async () => {
      const stereoBuffer = {
        ...mockAudioBuffer,
        numberOfChannels: 2,
        getChannelData: jest.fn((channel: number) => {
          return new Float32Array(mockAudioBuffer.length);
        }),
      } as unknown as AudioBuffer;

      const markers = await extractor.extractMarkers(stereoBuffer);

      expect(markers).toBeDefined();
      expect(markers.beats).toBeDefined();
    });

    it("should handle different sample rates", async () => {
      const customBuffer = {
        ...mockAudioBuffer,
        sampleRate: 48000,
      } as unknown as AudioBuffer;

      const markers = await extractor.extractMarkers(customBuffer, 48000);

      expect(markers).toBeDefined();
      expect(markers.beats).toBeDefined();
    });
  });

  describe("pattern detection", () => {
    beforeEach(async () => {
      extractor = new AudioMarkerExtractor({
        patternDetection: {
          enabled: true,
          minPatternLength: 2,
          maxPatternLength: 4,
        },
      });
      await extractor.initialize();
    });

    it("should detect rhythmic patterns from beats", async () => {
      const markers = await extractor.extractMarkers(mockAudioBuffer);

      expect(markers.patterns).toBeDefined();

      if (markers.patterns.length > 0) {
        const pattern = markers.patterns[0];
        expect(pattern).toMatchObject({
          startTime: expect.any(Number),
          endTime: expect.any(Number),
          pattern: expect.any(String),
        });
        expect(pattern.endTime).toBeGreaterThan(pattern.startTime);
      }
    });
  });

  describe("error handling", () => {
    it("should auto-initialize if not initialized", async () => {
      extractor = new AudioMarkerExtractor();

      // Should auto-initialize and not throw
      const markers = await extractor.extractMarkers(mockAudioBuffer);
      expect(markers).toBeDefined();
      expect(markers.beats).toBeDefined();
    });

    it("should handle invalid audio buffer gracefully", async () => {
      extractor = new AudioMarkerExtractor();
      await extractor.initialize();

      const invalidBuffer = {
        sampleRate: 44100,
        length: 0,
        duration: 0,
        numberOfChannels: 1,
        getChannelData: jest.fn(() => new Float32Array(0)),
        copyFromChannel: jest.fn(),
        copyToChannel: jest.fn(),
      } as unknown as AudioBuffer;

      // Should handle empty buffer gracefully
      const markers = await extractor.extractMarkers(invalidBuffer);
      expect(markers).toBeDefined();
    });
  });

  describe("cleanup", () => {
    it("should dispose resources properly", async () => {
      extractor = new AudioMarkerExtractor();
      await extractor.initialize();

      extractor.dispose();

      // Should be able to reinitialize after disposal
      await extractor.initialize();
      const markers = await extractor.extractMarkers(mockAudioBuffer);
      expect(markers).toBeDefined();
    });
  });

  describe("utility methods", () => {
    beforeEach(async () => {
      extractor = new AudioMarkerExtractor();
      await extractor.initialize();
    });

    it("should calculate energy correctly", () => {
      const window = new Float32Array([0.5, -0.5, 0.3, -0.3]);
      // Energy = sqrt(sum of squares / length)
      // = sqrt((0.25 + 0.25 + 0.09 + 0.09) / 4)
      // = sqrt(0.68 / 4) = sqrt(0.17) ≈ 0.412

      const energy = (extractor as any).calculateEnergy(window);
      expect(energy).toBeCloseTo(0.412, 2);
    });

    it("should calculate spectral centroid", () => {
      const window = new Float32Array([0.1, 0.2, 0.3, 0.4]);
      const sampleRate = 44100;

      const centroid = (extractor as any).calculateSpectralCentroid(
        window,
        sampleRate,
      );
      expect(centroid).toBeGreaterThan(0);
      expect(centroid).toBeLessThan(sampleRate / 2);
    });

    it("should classify patterns based on intervals", () => {
      const intervals = [0.5, 0.5, 1.0]; // Based on the actual implementation

      const pattern = (extractor as any).classifyPattern(intervals);
      // The implementation classifies 0.5s intervals as "eighth" and 1.0s as "half"
      expect(pattern).toContain("eighth");
      expect(pattern).toContain("half");
    });

    it("should return null for short patterns", () => {
      const intervals = [0.5]; // Too short

      const pattern = (extractor as any).classifyPattern(intervals);
      expect(pattern).toBeNull();
    });
  });
});
