import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
  Video,
} from "remotion";
import {
  Typography,
  Box,
  Paper,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Chip,
} from "@mui/material";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import * as React from "react";
import { staticFile } from "remotion";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

const theme = createTheme({
  palette: {
    primary: {
      main: "#4caf50", // Green for success/completion
    },
    secondary: {
      main: "#ff9800", // Orange for highlights
    },
    background: {
      default: "#1e1e1e",
    },
  },
  typography: {
    fontFamily: '"Fira Code", "Consolas", "Monaco", monospace',
  },
});

export const PythonManimTutorial: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Tutorial steps with timing
  const steps = [
    {
      title: "Introduction",
      duration: 90, // 3 seconds
      content: "Welcome to Manim Python Tutorial",
    },
    {
      title: "Step 1: Import Manim",
      duration: 150, // 5 seconds
      code: `from manim import *
import numpy as np`,
      explanation:
        "Import the Manim library and NumPy for mathematical operations",
    },
    {
      title: "Step 2: Create a Scene Class",
      duration: 300, // 10 seconds
      code: `class MyFirstAnimation(Scene):
    def construct(self):
        # Your animation code goes here
        pass`,
      explanation: "Every Manim animation starts with a Scene class",
    },
    {
      title: "Step 3: Add Objects",
      duration: 300, // 10 seconds
      code: `def construct(self):
    # Create a circle
    circle = Circle(radius=2, color=BLUE)

    # Create a square
    square = Square(side_length=3, color=RED)

    # Add to scene
    self.play(Create(circle))
    self.play(Transform(circle, square))`,
      explanation: "Create geometric objects and animate them",
    },
    {
      title: "Step 4: Run the Animation",
      duration: 240, // 8 seconds
      terminal: `$ manim -pql my_animation.py MyFirstAnimation

Manim Community v0.19.0
Rendering animation...
File ready at: media/videos/my_animation/480p15/MyFirstAnimation.mp4`,
      explanation: "Execute your animation with the manim command",
    },
    {
      title: "Step 5: View Results",
      duration: 180, // 6 seconds
      video: "/assets/manim/TestAnimation.mp4",
      explanation: "Your animation is ready to view!",
    },
  ];

  // Calculate current step
  let currentStep = 0;
  let accumulatedFrames = 0;
  for (let i = 0; i < steps.length; i++) {
    if (
      frame >= accumulatedFrames &&
      frame < accumulatedFrames + steps[i].duration
    ) {
      currentStep = i;
      break;
    }
    accumulatedFrames += steps[i].duration;
  }

  const stepOffset =
    frame - steps.slice(0, currentStep).reduce((acc, s) => acc + s.duration, 0);

  // Animation values
  const fadeIn = interpolate(stepOffset, [0, 30], [0, 1], {
    extrapolateRight: "clamp",
  });

  const slideIn = interpolate(stepOffset, [0, 30], [30, 0], {
    extrapolateRight: "clamp",
  });

  const codeReveal = spring({
    frame: stepOffset - 15,
    fps,
    config: {
      damping: 20,
    },
  });

  return (
    <ThemeProvider theme={theme}>
      <AbsoluteFill
        style={{
          background: "linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)",
        }}
      >
        {/* Header */}
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            backgroundColor: "rgba(0,0,0,0.9)",
            p: 3,
            borderBottom: "3px solid #4caf50",
          }}
        >
          <Typography
            variant="h3"
            sx={{
              color: "white",
              fontWeight: 700,
              textAlign: "center",
            }}
          >
            🐍 Python Manim Tutorial
          </Typography>
          <Typography
            variant="subtitle1"
            sx={{
              color: "rgba(255,255,255,0.8)",
              textAlign: "center",
              mt: 1,
            }}
          >
            Learn to create mathematical animations with code
          </Typography>
        </Box>

        {/* Main Content Area */}
        <Box
          sx={{
            position: "absolute",
            top: 140,
            left: 0,
            right: 0,
            bottom: 80,
            display: "flex",
            gap: 3,
            p: 3,
          }}
        >
          {/* Left Panel - Steps */}
          <Box
            sx={{
              flex: "0 0 350px",
              backgroundColor: "rgba(255,255,255,0.95)",
              borderRadius: 2,
              p: 2,
              overflowY: "auto",
            }}
          >
            <Stepper activeStep={currentStep} orientation="vertical">
              {steps.map((step, index) => (
                <Step key={index}>
                  <StepLabel
                    StepIconProps={{
                      sx: {
                        color:
                          index < currentStep
                            ? "#4caf50"
                            : index === currentStep
                              ? "#ff9800"
                              : "#ccc",
                      },
                    }}
                  >
                    <Typography
                      sx={{
                        fontWeight: index === currentStep ? 700 : 400,
                        color: index === currentStep ? "#1e3c72" : "#666",
                      }}
                    >
                      {step.title}
                    </Typography>
                  </StepLabel>
                  {index === currentStep && (
                    <StepContent>
                      <Typography
                        variant="body2"
                        sx={{
                          opacity: fadeIn,
                          transform: `translateY(${slideIn}px)`,
                        }}
                      >
                        {step.explanation}
                      </Typography>
                    </StepContent>
                  )}
                </Step>
              ))}
            </Stepper>
          </Box>

          {/* Right Panel - Code/Content */}
          <Box
            sx={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            {/* Current Step Title */}
            <Paper
              elevation={5}
              sx={{
                p: 2,
                backgroundColor: "rgba(0,0,0,0.8)",
                opacity: fadeIn,
                transform: `translateX(${-slideIn}px)`,
              }}
            >
              <Typography
                variant="h4"
                sx={{
                  color: "#4caf50",
                  fontWeight: 700,
                }}
              >
                {steps[currentStep].title}
              </Typography>
            </Paper>

            {/* Code Display */}
            {steps[currentStep].code && (
              <Paper
                elevation={10}
                sx={{
                  flex: 1,
                  backgroundColor: "#1e1e1e",
                  borderRadius: 2,
                  overflow: "hidden",
                  transform: `scale(${codeReveal})`,
                  opacity: codeReveal,
                }}
              >
                <Box
                  sx={{
                    backgroundColor: "#2d2d30",
                    px: 2,
                    py: 1,
                    borderBottom: "1px solid #3e3e42",
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      color: "#cccccc",
                      fontFamily: "monospace",
                    }}
                  >
                    my_animation.py
                  </Typography>
                </Box>
                <Box sx={{ p: 2 }}>
                  <SyntaxHighlighter
                    language="python"
                    style={vscDarkPlus}
                    customStyle={{
                      margin: 0,
                      padding: "1rem",
                      fontSize: "1.1rem",
                      backgroundColor: "transparent",
                    }}
                  >
                    {steps[currentStep].code || ""}
                  </SyntaxHighlighter>
                </Box>
              </Paper>
            )}

            {/* Terminal Output */}
            {steps[currentStep].terminal && (
              <Paper
                elevation={10}
                sx={{
                  flex: 1,
                  backgroundColor: "#0c0c0c",
                  borderRadius: 2,
                  p: 2,
                  fontFamily: "monospace",
                  transform: `scale(${codeReveal})`,
                  opacity: codeReveal,
                }}
              >
                <Box
                  sx={{
                    color: "#00ff00",
                    fontSize: "1rem",
                    lineHeight: 1.6,
                  }}
                >
                  <pre style={{ margin: 0 }}>{steps[currentStep].terminal}</pre>
                </Box>
              </Paper>
            )}

            {/* Video Display */}
            {steps[currentStep].video ? (
              <Paper
                elevation={10}
                sx={{
                  flex: 1,
                  backgroundColor: "#000",
                  borderRadius: 2,
                  overflow: "hidden",
                  transform: `scale(${codeReveal})`,
                  opacity: codeReveal,
                }}
              >
                <Video
                  src={staticFile(steps[currentStep].video!)}
                  startFrom={0}
                  endAt={steps[currentStep].duration}
                  onError={(e) => {
                    console.warn("Tutorial video could not be loaded:", e);
                  }}
                />
              </Paper>
            ) : null}

            {/* Explanation Box */}
            <Paper
              elevation={3}
              sx={{
                p: 2,
                backgroundColor: "rgba(76, 175, 80, 0.1)",
                borderLeft: "4px solid #4caf50",
                opacity: interpolate(stepOffset, [30, 60], [0, 1], {
                  extrapolateRight: "clamp",
                }),
              }}
            >
              <Typography variant="body1" sx={{ color: "#333" }}>
                💡 {steps[currentStep].explanation}
              </Typography>
            </Paper>
          </Box>
        </Box>

        {/* Footer Progress */}
        <Box
          sx={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: "rgba(0,0,0,0.9)",
            p: 2,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Chip
              label={`Step ${currentStep + 1} of ${steps.length}`}
              color="primary"
              sx={{ fontWeight: 700 }}
            />
            <Box
              sx={{
                flex: 1,
                height: 8,
                backgroundColor: "rgba(255,255,255,0.2)",
                borderRadius: 4,
                overflow: "hidden",
              }}
            >
              <Box
                sx={{
                  width: `${((currentStep + 1) / steps.length) * 100}%`,
                  height: "100%",
                  backgroundColor: "#4caf50",
                  transition: "width 0.5s ease",
                }}
              />
            </Box>
            <Typography
              variant="caption"
              sx={{
                color: "white",
                fontFamily: "monospace",
              }}
            >
              Duration: 2:00
            </Typography>
          </Box>
        </Box>
      </AbsoluteFill>
    </ThemeProvider>
  );
};