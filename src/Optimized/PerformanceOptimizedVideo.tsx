/**
 * Performance-Optimized Video Composition
 * Demonstrates caching, memoization, and performance monitoring
 */

import React, { useMemo, useCallback } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Sequence,
  Img,
  staticFile,
} from "remotion";
import { Typography, Box, Paper } from "@mui/material";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { frameCache, assetCache, cached } from "../../utils/renderCache";
import {
  performanceMonitor,
  withPerformanceMonitoring,
  measurePerformance,
} from "../../utils/performanceMonitor";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#00ff88" },
    secondary: { main: "#ff0088" },
  },
});

// Memoized heavy computations
const computeComplexAnimation = cached(
  class {
    @measurePerformance
    static calculate(frame: number, total: number): number[] {
      const results: number[] = [];
      for (let i = 0; i < 10; i++) {
        const phase = (i * Math.PI * 2) / 10;
        const value = Math.sin((frame / total) * Math.PI * 2 + phase) * 50 + 50;
        results.push(value);
      }
      return results;
    }
  },
  "calculate",
  Object.getOwnPropertyDescriptor(
    class {
      static calculate(frame: number, total: number): number[] {
        const results: number[] = [];
        for (let i = 0; i < 10; i++) {
          const phase = (i * Math.PI * 2) / 10;
          const value =
            Math.sin((frame / total) * Math.PI * 2 + phase) * 50 + 50;
          results.push(value);
        }
        return results;
      }
    },
    "calculate",
  )!,
);

// Optimized particle system
const ParticleSystem: React.FC<{ count: number }> = React.memo(({ count }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  // Cache particle positions
  const particles = useMemo(() => {
    return frameCache.calculate(
      "particles",
      frame,
      { count, width, height },
      () => {
        const items = [];
        for (let i = 0; i < count; i++) {
          const seed = i * 137.5; // Golden angle
          const x = (Math.sin(seed + frame * 0.01) * width) / 2 + width / 2;
          const y =
            (Math.cos(seed * 1.3 + frame * 0.015) * height) / 2 + height / 2;
          const size = 3 + Math.sin(seed + frame * 0.02) * 2;
          const opacity = 0.3 + Math.sin(seed + frame * 0.025) * 0.3;

          items.push({ x, y, size, opacity, key: i });
        }
        return items;
      },
    );
  }, [frame, count, width, height]);

  return (
    <>
      {particles.map((particle) => (
        <div
          key={particle.key}
          style={{
            position: "absolute",
            left: particle.x,
            top: particle.y,
            width: particle.size,
            height: particle.size,
            borderRadius: "50%",
            background: `rgba(0, 255, 136, ${particle.opacity})`,
            transform: "translate(-50%, -50%)",
          }}
        />
      ))}
    </>
  );
});

