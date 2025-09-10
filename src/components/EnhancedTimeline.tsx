/**
 * Enhanced Timeline Component
 *
 * Advanced timeline visualization with interactive features for ContentAugmentation
 */

import React, { useState, useCallback } from "react";
import { Box, Typography, Tooltip, Chip } from "@mui/material";
import { useCurrentFrame, useVideoConfig } from "remotion";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import InfoIcon from "@mui/icons-material/Info";
import WarningIcon from "@mui/icons-material/Warning";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import type { Annotation } from "../Augmented/ContentAugmentation";

interface EnhancedTimelineProps {
  annotations: Annotation[];
  showAnnotationLabels?: boolean;
  showFrameNumbers?: boolean;
  showProgressIndicator?: boolean;
  interactive?: boolean;
  height?: number;
  onAnnotationHover?: (annotation: Annotation | null) => void;
  onTimelineClick?: (frame: number) => void;
}

export const EnhancedTimeline: React.FC<EnhancedTimelineProps> = ({
  annotations = [],
  showAnnotationLabels = true,
  showFrameNumbers = false,
  showProgressIndicator = true,
  interactive = true,
  height = 60,
  onAnnotationHover,
  onTimelineClick,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const [hoveredAnnotation, setHoveredAnnotation] = useState<Annotation | null>(
    null,
  );

  // Calculate timeline segments for better visualization
  const totalDuration = durationInFrames / fps;
  const segments = Math.ceil(totalDuration / 5); // 5-second segments

  // Handle annotation hover
  const handleAnnotationHover = useCallback(
    (annotation: Annotation | null) => {
      setHoveredAnnotation(annotation);
      onAnnotationHover?.(annotation);
    },
    [onAnnotationHover],
  );

  // Handle timeline click
  const handleTimelineClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!interactive || !onTimelineClick) return;

      const rect = event.currentTarget.getBoundingClientRect();
      const clickX = event.clientX - rect.left;
      const clickProgress = clickX / rect.width;
      const clickFrame = Math.round(clickProgress * durationInFrames);

      onTimelineClick(Math.max(0, Math.min(durationInFrames, clickFrame)));
    },
    [interactive, onTimelineClick, durationInFrames],
  );

  // Get icon for annotation type
  const getAnnotationIcon = (type: Annotation["type"]) => {
    const iconProps = { sx: { fontSize: 14 } };
    switch (type) {
      case "info":
        return <InfoIcon {...iconProps} />;
      case "warning":
        return <WarningIcon {...iconProps} />;
      case "success":
        return <CheckCircleIcon {...iconProps} />;
      default:
        return null;
    }
  };

  // Get color for annotation type
  const getAnnotationColor = (annotation: Annotation) => {
    if (annotation.color) return annotation.color;

    const colors = {
      callout: "#2196f3",
      highlight: "#ff9800",
      arrow: "#ff5722",
      info: "#2196f3",
      warning: "#ff9800",
      success: "#4caf50",
    };
    return colors[annotation.type];
  };

  return (
    <Box
      sx={{
        position: "relative",
        height: height,
        backgroundColor: "rgba(0,0,0,0.8)",
        borderRadius: 3,
        p: 1.5,
        backdropFilter: "blur(10px)",
        border: "1px solid rgba(255,255,255,0.1)",
        cursor: interactive ? "pointer" : "default",
      }}
      onClick={handleTimelineClick}
    >
      {/* Timeline Container */}
      <Box
        sx={{
          position: "relative",
          height: 8,
          backgroundColor: "rgba(255,255,255,0.2)",
          borderRadius: 4,
          overflow: "hidden",
          mb: 1,
        }}
      >
        {/* Progress Bar */}
        {showProgressIndicator && (
          <Box
            sx={{
              position: "absolute",
              left: 0,
              top: 0,
              height: "100%",
              width: `${(frame / durationInFrames) * 100}%`,
              background: "linear-gradient(90deg, #2196f3, #21cbf3)",
              boxShadow: "0 0 10px #2196f366",
              transition: "width 0.1s ease-out",
            }}
          />
        )}

        {/* Time Segments */}
        {Array.from({ length: segments }).map((_, i) => (
          <Box
            key={i}
            sx={{
              position: "absolute",
              left: `${(i / segments) * 100}%`,
              top: 0,
              width: 1,
              height: "100%",
              backgroundColor: "rgba(255,255,255,0.3)",
            }}
          />
        ))}

        {/* Annotation Markers */}
        {annotations.map((annotation, index) => {
          const startPercent = (annotation.startFrame / durationInFrames) * 100;
          const widthPercent =
            ((annotation.endFrame - annotation.startFrame) / durationInFrames) *
            100;
          const color = getAnnotationColor(annotation);
          const isActive =
            frame >= annotation.startFrame && frame <= annotation.endFrame;
          const isHovered = hoveredAnnotation?.id === annotation.id;

          return (
            <Tooltip
              key={annotation.id}
              title={
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: "bold" }}>
                    {annotation.text || `${annotation.type} annotation`}
                  </Typography>
                  <Typography variant="caption" sx={{ display: "block" }}>
                    {Math.floor(annotation.startFrame / fps)}s -{" "}
                    {Math.floor(annotation.endFrame / fps)}s
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ display: "block", opacity: 0.8 }}
                  >
                    Type: {annotation.type}
                  </Typography>
                </Box>
              }
              arrow
              placement="top"
            >
              <Box
                sx={{
                  position: "absolute",
                  left: `${startPercent}%`,
                  width: `${widthPercent}%`,
                  height: isActive ? 12 : 8,
                  backgroundColor: color,
                  opacity: isActive ? 1 : isHovered ? 0.8 : 0.6,
                  borderRadius: 2,
                  top: isActive ? -2 : 0,
                  boxShadow: isActive
                    ? `0 2px 8px ${color}66`
                    : `0 1px 3px ${color}44`,
                  cursor: interactive ? "pointer" : "default",
                  transition: "all 0.2s ease-in-out",
                  zIndex: isActive ? 10 : isHovered ? 5 : 1,
                  "&:hover": interactive
                    ? {
                        opacity: 0.9,
                        transform: "scaleY(1.2)",
                      }
                    : {},
                }}
                onMouseEnter={() =>
                  interactive && handleAnnotationHover(annotation)
                }
                onMouseLeave={() => interactive && handleAnnotationHover(null)}
              />
            </Tooltip>
          );
        })}

        {/* Current Frame Indicator */}
        <Box
          sx={{
            position: "absolute",
            left: `${(frame / durationInFrames) * 100}%`,
            top: -4,
            width: 2,
            height: 16,
            backgroundColor: "#fff",
            borderRadius: 1,
            boxShadow: "0 2px 4px rgba(0,0,0,0.5)",
            transform: "translateX(-50%)",
            zIndex: 20,
          }}
        />
      </Box>

      {/* Annotation Labels */}
      {showAnnotationLabels && annotations.length > 0 && (
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            gap: 0.5,
            mt: 1,
            maxHeight: height - 20,
            overflow: "hidden",
          }}
        >
          {annotations
            .filter((ann) => frame >= ann.startFrame && frame <= ann.endFrame)
            .slice(0, 3) // Limit to 3 active annotations to prevent overflow
            .map((annotation) => (
              <Chip
                key={annotation.id}
                icon={getAnnotationIcon(annotation.type) || undefined}
                label={annotation.text || annotation.type}
                size="small"
                sx={{
                  backgroundColor: getAnnotationColor(annotation),
                  color: "white",
                  fontSize: "0.7rem",
                  height: 22,
                  "& .MuiChip-icon": {
                    color: "white",
                  },
                }}
              />
            ))}
        </Box>
      )}

      {/* Time Display */}
      <Box
        sx={{
          position: "absolute",
          top: 8,
          right: 12,
          display: "flex",
          alignItems: "center",
          gap: 1,
        }}
      >
        {showFrameNumbers && (
          <Typography
            variant="caption"
            sx={{
              color: "rgba(255,255,255,0.7)",
              fontFamily: "monospace",
              fontSize: "0.7rem",
            }}
          >
            Frame {frame}
          </Typography>
        )}
        <Typography
          variant="caption"
          sx={{
            color: "white",
            fontFamily: "monospace",
            fontSize: "0.8rem",
            fontWeight: 500,
          }}
        >
          {Math.floor(frame / fps)}s / {Math.floor(durationInFrames / fps)}s
        </Typography>
      </Box>

      {/* Playback Status Indicator */}
      <Box
        sx={{
          position: "absolute",
          top: 8,
          left: 12,
          color: "white",
          opacity: 0.8,
        }}
      >
        {frame > 0 && frame < durationInFrames ? (
          <PlayArrowIcon sx={{ fontSize: 16 }} />
        ) : (
          <PauseIcon sx={{ fontSize: 16 }} />
        )}
      </Box>

      {/* Hover Information */}
      {hoveredAnnotation && (
        <Box
          sx={{
            position: "absolute",
            bottom: "100%",
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "rgba(0,0,0,0.9)",
            color: "white",
            p: 1,
            borderRadius: 1,
            fontSize: "0.75rem",
            whiteSpace: "nowrap",
            mb: 0.5,
            boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
            "&::after": {
              content: '""',
              position: "absolute",
              top: "100%",
              left: "50%",
              transform: "translateX(-50%)",
              border: "4px solid transparent",
              borderTopColor: "rgba(0,0,0,0.9)",
            },
          }}
        >
          {hoveredAnnotation.text || `${hoveredAnnotation.type} annotation`}
        </Box>
      )}
    </Box>
  );
};

export default EnhancedTimeline;