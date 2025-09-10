import React from "react";
import { Composition } from "remotion";
import { ContentAugmentation } from "./ContentAugmentation";
import { ContentAugmentationAdvanced } from "./ContentAugmentationAdvanced";
import { ContentAugmentationInteractive } from "./ContentAugmentationInteractive";
import type { Annotation } from "./ContentAugmentation";
import type { FFmpegAnnotation } from "../utils/ffmpegIntegration";

/**
 * Example annotations showcasing all overlay types and features
 */
export const exampleAnnotations: Annotation[] = [
  // Callout - Information bubble
  {
    id: "intro-callout",
    type: "callout",
    text: "Welcome to Content Augmentation Demo",
    startFrame: 30,
    endFrame: 120,
    position: { x: 50, y: 20 },
    color: "#2196f3",
    size: "large",
  },

  // Highlight - Circle attention grabber
  {
    id: "feature-highlight",
    type: "highlight",
    text: "Focus on this area",
    startFrame: 150,
    endFrame: 240,
    position: { x: 70, y: 60 },
    color: "#ff9800",
    size: "medium",
  },

  // Arrow - Directional pointer
  {
    id: "arrow-pointer",
    type: "arrow",
    text: "Click here",
    startFrame: 270,
    endFrame: 360,
    position: { x: 30, y: 40 },
    target: { x: 60, y: 70 },
    color: "#ff5722",
    size: "medium",
  },

  // Info chip
  {
    id: "info-chip",
    type: "info",
    text: "Pro tip: Use keyboard shortcuts",
    startFrame: 390,
    endFrame: 480,
    position: { x: 80, y: 85 },
    size: "small",
  },

  // Warning chip
  {
    id: "warning-chip",
    type: "warning",
    text: "Caution: Save your work",
    startFrame: 510,
    endFrame: 600,
    position: { x: 20, y: 85 },
    size: "medium",
  },

  // Success chip
  {
    id: "success-chip",
    type: "success",
    text: "Task completed successfully!",
    startFrame: 630,
    endFrame: 720,
    position: { x: 50, y: 50 },
    size: "large",
  },

  // Multiple overlapping annotations
  {
    id: "multi-1",
    type: "callout",
    text: "Multiple annotations can overlap",
    startFrame: 750,
    endFrame: 840,
    position: { x: 30, y: 30 },
    color: "#9c27b0",
    size: "medium",
  },
  {
    id: "multi-2",
    type: "highlight",
    text: "Layered effects",
    startFrame: 780,
    endFrame: 870,
    position: { x: 70, y: 70 },
    color: "#00bcd4",
    size: "large",
  },
];

/**
 * Advanced annotations with FFmpeg effects
 */
export const advancedAnnotations: FFmpegAnnotation[] = [
  // Annotation with fade transition
  {
    id: "fade-anno",
    type: "callout",
    text: "Smooth fade transition",
    startFrame: 30,
    endFrame: 150,
    position: { x: 50, y: 30 },
    transition: {
      type: "fade",
      duration: 30,
      easing: "ease-in-out",
    },
    colorGrading: "cinematic",
  },

  // Annotation with slide effect
  {
    id: "slide-anno",
    type: "info",
    text: "Sliding in from left",
    startFrame: 180,
    endFrame: 300,
    position: { x: 75, y: 50 },
    transition: {
      type: "slide",
      duration: 20,
      direction: "left",
      easing: "ease-out",
    },
    colorGrading: "vibrant",
  },

  // Annotation with dissolve effect
  {
    id: "dissolve-anno",
    type: "success",
    text: "Dissolve effect with blur",
    startFrame: 330,
    endFrame: 450,
    position: { x: 25, y: 70 },
    transition: {
      type: "dissolve",
      duration: 25,
    },
    videoFilters: {
      brightness: 0.1,
      contrast: 1.2,
      saturation: 1.3,
    },
  },

  // Annotation with wipe transition
  {
    id: "wipe-anno",
    type: "warning",
    text: "Wipe transition effect",
    startFrame: 480,
    endFrame: 600,
    position: { x: 60, y: 40 },
    transition: {
      type: "wipe",
      duration: 15,
    },
    colorGrading: "warm",
  },

  // Annotation with pixelate effect
  {
    id: "pixelate-anno",
    type: "highlight",
    text: "Pixelated entrance",
    startFrame: 630,
    endFrame: 750,
    position: { x: 50, y: 60 },
    target: { x: 80, y: 80 },
    transition: {
      type: "pixelate",
      duration: 20,
    },
    colorGrading: "dramatic",
    mask: {
      type: "circle",
      feather: 10,
    },
  },
];

