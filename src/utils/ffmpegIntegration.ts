/**
 * FFmpeg Integration Utilities for ContentAugmentation
 *
 * This module provides advanced video processing capabilities
 * using FFmpeg through Remotion's video processing features.
 */

import type { Annotation } from "../Augmented/ContentAugmentation";

/**
 * Video processing options for FFmpeg integration
 */
export interface VideoProcessingOptions {
  // Video filters
  brightness?: number; // -1 to 1
  contrast?: number; // 0 to 2
  saturation?: number; // 0 to 2
  hue?: number; // -180 to 180 degrees

  // Video effects
  blur?: number; // 0 to 20
  sharpen?: boolean;
  denoise?: boolean;
  stabilize?: boolean;

  // Color correction
  gamma?: number; // 0.1 to 3.0
  exposure?: number; // -3 to 3
  highlights?: number; // -100 to 100
  shadows?: number; // -100 to 100

  // Advanced filters
  chromaKey?: {
    color: string;
    threshold: number; // 0 to 1
  };
  overlay?: {
    image: string;
    position: { x: number; y: number };
    opacity: number; // 0 to 1
  };

  // Audio processing
  audioFilters?: {
    normalize?: boolean;
    noiseReduction?: boolean;
    volume?: number; // 0 to 2
  };
}

/**
 * Enhanced annotation with video processing
 */
export interface ProcessedAnnotation extends Annotation {
  videoFilters?: VideoProcessingOptions;
  region?: {
    x: number; // percentage
    y: number; // percentage
    width: number; // percentage
    height: number; // percentage
  };
}

/**
 * Generate CSS filter string from video processing options
 */
export function generateCSSFilters(options: VideoProcessingOptions): string {
  const filters: string[] = [];

  if (options.brightness !== undefined) {
    filters.push(`brightness(${1 + options.brightness})`);
  }

  if (options.contrast !== undefined) {
    filters.push(`contrast(${options.contrast})`);
  }

  if (options.saturation !== undefined) {
    filters.push(`saturate(${options.saturation})`);
  }

  if (options.hue !== undefined) {
    filters.push(`hue-rotate(${options.hue}deg)`);
  }

  if (options.blur !== undefined && options.blur > 0) {
    filters.push(`blur(${options.blur}px)`);
  }

  return filters.join(" ");
}

/**
 * Apply video processing to a video element
 */
export function applyVideoProcessing(
  element: HTMLVideoElement | null,
  options: VideoProcessingOptions,
): void {
  if (!element) return;

  const filterString = generateCSSFilters(options);
  if (filterString) {
    element.style.filter = filterString;
  }

  // Apply audio processing if available
  if (options.audioFilters?.volume !== undefined) {
    element.volume = Math.max(0, Math.min(1, options.audioFilters.volume));
  }
}

/**
 * FFmpeg-style video transition effects
 */
export interface TransitionEffect {
  type: "fade" | "slide" | "dissolve" | "wipe" | "pixelate";
  duration: number; // in frames
  direction?: "left" | "right" | "up" | "down";
  easing?: "linear" | "ease-in" | "ease-out" | "ease-in-out";
}

/**
 * Generate transition CSS based on frame and effect
 */
export function generateTransitionCSS(
  frame: number,
  startFrame: number,
  effect: TransitionEffect,
): React.CSSProperties {
  const progress = Math.max(
    0,
    Math.min(1, (frame - startFrame) / effect.duration),
  );

  switch (effect.type) {
    case "fade":
      return { opacity: progress };

    case "slide":
      const slideDistance = 100 * (1 - progress);
      const transforms = {
        left: `translateX(-${slideDistance}%)`,
        right: `translateX(${slideDistance}%)`,
        up: `translateY(-${slideDistance}%)`,
        down: `translateY(${slideDistance}%)`,
      };
      return {
        transform: transforms[effect.direction || "left"],
        transition: effect.easing
          ? `transform 0.1s ${effect.easing}`
          : undefined,
      };

    case "dissolve":
      return {
        opacity: progress,
        filter: `blur(${(1 - progress) * 5}px)`,
      };

    case "wipe":
      return {
        clipPath: `inset(0 ${(1 - progress) * 100}% 0 0)`,
      };

    case "pixelate":
      return {
        filter: `blur(${(1 - progress) * 10}px) contrast(${
          1 + (1 - progress)
        })`,
      };

    default:
      return { opacity: progress };
  }
}

