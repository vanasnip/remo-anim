import * as React from "react";
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

const theme = createTheme({
  palette: {
    primary: { main: "#2196f3" },
    secondary: { main: "#ff9800" },
    success: { main: "#4caf50" },
    warning: { main: "#ff5722" },
  },
});

export interface Annotation {
  id: string;
  type: "callout" | "highlight" | "arrow" | "info" | "warning" | "success";
  text: string;
  startFrame: number;
  endFrame: number;
  position: {
    x: number; // percentage 0-100
    y: number; // percentage 0-100
  };
  target?: {
    x: number;
    y: number;
  };
  color?: string;
  size?: "small" | "medium" | "large";
}

export interface ContentAugmentationProps {
  sourceVideo: string;
  annotations: Annotation[];
  showTimeline?: boolean;
  enableZoomEffects?: boolean;
}

export const ContentAugmentation: React.FC<ContentAugmentationProps> = ({
  sourceVideo,
  annotations = [],
  showTimeline = true,
  enableZoomEffects = true,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Filter active annotations for current frame
  const activeAnnotations = annotations.filter(
    (ann) => frame >= ann.startFrame && frame <= ann.endFrame,
  );

  const renderAnnotation = (annotation: Annotation) => {
    const annFrame = frame - annotation.startFrame;
    const annDuration = annotation.endFrame - annotation.startFrame;

    // Entrance animation
    const enterScale = spring({
      frame: annFrame,
      fps,
      config: { damping: 12 },
    });

    // Exit animation
    const exitOpacity = interpolate(
      annFrame,
      [annDuration - 10, annDuration],
      [1, 0],
      { extrapolateLeft: "clamp" },
    );

    const opacity = Math.min(enterScale, exitOpacity);

    // Pulsing effect for important annotations
    const pulse = interpolate(annFrame % 30, [0, 15, 30], [1, 1.1, 1], {
      extrapolateRight: "clamp",
    });

    const sizeMultiplier = {
      small: 0.8,
      medium: 1,
      large: 1.2,
    }[annotation.size || "medium"];

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
              zIndex: 100,
            }}
          >
            <Box
              sx={{
                backgroundColor: annotation.color || "rgba(33, 150, 243, 0.95)",
                color: "white",
                p: 2 * sizeMultiplier,
                borderRadius: 2,
                boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
                maxWidth: 300 * sizeMultiplier,
                backdropFilter: "blur(10px)",
              }}
            >
              <Typography
                variant="body1"
                sx={{ fontSize: `${1 * sizeMultiplier}rem` }}
              >
                {annotation.text}
              </Typography>
            </Box>
            {/* Pointer */}
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
              transform: "translate(-50%, -50%)",
              opacity,
              zIndex: 90,
            }}
          >
            <Box
              sx={{
                width: 150 * sizeMultiplier,
                height: 150 * sizeMultiplier,
                border: `4px solid ${annotation.color || "#ff9800"}`,
                borderRadius: "50%",
                animation: "pulse 2s infinite",
                "@keyframes pulse": {
                  "0%": {
                    transform: "scale(1)",
                    opacity: 1,
                  },
                  "50%": {
                    transform: "scale(1.1)",
                    opacity: 0.7,
                  },
                  "100%": {
                    transform: "scale(1)",
                    opacity: 1,
                  },
                },
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
              zIndex: 95,
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
                  width: `${distance}px`,
                  height: 3,
                  backgroundColor: annotation.color || "#ff5722",
                  transform: `scaleX(${enterScale})`,
                  transformOrigin: "left center",
                }}
              />
              <ArrowForwardIcon
                sx={{
                  color: annotation.color || "#ff5722",
                  fontSize: 30 * sizeMultiplier,
                  marginLeft: -1,
                  transform: `scale(${enterScale})`,
                }}
              />
            </Box>
            {annotation.text && (
              <Typography
                sx={{
                  position: "absolute",
                  top: -30,
                  left: distance / 2,
                  transform: `rotate(${-angle}rad) translateX(-50%)`,
                  backgroundColor: "rgba(0,0,0,0.8)",
                  color: "white",
                  px: 1,
                  py: 0.5,
                  borderRadius: 1,
                  fontSize: `${0.9 * sizeMultiplier}rem`,
                  whiteSpace: "nowrap",
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
              zIndex: 100,
            }}
          >
            <Chip
              icon={<Icon />}
              label={annotation.text}
              sx={{
                backgroundColor: color,
                color: "white",
                fontSize: `${1 * sizeMultiplier}rem`,
                py: 2 * sizeMultiplier,
                px: 1 * sizeMultiplier,
                "& .MuiChip-icon": {
                  color: "white",
                },
              }}
            />
          </Box>
        );

      default:
        return null;
    }
  };

  // Zoom effect for specific annotations
  const zoomAnnotation = enableZoomEffects
    ? activeAnnotations.find((ann) => ann.type === "highlight")
    : null;

  const zoomScale = zoomAnnotation
    ? interpolate(
        frame - zoomAnnotation.startFrame,
        [
          0,
          15,
          zoomAnnotation.endFrame - zoomAnnotation.startFrame - 15,
          zoomAnnotation.endFrame - zoomAnnotation.startFrame,
        ],
        [1, 1.2, 1.2, 1],
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
            height: "100%",
            transform: `scale(${zoomScale})`,
            transformOrigin: `${zoomX}% ${zoomY}%`,
            transition: "transform 0.3s ease-out",
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

        {/* Timeline */}
        {showTimeline && (
          <Box
            sx={{
              position: "absolute",
              bottom: 20,
              left: 20,
              right: 20,
              height: 40,
              backgroundColor: "rgba(0,0,0,0.7)",
              borderRadius: 2,
              p: 1,
              display: "flex",
              alignItems: "center",
              gap: 1,
            }}
          >
            <Box
              sx={{
                flex: 1,
                height: 4,
                backgroundColor: "rgba(255,255,255,0.2)",
                borderRadius: 2,
                overflow: "hidden",
                position: "relative",
              }}
            >
              {/* Progress */}
              <Box
                sx={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  height: "100%",
                  width: `${(frame / durationInFrames) * 100}%`,
                  backgroundColor: "#2196f3",
                }}
              />
              {/* Annotation markers */}
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
                          : "#fff",
                    opacity: 0.5,
                  }}
                />
              ))}
            </Box>
            <Typography
              variant="caption"
              sx={{
                color: "white",
                fontFamily: "monospace",
                minWidth: 60,
              }}
            >
              {Math.floor(frame / fps)}s
            </Typography>
          </Box>
        )}
      </AbsoluteFill>
    </ThemeProvider>
  );
};
