/**
 * Audio Marker Extractor using Essentia.js
 * Extracts beats, onsets, and other musical markers from audio
 */

import type {
  AudioMarkers,
  TimelineMarker,
  AudioAnalysisConfig,
  HarmonicMarker,
  RhythmicPattern,
} from "./types";

// @ts-ignore - Essentia.js doesn't have TypeScript definitions
import Essentia from "essentia.js";
import type { EssentiaWASM } from "essentia.js";

export class AudioMarkerExtractor {
  private essentia: EssentiaWASM | null = null;
  private isInitialized = false;
  private config: AudioAnalysisConfig;

  constructor(config?: Partial<AudioAnalysisConfig>) {
    this.config = {
      beatTracking: {
        enabled: true,
        method: "multifeature",
        sensitivity: 0.5,
        ...config?.beatTracking,
      },
      onsetDetection: {
        enabled: true,
        method: "complex",
        threshold: 0.3,
        ...config?.onsetDetection,
      },
      harmonicAnalysis: {
        enabled: true,
        windowSize: 2048,
        hopSize: 512,
        ...config?.harmonicAnalysis,
      },
      patternDetection: {
        enabled: true,
        minPatternLength: 2,
        maxPatternLength: 8,
        ...config?.patternDetection,
      },
    };
  }

  /**
   * Initialize Essentia.js WASM module
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize Essentia.js
      const EssentiaClass = (Essentia as any).Essentia || Essentia;
      this.essentia = new EssentiaClass();
      this.isInitialized = true;
      console.log("Essentia.js initialized successfully");
    } catch (error) {
      console.error("Failed to initialize Essentia.js:", error);
      throw new Error("Failed to initialize audio analysis engine");
    }
  }

  /**
   * Extract all markers from an audio buffer
   */
  async extractMarkers(
    audioBuffer: AudioBuffer,
    sampleRate: number = 44100,
  ): Promise<AudioMarkers> {
    if (!this.isInitialized || !this.essentia) {
      await this.initialize();
    }

    if (!this.essentia) {
      throw new Error("Essentia.js not initialized");
    }

    // Convert AudioBuffer to mono array
    const audioData = this.getMonoAudioData(audioBuffer);

    // Convert to Essentia vector format
    const audioVector = this.essentia.arrayToVector(audioData);

    const markers: AudioMarkers = {
      beats: [],
      onsets: [],
      downbeats: [],
      patterns: [],
      harmonicEvents: [],
    };

    try {
      // Extract beats if enabled
      if (this.config.beatTracking.enabled) {
        const beatData = this.extractBeats(audioVector, sampleRate);
        markers.beats = beatData.beats;
        markers.downbeats = beatData.downbeats;
        markers.bpm = beatData.bpm;
      }

      // Extract onsets if enabled
      if (this.config.onsetDetection.enabled) {
        markers.onsets = this.extractOnsets(audioVector, sampleRate);
      }

      // Extract harmonic markers if enabled
      if (this.config.harmonicAnalysis.enabled) {
        markers.harmonicEvents = this.extractHarmonicMarkers(
          audioData,
          sampleRate,
        );
      }

      // Detect patterns if enabled
      if (this.config.patternDetection.enabled && markers.beats.length > 0) {
        markers.patterns = this.detectPatterns(markers.beats);
      }

      // Clean up
      audioVector.delete();

      return markers;
    } catch (error) {
      console.error("Error extracting markers:", error);
      // Clean up on error
      audioVector.delete();
      throw error;
    }
  }

  /**
   * Extract beat positions using Essentia's BeatTrackerMultiFeature
   */
  private extractBeats(
    audioVector: any,
    sampleRate: number,
  ): {
    beats: TimelineMarker[];
    downbeats: TimelineMarker[];
    bpm: number;
  } {
    if (!this.essentia) {
      throw new Error("Essentia not initialized");
    }

    // Use BeatTrackerMultiFeature for robust beat tracking
    const beatTracker = this.essentia.BeatTrackerMultiFeature(
      audioVector,
      sampleRate,
    );

    // Extract beat ticks (positions in seconds)
    const beatTicks = beatTracker.ticks;
    const confidence = beatTracker.confidence;

    // Convert to TimelineMarker format
    const beats: TimelineMarker[] = [];
    for (let i = 0; i < beatTicks.size(); i++) {
      beats.push({
        time: beatTicks.get(i),
        type: "beat",
        confidence: confidence,
        strength: 1.0, // BeatTrackerMultiFeature doesn't provide individual strengths
      });
    }

    // Extract BPM
    const bpmData = this.essentia.BpmHistogram(beatTracker.bpm);
    const bpm = bpmData.bpm;

    // Estimate downbeats (first beat of each measure)
    // Simple heuristic: every 4th beat in 4/4 time
    const downbeats: TimelineMarker[] = [];
    for (let i = 0; i < beats.length; i += 4) {
      downbeats.push({
        ...beats[i],
        type: "downbeat",
      });
    }

    // Clean up
    beatTicks.delete();
    beatTracker.bpm.delete();
    bpmData.delete();

    return { beats, downbeats, bpm };
  }

