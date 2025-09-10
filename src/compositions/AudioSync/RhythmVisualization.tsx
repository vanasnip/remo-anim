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
  const { fps, durationInFrames } = useVideoConfig();

  const { isOnBeat, isOnDownbeat, beatProgress, bpm, currentMarkers } =
    useAudioMarkers({
      audioSrc,
      audioStartFrame: 0,
      window: 2,
    });

  // Calculate time-based progression phases (60 seconds = 1800 frames at 30fps)
  const timeInSeconds = frame / fps;
  const phase = Math.floor(timeInSeconds / 10); // 0-5 for each 10-second phase
  const phaseProgress = (timeInSeconds % 10) / 10; // 0-1 within current phase

  // Dynamic background that evolves through phases
  const baseHue = interpolate(phase, [0, 5], [220, 280]);
  const bgHue = interpolate(beatProgress, [0, 1], [baseHue, baseHue + 20]);
  const bgLightness = interpolate(phase, [0, 5], [5, 20]) + (isOnBeat ? 5 : 0);
  const bgSaturation = interpolate(phase, [0, 5], [30, 70]);

  // Global intensity and fade controls
  const globalIntensity = interpolate(phase, [0, 4, 5], [0.4, 1, 0.3]);
  const fadeOut = phase === 5 ? interpolate(phaseProgress, [0.5, 1], [1, 0.2]) : 1;

  return (
    <ThemeProvider theme={theme}>
      <AbsoluteFill
        style={{
          background: phase <= 2 
            ? `linear-gradient(135deg,
                hsl(${bgHue}, ${bgSaturation}%, ${bgLightness}%) 0%,
                hsl(${bgHue + 30}, ${bgSaturation - 10}%, 5%) 100%)`
            : `radial-gradient(circle at 50% 50%, 
                hsl(${bgHue}, ${bgSaturation}%, ${bgLightness}%) 0%,
                hsl(${bgHue + 60}, ${bgSaturation - 20}%, 8%) 50%,
                hsl(${bgHue + 120}, ${bgSaturation - 30}%, 3%) 100%)`,
          transition: "background 2s ease",
          opacity: globalIntensity * fadeOut,
        }}
      >
        {/* No audio element - pure visual rhythm demonstration */}

        {/* Enhanced header with phase information */}
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
            opacity: 0.8 * globalIntensity,
          }}
        >
          <span>Phase {phase + 1}/6 ({Math.floor(timeInSeconds)}s)</span>
          <span>BPM: {bpm ? Math.round(bpm) : "..."}</span>
          <span>Markers: {currentMarkers.length}</span>
        </Box>

        {/* Central visualization area with phase-based transformations */}
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: `translate(-50%, -50%) scale(${interpolate(phase, [0, 4], [0.8, 1.2])})`,
            width: "80%",
            height: "60%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            opacity: fadeOut,
          }}
        >
          {/* Phase-aware dynamic text */}
          <AudioTriggers audioSrc={audioSrc}>
            {(markers) => {
              const beatMarker = markers.find((m) => m.type === "beat");
              const onsetMarker = markers.find((m) => m.type === "onset");
              
              const phaseTexts = ["PULSE", "RHYTHM", "ENERGY", "POWER", "CLIMAX", "FADE"];
              const currentText = phaseTexts[phase] || "BEAT";

              return (
                <>
                  {beatMarker && (
                    <Typography
                      variant="h1"
                      sx={{
                        color: `hsl(${bgHue + 180}, 80%, 80%)`,
                        fontWeight: "bold",
                        animation: "slideIn 0.3s ease-out",
                        fontSize: interpolate(phase, [0, 4], [48, 72]),
                        textShadow: phase >= 3 ? `0 0 20px hsl(${bgHue + 180}, 80%, 80%)` : "none",
                      }}
                    >
                      {currentText}
                    </Typography>
                  )}
                  {onsetMarker && phase >= 1 && (
                    <>
                      <Typography
                        variant="h3"
                        sx={{
                          color: `hsl(${bgHue + 120}, 90%, 70%)`,
                          position: "absolute",
                          top: -50,
                          animation: "fadeUp 0.5s ease-out",
                        }}
                      >
                        ♪
                      </Typography>
                      {/* Phase 3+: Multiple musical symbols */}
                      {phase >= 3 && (
                        <>
                          <EmojiRhythm audioSrc={audioSrc} phase={phase} hue={bgHue} />
                        </>
                      )}
                    </>
                  )}
                </>
              );
            }}
          </AudioTriggers>

          {/* Enhanced visual grid with wave patterns */}
          <RhythmGrid audioSrc={audioSrc} phase={phase} frame={frame} hue={bgHue} />

          {/* Enhanced beat progress indicator */}
          <BeatProgressBar 
            beatProgress={beatProgress} 
            isOnBeat={isOnBeat} 
            phase={phase}
            hue={bgHue}
          />
        </Box>

        {/* Phase 1+: Wave patterns */}
        {phase >= 1 && (
          <WavePatterns 
            frame={frame}
            phase={phase}
            hue={bgHue}
            intensity={globalIntensity * fadeOut}
            isOnBeat={isOnBeat}
          />
        )}

        {/* Enhanced particle effects */}
        {isOnDownbeat && (
          <DownbeatParticles 
            frame={frame} 
            fps={fps} 
            phase={phase}
            hue={bgHue}
            intensity={globalIntensity * fadeOut}
          />
        )}

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
 * Enhanced grid that evolves with phases
 */
