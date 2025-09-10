import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from "remotion";
import { Box, Typography } from "@mui/material";
import { ThemeProvider, createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#00ffff",
    },
    secondary: {
      main: "#ff00ff",
    },
  },
});

interface Scene {
  id: string;
  title: string;
  transition: "fade" | "slide" | "zoom" | "rotate" | "glitch" | "morph";
  duration: number;
  backgroundColor: string;
}

const scenes: Scene[] = [
  {
    id: "intro",
    title: "Fade Transition",
    transition: "fade",
    duration: 90,
    backgroundColor: "#1a1a2e",
  },
  {
    id: "slide",
    title: "Slide Transition",
    transition: "slide",
    duration: 90,
    backgroundColor: "#16213e",
  },
  {
    id: "zoom",
    title: "Zoom Transition",
    transition: "zoom",
    duration: 90,
    backgroundColor: "#0f3460",
  },
  {
    id: "rotate",
    title: "Rotate Transition",
    transition: "rotate",
    duration: 90,
    backgroundColor: "#533483",
  },
  {
    id: "glitch",
    title: "Glitch Effect",
    transition: "glitch",
    duration: 90,
    backgroundColor: "#e94560",
  },
  {
    id: "morph",
    title: "Morph Transition",
    transition: "morph",
    duration: 90,
    backgroundColor: "#1f4788",
  },
];

export const TransitionShowcase: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Calculate current scene
  let currentSceneIndex = 0;
  let frameInScene = frame;
  let accumulatedFrames = 0;

  for (let i = 0; i < scenes.length; i++) {
    if (frame < accumulatedFrames + scenes[i].duration) {
      currentSceneIndex = i;
      frameInScene = frame - accumulatedFrames;
      break;
    }
    accumulatedFrames += scenes[i].duration;
  }

  const currentScene = scenes[currentSceneIndex];
  const transitionDuration = 30; // 1 second transition

  // Calculate transition progress
  const isTransitioning = frameInScene < transitionDuration;
  const transitionProgress = isTransitioning
    ? frameInScene / transitionDuration
    : 1;

  // Apply different transition effects
  const getTransitionStyle = () => {
    switch (currentScene.transition) {
      case "fade":
        return {
          opacity: interpolate(frameInScene, [0, transitionDuration], [0, 1]),
        };

      case "slide":
        return {
          transform: `translateX(${interpolate(
            frameInScene,
            [0, transitionDuration],
            [100, 0],
            {
              easing: Easing.out(Easing.cubic),
            },
          )}%)`,
        };

      case "zoom":
        return {
          transform: `scale(${spring({
            frame: frameInScene,
            fps,
            from: 0,
            to: 1,
            config: {
              damping: 15,
              stiffness: 200,
              mass: 1,
            },
          })})`,
        };

      case "rotate":
        return {
          transform: `rotate(${interpolate(
            frameInScene,
            [0, transitionDuration],
            [180, 0],
            {
              easing: Easing.out(Easing.quad),
            },
          )}deg) scale(${interpolate(
            frameInScene,
            [0, transitionDuration],
            [0.5, 1],
            {
              easing: Easing.out(Easing.quad),
            },
          )})`,
        };

      case "glitch":
        const glitchOffset = Math.sin(frameInScene * 0.5) * 10;
        const rgbShift = isTransitioning ? Math.random() * 5 : 0;
        return {
          transform: `translateX(${
            isTransitioning ? glitchOffset : 0
          }px) skewX(${isTransitioning ? Math.random() * 2 : 0}deg)`,
          filter: `hue-rotate(${rgbShift}deg)`,
          opacity: isTransitioning ? 0.8 + Math.random() * 0.2 : 1,
        };

      case "morph":
        const morphProgress = spring({
          frame: frameInScene,
          fps,
          config: {
            damping: 20,
            stiffness: 100,
          },
        });
        return {
          borderRadius: `${interpolate(morphProgress, [0, 1], [50, 0])}%`,
          transform: `scale(${morphProgress}) rotate(${interpolate(
            morphProgress,
            [0, 1],
            [-90, 0],
          )}deg)`,
        };

      default:
        return {};
    }
  };

  // Particle effects for background
  const particles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 3 + 1,
    speed: Math.random() * 2 + 1,
  }));

  return (
    <ThemeProvider theme={theme}>
      <AbsoluteFill
        style={{
          background: `linear-gradient(135deg, ${currentScene.backgroundColor} 0%, #000 100%)`,
        }}
      >
        {/* Animated particles */}
        {particles.map((particle) => {
          const particleY = interpolate(
            frame % (fps * 3),
            [0, fps * 3],
            [particle.y, particle.y - 20],
            {
              extrapolateRight: "wrap",
            },
          );

          return (
            <Box
              key={particle.id}
              sx={{
                position: "absolute",
                left: `${particle.x}%`,
                top: `${particleY}%`,
                width: particle.size * 2,
                height: particle.size * 2,
                borderRadius: "50%",
                background: "rgba(255, 255, 255, 0.3)",
                filter: "blur(1px)",
              }}
            />
          );
        })}

        {/* Main content with transition */}
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            textAlign: "center",
            ...getTransitionStyle(),
          }}
        >
          <Typography
            variant="h1"
            sx={{
              fontSize: "5rem",
              fontWeight: "bold",
              background: "linear-gradient(45deg, #00ffff, #ff00ff)",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              textShadow: "0 0 30px rgba(0, 255, 255, 0.5)",
              mb: 4,
            }}
          >
            {currentScene.title}
          </Typography>

          <Typography
            variant="h4"
            sx={{
              color: "white",
              opacity: 0.8,
              fontSize: "2rem",
            }}
          >
            Scene {currentSceneIndex + 1} of {scenes.length}
          </Typography>
        </Box>

        {/* Progress bar */}
        <Box
          sx={{
            position: "absolute",
            bottom: 30,
            left: "50%",
            transform: "translateX(-50%)",
            width: "80%",
            height: 8,
            backgroundColor: "rgba(255, 255, 255, 0.2)",
            borderRadius: 4,
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              height: "100%",
              width: `${(frameInScene / currentScene.duration) * 100}%`,
              background: "linear-gradient(90deg, #00ffff, #ff00ff)",
              borderRadius: 4,
              transition: "width 0.1s ease",
            }}
          />
        </Box>

        {/* Scene indicator dots */}
        <Box
          sx={{
            position: "absolute",
            bottom: 60,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            gap: 2,
          }}
        >
          {scenes.map((_, index) => (
            <Box
              key={index}
              sx={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                backgroundColor:
                  index === currentSceneIndex
                    ? "#00ffff"
                    : "rgba(255, 255, 255, 0.3)",
                transition: "all 0.3s ease",
                transform:
                  index === currentSceneIndex ? "scale(1.5)" : "scale(1)",
              }}
            />
          ))}
        </Box>
      </AbsoluteFill>
    </ThemeProvider>
  );
};
