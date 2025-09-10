/**
 * Example component demonstrating audio-triggered content
 * Shows how to use audio markers to trigger visual elements
 */

import React from "react";
import {
  AbsoluteFill,
  Audio,
  staticFile,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Box, Typography, CircularProgress } from "@mui/material";
import { useAudioMarkers, useBeats } from "../../audio/hooks/useAudioMarkers";
import type { TimelineMarker } from "../../audio/types";

interface AudioTriggeredContentProps {
  audioSrc: string;
  audioStartFrame?: number;
}

/**
 * Main component demonstrating flexible audio-triggered content
 */
export const AudioTriggeredContent: React.FC<AudioTriggeredContentProps> = ({
  audioSrc,
  audioStartFrame = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

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

  // Spring animation for beat pulses
  const beatScale = spring({
    frame: isOnBeat ? frame : frame - 10,
    fps,
    config: {
      damping: 15,
      stiffness: 300,
    },
  });

  // Color based on beat progress
  const hue = interpolate(beatProgress, [0, 1], [200, 280]);

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

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0a" }}>
      {/* Audio element */}
      <Audio src={staticFile(audioSrc)} startFrom={audioStartFrame} />

      {/* BPM Display */}
      {bpm && (
        <Box
          sx={{
            position: "absolute",
            top: 20,
            left: 20,
            color: "white",
            fontFamily: "monospace",
          }}
        >
          BPM: {Math.round(bpm)}
        </Box>
      )}

      {/* Beat Progress Bar */}
      <Box
        sx={{
          position: "absolute",
          bottom: 20,
          left: 20,
          right: 20,
          height: 4,
          backgroundColor: "rgba(255, 255, 255, 0.1)",
          borderRadius: 2,
        }}
      >
        <Box
          sx={{
            width: `${beatProgress * 100}%`,
            height: "100%",
            backgroundColor: `hsl(${hue}, 70%, 50%)`,
            borderRadius: 2,
            transition: "none",
          }}
        />
      </Box>

      {/* Central beat indicator */}
      <Box
        sx={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: `translate(-50%, -50%) scale(${isOnBeat ? beatScale : 1})`,
          width: 200,
          height: 200,
          borderRadius: "50%",
          backgroundColor: isOnDownbeat
            ? "rgba(255, 100, 100, 0.3)"
            : "rgba(100, 200, 255, 0.3)",
          border: `4px solid ${isOnBeat ? "white" : "transparent"}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "background-color 0.1s ease",
        }}
      >
        <Typography
          variant="h3"
          sx={{
            color: "white",
            fontWeight: "bold",
            opacity: isOnBeat ? 1 : 0.3,
          }}
        >
          {isOnDownbeat ? "!" : "•"}
        </Typography>
      </Box>

      {/* Onset indicators */}
      {isOnOnset && (
        <Box
          sx={{
            position: "absolute",
            top: "30%",
            left: "50%",
            transform: "translateX(-50%)",
            color: "yellow",
            fontSize: "2rem",
            fontWeight: "bold",
            animation: "fadeOut 0.3s ease-out",
          }}
        >
          ♪
        </Box>
      )}

      {/* Render current markers */}
      {currentMarkers.map((marker, index) => (
        <MarkerVisual
          key={`${marker.frame}-${index}`}
          marker={marker}
          index={index}
        />
      ))}

      <style>
        {`
          @keyframes fadeOut {
            from { opacity: 1; transform: translateX(-50%) scale(1); }
            to { opacity: 0; transform: translateX(-50%) scale(1.5); }
          }
        `}
      </style>
    </AbsoluteFill>
  );
};

/**
 * Individual marker visualization component
 */
const MarkerVisual: React.FC<{ marker: TimelineMarker; index: number }> = ({
  marker,
  index,
}) => {
  const positions = [
    { top: "20%", left: "20%" },
    { top: "20%", right: "20%" },
    { bottom: "20%", left: "20%" },
    { bottom: "20%", right: "20%" },
  ];

  const position = positions[index % positions.length];
  const colors = {
    beat: "#4FC3F7",
    onset: "#FFD54F",
    downbeat: "#FF7043",
    pattern: "#AB47BC",
    harmonic: "#66BB6A",
  };

  return (
    <Box
      sx={{
        position: "absolute",
        ...position,
        width: 40,
        height: 40,
        borderRadius: marker.type === "beat" ? "50%" : "0%",
        backgroundColor: colors[marker.type] || "#ffffff",
        opacity: marker.confidence || 0.8,
        transform: `scale(${marker.strength || 1})`,
        animation: "pulse 0.3s ease-out",
      }}
    />
  );
};

/**
 * Simplified beat-only visualization
 */
export const BeatPulse: React.FC<{ audioSrc: string }> = ({ audioSrc }) => {
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
  audioSrc: string;
  words: string[];
}> = ({ audioSrc, words }) => {
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
  audioSrc: string;
  children: (markers: TimelineMarker[]) => React.ReactNode;
}> = ({ audioSrc, children }) => {
  const { currentMarkers, isLoading } = useAudioMarkers({ audioSrc });

  if (isLoading) return null;

  return <>{children(currentMarkers)}</>;
};
