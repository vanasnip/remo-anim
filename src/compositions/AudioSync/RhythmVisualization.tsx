/**
 * Complete rhythm visualization composition
 * Demonstrates various ways to use audio triggers
 */

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { Box, Typography, Grid } from "@mui/material";
import { useAudioMarkers } from "../../audio/hooks/useAudioMarkers";
import { AudioTriggers } from "./AudioTriggeredContent";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#4FC3F7",
    },
    secondary: {
      main: "#FFD54F",
    },
  },
});

interface RhythmVisualizationProps {
  audioSrc?: string; // Optional - uses synthetic audio by default
}

/**
 * Main rhythm visualization composition
 */
export const RhythmVisualization: React.FC<RhythmVisualizationProps> = ({
  audioSrc = "synthetic", // Default to synthetic audio
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const { isOnBeat, isOnDownbeat, beatProgress, bpm, currentMarkers } =
    useAudioMarkers({
      audioSrc,
      audioStartFrame: 0,
      window: 2,
    });

  // Background color shifts with beat
  const bgHue = interpolate(beatProgress, [0, 1], [220, 260]);
  const bgLightness = isOnBeat ? 15 : 10;

  return (
    <ThemeProvider theme={theme}>
      <AbsoluteFill
        style={{
          background: `linear-gradient(135deg,
            hsl(${bgHue}, 50%, ${bgLightness}%) 0%,
            hsl(${bgHue + 30}, 40%, 5%) 100%)`,
          transition: "background 0.1s ease",
        }}
      >
        {/* No audio element - pure visual rhythm demonstration */}

        {/* Header with BPM and frame info */}
        <Box
          sx={{
            position: "absolute",
            top: 20,
            left: 20,
            right: 20,
            display: "flex",
            justifyContent: "space-between",
            color: "white",
            fontFamily: "monospace",
            fontSize: "0.9rem",
            opacity: 0.7,
          }}
        >
          <span>Frame: {frame}</span>
          <span>BPM: {bpm ? Math.round(bpm) : "..."}</span>
          <span>Markers: {currentMarkers.length}</span>
        </Box>

        {/* Central visualization area */}
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "80%",
            height: "60%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
          }}
        >
          {/* Dynamic text that changes on beats */}
          <AudioTriggers audioSrc={audioSrc}>
            {(markers) => {
              const beatMarker = markers.find((m) => m.type === "beat");
              const onsetMarker = markers.find((m) => m.type === "onset");

              return (
                <>
                  {beatMarker && (
                    <Typography
                      variant="h1"
                      sx={{
                        color: "white",
                        fontWeight: "bold",
                        animation: "slideIn 0.3s ease-out",
                      }}
                    >
                      BEAT
                    </Typography>
                  )}
                  {onsetMarker && (
                    <Typography
                      variant="h3"
                      sx={{
                        color: "yellow",
                        position: "absolute",
                        top: -50,
                        animation: "fadeUp 0.5s ease-out",
                      }}
                    >
                      ♪
                    </Typography>
                  )}
                </>
              );
            }}
          </AudioTriggers>

          {/* Visual grid that reacts to rhythm */}
          <RhythmGrid audioSrc={audioSrc} />

          {/* Beat progress indicator */}
          <BeatProgressBar beatProgress={beatProgress} isOnBeat={isOnBeat} />
        </Box>

        {/* Particle effects on downbeats */}
        {isOnDownbeat && <DownbeatParticles frame={frame} fps={fps} />}

        <style>
          {`
            @keyframes slideIn {
              from {
                opacity: 0;
                transform: translateX(-50px);
              }
              to {
                opacity: 1;
                transform: translateX(0);
              }
            }

            @keyframes fadeUp {
              from {
                opacity: 0;
                transform: translateY(20px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }

            @keyframes pulse {
              0% { transform: scale(1); }
              50% { transform: scale(1.1); }
              100% { transform: scale(1); }
            }
          `}
        </style>
      </AbsoluteFill>
    </ThemeProvider>
  );
};

/**
 * Grid of elements that pulse on beats
 */
