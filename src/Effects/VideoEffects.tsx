import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Video,
  staticFile,
  Easing,
} from "remotion";
import { Box, Typography } from "@mui/material";
import { ThemeProvider, createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#4fc3f7",
    },
    secondary: {
      main: "#ff4081",
    },
  },
});

type EffectType =
  | "blur"
  | "pixelate"
  | "chromatic"
  | "vhs"
  | "neon"
  | "matrix"
  | "split"
  | "kaleidoscope";

interface VideoEffect {
  type: EffectType;
  intensity: number;
  startFrame: number;
  endFrame: number;
}

interface VideoEffectsProps {
  sourceVideo?: string;
  effects?: VideoEffect[];
  showEffectName?: boolean;
}

export const VideoEffects: React.FC<VideoEffectsProps> = ({
  sourceVideo = "/assets/manim/CircleAreaDemo_480p15_20250902_222354.mp4",
  effects = [
    { type: "blur", intensity: 0.5, startFrame: 0, endFrame: 90 },
    { type: "chromatic", intensity: 0.7, startFrame: 90, endFrame: 180 },
    { type: "vhs", intensity: 0.8, startFrame: 180, endFrame: 270 },
    { type: "neon", intensity: 0.6, startFrame: 270, endFrame: 360 },
    { type: "matrix", intensity: 0.9, startFrame: 360, endFrame: 450 },
    { type: "split", intensity: 0.5, startFrame: 450, endFrame: 540 },
  ],
  showEffectName = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Find current effect
  const currentEffect = effects.find(
    (effect) => frame >= effect.startFrame && frame < effect.endFrame,
  );

  // Calculate effect progress
  const effectProgress = currentEffect
    ? interpolate(
        frame,
        [currentEffect.startFrame, currentEffect.endFrame],
        [0, 1],
      )
    : 0;

  // Generate CSS filters based on effect type
  const getEffectFilter = () => {
    if (!currentEffect) return "";

    const { type, intensity } = currentEffect;

    switch (type) {
      case "blur":
        return `blur(${interpolate(
          effectProgress,
          [0, 0.5, 1],
          [0, intensity * 10, 0],
        )}px)`;

      case "chromatic":
        const chromaticShift = Math.sin(frame * 0.2) * intensity * 10;
        return `hue-rotate(${chromaticShift}deg) saturate(${1 + intensity})`;

      case "vhs":
        const scanline = Math.sin(frame * 0.5) * 2;
        return `contrast(${1.2 + intensity * 0.3}) brightness(${
          0.9 + Math.random() * 0.1
        }) saturate(${0.8}) sepia(${intensity * 0.2})`;

      case "neon":
        return `brightness(${1 + intensity * 0.5}) contrast(${
          1 + intensity * 0.8
        }) saturate(${1 + intensity * 2})`;

      case "matrix":
        return `hue-rotate(120deg) saturate(${intensity * 2}) contrast(${
          1 + intensity * 0.5
        })`;

      case "pixelate":
        // This would need canvas manipulation for true pixelation
        return `contrast(${1.5}) brightness(${1.1})`;

      case "split":
        return `contrast(${1 + intensity * 0.3})`;

      case "kaleidoscope":
        const rotation = frame * 2;
        return `hue-rotate(${rotation}deg)`;

      default:
        return "";
    }
  };

  // Generate transform effects
  const getEffectTransform = () => {
    if (!currentEffect) return "";

    const { type, intensity } = currentEffect;

    switch (type) {
      case "split":
        const splitOffset = Math.sin(effectProgress * Math.PI) * intensity * 20;
        return `translateX(${splitOffset}px)`;

      case "vhs":
        const vhsOffset = Math.random() * intensity * 2;
        return `translateX(${vhsOffset}px) skewX(${
          Math.random() * intensity
        }deg)`;

      case "kaleidoscope":
        return `rotate(${frame * intensity * 2}deg) scale(${
          1 + Math.sin(frame * 0.1) * 0.1
        })`;

      default:
        return "";
    }
  };

  // VHS scan lines effect
  const renderScanLines = () => {
    if (currentEffect?.type !== "vhs") return null;

    return (
      <Box
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `repeating-linear-gradient(
            0deg,
            rgba(0, 0, 0, 0.15),
            rgba(0, 0, 0, 0.15) 1px,
            transparent 1px,
            transparent 2px
          )`,
          pointerEvents: "none",
          opacity: currentEffect.intensity,
        }}
      />
    );
  };

  // Matrix rain effect
  const renderMatrixRain = () => {
    if (currentEffect?.type !== "matrix") return null;

    const columns = 20;
    const chars = "01";

    return (
      <Box
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: "none",
          opacity: currentEffect.intensity * 0.3,
        }}
      >
        {Array.from({ length: columns }, (_, i) => {
          const speed = Math.random() * 2 + 1;
          const offset = Math.random() * 100;
          const y = ((frame * speed + offset) % 110) - 10;

          return (
            <Typography
              key={i}
              sx={{
                position: "absolute",
                left: `${(i / columns) * 100}%`,
                top: `${y}%`,
                fontSize: "1.5rem",
                color: "#00ff00",
                fontFamily: "monospace",
                textShadow: "0 0 10px #00ff00",
              }}
            >
              {chars[Math.floor(Math.random() * chars.length)]}
            </Typography>
          );
        })}
      </Box>
    );
  };

  // Split screen effect overlay
  const renderSplitScreen = () => {
    if (currentEffect?.type !== "split") return null;

    return (
      <>
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "50%",
            height: "100%",
            borderRight: "2px solid white",
            overflow: "hidden",
          }}
        >
          <Video
            src={staticFile(sourceVideo)}
            style={{
              width: "200%",
              height: "100%",
              filter: "hue-rotate(180deg)",
            }}
          />
        </Box>
      </>
    );
  };

  // Glitch effect overlay
  const renderGlitchOverlay = () => {
    if (!currentEffect || frame % 30 > 25) return null;

    const glitchIntensity = Math.random() * currentEffect.intensity;

    return (
      <Box
        sx={{
          position: "absolute",
          top: `${Math.random() * 80}%`,
          left: 0,
          right: 0,
          height: `${Math.random() * 10 + 5}%`,
          background: `linear-gradient(
            90deg,
            rgba(255, 0, 0, ${glitchIntensity}),
            rgba(0, 255, 0, ${glitchIntensity}),
            rgba(0, 0, 255, ${glitchIntensity})
          )`,
          mixBlendMode: "screen",
        }}
      />
    );
  };

  return (
    <ThemeProvider theme={theme}>
      <AbsoluteFill>
        {/* Main video with effects */}
        <Box
          sx={{
            width: "100%",
            height: "100%",
            filter: getEffectFilter(),
            transform: getEffectTransform(),
            transition: "filter 0.1s ease",
          }}
        >
          <Video
            src={staticFile(sourceVideo)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        </Box>

        {/* Effect-specific overlays */}
        {renderScanLines()}
        {renderMatrixRain()}
        {renderSplitScreen()}
        {renderGlitchOverlay()}

        {/* Effect name display */}
        {showEffectName && currentEffect && (
          <Box
            sx={{
              position: "absolute",
              top: 40,
              left: 40,
              padding: "12px 24px",
              background: "rgba(0, 0, 0, 0.7)",
              borderRadius: 2,
              border: "2px solid",
              borderColor: "primary.main",
              backdropFilter: "blur(10px)",
            }}
          >
            <Typography
              variant="h5"
              sx={{
                color: "white",
                fontWeight: "bold",
                textTransform: "uppercase",
                letterSpacing: 2,
              }}
            >
              {currentEffect.type} Effect
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: "primary.main",
                mt: 1,
              }}
            >
              Intensity: {Math.round(currentEffect.intensity * 100)}%
            </Typography>
          </Box>
        )}

        {/* Progress indicator */}
        <Box
          sx={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 4,
            background: "rgba(255, 255, 255, 0.1)",
          }}
        >
          <Box
            sx={{
              height: "100%",
              width: `${(frame / 540) * 100}%`,
              background: "linear-gradient(90deg, #4fc3f7, #ff4081)",
            }}
          />
        </Box>
      </AbsoluteFill>
    </ThemeProvider>
  );
};