/**
 * Advanced color grading presets inspired by popular looks
 */
export const colorGradingPresets = {
  cinematic: {
    brightness: -0.1,
    contrast: 1.2,
    saturation: 0.9,
    gamma: 0.9,
    highlights: -20,
    shadows: 10,
  },
  vibrant: {
    brightness: 0.1,
    contrast: 1.3,
    saturation: 1.4,
    gamma: 1.1,
  },
  vintage: {
    brightness: -0.05,
    contrast: 0.9,
    saturation: 0.7,
    hue: 15,
    gamma: 1.2,
  },
  cool: {
    brightness: 0.05,
    contrast: 1.1,
    saturation: 1.1,
    hue: -10,
  },
  warm: {
    brightness: 0.1,
    contrast: 1.15,
    saturation: 1.2,
    hue: 10,
  },
  dramatic: {
    brightness: -0.2,
    contrast: 1.5,
    saturation: 0.8,
    gamma: 0.8,
    highlights: -40,
    shadows: 30,
  },
} as const;

export type ColorGradingPreset = keyof typeof colorGradingPresets;

/**
 * Apply color grading preset to video processing options
 */
export function applyColorGrading(
  preset: ColorGradingPreset,
): VideoProcessingOptions {
  return colorGradingPresets[preset];
}

/**
 * Advanced annotation with FFmpeg-style effects
 */
export interface FFmpegAnnotation extends ProcessedAnnotation {
  transition?: TransitionEffect;
  colorGrading?: ColorGradingPreset;
  mask?: {
    type: "circle" | "rectangle" | "custom";
    feather: number; // blur amount for soft edges
    invert?: boolean;
  };
}

/**
 * Generate complex video filter chain for annotations
 */
export function generateVideoFilterChain(
  annotations: FFmpegAnnotation[],
  currentFrame: number,
): VideoProcessingOptions {
  const activeAnnotations = annotations.filter(
    (ann) => currentFrame >= ann.startFrame && currentFrame <= ann.endFrame,
  );

  // Combine all active video filters
  const combinedOptions: VideoProcessingOptions = {};

  for (const annotation of activeAnnotations) {
    if (annotation.colorGrading) {
      const grading = applyColorGrading(annotation.colorGrading);
      Object.assign(combinedOptions, grading);
    }

    if (annotation.videoFilters) {
      // Merge filters (later annotations override earlier ones)
      Object.assign(combinedOptions, annotation.videoFilters);
    }
  }

  return combinedOptions;
}

/**
 * Batch processing utilities for multiple videos
 */
export interface BatchProcessingJob {
  id: string;
  sourceVideo: string;
  outputPath: string;
  annotations: FFmpegAnnotation[];
  processingOptions: VideoProcessingOptions;
  priority: "low" | "medium" | "high";
}

/**
 * Queue system for batch video processing
 */
export class VideoProcessingQueue {
  private jobs: BatchProcessingJob[] = [];
  private processing = false;

  addJob(job: BatchProcessingJob): void {
    this.jobs.push(job);
    this.jobs.sort(
      (a, b) =>
        this.getPriorityValue(b.priority) - this.getPriorityValue(a.priority),
    );
  }

  private getPriorityValue(priority: "low" | "medium" | "high"): number {
    return { low: 1, medium: 2, high: 3 }[priority];
  }

  async processNext(): Promise<BatchProcessingJob | null> {
    if (this.processing || this.jobs.length === 0) return null;

    this.processing = true;
    const job = this.jobs.shift()!;

    try {
      // In a real implementation, this would trigger actual FFmpeg processing
      // For now, we simulate processing
      await new Promise((resolve) => setTimeout(resolve, 100));
      console.log(
        `Processed job ${job.id}: ${job.sourceVideo} -> ${job.outputPath}`,
      );

      return job;
    } finally {
      this.processing = false;
    }
  }

  getQueueStatus(): { pending: number; processing: boolean } {
    return {
      pending: this.jobs.length,
      processing: this.processing,
    };
  }
}

/**
 * Export utility functions for easy import
 */
export const ffmpegUtils = {
  generateCSSFilters,
  applyVideoProcessing,
  generateTransitionCSS,
  applyColorGrading,
  generateVideoFilterChain,
  colorGradingPresets,
  VideoProcessingQueue,
};

export default ffmpegUtils;