  /**
   * Extract onset positions (when new sounds/notes begin)
   */
  private extractOnsets(
    audioVector: any,
    sampleRate: number,
  ): TimelineMarker[] {
    if (!this.essentia) {
      throw new Error("Essentia not initialized");
    }

    const onsets: TimelineMarker[] = [];

    // Configure onset detection based on method
    const method = this.config.onsetDetection.method || "complex";

    // Use different onset detection functions based on method
    let onsetTimes: any;

    if (method === "superflux") {
      // SuperFlux for more accurate onset detection
      const superflux = this.essentia.SuperFluxExtractor(
        audioVector,
        sampleRate,
      );
      onsetTimes = superflux;
    } else {
      // Use OnsetDetection with specified method
      const onsetDetector = this.essentia.OnsetDetection(
        audioVector,
        method,
        sampleRate,
      );
      onsetTimes = onsetDetector;
    }

    // Convert to TimelineMarker format
    for (let i = 0; i < onsetTimes.size(); i++) {
      const time = onsetTimes.get(i);
      if (time > 0) {
        // Filter out zero/negative times
        onsets.push({
          time,
          type: "onset",
          confidence: 0.8, // Default confidence
          strength: 0.7, // Default strength
        });
      }
    }

    // Clean up
    onsetTimes.delete();

    return onsets;
  }

  /**
   * Extract harmonic markers for color/visual mapping
   */
  private extractHarmonicMarkers(
    audioData: Float32Array,
    sampleRate: number,
  ): HarmonicMarker[] {
    const markers: HarmonicMarker[] = [];
    const windowSize = this.config.harmonicAnalysis.windowSize || 2048;
    const hopSize = this.config.harmonicAnalysis.hopSize || 512;

    // Process audio in windows
    for (let i = 0; i < audioData.length - windowSize; i += hopSize) {
      const window = audioData.slice(i, i + windowSize);

      // Calculate spectral features (simplified - would use Meyda for this)
      const energy = this.calculateEnergy(window);
      const spectralCentroid = this.calculateSpectralCentroid(
        window,
        sampleRate,
      );

      // Only create marker for significant energy changes
      if (energy > 0.1) {
        markers.push({
          time: i / sampleRate,
          frequency: spectralCentroid,
          spectralCentroid,
          energy,
        });
      }
    }

    return markers;
  }

  /**
   * Detect rhythmic patterns in beat sequences
   */
  private detectPatterns(beats: TimelineMarker[]): RhythmicPattern[] {
    const patterns: RhythmicPattern[] = [];
    const minLength = this.config.patternDetection.minPatternLength || 2;
    const maxLength = this.config.patternDetection.maxPatternLength || 8;

    // Simple pattern detection based on inter-beat intervals
    for (let i = 0; i < beats.length - minLength; i++) {
      const intervals: number[] = [];

      // Calculate intervals between consecutive beats
      for (let j = i; j < Math.min(i + maxLength, beats.length - 1); j++) {
        intervals.push(beats[j + 1].time - beats[j].time);
      }

      // Classify pattern based on intervals
      const pattern = this.classifyPattern(intervals);
      if (pattern) {
        patterns.push({
          startTime: beats[i].time,
          endTime: beats[i + intervals.length].time,
          pattern,
        });
      }
    }

    return patterns;
  }

  /**
   * Convert stereo/multi-channel audio to mono
   */
  private getMonoAudioData(audioBuffer: AudioBuffer): Float32Array {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;
    const mono = new Float32Array(length);

    // Mix all channels to mono
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const channelData = audioBuffer.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        mono[i] += channelData[i] / numberOfChannels;
      }
    }

    return mono;
  }

  /**
   * Calculate energy of audio window
   */
  private calculateEnergy(window: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < window.length; i++) {
      sum += window[i] * window[i];
    }
    return Math.sqrt(sum / window.length);
  }

  /**
   * Calculate spectral centroid (brightness indicator)
   */
  private calculateSpectralCentroid(
    window: Float32Array,
    sampleRate: number,
  ): number {
    // Simplified spectral centroid calculation
    // In production, would use FFT for accurate frequency analysis
    let weightedSum = 0;
    let magnitudeSum = 0;

    for (let i = 0; i < window.length; i++) {
      const magnitude = Math.abs(window[i]);
      const frequency = (i * sampleRate) / (2 * window.length);
      weightedSum += frequency * magnitude;
      magnitudeSum += magnitude;
    }

    return magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
  }

  /**
   * Classify rhythmic pattern based on intervals
   */
  private classifyPattern(intervals: number[]): string | null {
    if (intervals.length < 2) return null;

    // Calculate average interval
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

    // Classify based on relative intervals
    const relativeIntervals = intervals.map((i) => {
      const ratio = i / avgInterval;
      if (ratio < 0.6) return "sixteenth";
      if (ratio < 0.8) return "eighth";
      if (ratio < 1.2) return "quarter";
      if (ratio < 1.8) return "half";
      return "whole";
    });

    return relativeIntervals.join("-");
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.essentia) {
      // Essentia cleanup if needed
      this.essentia = null;
    }
    this.isInitialized = false;
  }
}