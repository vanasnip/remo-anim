/**
 * Example component demonstrating audio-triggered content
 * Shows how to use audio markers to trigger visual elements
 */

import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Box, Typography, CircularProgress } from "@mui/material";
import { useAudioMarkers, useBeats } from "../../audio/hooks/useAudioMarkers";
import type { TimelineMarker } from "../../audio/types";

interface AudioTriggeredContentProps {
  audioSrc?: string; // Optional - uses synthetic audio by default
  audioStartFrame?: number;
}

/**
 * Main component demonstrating flexible audio-triggered content
 */
export const AudioTriggeredContent: React.FC<AudioTriggeredContentProps> = ({
  audioSrc = "synthetic", // Default to synthetic audio
  audioStartFrame = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Use the audio markers hook
  const {
    currentMarkers,
    isOnBeat,
    isOnOnset,
    isOnDownbeat,
    beatProgress,
    bpm,
    isLoading,
    error,
  } = useAudioMarkers({
    audioSrc,
    audioStartFrame,
    window: 1, // Allow 1 frame tolerance
  });

  // Calculate time-based progression phases (60 seconds = 1800 frames at 30fps)
  const timeInSeconds = frame / fps;
  const phase = Math.floor(timeInSeconds / 10); // 0-5 for each 10-second phase
  const phaseProgress = (timeInSeconds % 10) / 10; // 0-1 within current phase

  // Spring animation for beat pulses with intensity based on phase
  const beatIntensity = interpolate(phase, [0, 5], [1, 2.5]);
  const beatScale = spring({
    frame: isOnBeat ? frame : frame - 10,
    fps,
    config: {
      damping: interpolate(phase, [0, 5], [15, 8]),
      stiffness: interpolate(phase, [0, 5], [300, 500]),
    },
  });

  // Dynamic color system that evolves through phases
  const baseHue = interpolate(phase, [0, 5], [200, 320]);
  const hue = interpolate(beatProgress, [0, 1], [baseHue, baseHue + 40]);
  const saturation = interpolate(phase, [0, 5], [50, 80]);
  const lightness = interpolate(phase, [0, 5], [40, 60]);

  if (isLoading) {
    return (
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Analyzing audio rhythm...
        </Typography>
      </AbsoluteFill>
    );
  }

  if (error) {
    return (
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <Typography variant="h6" color="error">
          Error analyzing audio: {error.message}
        </Typography>
      </AbsoluteFill>
    );
  }

  // Phase-based visual intensity and opacity controls
  const globalIntensity = interpolate(phase, [0, 4, 5], [0.3, 1, 0.6]);
  const cooldownFade = phase === 5 ? interpolate(phaseProgress, [0, 1], [1, 0.3]) : 1;

  return (
    <AbsoluteFill 
      style={{ 
        backgroundColor: phase >= 5 ? "#050505" : "#0a0a0a",
        transition: "background-color 2s ease"
      }}
    >
      {/* No audio element - pure visual beat demonstration */}

      {/* Phase indicator and BPM Display */}
      <Box
        sx={{
          position: "absolute",
          top: 20,
          left: 20,
          color: "white",
          fontFamily: "monospace",
          opacity: globalIntensity,
        }}
      >
        <div>Phase {phase + 1}/6 ({Math.floor(timeInSeconds)}s)</div>
        {bpm && <div>BPM: {Math.round(bpm)}</div>}
      </Box>

      {/* Enhanced Beat Progress Bar */}
      <Box
        sx={{
          position: "absolute",
          bottom: 20,
          left: 20,
          right: 20,
          height: interpolate(phase, [0, 4], [4, 12]),
          backgroundColor: "rgba(255, 255, 255, 0.1)",
          borderRadius: 2,
          transition: "height 1s ease",
        }}
      >
        <Box
          sx={{
            width: `${beatProgress * 100}%`,
            height: "100%",
            backgroundColor: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
            borderRadius: 2,
            transition: "none",
            boxShadow: phase >= 3 ? `0 0 20px hsl(${hue}, ${saturation}%, ${lightness}%)` : "none",
          }}
        />
        {/* Phase progress overlay */}
        <Box
          sx={{
            position: "absolute",
            top: -2,
            left: 0,
            width: `${phaseProgress * 100}%`,
            height: 2,
            backgroundColor: "white",
            opacity: 0.6,
          }}
        />
      </Box>

      {/* Dynamic Central beat indicator with phase-based evolution */}
      <Box
        sx={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: `translate(-50%, -50%) scale(${isOnBeat ? beatScale * beatIntensity : 1})`,
          width: interpolate(phase, [0, 4], [200, 300]),
          height: interpolate(phase, [0, 4], [200, 300]),
          borderRadius: "50%",
          backgroundColor: isOnDownbeat
            ? `hsla(${hue - 50}, ${saturation}%, ${lightness + 20}%, 0.4)`
            : `hsla(${hue}, ${saturation}%, ${lightness}%, 0.3)`,
          border: `${interpolate(phase, [0, 4], [4, 8])}px solid ${isOnBeat ? "white" : "transparent"}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.1s ease",
          opacity: globalIntensity * cooldownFade,
          boxShadow: phase >= 3 ? `0 0 50px hsla(${hue}, ${saturation}%, ${lightness}%, 0.5)` : "none",
        }}
      >
        <Typography
          variant="h3"
          sx={{
            color: "white",
            fontWeight: "bold",
            opacity: isOnBeat ? 1 : 0.3,
            fontSize: interpolate(phase, [0, 4], [48, 72]),
          }}
        >
          {isOnDownbeat ? "!" : "•"}
        </Typography>
      </Box>

      {/* Phase 2+: Enhanced Onset indicators */}
      {isOnOnset && phase >= 1 && (
        <>
          <Box
            sx={{
              position: "absolute",
              top: "30%",
              left: "50%",
              transform: "translateX(-50%)",
              color: `hsl(${hue + 60}, 80%, 70%)`,
              fontSize: interpolate(phase, [1, 4], [32, 64]),
              fontWeight: "bold",
              animation: "fadeOut 0.5s ease-out",
              opacity: globalIntensity,
            }}
          >
            ♪
          </Box>
          {/* Phase 3+: Multiple onset indicators */}
          {phase >= 2 && (
            <>
              <Box
                sx={{
                  position: "absolute",
                  top: "25%",
                  left: "25%",
                  color: `hsl(${hue + 120}, 80%, 60%)`,
                  fontSize: 48,
                  animation: "fadeOut 0.4s ease-out",
                }}
              >
                ♫
              </Box>
              <Box
                sx={{
                  position: "absolute",
                  top: "25%",
                  right: "25%",
                  color: `hsl(${hue + 180}, 80%, 60%)`,
                  fontSize: 48,
                  animation: "fadeOut 0.4s ease-out",
                }}
              >
                ♬
              </Box>
            </>
          )}
        </>
      )}

      {/* Phase 3+: Particle effects system */}
      {phase >= 3 && (
        <ParticleEffects 
          frame={frame} 
          fps={fps} 
          phase={phase} 
          isOnBeat={isOnBeat}
          hue={hue}
          intensity={globalIntensity * cooldownFade}
        />
      )}

      {/* Phase 4+: Orbital elements */}
      {phase >= 3 && (
        <OrbitalElements 
          frame={frame}
          phase={phase}
          hue={hue}
          intensity={globalIntensity * cooldownFade}
        />
      )}

      {/* Enhanced marker visualization */}
      {currentMarkers.map((marker, index) => (
        <MarkerVisual
          key={`${marker.frame}-${index}`}
          marker={marker}
          index={index}
          phase={phase}
          intensity={globalIntensity * cooldownFade}
        />
      ))}

      <style>
        {`
          @keyframes fadeOut {
            from { opacity: 1; transform: translateX(-50%) scale(1); }
            to { opacity: 0; transform: translateX(-50%) scale(1.8); }
          }
          @keyframes particleFloat {
            0% { transform: scale(0) rotate(0deg); opacity: 1; }
            50% { opacity: 0.8; }
            100% { transform: scale(1.5) rotate(360deg); opacity: 0; }
          }
          @keyframes orbit {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </AbsoluteFill>
  );
};

/**
 * Enhanced marker visualization component with phase awareness
 */
const MarkerVisual: React.FC<{ 
  marker: TimelineMarker; 
  index: number;
  phase: number;
  intensity: number;
}> = ({
  marker,
  index,
  phase,
  intensity,
}) => {
  const positions = [
    { top: "20%", left: "20%" },
    { top: "20%", right: "20%" },
    { bottom: "20%", left: "20%" },
    { bottom: "20%", right: "20%" },
    { top: "10%", left: "50%" },
    { bottom: "10%", right: "50%" },
    { top: "50%", left: "10%" },
    { top: "50%", right: "10%" },
  ];

  const position = positions[index % positions.length];
  const baseColors = {
    beat: "#4FC3F7",
    onset: "#FFD54F",
    downbeat: "#FF7043",
    pattern: "#AB47BC",
    harmonic: "#66BB6A",
  };

  const size = interpolate(phase, [0, 4], [40, 60]);
  const glowIntensity = interpolate(phase, [0, 4], [0, 20]);

  return (
    <Box
      sx={{
        position: "absolute",
        ...position,
        width: size,
        height: size,
        borderRadius: marker.type === "beat" ? "50%" : phase >= 2 ? "20%" : "0%",
        backgroundColor: baseColors[marker.type] || "#ffffff",
        opacity: (marker.confidence || 0.8) * intensity,
        transform: `scale(${(marker.strength || 1) * intensity})`,
        animation: "pulse 0.3s ease-out",
        boxShadow: phase >= 3 ? `0 0 ${glowIntensity}px ${baseColors[marker.type] || "#ffffff"}` : "none",
        border: phase >= 4 ? `2px solid white` : "none",
      }}
    />
  );
};

/**
 * Particle effects system for phases 3+
 */
const ParticleEffects: React.FC<{
  frame: number;
  fps: number;
  phase: number;
  isOnBeat: boolean;
  hue: number;
  intensity: number;
}> = ({ frame, fps, phase, isOnBeat, hue, intensity }) => {
  if (!isOnBeat) return null;

  const particleCount = interpolate(phase, [3, 5], [8, 16]);
  const particles = Array.from({ length: Math.floor(particleCount) }, (_, i) => i);

  return (
    <>
      {particles.map((index) => {
        const angle = (index * 360) / particles.length;
        const delay = index * 2;
        const animationFrame = (frame + delay) % 60; // Reset every 2 seconds

        const distance = interpolate(animationFrame, [0, 30], [0, 150]);
        const opacity = interpolate(animationFrame, [0, 15, 30], [1, 0.8, 0]);

        return (
          <Box
            key={`particle-${index}`}
            sx={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: interpolate(phase, [3, 5], [6, 12]),
              height: interpolate(phase, [3, 5], [6, 12]),
              backgroundColor: `hsl(${hue + index * 30}, 80%, 60%)`,
              borderRadius: "50%",
              transform: `
                translate(-50%, -50%)
                rotate(${angle}deg)
                translateX(${distance}px)
                scale(${interpolate(animationFrame, [0, 30], [0.5, 1.5])})
              `,
              opacity: opacity * intensity,
              pointerEvents: "none",
            }}
          />
        );
      })}
    </>
  );
};

/**
 * Orbital elements for phases 3+
 */
const OrbitalElements: React.FC<{
  frame: number;
  phase: number;
  hue: number;
  intensity: number;
}> = ({ frame, phase, hue, intensity }) => {
  const orbitCount = Math.min(phase - 2, 3);
  const orbits = Array.from({ length: orbitCount }, (_, i) => i);

  return (
    <>
      {orbits.map((orbitIndex) => {
        const radius = 250 + orbitIndex * 50;
        const speed = 1 + orbitIndex * 0.3;
        const angle = (frame * speed) % 360;
        const elementCount = 3 + orbitIndex;
        
        return Array.from({ length: elementCount }, (_, elemIndex) => {
          const elementAngle = angle + (elemIndex * 360) / elementCount;
          
          return (
            <Box
              key={`orbit-${orbitIndex}-${elemIndex}`}
              sx={{
                position: "absolute",
                top: "50%",
                left: "50%",
                width: 8 + orbitIndex * 2,
                height: 8 + orbitIndex * 2,
                backgroundColor: `hsl(${hue + orbitIndex * 60 + elemIndex * 20}, 70%, 50%)`,
                borderRadius: "50%",
                transform: `
                  translate(-50%, -50%)
                  rotate(${elementAngle}deg)
                  translateX(${radius}px)
                `,
                opacity: intensity * 0.8,
                boxShadow: `0 0 10px hsl(${hue + orbitIndex * 60 + elemIndex * 20}, 70%, 50%)`,
              }}
            />
          );
        });
      })}
    </>
  );
};

/**
 * Simplified beat-only visualization
 */
export const BeatPulse: React.FC<{ audioSrc?: string }> = ({ audioSrc = "synthetic" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { isOnBeat, beatProgress } = useBeats(audioSrc);

  const scale = spring({
    frame: isOnBeat ? frame : frame - 10,
    fps,
    config: {
      damping: 10,
      stiffness: 200,
    },
  });

  return (
    <Box
      sx={{
        width: 100,
        height: 100,
        borderRadius: "50%",
        backgroundColor: "white",
        transform: `scale(${isOnBeat ? scale : 1})`,
        opacity: 0.8 + beatProgress * 0.2,
      }}
    />
  );
};

/**
 * Text that appears on rhythm
 */
export const RhythmText: React.FC<{
  audioSrc?: string;
  words: string[];
}> = ({ audioSrc = "synthetic", words }) => {
  const { currentMarkers } = useAudioMarkers({ audioSrc });
  const [wordIndex, setWordIndex] = React.useState(0);

  React.useEffect(() => {
    if (currentMarkers.some((m) => m.type === "beat")) {
      setWordIndex((prev) => (prev + 1) % words.length);
    }
  }, [currentMarkers, words.length]);

  return (
    <Typography
      variant="h2"
      sx={{
        color: "white",
        fontWeight: "bold",
        textAlign: "center",
        opacity: currentMarkers.length > 0 ? 1 : 0.3,
        transition: "opacity 0.1s ease",
      }}
    >
      {words[wordIndex]}
    </Typography>
  );
};

/**
 * Dynamic content renderer using render props pattern
 */
export const AudioTriggers: React.FC<{
  audioSrc?: string;
  children: (markers: TimelineMarker[]) => React.ReactNode;
}> = ({ audioSrc = "synthetic", children }) => {
  const { currentMarkers, isLoading } = useAudioMarkers({ audioSrc });

  if (isLoading) return null;

  return <>{children(currentMarkers)}</>;
};