// Optimized text animation
const AnimatedText: React.FC<{ text: string; delay: number }> = React.memo(
  ({ text, delay }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    // Cache spring calculations
    const progress = frameCache.spring(
      frame - delay,
      { fps, config: { damping: 12 } },
      () =>
        spring({
          frame: frame - delay,
          fps,
          config: { damping: 12 },
        }),
    );

    // Cache interpolation
    const opacity = frameCache.interpolate(
      frame,
      [delay, delay + 30],
      [0, 1],
      () =>
        interpolate(frame, [delay, delay + 30], [0, 1], {
          extrapolateRight: "clamp",
        }),
    );

    return (
      <Typography
        variant="h2"
        sx={{
          opacity,
          transform: `scale(${progress})`,
          textAlign: "center",
          fontWeight: "bold",
          background: "linear-gradient(45deg, #00ff88, #ff0088)",
          backgroundClip: "text",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        {text}
      </Typography>
    );
  },
);

// Main optimized composition
export const PerformanceOptimizedVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();

  // Start performance monitoring
  React.useEffect(() => {
    if (frame === 0) {
      performanceMonitor.startSession(durationInFrames);
    }
    performanceMonitor.markFrameStart(frame);

    return () => {
      performanceMonitor.markFrameEnd(frame);
      if (frame === durationInFrames - 1) {
        const session = performanceMonitor.endSession();
        if (session) {
          console.log(performanceMonitor.getReport());
        }
      }
    };
  }, [frame, durationInFrames]);

  // Memoized background gradient
  const backgroundStyle = useMemo(() => {
    const hue = frameCache.calculate(
      "bgHue",
      frame,
      { durationInFrames },
      () => (frame / durationInFrames) * 360,
    );

    return {
      background: `linear-gradient(${hue}deg, #0a0a0a, #1a1a2a)`,
    };
  }, [frame, durationInFrames]);

  // Cached complex calculations
  const animationValues = useMemo(() => {
    return withPerformanceMonitoring(
      () => computeComplexAnimation.calculate(frame, durationInFrames),
      "complexAnimation",
    );
  }, [frame, durationInFrames]);

  // Optimize render phases
  const showIntro = frame < fps * 3;
  const showMain = frame >= fps * 3 && frame < fps * 7;
  const showOutro = frame >= fps * 7;

  return (
    <ThemeProvider theme={theme}>
      <AbsoluteFill style={backgroundStyle}>
        {/* Optimized particle background */}
        <div style={{ position: "absolute", width: "100%", height: "100%" }}>
          <ParticleSystem count={50} />
        </div>

        {/* Intro sequence */}
        {showIntro && (
          <Sequence from={0} durationInFrames={fps * 3}>
            <AbsoluteFill
              style={{
                justifyContent: "center",
                alignItems: "center",
                padding: 40,
              }}
            >
              <AnimatedText text="Performance Optimized" delay={0} />
              <Box sx={{ height: 20 }} />
              <AnimatedText text="Remotion Rendering" delay={30} />
            </AbsoluteFill>
          </Sequence>
        )}

        {/* Main content */}
        {showMain && (
          <Sequence from={fps * 3} durationInFrames={fps * 4}>
            <AbsoluteFill
              style={{
                justifyContent: "center",
                alignItems: "center",
                padding: 40,
              }}
            >
              <Paper
                elevation={10}
                sx={{
                  padding: 4,
                  background: "rgba(0, 0, 0, 0.8)",
                  backdropFilter: "blur(10px)",
                  border: "1px solid rgba(0, 255, 136, 0.3)",
                }}
              >
                <Typography variant="h4" sx={{ mb: 3, color: "#00ff88" }}>
                  Performance Features
                </Typography>

                {/* Display animated metrics */}
                <Box sx={{ display: "grid", gap: 2 }}>
                  {[
                    "Concurrent Rendering: 8 workers",
                    "GPU Acceleration: Metal API",
                    "Frame Caching: Active",
                    "Target FPS: 1.5-2.5",
                  ].map((feature, i) => (
                    <Typography
                      key={i}
                      variant="body1"
                      sx={{
                        opacity: interpolate(
                          frame,
                          [fps * 3 + i * 10, fps * 3 + i * 10 + 10],
                          [0, 1],
                          { extrapolateRight: "clamp" },
                        ),
                        transform: `translateX(${interpolate(
                          frame,
                          [fps * 3 + i * 10, fps * 3 + i * 10 + 20],
                          [-20, 0],
                          { extrapolateRight: "clamp" },
                        )}px)`,
                      }}
                    >
                      ✓ {feature}
                    </Typography>
                  ))}
                </Box>

                {/* Performance bars visualization */}
                <Box sx={{ mt: 3 }}>
                  {animationValues.slice(0, 5).map((value, i) => (
                    <Box
                      key={i}
                      sx={{
                        height: 8,
                        background: `linear-gradient(90deg, #00ff88 ${value}%, transparent ${value}%)`,
                        border: "1px solid #00ff88",
                        borderRadius: 1,
                        mb: 1,
                        transition: "none", // Disable CSS transitions for performance
                      }}
                    />
                  ))}
                </Box>
              </Paper>
            </AbsoluteFill>
          </Sequence>
        )}

        {/* Outro */}
        {showOutro && (
          <Sequence from={fps * 7} durationInFrames={fps * 3}>
            <AbsoluteFill
              style={{
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Typography
                variant="h3"
                sx={{
                  opacity: interpolate(frame, [fps * 7, fps * 7 + 30], [0, 1], {
                    extrapolateRight: "clamp",
                  }),
                  textAlign: "center",
                  color: "#00ff88",
                }}
              >
                Optimized for Production
              </Typography>
            </AbsoluteFill>
          </Sequence>
        )}

        {/* Performance overlay (development only) */}
        {process.env.NODE_ENV === "development" && (
          <Box
            sx={{
              position: "absolute",
              top: 10,
              right: 10,
              padding: 1,
              background: "rgba(0, 0, 0, 0.8)",
              color: "#00ff88",
              fontFamily: "monospace",
              fontSize: 12,
            }}
          >
            Frame: {frame}/{durationInFrames}
          </Box>
        )}
      </AbsoluteFill>
    </ThemeProvider>
  );
};

// Default export with configuration
export const PerformanceOptimizedVideoConfig = {
  id: "PerformanceOptimizedVideo",
  component: PerformanceOptimizedVideo,
  durationInFrames: 300, // 10 seconds at 30fps
  fps: 30,
  width: 1920,
  height: 1080,
  defaultProps: {},
};