const RhythmGrid: React.FC<{ 
  audioSrc?: string;
  phase: number;
  frame: number;
  hue: number;
}> = ({ audioSrc = "synthetic", phase, frame, hue }) => {
  const { fps } = useVideoConfig();
  const { isOnBeat, currentMarkers } = useAudioMarkers({ audioSrc });

  const gridSize = interpolate(phase, [0, 4], [4, 6]); // 4x4 to 6x6 grid
  const totalItems = Math.floor(gridSize) ** 2;
  const gridItems = Array.from({ length: totalItems }, (_, i) => i);

  return (
    <Grid 
      container 
      spacing={interpolate(phase, [0, 4], [2, 1])} 
      sx={{ 
        width: interpolate(phase, [0, 4], [400, 500]), 
        height: interpolate(phase, [0, 4], [400, 500]),
        transition: "all 1s ease",
      }}
    >
      {gridItems.map((index) => {
        const row = Math.floor(index / Math.floor(gridSize));
        const col = index % Math.floor(gridSize);
        const delay = (row + col) * 2;
        const shouldPulse = isOnBeat && (frame + delay) % 30 < 15;

        const scale = spring({
          frame: shouldPulse ? frame : frame - 10,
          fps,
          config: {
            damping: interpolate(phase, [0, 4], [12, 6]),
            stiffness: interpolate(phase, [0, 4], [180, 300]),
          },
        });

        // Phase-based color evolution
        const baseColor = `hsl(${hue + index * 10}, 70%, 50%)`;
        let opacity = interpolate(phase, [0, 4], [0.3, 0.7]);
        
        // Different marker types affect different grid cells
        if (currentMarkers.some((m) => m.type === "onset") && index % 2 === 0) {
          opacity += 0.2;
        }
        if (currentMarkers.some((m) => m.type === "downbeat") && index % 3 === 0) {
          opacity += 0.3;
        }

        // Phase 2+: Add wave-like motion
        const waveOffset = phase >= 1 ? 
          Math.sin((frame * 0.1) + (index * 0.5)) * 10 : 0;

        return (
          <Grid key={index} item xs={Math.floor(12 / Math.floor(gridSize))}>
            <Box
              sx={{
                width: "100%",
                paddingTop: "100%",
                position: "relative",
                backgroundColor: baseColor,
                borderRadius: phase >= 2 ? 8 : 2,
                transform: `scale(${shouldPulse ? scale : 1}) translateY(${waveOffset}px)`,
                transition: "all 0.2s ease",
                border: phase >= 3 ? `2px solid rgba(255, 255, 255, 0.3)` : "1px solid rgba(255, 255, 255, 0.1)",
                opacity,
                boxShadow: phase >= 3 ? `0 0 15px ${baseColor}` : "none",
              }}
            />
          </Grid>
        );
      })}
    </Grid>
  );
};

/**
 * Enhanced beat progress bar with phase evolution
 */
const BeatProgressBar: React.FC<{
  beatProgress: number;
  isOnBeat: boolean;
  phase: number;
  hue: number;
}> = ({ beatProgress, isOnBeat, phase, hue }) => {
  const barHeight = interpolate(phase, [0, 4], [8, 20]);
  const barColor = `hsl(${hue}, 70%, ${isOnBeat ? 70 : 50}%)`;
  
  return (
    <Box
      sx={{
        width: interpolate(phase, [0, 4], [60, 80]) + "%",
        height: barHeight,
        backgroundColor: "rgba(255, 255, 255, 0.1)",
        borderRadius: barHeight / 2,
        overflow: "hidden",
        position: "relative",
        border: phase >= 3 ? `2px solid rgba(255, 255, 255, 0.2)` : "none",
        transition: "all 1s ease",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: `${beatProgress * 100}%`,
          backgroundColor: barColor,
          transition: "none",
          borderRadius: barHeight / 2,
          boxShadow: phase >= 3 ? `0 0 10px ${barColor}` : "none",
        }}
      />
      {isOnBeat && (
        <Box
          sx={{
            position: "absolute",
            right: 0,
            top: "50%",
            transform: "translateY(-50%)",
            width: barHeight,
            height: barHeight,
            backgroundColor: "white",
            borderRadius: "50%",
            animation: "pulse 0.3s ease-out",
            boxShadow: phase >= 3 ? "0 0 15px white" : "none",
          }}
        />
      )}
      {/* Phase 4+: Additional progress indicators */}
      {phase >= 3 && (
        <Box
          sx={{
            position: "absolute",
            left: 0,
            top: -4,
            width: `${beatProgress * 100}%`,
            height: 4,
            backgroundColor: `hsl(${hue + 60}, 80%, 60%)`,
            borderRadius: 2,
            opacity: 0.8,
          }}
        />
      )}
    </Box>
  );
};

