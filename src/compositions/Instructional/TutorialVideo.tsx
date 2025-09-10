import * as React from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Audio,
  Video,
  staticFile,
} from "remotion";
import {
  Box,
  Typography,
  Paper,
  Stepper,
  Step,
  StepLabel,
  LinearProgress,
  Card,
  Alert,
  IconButton,
} from "@mui/material";
import {
  Terminal,
  CheckCircle,
  Info,
  ContentCopy,
  Keyboard,
} from "@mui/icons-material";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

interface CodeSnippet {
  language: string;
  code: string;
  filename?: string;
  highlights?: number[]; // Line numbers to highlight
  startLine?: number;
}

interface TutorialStep {
  title: string;
  description: string;
  duration: number; // in frames
  codeSnippet?: CodeSnippet;
  terminalOutput?: string;
  keyboardShortcut?: string;
  tipText?: string;
  manimVideo?: string; // Optional manim visualization
  voiceOverAudio?: string; // Audio file for this step
}

export interface TutorialVideoProps {
  title: string;
  subtitle?: string;
  author?: string;
  steps: TutorialStep[];
  backgroundMusic?: string;
  theme?: {
    primaryColor?: string;
    secondaryColor?: string;
    codeTheme?: "dark" | "light";
  };
}

const CodeDisplay: React.FC<{
  snippet: CodeSnippet;
  frame: number;
  startFrame: number;
  duration: number;
}> = ({ snippet, frame, startFrame, duration }) => {
  const relativeFrame = frame - startFrame;

  // Animate code appearance with typing effect
  const progress = interpolate(
    relativeFrame,
    [0, Math.min(30, duration / 2)],
    [0, 1],
    { extrapolateRight: "clamp" },
  );

  const visibleCode = snippet.code.substring(
    0,
    Math.floor(snippet.code.length * progress),
  );

  const opacity = interpolate(relativeFrame, [0, 10], [0, 1]);

  return (
    <Card
      sx={{
        backgroundColor: "rgba(30, 30, 30, 0.95)",
        borderRadius: 2,
        overflow: "hidden",
        opacity,
      }}
    >
      {snippet.filename && (
        <Box
          sx={{
            backgroundColor: "rgba(40, 40, 40, 1)",
            padding: "8px 16px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Typography
            variant="caption"
            sx={{ color: "#888", fontFamily: "monospace" }}
          >
            {snippet.filename}
          </Typography>
          <IconButton size="small" sx={{ color: "#888" }}>
            <ContentCopy fontSize="small" />
          </IconButton>
        </Box>
      )}
      <Box sx={{ padding: 2 }}>
        <SyntaxHighlighter
          language={snippet.language}
          style={vscDarkPlus}
          showLineNumbers={true}
          startingLineNumber={snippet.startLine || 1}
          wrapLines={true}
          lineProps={(lineNumber) => ({
            style: {
              backgroundColor: snippet.highlights?.includes(lineNumber)
                ? "rgba(255, 235, 59, 0.1)"
                : "transparent",
              display: "block",
              width: "100%",
            },
          })}
        >
          {visibleCode}
        </SyntaxHighlighter>
      </Box>
    </Card>
  );
};

const TerminalOutput: React.FC<{
  output: string;
  frame: number;
  startFrame: number;
}> = ({ output, frame, startFrame }) => {
  const relativeFrame = frame - startFrame;

  const typewriterProgress = interpolate(relativeFrame, [0, 60], [0, 1], {
    extrapolateRight: "clamp",
  });

  const visibleOutput = output.substring(
    0,
    Math.floor(output.length * typewriterProgress),
  );

  const cursorOpacity = Math.floor(relativeFrame / 15) % 2;

  return (
    <Paper
      sx={{
        backgroundColor: "#0a0a0a",
        color: "#00ff00",
        padding: 2,
        fontFamily: "monospace",
        borderRadius: 1,
        border: "1px solid #00ff00",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
        <Terminal sx={{ color: "#00ff00", mr: 1 }} />
        <Typography variant="caption" sx={{ color: "#00ff00" }}>
          Terminal
        </Typography>
      </Box>
      <Typography
        component="pre"
        sx={{
          margin: 0,
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
        }}
      >
        {visibleOutput}
        <span style={{ opacity: cursorOpacity }}>█</span>
      </Typography>
    </Paper>
  );
};

const StepIndicator: React.FC<{
  currentStep: number;
  totalSteps: number;
  stepTitles: string[];
}> = ({ currentStep, totalSteps, stepTitles }) => {
  return (
    <Box sx={{ width: "100%", mb: 2 }}>
      <Stepper activeStep={currentStep} alternativeLabel>
        {stepTitles.map((title, index) => (
          <Step key={index} completed={index < currentStep}>
            <StepLabel>{title}</StepLabel>
          </Step>
        ))}
      </Stepper>
      <LinearProgress
        variant="determinate"
        value={(currentStep / totalSteps) * 100}
        sx={{ mt: 2, height: 6, borderRadius: 3 }}
      />
    </Box>
  );
};

export const TutorialVideo: React.FC<TutorialVideoProps> = ({
  title,
  subtitle,
  author,
  steps,
  backgroundMusic,
  theme = {},
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const {
    primaryColor = "#1976d2",
    // secondaryColor = "#42a5f5", // Currently unused
    // codeTheme = "dark", // Currently unused
  } = theme;

  // Calculate cumulative start frames for each step
  let cumulativeFrames = 0;
  const stepStartFrames = steps.map((step) => {
    const startFrame = cumulativeFrames;
    cumulativeFrames += step.duration;
    return startFrame;
  });

  // Determine current step
  const currentStepIndex = stepStartFrames.findIndex((startFrame, index) => {
    const nextStartFrame = stepStartFrames[index + 1] || durationInFrames;
    return frame >= startFrame && frame < nextStartFrame;
  });

  const currentStep = steps[currentStepIndex];
  const currentStepStartFrame = stepStartFrames[currentStepIndex];

  // Title animation
  const titleScale = spring({
    frame: frame - 0,
    fps,
    from: 0,
    to: 1,
    config: {
      damping: 12,
      stiffness: 200,
    },
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#f5f5f5",
        padding: 40,
      }}
    >
      {/* Background Music */}
      {backgroundMusic && (
        <Audio src={staticFile(backgroundMusic)} volume={0.1} />
      )}

      {/* Header */}
      <Box
        sx={{
          position: "absolute",
          top: 20,
          left: 40,
          right: 40,
          zIndex: 10,
        }}
      >
        <Typography
          variant="h3"
          sx={{
            fontWeight: "bold",
            color: primaryColor,
            transform: `scale(${titleScale})`,
            mb: 1,
          }}
        >
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="h5" sx={{ color: "#666" }}>
            {subtitle}
          </Typography>
        )}
        {author && (
          <Typography variant="body2" sx={{ color: "#888", mt: 1 }}>
            by {author}
          </Typography>
        )}
      </Box>

      {/* Progress Indicator */}
      <Box
        sx={{
          position: "absolute",
          top: 120,
          left: 40,
          right: 40,
        }}
      >
        <StepIndicator
          currentStep={currentStepIndex}
          totalSteps={steps.length}
          stepTitles={steps.map((s) => s.title)}
        />
      </Box>

      {/* Main Content Area */}
      <Box
        sx={{
          position: "absolute",
          top: 220,
          left: 40,
          right: 40,
          bottom: 40,
          display: "flex",
          gap: 3,
        }}
      >
        {/* Left Panel - Instructions */}
        <Box sx={{ flex: "0 0 40%" }}>
          {currentStep && (
            <Sequence
              from={currentStepStartFrame}
              durationInFrames={currentStep.duration}
            >
              <Box>
                <Paper
                  elevation={3}
                  sx={{
                    padding: 3,
                    backgroundColor: "white",
                    mb: 2,
                  }}
                >
                  <Typography
                    variant="h5"
                    sx={{
                      fontWeight: "bold",
                      color: primaryColor,
                      mb: 2,
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <CheckCircle sx={{ mr: 1 }} />
                    {currentStep.title}
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{ color: "#333", lineHeight: 1.6 }}
                  >
                    {currentStep.description}
                  </Typography>
                </Paper>

                {/* Keyboard Shortcut */}
                {currentStep.keyboardShortcut && (
                  <Alert icon={<Keyboard />} severity="info" sx={{ mb: 2 }}>
                    Keyboard shortcut:{" "}
                    <strong>{currentStep.keyboardShortcut}</strong>
                  </Alert>
                )}

                {/* Tip */}
                {currentStep.tipText && (
                  <Alert icon={<Info />} severity="success" sx={{ mb: 2 }}>
                    <strong>Pro Tip:</strong> {currentStep.tipText}
                  </Alert>
                )}

                {/* Voice Over */}
                {currentStep.voiceOverAudio && (
                  <Sequence from={0}>
                    <Audio src={staticFile(currentStep.voiceOverAudio)} />
                  </Sequence>
                )}
              </Box>
            </Sequence>
          )}
        </Box>

        {/* Right Panel - Code/Output */}
        <Box sx={{ flex: "1 1 60%" }}>
          {currentStep && (
            <Sequence
              from={currentStepStartFrame}
              durationInFrames={currentStep.duration}
            >
              <Box>
                {/* Code Snippet */}
                {currentStep.codeSnippet && (
                  <Box sx={{ mb: 3 }}>
                    <CodeDisplay
                      snippet={currentStep.codeSnippet}
                      frame={frame}
                      startFrame={currentStepStartFrame}
                      duration={currentStep.duration}
                    />
                  </Box>
                )}

                {/* Terminal Output */}
                {currentStep.terminalOutput && (
                  <Box sx={{ mb: 3 }}>
                    <TerminalOutput
                      output={currentStep.terminalOutput}
                      frame={frame}
                      startFrame={currentStepStartFrame}
                    />
                  </Box>
                )}

                {/* Manim Video */}
                {currentStep.manimVideo && (
                  <Box
                    sx={{
                      position: "relative",
                      borderRadius: 2,
                      overflow: "hidden",
                      boxShadow: 3,
                    }}
                  >
                    <Video
                      src={staticFile(currentStep.manimVideo)}
                      style={{
                        width: "100%",
                        height: "auto",
                      }}
                    />
                  </Box>
                )}
              </Box>
            </Sequence>
          )}
        </Box>
      </Box>

      {/* Footer */}
      <Box
        sx={{
          position: "absolute",
          bottom: 20,
          left: 40,
          right: 40,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Typography variant="caption" sx={{ color: "#888" }}>
          Step {currentStepIndex + 1} of {steps.length}
        </Typography>
        <Typography variant="caption" sx={{ color: "#888" }}>
          {Math.floor(frame / fps)}s / {Math.floor(durationInFrames / fps)}s
        </Typography>
      </Box>
    </AbsoluteFill>
  );
};