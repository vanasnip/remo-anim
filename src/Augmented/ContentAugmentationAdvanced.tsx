/**
 * Advanced ContentAugmentation with FFmpeg Integration
 *
 * This enhanced version includes advanced video processing capabilities
 * using FFmpeg-style filters and effects.
 */

import React, { useRef, useEffect } from "react";
import {
  AbsoluteFill,
  Video,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { Box, Typography, Chip } from "@mui/material";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { staticFile } from "remotion";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import InfoIcon from "@mui/icons-material/Info";
import WarningIcon from "@mui/icons-material/Warning";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import {
  type FFmpegAnnotation,
  type VideoProcessingOptions,
  type TransitionEffect,
  generateCSSFilters,
  generateTransitionCSS,
  generateVideoFilterChain,
  applyVideoProcessing,
} from "../../utils/ffmpegIntegration";

const theme = createTheme({
  palette: {
    primary: { main: "#2196f3" },
    secondary: { main: "#ff9800" },
    success: { main: "#4caf50" },
    warning: { main: "#ff5722" },
  },
});

export interface AdvancedContentAugmentationProps {
  sourceVideo: string;
  annotations: FFmpegAnnotation[];
  showTimeline?: boolean;
  enableZoomEffects?: boolean;
  globalVideoFilters?: VideoProcessingOptions;
  transitionEffect?: TransitionEffect;
  enableRealTimeProcessing?: boolean;
}

export const ContentAugmentationAdvanced: React.FC<
  AdvancedContentAugmentationProps
> = ({
  sourceVideo,
  annotations = [],
  showTimeline = true,
  enableZoomEffects = true,
  globalVideoFilters,
  transitionEffect,
  enableRealTimeProcessing = true,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const videoRef = useRef<HTMLVideoElement>(null);

  // Filter active annotations for current frame
  const activeAnnotations = annotations.filter(
    (ann) => frame >= ann.startFrame && frame <= ann.endFrame,
  );

  // Generate combined video filters
  const activeVideoFilters = generateVideoFilterChain(annotations, frame);
  const combinedFilters = { ...globalVideoFilters, ...activeVideoFilters };

  // Apply real-time video processing
  useEffect(() => {
    if (enableRealTimeProcessing && videoRef.current) {
      applyVideoProcessing(videoRef.current, combinedFilters);
    }
  }, [combinedFilters, enableRealTimeProcessing]);

  const renderAdvancedAnnotation = (annotation: FFmpegAnnotation) => {
    const annFrame = frame - annotation.startFrame;
    const annDuration = annotation.endFrame - annotation.startFrame;

    // Enhanced entrance animation with transition effects
    let enterAnimation = spring({
      frame: annFrame,
      fps,
      config: { damping: 12 },
    });

    // Apply custom transition if specified
    let transitionStyle: React.CSSProperties = {};
    if (annotation.transition) {
      transitionStyle = generateTransitionCSS(
        frame,
        annotation.startFrame,
        annotation.transition,
      );
      enterAnimation = 1; // Override spring when using custom transition
    }

    // Exit animation
    const exitOpacity = interpolate(
      annFrame,
      [annDuration - 10, annDuration],
      [1, 0],
      { extrapolateLeft: "clamp" },
    );

    const opacity = Math.min(enterAnimation, exitOpacity);

    // Enhanced pulsing effect with more control
    const pulseIntensity = annotation.type === "warning" ? 1.2 : 1.1;
    const pulse = interpolate(
      annFrame % 30,
      [0, 15, 30],
      [1, pulseIntensity, 1],
      {
        extrapolateRight: "clamp",
      },
    );

    const sizeMultiplier = {
      small: 0.8,
      medium: 1,
      large: 1.2,
    }[annotation.size || "medium"];

    // Generate CSS filters for the annotation if specified
    const annotationFilters = annotation.videoFilters
      ? generateCSSFilters(annotation.videoFilters)
      : "";

    // Apply mask if specified
    let maskStyle: React.CSSProperties = {};
    if (annotation.mask) {
      switch (annotation.mask.type) {
        case "circle":
          maskStyle.clipPath = `circle(50% at 50% 50%)`;
          break;
        case "rectangle":
          maskStyle.clipPath = `inset(10% 10% 10% 10%)`;
          break;
      }
      if (annotation.mask.feather > 0) {
        maskStyle.filter = `blur(${annotation.mask.feather}px)`;
      }
    }

    // Regional video processing
    let regionStyle: React.CSSProperties = {};
    if (annotation.region) {
      regionStyle = {
        position: "absolute",
        left: `${annotation.region.x}%`,
        top: `${annotation.region.y}%`,
        width: `${annotation.region.width}%`,
        height: `${annotation.region.height}%`,
        overflow: "hidden",
      };
    }

    const baseStyle: React.CSSProperties = {
      position: "absolute",
      left: `${annotation.position.x}%`,
      top: `${annotation.position.y}%`,
      transform: `translate(-50%, -50%) scale(${enterAnimation * pulse})`,
      opacity,
      zIndex: 100,
      filter: annotationFilters,
      ...transitionStyle,
      ...maskStyle,
      ...regionStyle,
    };

    switch (annotation.type) {
      case "callout":
        return (
          <Box key={annotation.id} sx={baseStyle}>
            <Box
              sx={{
                backgroundColor: annotation.color || "rgba(33, 150, 243, 0.95)",
                color: "white",
                p: 2 * sizeMultiplier,
                borderRadius: 2,
                boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
                maxWidth: 300 * sizeMultiplier,
                backdropFilter: "blur(10px)",
                // Enhanced styling with more depth
                background: annotation.color
                  ? `linear-gradient(135deg, ${annotation.color}, ${annotation.color}dd)`
                  : "linear-gradient(135deg, rgba(33, 150, 243, 0.95), rgba(33, 150, 243, 0.8))",
              }}
            >
              <Typography
                variant="body1"
                sx={{
                  fontSize: `${1 * sizeMultiplier}rem`,
                  textShadow: "0 1px 2px rgba(0,0,0,0.3)",
                }}
              >
                {annotation.text}
              </Typography>
            </Box>
            {/* Enhanced pointer with glow effect */}
            <Box
              sx={{
                position: "absolute",
                bottom: -10,
                left: "50%",
                transform: "translateX(-50%)",
                width: 0,
                height: 0,
                borderLeft: "10px solid transparent",
                borderRight: "10px solid transparent",
                borderTop: `10px solid ${
                  annotation.color || "rgba(33, 150, 243, 0.95)"
                }`,
                filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
              }}
            />
          </Box>
        );

      case "highlight":
        return (
          <Box key={annotation.id} sx={baseStyle}>
            <Box
              sx={{
                width: 150 * sizeMultiplier,
                height: 150 * sizeMultiplier,
                border: `4px solid ${annotation.color || "#ff9800"}`,
                borderRadius: "50%",
                // Enhanced animation with more sophisticated effects
                "@keyframes advancedPulse": {
                  "0%": {
                    transform: "scale(1)",
                    opacity: 1,
                    boxShadow: `0 0 0 0 ${annotation.color || "#ff9800"}66`,
                  },
                  "50%": {
                    transform: "scale(1.1)",
                    opacity: 0.8,
                    boxShadow: `0 0 0 10px ${annotation.color || "#ff9800"}33`,
                  },
                  "100%": {
                    transform: "scale(1)",
                    opacity: 1,
                    boxShadow: `0 0 0 0 ${annotation.color || "#ff9800"}00`,
                  },
                },
                animation: "advancedPulse 2s infinite",
              }}
            />
          </Box>
        );

      case "arrow":
        if (!annotation.target) return null;
        const angle = Math.atan2(
          annotation.target.y - annotation.position.y,
          annotation.target.x - annotation.position.x,
        );
        const distance = Math.sqrt(
          Math.pow(annotation.target.x - annotation.position.x, 2) +
            Math.pow(annotation.target.y - annotation.position.y, 2),
        );

        return (
          <Box key={annotation.id} sx={baseStyle}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                transformOrigin: "left center",
              }}
            >
              <Box
                sx={{
                  width: `${distance}px`,
                  height: 4, // Slightly thicker
                  background: `linear-gradient(90deg, ${
                    annotation.color || "#ff5722"
                  }, ${annotation.color || "#ff5722"}aa)`,
                  transform: `scaleX(${enterAnimation})`,
                  transformOrigin: "left center",
                  boxShadow: `0 0 8px ${annotation.color || "#ff5722"}66`,
                }}
              />
              <ArrowForwardIcon
                sx={{
                  color: annotation.color || "#ff5722",
                  fontSize: 30 * sizeMultiplier,
                  marginLeft: -1,
                  transform: `scale(${enterAnimation})`,
                  filter: `drop-shadow(0 2px 4px ${
                    annotation.color || "#ff5722"
                  }66)`,
                }}
              />
            </Box>
            {annotation.text && (
              <Typography
                sx={{
                  position: "absolute",
                  top: -35,
                  left: distance / 2,
                  transform: `rotate(${-angle}rad) translateX(-50%)`,
                  backgroundColor: "rgba(0,0,0,0.9)",
                  color: "white",
                  px: 2,
                  py: 1,
                  borderRadius: 2,
                  fontSize: `${0.9 * sizeMultiplier}rem`,
                  whiteSpace: "nowrap",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                  backdropFilter: "blur(8px)",
                }}
              >
                {annotation.text}
              </Typography>
            )}
          </Box>
        );

      case "info":
      case "warning":
      case "success":
        const icons = {
          info: InfoIcon,
          warning: WarningIcon,
          success: CheckCircleIcon,
        };
        const colors = {
          info: "#2196f3",
          warning: "#ff9800",
          success: "#4caf50",
        };
        const Icon = icons[annotation.type];
        const color = annotation.color || colors[annotation.type];

        return (
          <Box key={annotation.id} sx={baseStyle}>
            <Chip
              icon={<Icon />}
              label={annotation.text}
              sx={{
                background: `linear-gradient(135deg, ${color}, ${color}dd)`,
                color: "white",
                fontSize: `${1 * sizeMultiplier}rem`,
                py: 2 * sizeMultiplier,
                px: 1.5 * sizeMultiplier,
                boxShadow: `0 6px 20px ${color}44`,
                "& .MuiChip-icon": {
                  color: "white",
                  filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))",
                },
                "& .MuiChip-label": {
                  textShadow: "0 1px 2px rgba(0,0,0,0.3)",
                },
              }}
            />
          </Box>
        );

      default:
        return null;
    }
  };

  // Enhanced zoom effect with smoother transitions
  const zoomAnnotation = enableZoomEffects
    ? activeAnnotations.find((ann) => ann.type === "highlight")
    : null;

  const zoomScale = zoomAnnotation
    ? interpolate(
        frame - zoomAnnotation.startFrame,
        [
          0,
          20, // Slower zoom in
          zoomAnnotation.endFrame - zoomAnnotation.startFrame - 20,
          zoomAnnotation.endFrame - zoomAnnotation.startFrame,
        ],
        [1, 1.3, 1.3, 1], // More dramatic zoom
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
      )
    : 1;

  const zoomX = zoomAnnotation ? zoomAnnotation.position.x : 50;
  const zoomY = zoomAnnotation ? zoomAnnotation.position.y : 50;

  // Generate video container filters
  const containerFilters = generateCSSFilters(combinedFilters);

  return (
    <ThemeProvider theme={theme}>
      <AbsoluteFill style={{ backgroundColor: "#000" }}>
        {/* Enhanced Base Video with Processing */}
        <Box
          sx={{
            position: "absolute",
            width: "100%",
            height: "100%",
            transform: `scale(${zoomScale})`,
            transformOrigin: `${zoomX}% ${zoomY}%`,
            transition: "transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
            filter: containerFilters,
          }}
        >
          <Video
            ref={videoRef}
            src={staticFile(sourceVideo)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
            onError={(e) => {
              console.warn("Source video could not be loaded:", e);
            }}
          />
        </Box>

        {/* Annotations Layer */}
        <AbsoluteFill>
          {activeAnnotations.map((annotation) =>
            renderAdvancedAnnotation(annotation),
          )}
        </AbsoluteFill>

        {/* Enhanced Timeline */}
        {showTimeline && (
          <Box
            sx={{
              position: "absolute",
              bottom: 20,
              left: 20,
              right: 20,
              height: 50, // Slightly taller
              backgroundColor: "rgba(0,0,0,0.8)",
              borderRadius: 3,
              p: 1.5,
              display: "flex",
              alignItems: "center",
              gap: 2,
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <Box
              sx={{
                flex: 1,
                height: 6, // Thicker timeline
                backgroundColor: "rgba(255,255,255,0.2)",
                borderRadius: 3,
                overflow: "hidden",
                position: "relative",
              }}
            >
              {/* Enhanced Progress */}
              <Box
                sx={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  height: "100%",
                  width: `${(frame / durationInFrames) * 100}%`,
                  background: "linear-gradient(90deg, #2196f3, #21cbf3)",
                  boxShadow: "0 0 10px #2196f366",
                }}
              />
              {/* Enhanced annotation markers */}
              {annotations.map((ann) => (
                <Box
                  key={ann.id}
                  sx={{
                    position: "absolute",
                    left: `${(ann.startFrame / durationInFrames) * 100}%`,
                    width: `${
                      ((ann.endFrame - ann.startFrame) / durationInFrames) * 100
                    }%`,
                    height: "100%",
                    backgroundColor:
                      ann.type === "warning"
                        ? "#ff9800"
                        : ann.type === "success"
                          ? "#4caf50"
                          : ann.type === "highlight"
                            ? "#e91e63"
                            : "#fff",
                    opacity: 0.6,
                    borderRadius: 3,
                    boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
                  }}
                />
              ))}
            </Box>
            <Typography
              variant="caption"
              sx={{
                color: "white",
                fontFamily: "monospace",
                minWidth: 70,
                fontSize: "0.9rem",
                fontWeight: 500,
              }}
            >
              {Math.floor(frame / fps)}s / {Math.floor(durationInFrames / fps)}s
            </Typography>
          </Box>
        )}

        {/* Processing Status Indicator */}
        {enableRealTimeProcessing &&
          Object.keys(combinedFilters).length > 0 && (
            <Box
              sx={{
                position: "absolute",
                top: 20,
                right: 20,
                backgroundColor: "rgba(76, 175, 80, 0.9)",
                color: "white",
                px: 2,
                py: 1,
                borderRadius: 2,
                fontSize: "0.8rem",
                backdropFilter: "blur(10px)",
                border: "1px solid rgba(255,255,255,0.2)",
              }}
            >
              Real-time Processing Active
            </Box>
          )}
      </AbsoluteFill>
    </ThemeProvider>
  );
};