/**
 * Enhanced particle effects that evolve with phases
 */
const DownbeatParticles: React.FC<{ 
  frame: number; 
  fps: number;
  phase: number;
  hue: number;
  intensity: number;
}> = ({ frame, fps, phase, hue, intensity }) => {
  const particleCount = interpolate(phase, [0, 4], [8, 20]);
  const particles = Array.from({ length: Math.floor(particleCount) }, (_, i) => i);

  return (
    <>
      {particles.map((index) => {
        const angle = (index * 360) / particles.length;
        const distance = spring({
          frame,
          fps,
          config: {
            damping: interpolate(phase, [0, 4], [8, 4]),
            stiffness: interpolate(phase, [0, 4], [100, 200]),
          },
        });

        const opacity = interpolate(frame % 60, [0, 30, 60], [1, 0.8, 0], {
          extrapolateRight: "clamp",
        }) * intensity;

        const size = interpolate(phase, [0, 4], [10, 16]);
        const particleHue = hue + index * 30;

        return (
          <Box
            key={index}
            sx={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: size,
              height: size,
              backgroundColor: `hsl(${particleHue}, 80%, 60%)`,
              borderRadius: "50%",
              transform: `
                translate(-50%, -50%)
                rotate(${angle}deg)
                translateX(${distance * interpolate(phase, [0, 4], [100, 200])}px)
                scale(${interpolate(frame % 60, [0, 60], [0.5, 1.5])})
              `,
              opacity,
              boxShadow: phase >= 3 ? `0 0 15px hsl(${particleHue}, 80%, 60%)` : "none",
            }}
          />
        );
      })}
    </>
  );
};

/**
 * Enhanced emoji rhythm with phase awareness
 */
export const EmojiRhythm: React.FC<{ 
  audioSrc?: string;
  phase: number;
  hue: number;
}> = ({ audioSrc = "synthetic", phase, hue }) => {
  const emojis = ["🎵", "🎶", "🎤", "🎸", "🥁", "🎹", "🎺", "🎷", "🌟", "⚡", "💫", "🔥"];
  const [currentEmoji, setCurrentEmoji] = React.useState(0);
  const frame = useCurrentFrame();

  const { isOnBeat } = useAudioMarkers({ audioSrc });

  React.useEffect(() => {
    if (isOnBeat) {
      setCurrentEmoji((prev) => (prev + 1) % emojis.length);
    }
  }, [isOnBeat, emojis.length]);

  // Create multiple emojis for higher phases
  const emojiCount = Math.min(phase - 2, 4);
  const positions = [
    { top: "10%", left: "10%" },
    { top: "10%", right: "10%" },
    { bottom: "20%", left: "10%" },
    { bottom: "20%", right: "10%" },
  ];

  return (
    <>
      {Array.from({ length: emojiCount }, (_, i) => (
        <Typography
          key={i}
          variant="h1"
          sx={{
            position: "absolute",
            ...positions[i],
            fontSize: interpolate(phase, [3, 5], [64, 96]),
            animation: isOnBeat ? "bounce 0.3s ease-out" : "none",
            filter: `hue-rotate(${(hue + i * 60) % 360}deg)`,
            transform: `rotate(${Math.sin(frame * 0.1 + i) * 10}deg)`,
            textShadow: `0 0 20px hsl(${hue + i * 60}, 80%, 50%)`,
            zIndex: 10,
          }}
        >
          {emojis[(currentEmoji + i) % emojis.length]}
        </Typography>
      ))}
    </>
  );
};

/**
 * Wave patterns component for phase 1+
 */
const WavePatterns: React.FC<{
  frame: number;
  phase: number;
  hue: number;
  intensity: number;
  isOnBeat: boolean;
}> = ({ frame, phase, hue, intensity, isOnBeat }) => {
  const waveCount = interpolate(phase, [1, 4], [3, 8]);
  const waves = Array.from({ length: Math.floor(waveCount) }, (_, i) => i);

  return (
    <>
      {waves.map((waveIndex) => {
        const waveSpeed = 0.05 + waveIndex * 0.02;
        const waveAmplitude = interpolate(phase, [1, 4], [20, 60]);
        const waveLength = 100 + waveIndex * 20;
        const waveHue = hue + waveIndex * 40;
        
        const points = Array.from({ length: 50 }, (_, pointIndex) => {
          const x = (pointIndex / 49) * 100; // 0 to 100%
          const y = 50 + Math.sin((frame * waveSpeed) + (pointIndex * 0.2) + (waveIndex * 0.5)) * waveAmplitude;
          return `${x}% ${y}%`;
        }).join(", ");

        return (
          <Box
            key={`wave-${waveIndex}`}
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
              zIndex: waveIndex,
              "&::before": {
                content: '""',
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                background: `linear-gradient(90deg, transparent, 
                  hsl(${waveHue}, 70%, 50%) 50%, transparent)`,
                opacity: intensity * (isOnBeat ? 0.8 : 0.4),
                clipPath: `polygon(${points})`,
                transition: "opacity 0.1s ease",
              },
            }}
          />
        );
      })}
    </>
  );
};