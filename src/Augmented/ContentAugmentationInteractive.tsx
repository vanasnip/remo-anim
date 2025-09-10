/**
 * Interactive ContentAugmentation with Enhanced Timeline
 *
 * This version includes an enhanced timeline with interactive features
 * and better visualization capabilities.
 */

import React, { useState } from "react";
import {
  AbsoluteFill,
  Video,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { Box, Typography, Chip, Fade } from "@mui/material";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { staticFile } from "remotion";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import InfoIcon from "@mui/icons-material/Info";
import WarningIcon from "@mui/icons-material/Warning";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import EnhancedTimeline from "../components/EnhancedTimeline";
import type { Annotation } from "./ContentAugmentation";

const theme = createTheme({
  palette: {
    primary: { main: "#2196f3" },
    secondary: { main: "#ff9800" },
    success: { main: "#4caf50" },
    warning: { main: "#ff5722" },
  },
});

export interface InteractiveContentAugmentationProps {
  sourceVideo: string;
  annotations: Annotation[];
  showTimeline?: boolean;
  enableZoomEffects?: boolean;
  timelineHeight?: number;
  showAnnotationLabels?: boolean;
  showFrameNumbers?: boolean;
  enableInteractiveTimeline?: boolean;
  showAnnotationPreview?: boolean;
}

export const ContentAugmentationInteractive: React.FC<
  InteractiveContentAugmentationProps
> = ({
  sourceVideo,
  annotations = [],
  showTimeline = true,
  enableZoomEffects = true,
  timelineHeight = 80,
  showAnnotationLabels = true,
  showFrameNumbers = false,
  enableInteractiveTimeline = true,
  showAnnotationPreview = true,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const [hoveredAnnotation, setHoveredAnnotation] = useState<Annotation | null>(
    null,
  );
  const [previewAnnotation, setPreviewAnnotation] = useState<Annotation | null>(
    null,
  );

  // Filter active annotations for current frame
  const activeAnnotations = annotations.filter(
    (ann) => frame >= ann.startFrame && frame <= ann.endFrame,
  );

  // Handle timeline annotation hover
  const handleAnnotationHover = (annotation: Annotation | null) => {
    setHoveredAnnotation(annotation);
    if (showAnnotationPreview) {
      setPreviewAnnotation(annotation);
    }
  };

  // Enhanced rendering with animation improvements
  const renderAnnotation = (annotation: Annotation, isPreview = false) => {
    const annFrame = isPreview ? 15 : frame - annotation.startFrame; // Use mid-animation frame for preview
    const annDuration = annotation.endFrame - annotation.startFrame;

    // Enhanced entrance animation
    const enterScale = isPreview
      ? 0.8
      : spring({
          frame: annFrame,
          fps,
          config: { damping: 12, stiffness: 150 },
        });

    // Exit animation
    const exitOpacity = isPreview
      ? 0.7
      : interpolate(annFrame, [annDuration - 15, annDuration], [1, 0], {
          extrapolateLeft: "clamp",
        });

    const opacity = isPreview ? 0.6 : Math.min(enterScale, exitOpacity);

    // Enhanced pulsing effect
    const pulseIntensity =
      annotation.type === "warning"
        ? 1.15
        : annotation.type === "success"
          ? 1.1
          : 1.05;
    const pulse = isPreview
      ? 1
      : interpolate(annFrame % 40, [0, 20, 40], [1, pulseIntensity, 1], {
          extrapolateRight: "clamp",
        });

    const sizeMultiplier = {
      small: 0.8,
      medium: 1,
      large: 1.2,
    }[annotation.size || "medium"];

    const finalSizeMultiplier = isPreview
      ? sizeMultiplier * 0.7
      : sizeMultiplier;

    switch (annotation.type) {
      case "callout":
        return (
          <Box
            sx={{
              position: "absolute",
              left: `${annotation.position.x}%`,
              top: `${annotation.position.y}%`,
              transform: `translate(-50%, -50%) scale(${enterScale * pulse})`,
              opacity,
              zIndex: isPreview ? 150 : 100,
            }}
          >
            <Box
              sx={{
                backgroundColor: annotation.color || "rgba(33, 150, 243, 0.95)",
                color: "white",
                p: 2 * finalSizeMultiplier,
                borderRadius: 2,
                boxShadow: isPreview
                  ? "0 4px 16px rgba(0,0,0,0.4)"
                  : "0 8px 32px rgba(0,0,0,0.3)",
                maxWidth: 300 * finalSizeMultiplier,
                backdropFilter: "blur(10px)",
                background: annotation.color
                  ? `linear-gradient(135deg, ${annotation.color}, ${annotation.color}dd)`
                  : "linear-gradient(135deg, rgba(33, 150, 243, 0.95), rgba(33, 150, 243, 0.8))",
                border: isPreview ? "1px solid rgba(255,255,255,0.3)" : "none",
              }}
            >
              <Typography
                variant="body1"
                sx={{
                  fontSize: `${1 * finalSizeMultiplier}rem`,
                  textShadow: "0 1px 2px rgba(0,0,0,0.3)",
                }}
              >
                {annotation.text}
              </Typography>
            </Box>
            <Box
              sx={{
                position: "absolute",
                bottom: -8,
                left: "50%",
                transform: "translateX(-50%)",
                width: 0,
                height: 0,
                borderLeft: "8px solid transparent",
                borderRight: "8px solid transparent",
                borderTop: `8px solid ${
                  annotation.color || "rgba(33, 150, 243, 0.95)"
                }`,
                filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))",
              }}
            />
          </Box>
        );

      case "highlight":
        return (
          <Box
            sx={{
              position: "absolute",
              left: `${annotation.position.x}%`,
              top: `${annotation.position.y}%`,
              transform: `translate(-50%, -50%) scale(${enterScale})`,
              opacity,
              zIndex: isPreview ? 140 : 90,
            }}
          >
            <Box
              sx={{
                width: 150 * finalSizeMultiplier,
                height: 150 * finalSizeMultiplier,
                border: `4px solid ${annotation.color || "#ff9800"}`,
                borderRadius: "50%",
                "@keyframes enhancedPulse": {
                  "0%": {
                    transform: "scale(1)",
                    opacity: 1,
                    boxShadow: `0 0 0 0 ${annotation.color || "#ff9800"}66`,
                  },
                  "50%": {
                    transform: "scale(1.1)",
                    opacity: 0.8,
                    boxShadow: `0 0 0 15px ${annotation.color || "#ff9800"}22`,
                  },
                  "100%": {
                    transform: "scale(1)",
                    opacity: 1,
                    boxShadow: `0 0 0 0 ${annotation.color || "#ff9800"}00`,
                  },
                },
                animation: isPreview ? "none" : "enhancedPulse 2.5s infinite",
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
          <Box
            sx={{
              position: "absolute",
              left: `${annotation.position.x}%`,
              top: `${annotation.position.y}%`,
              transform: `rotate(${angle}rad)`,
              opacity,
              zIndex: isPreview ? 145 : 95,
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                transformOrigin: "left center",
              }}
            >
              <Box
                sx={{
                  width: `${distance * (isPreview ? 0.8 : 1)}px`,
                  height: 4,
                  background: `linear-gradient(90deg, ${
                    annotation.color || "#ff5722"
                  }, ${annotation.color || "#ff5722"}aa)`,
                  transform: `scaleX(${enterScale})`,
                  transformOrigin: "left center",
                  boxShadow: `0 0 8px ${annotation.color || "#ff5722"}44`,
                }}
              />
              <ArrowForwardIcon
                sx={{
                  color: annotation.color || "#ff5722",
                  fontSize: 28 * finalSizeMultiplier,
                  marginLeft: -1,
                  transform: `scale(${enterScale})`,
                  filter: `drop-shadow(0 2px 4px ${
                    annotation.color || "#ff5722"
                  }44)`,
                }}
              />
            </Box>
            {annotation.text && (
              <Typography
                sx={{
                  position: "absolute",
                  top: -30,
                  left: (distance * (isPreview ? 0.8 : 1)) / 2,
                  transform: `rotate(${-angle}rad) translateX(-50%)`,
                  backgroundColor: "rgba(0,0,0,0.9)",
                  color: "white",
                  px: 1.5,
                  py: 0.8,
                  borderRadius: 1.5,
                  fontSize: `${0.85 * finalSizeMultiplier}rem`,
                  whiteSpace: "nowrap",
                  boxShadow: "0 3px 9px rgba(0,0,0,0.4)",
                  backdropFilter: "blur(6px)",
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
          <Box
            sx={{
              position: "absolute",
              left: `${annotation.position.x}%`,
              top: `${annotation.position.y}%`,
              transform: `translate(-50%, -50%) scale(${enterScale})`,
              opacity,
              zIndex: isPreview ? 150 : 100,
            }}
          >
            <Chip
              icon={<Icon />}
              label={annotation.text}
              sx={{
                background: `linear-gradient(135deg, ${color}, ${color}dd)`,
                color: "white",
                fontSize: `${1 * finalSizeMultiplier}rem`,
                py: 2 * finalSizeMultiplier,
                px: 1.5 * finalSizeMultiplier,
                boxShadow: `0 6px 20px ${color}${isPreview ? "33" : "44"}`,
                border: isPreview ? "1px solid rgba(255,255,255,0.2)" : "none",
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

  // Zoom effect
  const zoomAnnotation = enableZoomEffects
    ? activeAnnotations.find((ann) => ann.type === "highlight")
    : null;

  const zoomScale = zoomAnnotation
    ? interpolate(
        frame - zoomAnnotation.startFrame,
        [
          0,
          20,
          zoomAnnotation.endFrame - zoomAnnotation.startFrame - 20,
          zoomAnnotation.endFrame - zoomAnnotation.startFrame,
        ],
        [1, 1.25, 1.25, 1],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
      )
    : 1;

  const zoomX = zoomAnnotation ? zoomAnnotation.position.x : 50;
  const zoomY = zoomAnnotation ? zoomAnnotation.position.y : 50;

  return (
    <ThemeProvider theme={theme}>
      <AbsoluteFill style={{ backgroundColor: "#000" }}>
        {/* Base Video */}
        <Box
          sx={{
            position: "absolute",
            width: "100%",
            height: showTimeline
              ? `calc(100% - ${timelineHeight + 40}px)`
              : "100%",
            transform: `scale(${zoomScale})`,
            transformOrigin: `${zoomX}% ${zoomY}%`,
            transition: "transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          <Video
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
          {activeAnnotations.map((annotation) => (
            <React.Fragment key={annotation.id}>
              {renderAnnotation(annotation)}
            </React.Fragment>
          ))}
        </AbsoluteFill>

        {/* Preview Annotation */}
        {previewAnnotation &&
          !activeAnnotations.find((ann) => ann.id === previewAnnotation.id) && (
            <Fade in={true} timeout={200}>
              <Box>{renderAnnotation(previewAnnotation, true)}</Box>
            </Fade>
          )}

        {/* Enhanced Timeline */}
        {showTimeline && (
          <Box
            sx={{
              position: "absolute",
              bottom: 20,
              left: 20,
              right: 20,
              height: timelineHeight,
            }}
          >
            <EnhancedTimeline
              annotations={annotations}
              showAnnotationLabels={showAnnotationLabels}
              showFrameNumbers={showFrameNumbers}
              interactive={enableInteractiveTimeline}
              height={timelineHeight}
              onAnnotationHover={handleAnnotationHover}
            />
          </Box>
        )}

        {/* Annotation Counter */}
        {activeAnnotations.length > 0 && (
          <Box
            sx={{
              position: "absolute",
              top: 20,
              left: 20,
              backgroundColor: "rgba(0,0,0,0.8)",
              color: "white",
              px: 2,
              py: 1,
              borderRadius: 2,
              fontSize: "0.8rem",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(255,255,255,0.2)",
            }}
          >
            Active: {activeAnnotations.length} / {annotations.length}
          </Box>
        )}

        {/* Hovered Annotation Info */}
        {hoveredAnnotation && (
          <Fade in={true} timeout={150}>
            <Box
              sx={{
                position: "absolute",
                top: 20,
                right: 20,
                backgroundColor: "rgba(0,0,0,0.9)",
                color: "white",
                px: 2.5,
                py: 1.5,
                borderRadius: 2,
                maxWidth: 250,
                backdropFilter: "blur(15px)",
                border: "1px solid rgba(255,255,255,0.2)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: "bold", mb: 0.5 }}>
                {hoveredAnnotation.text ||
                  `${hoveredAnnotation.type} annotation`}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>
                {Math.floor(hoveredAnnotation.startFrame / fps)}s -{" "}
                {Math.floor(hoveredAnnotation.endFrame / fps)}s
              </Typography>
              <Typography
                variant="caption"
                sx={{ display: "block", opacity: 0.6 }}
              >
                Type: {hoveredAnnotation.type} | Size:{" "}
                {hoveredAnnotation.size || "medium"}
              </Typography>
            </Box>
          </Fade>
        )}
      </AbsoluteFill>
    </ThemeProvider>
  );
};