/**
 * Demo composition showcasing all augmentation features
 */
export const ContentAugmentationDemo: React.FC = () => {
  return (
    <>
      {/* Basic ContentAugmentation */}
      <Composition
        id="ContentAugmentation-Basic"
        component={() => (
          <ContentAugmentation
            sourceVideo="/assets/manim/TestAnimation.mp4"
            annotations={exampleAnnotations}
            showTimeline={true}
            enableZoomEffects={true}
          />
        )}
        durationInFrames={900}
        fps={30}
        width={1920}
        height={1080}
      />

      {/* Advanced ContentAugmentation with FFmpeg effects */}
      <Composition
        id="ContentAugmentation-Advanced"
        component={() => (
          <ContentAugmentationAdvanced
            sourceVideo="/assets/manim/TestAnimation.mp4"
            annotations={advancedAnnotations}
            showTimeline={true}
            enableZoomEffects={true}
            globalVideoFilters={{
              brightness: -0.05,
              contrast: 1.1,
              saturation: 1.05,
              gamma: 0.95,
            }}
            transitionEffect={{
              type: "fade",
              duration: 30,
              easing: "ease-in-out",
            }}
            enableRealTimeProcessing={true}
          />
        )}
        durationInFrames={900}
        fps={30}
        width={1920}
        height={1080}
      />

      {/* Interactive ContentAugmentation */}
      <Composition
        id="ContentAugmentation-Interactive"
        component={() => (
          <ContentAugmentationInteractive
            sourceVideo="/assets/manim/TestAnimation.mp4"
            annotations={exampleAnnotations}
            showTimeline={true}
            enableZoomEffects={true}
            timelineHeight={100}
            showAnnotationLabels={true}
            showFrameNumbers={true}
            enableInteractiveTimeline={true}
            showAnnotationPreview={true}
          />
        )}
        durationInFrames={900}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};

/**
 * Usage Guide for ContentAugmentation
 *
 * 1. BASIC USAGE:
 * ```tsx
 * <ContentAugmentation
 *   sourceVideo="your-video.mp4"
 *   annotations={[
 *     {
 *       id: "1",
 *       type: "callout",
 *       text: "Important point",
 *       startFrame: 30,
 *       endFrame: 90,
 *       position: { x: 50, y: 50 }
 *     }
 *   ]}
 * />
 * ```
 *
 * 2. OVERLAY TYPES:
 * - callout: Speech bubble with pointer
 * - highlight: Circular attention grabber
 * - arrow: Directional pointer with optional text
 * - info: Blue information chip
 * - warning: Orange warning chip
 * - success: Green success chip
 *
 * 3. ADVANCED FEATURES:
 * - Zoom effects on highlights
 * - Timeline visualization
 * - Color grading presets
 * - Transition effects (fade, slide, dissolve, wipe, pixelate)
 * - Video filters (brightness, contrast, saturation, blur)
 * - Interactive timeline with hover previews
 *
 * 4. FFMPEG INTEGRATION:
 * The advanced version supports FFmpeg-style processing:
 * - Real-time video filters
 * - Color grading presets (cinematic, vibrant, vintage, cool, warm, dramatic)
 * - Batch processing queue for multiple videos
 * - Mask effects for annotations
 *
 * 5. BEST PRACTICES:
 * - Keep annotation text concise
 * - Use appropriate overlay types for context
 * - Don't overlap too many annotations
 * - Test zoom effects with your video content
 * - Use color grading sparingly
 * - Consider mobile viewing when positioning
 *
 * 6. PERFORMANCE TIPS:
 * - Limit concurrent annotations to 3-4
 * - Use smaller annotation sizes for better performance
 * - Disable real-time processing for complex scenes
 * - Pre-render videos with heavy effects
 */

export default ContentAugmentationDemo;
