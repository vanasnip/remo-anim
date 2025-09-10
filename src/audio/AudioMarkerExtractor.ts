/**
 * Audio Marker Extractor with fallback implementation
 * Extracts beats, onsets, and other musical markers from audio
 * Uses Essentia.js when available, falls back to Web Audio API analysis
 */

import type {
  AudioMarkers,
  TimelineMarker,
  AudioAnalysisConfig,
  HarmonicMarker,
  RhythmicPattern,
} from "./types";

export class AudioMarkerExtractor {
  private essentia: any = null;
  private isInitialized = false;
  private useEssentia = false;
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
   * Initialize audio analysis engine with fallback
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Try to load Essentia.js
      try {
        const Essentia = await import("essentia.js");
        const EssentiaClass = (Essentia as any).Essentia || Essentia.default || Essentia;
        this.essentia = new EssentiaClass();
        this.useEssentia = true;
        console.log("Essentia.js initialized successfully");
      } catch (essentiaError) {
        console.warn("Essentia.js not available, using fallback implementation:", essentiaError);
        this.useEssentia = false;
      }

      this.isInitialized = true;
      console.log(`Audio analysis initialized (${this.useEssentia ? "Essentia.js" : "Fallback"})`);
    } catch (error) {
      console.error("Failed to initialize audio analysis engine:", error);
      // Don't throw, use fallback implementation
      this.isInitialized = true;
      this.useEssentia = false;
      console.log("Using fallback audio analysis implementation");
    }
  }

  /**
   * Extract all markers from an audio buffer
   */
  async extractMarkers(
    audioBuffer: AudioBuffer,
    sampleRate: number = 44100,
  ): Promise<AudioMarkers> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Convert AudioBuffer to mono array
    const audioData = this.getMonoAudioData(audioBuffer);

    const markers: AudioMarkers = {
      beats: [],
      onsets: [],
      downbeats: [],
      patterns: [],
      harmonicEvents: [],
    };

    try {
      if (this.useEssentia && this.essentia) {
        return await this.extractMarkersWithEssentia(audioData, sampleRate);
      } else {
        return await this.extractMarkersWithFallback(audioData, sampleRate, audioBuffer);
      }
    } catch (error) {
      console.error("Error extracting markers:", error);
      // Fallback to simple implementation
      return await this.extractMarkersWithFallback(audioData, sampleRate, audioBuffer);
    }
  }

  /**
   * Extract markers using Essentia.js
   */
  private async extractMarkersWithEssentia(
    audioData: Float32Array,
    sampleRate: number,
  ): Promise<AudioMarkers> {
    if (!this.essentia) {
      throw new Error("Essentia.js not available");
    }

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
        const beatData = this.extractBeatsEssentia(audioVector, sampleRate);
        markers.beats = beatData.beats;
        markers.downbeats = beatData.downbeats;
        markers.bpm = beatData.bpm;
      }

      // Extract onsets if enabled
      if (this.config.onsetDetection.enabled) {
        markers.onsets = this.extractOnsetsEssentia(audioVector, sampleRate);
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
      // Clean up on error
      audioVector.delete();
      throw error;
    }
  }

  /**
   * Extract markers using fallback Web Audio API implementation
   */
  private async extractMarkersWithFallback(
    audioData: Float32Array,
    sampleRate: number,
    audioBuffer: AudioBuffer,
  ): Promise<AudioMarkers> {
    console.log("Using fallback audio analysis implementation");

    const markers: AudioMarkers = {
      beats: [],
      onsets: [],
      downbeats: [],
      patterns: [],
      harmonicEvents: [],
    };

    // Extract beats if enabled
    if (this.config.beatTracking.enabled) {
      const beatData = this.extractBeatsFallback(audioData, sampleRate);
      markers.beats = beatData.beats;
      markers.downbeats = beatData.downbeats;
      markers.bpm = beatData.bpm;
    }

    // Extract onsets if enabled
    if (this.config.onsetDetection.enabled) {
      markers.onsets = this.extractOnsetsFallback(audioData, sampleRate);
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

    return markers;
  }

  /**
   * Extract beat positions using Essentia's BeatTrackerMultiFeature
   */
  private extractBeatsEssentia(
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
   * Fallback beat extraction using simple energy-based analysis
   */
  private extractBeatsFallback(
    audioData: Float32Array,
    sampleRate: number,
  ): {
    beats: TimelineMarker[];
    downbeats: TimelineMarker[];
    bpm: number;
  } {
    const beats: TimelineMarker[] = [];
    const windowSize = 1024;
    const hopSize = 512;
    const minBeatInterval = 60 / 180; // 180 BPM max
    const maxBeatInterval = 60 / 60;  // 60 BPM min

    // Calculate energy envelope
    const energyEnvelope: number[] = [];
    for (let i = 0; i < audioData.length - windowSize; i += hopSize) {
      let energy = 0;
      for (let j = 0; j < windowSize; j++) {
        const sample = audioData[i + j];
        energy += sample * sample;
      }
      energyEnvelope.push(Math.sqrt(energy / windowSize));
    }

    // Find energy peaks (potential beats)
    const threshold = this.calculateEnergyThreshold(energyEnvelope);
    const peaks: number[] = [];
    
    for (let i = 1; i < energyEnvelope.length - 1; i++) {
      const current = energyEnvelope[i];
      const prev = energyEnvelope[i - 1];
      const next = energyEnvelope[i + 1];
      
      if (current > prev && current > next && current > threshold) {
        const timeInSeconds = (i * hopSize) / sampleRate;
        peaks.push(timeInSeconds);
      }
    }

    // Filter peaks based on minimum beat interval
    let lastBeatTime = -1;
    for (const peakTime of peaks) {
      if (lastBeatTime === -1 || peakTime - lastBeatTime >= minBeatInterval) {
        beats.push({
          time: peakTime,
          type: "beat",
          confidence: 0.7,
          strength: 0.8,
        });
        lastBeatTime = peakTime;
      }
    }

    // Calculate BPM from beat intervals
    let bpm = 120; // Default BPM
    if (beats.length > 1) {
      const intervals = [];
      for (let i = 1; i < beats.length; i++) {
        intervals.push(beats[i].time - beats[i - 1].time);
      }
      const averageInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      bpm = Math.max(60, Math.min(180, 60 / averageInterval));
    }

    // Generate downbeats (every 4th beat in 4/4 time)
    const downbeats: TimelineMarker[] = [];
    for (let i = 0; i < beats.length; i += 4) {
      downbeats.push({
        ...beats[i],
        type: "downbeat",
      });
    }

    console.log(`Fallback beat detection found ${beats.length} beats, BPM: ${Math.round(bpm)}`);
    return { beats, downbeats, bpm };
  }

  /**
   * Calculate energy threshold for peak detection
   */
  private calculateEnergyThreshold(energyEnvelope: number[]): number {
    const sorted = [...energyEnvelope].sort((a, b) => a - b);
    const percentile90 = sorted[Math.floor(sorted.length * 0.9)];
    return percentile90 * 0.7; // 70% of 90th percentile
  }

  /**
   * Extract onset positions using Essentia.js
   */
  private extractOnsetsEssentia(
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
   * Fallback onset detection using spectral flux
   */
  private extractOnsetsFallback(
    audioData: Float32Array,
    sampleRate: number,
  ): TimelineMarker[] {
    const onsets: TimelineMarker[] = [];
    const windowSize = 1024;
    const hopSize = 512;
    const threshold = this.config.onsetDetection.threshold || 0.3;

    // Calculate spectral flux (simplified)
    const spectralFlux: number[] = [];
    let prevSpectralEnergy = 0;

    for (let i = 0; i < audioData.length - windowSize; i += hopSize) {
      // Calculate current window's spectral energy
      let currentSpectralEnergy = 0;
      for (let j = 0; j < windowSize; j++) {
        const sample = audioData[i + j];
        currentSpectralEnergy += sample * sample;
      }
      currentSpectralEnergy = Math.sqrt(currentSpectralEnergy / windowSize);

      // Calculate flux as positive increase in energy
      const flux = Math.max(0, currentSpectralEnergy - prevSpectralEnergy);
      spectralFlux.push(flux);
      prevSpectralEnergy = currentSpectralEnergy;
    }

    // Find onset peaks in spectral flux
    const fluxThreshold = this.calculateSpectralFluxThreshold(spectralFlux);
    
    for (let i = 1; i < spectralFlux.length - 1; i++) {
      const current = spectralFlux[i];
      const prev = spectralFlux[i - 1];
      const next = spectralFlux[i + 1];
      
      if (current > prev && current > next && current > fluxThreshold) {
        const timeInSeconds = (i * hopSize) / sampleRate;
        onsets.push({
          time: timeInSeconds,
          type: "onset",
          confidence: Math.min(1.0, current / fluxThreshold),
          strength: current / fluxThreshold,
        });
      }
    }

    console.log(`Fallback onset detection found ${onsets.length} onsets`);
    return onsets;
  }

  /**
   * Calculate spectral flux threshold for onset detection
   */
  private calculateSpectralFluxThreshold(spectralFlux: number[]): number {
    const sorted = [...spectralFlux].sort((a, b) => a - b);
    const percentile80 = sorted[Math.floor(sorted.length * 0.8)];
    return percentile80 * 0.6; // 60% of 80th percentile
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