const RhythmGrid: React.FC<{ audioSrc?: string }> = ({ audioSrc = "synthetic" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { isOnBeat, currentMarkers } = useAudioMarkers({ audioSrc });

  const gridItems = Array.from({ length: 16 }, (_, i) => i);

  return (
    <Grid container spacing={2} sx={{ width: 400, height: 400 }}>
      {gridItems.map((index) => {
        const delay = index * 2;
        const shouldPulse = isOnBeat && frame % 30 === delay;

        const scale = spring({
          frame: shouldPulse ? frame : frame - 10,
          fps,
          config: {
            damping: 12,
            stiffness: 180,
          },
        });

        // Color based on marker type
        let color = "rgba(79, 195, 247, 0.3)";
        if (currentMarkers.some((m) => m.type === "onset")) {
          color = "rgba(255, 213, 79, 0.3)";
        }
        if (currentMarkers.some((m) => m.type === "downbeat")) {
          color = "rgba(255, 112, 67, 0.3)";
        }

        return (
          <Grid key={index} item xs={3}>
            <Box
              sx={{
                width: "100%",
                paddingTop: "100%",
                position: "relative",
                backgroundColor: color,
                borderRadius: 2,
                transform: `scale(${shouldPulse ? scale : 1})`,
                transition: "background-color 0.2s ease",
                border: "1px solid rgba(255, 255, 255, 0.1)",
              }}
            />
          </Grid>
        );
      })}
    </Grid>
  );
};

/**
 * Beat progress bar visualization
 */
const BeatProgressBar: React.FC<{
  beatProgress: number;
  isOnBeat: boolean;
}> = ({ beatProgress, isOnBeat }) => {
  return (
    <Box
      sx={{
        width: "60%",
        height: 8,
        backgroundColor: "rgba(255, 255, 255, 0.1)",
        borderRadius: 4,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: `${beatProgress * 100}%`,
          backgroundColor: isOnBeat ? "#FFD54F" : "#4FC3F7",
          transition: "none",
          borderRadius: 4,
        }}
      />
      {isOnBeat && (
        <Box
          sx={{
            position: "absolute",
            right: 0,
            top: "50%",
            transform: "translateY(-50%)",
            width: 20,
            height: 20,
            backgroundColor: "white",
            borderRadius: "50%",
            animation: "pulse 0.3s ease-out",
          }}
        />
      )}
    </Box>
  );
};

/**
 * Particle effects for downbeats
 */
const DownbeatParticles: React.FC<{ frame: number; fps: number }> = ({
  frame,
  fps,
}) => {
  const particles = Array.from({ length: 8 }, (_, i) => i);

  return (
    <>
      {particles.map((index) => {
        const angle = (index * 360) / particles.length;
        const distance = spring({
          frame,
          fps,
          config: {
            damping: 8,
            stiffness: 100,
          },
        });

        const opacity = interpolate(frame % 30, [0, 30], [1, 0], {
          extrapolateRight: "clamp",
        });

        return (
          <Box
            key={index}
            sx={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: 10,
              height: 10,
              backgroundColor: "#FF7043",
              borderRadius: "50%",
              transform: `
                translate(-50%, -50%)
                rotate(${angle}deg)
                translateX(${distance * 100}px)
              `,
              opacity,
            }}
          />
        );
      })}
    </>
  );
};

/**
 * Example of emoji/icon triggers
 */
export const EmojiRhythm: React.FC<{ audioSrc?: string }> = ({ audioSrc = "synthetic" }) => {
  const emojis = ["🎵", "🎶", "🎤", "🎸", "🥁", "🎹", "🎺", "🎷"];
  const [currentEmoji, setCurrentEmoji] = React.useState(0);

  const { isOnBeat } = useAudioMarkers({ audioSrc });

  React.useEffect(() => {
    if (isOnBeat) {
      setCurrentEmoji((prev) => (prev + 1) % emojis.length);
    }
  }, [isOnBeat, emojis.length]);

  return (
    <Typography
      variant="h1"
      sx={{
        fontSize: "5rem",
        animation: isOnBeat ? "bounce 0.3s ease-out" : "none",
      }}
    >
      {emojis[currentEmoji]}
    </Typography>
  );
};