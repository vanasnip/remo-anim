import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from "remotion";
import {
  Card,
  CardContent,
  Typography,
  Box,
  Paper,
  LinearProgress,
} from "@mui/material";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import * as React from "react";
import VideoWithErrorHandling from "../../components/VideoWithErrorHandling";
import {
  VideoErrorFallback,
  VideoLoadingFallback,
} from "../../components/VideoFallbacks";
import { RemotionVideoErrorBoundary } from "../../components/VideoErrorBoundary";
import { useErrorHandler } from "../../hooks/useErrorHandler";
import { useVideoLoader } from "../../hooks/useVideoLoader";

const theme = createTheme({
  palette: {
    primary: {
      main: "#2e7d32", // Green for educational content
    },
    secondary: {
      main: "#1565c0", // Blue for highlights
    },
    background: {
      default: "#f5f5f5",
    },
  },
  typography: {
    fontFamily: '"Inter", "Helvetica", "Arial", sans-serif',
  },
});

export type MathLessonProps = {
  title: string;
  subtitle?: string;
  chapters: {
    title: string;
    description: string;
    manimVideo?: string;
    keyPoints: string[];
    duration: number; // in frames
  }[];
  instructor?: string;
};

export const MathLesson: React.FC<MathLessonProps> = ({
  title = "Mathematical Concepts",
  subtitle = "An Interactive Learning Experience",
  chapters = [
    {
      title: "Introduction to Sine Waves",
      description: "Understanding periodic functions and their properties",
      manimVideo: "/assets/manim/SineWaveAnimation_480p15_20250902_220341.mp4",
      keyPoints: [
        "Sine waves are periodic functions",
        "They oscillate between -1 and 1",
        "Period is 2π radians",
        "Used in physics, engineering, and signal processing",
      ],
      duration: 450, // 15 seconds at 30fps
    },
  ],
  instructor = "Professor Math",
}) => {
  // Error handling for the component
  const { handleError } = useErrorHandler({
    onError: (error, context) => {
      console.error(`MathLesson component error (${context}):`, error);
    },
  });

  // Video loader for the first chapter (most common case)
  // For multiple chapters, we'll use a different approach to avoid hooks rule violations
  const firstChapterVideoLoader = useVideoLoader(
    chapters[0]?.manimVideo || "",
    {
      maxRetries: 3,
      fallbackPaths: [
        "/assets/manim/fallback-math-demo.mp4",
        "/assets/video/educational-placeholder.mp4",
      ],
      enableProgressiveLoading: true,
      preloadMetadata: true,
    },
  );

  // Validate props with error handling
  React.useEffect(() => {
    try {
      if (!title || title.trim().length === 0) {
        throw new Error("Title is required and cannot be empty");
      }
      if (!chapters || chapters.length === 0) {
        throw new Error("At least one chapter is required");
      }
      chapters.forEach((chapter, index) => {
        if (!chapter.title || chapter.title.trim().length === 0) {
          throw new Error(`Chapter ${index + 1} title is required`);
        }
        if (!chapter.keyPoints || chapter.keyPoints.length === 0) {
          throw new Error(
            `Chapter ${index + 1} must have at least one key point`,
          );
        }
        if (chapter.duration <= 0) {
          throw new Error(`Chapter ${index + 1} duration must be positive`);
        }
      });
    } catch (error) {
      handleError(error as Error, "Props validation");
    }
  }, [title, chapters, handleError]);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Calculate current chapter based on frame
  // let currentChapterIndex = 0; // Currently unused - commented out to fix TypeScript warning
  // let frameOffset = 0; // Currently unused - commented out to fix TypeScript warning
  let accumulatedFrames = 90; // After intro (3 seconds)

  for (let i = 0; i < chapters.length; i++) {
    if (
      frame >= accumulatedFrames &&
      frame < accumulatedFrames + chapters[i].duration
    ) {
      // currentChapterIndex = i; // Currently unused - commented out to fix TypeScript warning
      // frameOffset = frame - accumulatedFrames; // Currently unused - commented out to fix TypeScript warning
      break;
    }
    accumulatedFrames += chapters[i].duration;
  }

  // const currentChapter = chapters[currentChapterIndex]; // Currently unused

  // Animation values
  const titleScale = spring({
    frame: frame - 10,
    fps,
    config: {
      damping: 12,
    },
  });

  const titleOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: "clamp",
  });

  const subtitleOpacity = interpolate(frame, [20, 50], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Progress bar calculation
  const totalDuration = 90 + chapters.reduce((acc, ch) => acc + ch.duration, 0);
  const progress = (frame / totalDuration) * 100;

  return (
    <ThemeProvider theme={theme}>
      <AbsoluteFill
        style={{
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        }}
      >
        {/* Title Sequence (0-3 seconds / 0-90 frames) */}
        <Sequence from={0} durationInFrames={90}>
          <AbsoluteFill
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              gap: "1rem",
            }}
          >
            <Typography
              variant="h1"
              component="h1"
              style={{
                transform: `scale(${titleScale})`,
                opacity: titleOpacity,
                fontSize: "4.5rem",
                fontWeight: 700,
                color: "white",
                textAlign: "center",
                textShadow: "0 4px 20px rgba(0,0,0,0.3)",
              }}
            >
              {title}
            </Typography>

            {subtitle && (
              <Typography
                variant="h3"
                component="p"
                style={{
                  fontSize: "1.8rem",
                  fontWeight: 300,
                  color: "rgba(255,255,255,0.9)",
                  textAlign: "center",
                  opacity: subtitleOpacity,
                }}
              >
                {subtitle}
              </Typography>
            )}

            <Typography
              variant="body1"
              style={{
                fontSize: "1rem",
                color: "rgba(255,255,255,0.8)",
                opacity: interpolate(frame, [50, 70], [0, 1]),
              }}
            >
              Instructor: {instructor}
            </Typography>
          </AbsoluteFill>
        </Sequence>

        {/* Chapter Content */}
        {chapters.map((chapter, chapterIndex) => {
          const chapterStart =
            90 +
            chapters
              .slice(0, chapterIndex)
              .reduce((acc, ch) => acc + ch.duration, 0);

          return (
            <Sequence
              key={chapterIndex}
              from={chapterStart}
              durationInFrames={chapter.duration}
            >
              <AbsoluteFill>
                {/* Chapter Title Bar */}
                <Box
                  sx={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    backgroundColor: "rgba(0,0,0,0.8)",
                    p: 2,
                    zIndex: 10,
                  }}
                >
                  <Typography
                    variant="h4"
                    component="h2"
                    sx={{
                      color: "white",
                      fontWeight: 600,
                      opacity: interpolate(
                        frame - chapterStart,
                        [0, 30],
                        [0, 1],
                        { extrapolateRight: "clamp" },
                      ),
                    }}
                  >
                    Chapter {chapterIndex + 1}: {chapter.title}
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{
                      color: "rgba(255,255,255,0.8)",
                      mt: 1,
                      opacity: interpolate(
                        frame - chapterStart,
                        [15, 45],
                        [0, 1],
                        { extrapolateRight: "clamp" },
                      ),
                    }}
                  >
                    {chapter.description}
                  </Typography>
                </Box>

                {/* Main Content Area */}
                <Box
                  sx={{
                    position: "absolute",
                    top: 120,
                    left: 0,
                    right: 0,
                    bottom: 60,
                    display: "flex",
                    gap: 3,
                    p: 3,
                  }}
                >
                  {/* Video Section */}
                  {chapter.manimVideo && (
                    <Box
                      sx={{
                        flex: 2,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Paper
                        elevation={10}
                        sx={{
                          width: "100%",
                          borderRadius: 2,
                          overflow: "hidden",
                          opacity: interpolate(
                            frame - chapterStart,
                            [30, 60],
                            [0, 1],
                            { extrapolateRight: "clamp" },
                          ),
                        }}
                      >
                        <RemotionVideoErrorBoundary
                          videoPath={chapter.manimVideo}
                          compositionId={`MathLesson-Chapter-${
                            chapterIndex + 1
                          }`}
                        >
                          {/* Use first chapter's video loader for the first chapter, fallback to basic loading for others */}
                          {chapterIndex === 0 &&
                            firstChapterVideoLoader?.loading && (
                              <VideoLoadingFallback
                                width={600}
                                height={400}
                                progress={firstChapterVideoLoader?.progress}
                                message={
                                  firstChapterVideoLoader?.isRetrying
                                    ? "Retrying math animation..."
                                    : "Loading educational content..."
                                }
                                showProgress={true}
                                animated={true}
                              />
                            )}

                          {chapterIndex === 0 &&
                            firstChapterVideoLoader?.error &&
                            !firstChapterVideoLoader?.loading && (
                              <VideoErrorFallback
                                width={600}
                                height={400}
                                error={firstChapterVideoLoader?.error!}
                                onRetry={
                                  firstChapterVideoLoader?.canRetry
                                    ? firstChapterVideoLoader?.retry
                                    : undefined
                                }
                                retryCount={firstChapterVideoLoader?.retryCount}
                                maxRetries={3}
                                canRetry={firstChapterVideoLoader?.canRetry}
                                videoPath={chapter.manimVideo}
                                showDetails={true}
                              />
                            )}

                          {chapterIndex === 0 &&
                            firstChapterVideoLoader?.videoUrl &&
                            !firstChapterVideoLoader?.loading &&
                            !firstChapterVideoLoader?.error && (
                              <VideoWithErrorHandling
                                src={firstChapterVideoLoader?.videoUrl!}
                                startFrom={0}
                                endAt={chapter.duration}
                                maxRetries={1} // Lower retries since videoLoader already handled retries
                                onLoadError={(error) => {
                                  handleError(
                                    error,
                                    `Chapter ${
                                      chapterIndex + 1
                                    } video playback`,
                                  );
                                }}
                                fallbackContent={
                                  <VideoErrorFallback
                                    width={600}
                                    height={400}
                                    error={
                                      new Error(
                                        "Math animation playback failed after successful load",
                                      )
                                    }
                                    onRetry={firstChapterVideoLoader?.retry}
                                    canRetry={firstChapterVideoLoader?.canRetry}
                                    videoPath={chapter.manimVideo}
                                    showDetails={false}
                                  />
                                }
                              />
                            )}

                          {/* For non-first chapters, use the existing VideoWithErrorHandling with enhanced fallback */}
                          {chapterIndex > 0 && chapter.manimVideo && (
                            <VideoWithErrorHandling
                              src={chapter.manimVideo}
                              startFrom={0}
                              endAt={chapter.duration}
                              maxRetries={3}
                              onLoadError={(error) => {
                                handleError(
                                  error,
                                  `Chapter ${chapterIndex + 1} video loading`,
                                );
                              }}
                              fallbackContent={
                                <VideoErrorFallback
                                  width={600}
                                  height={400}
                                  error={
                                    new Error(
                                      "Math animation could not be loaded",
                                    )
                                  }
                                  onRetry={undefined}
                                  canRetry={false}
                                  videoPath={chapter.manimVideo}
                                  showDetails={true}
                                />
                              }
                            />
                          )}

                          {/* Fallback when no video is available but still showing a placeholder */}
                          {!chapter.manimVideo && (
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                minHeight: 400,
                                bgcolor: "rgba(0,0,0,0.05)",
                                borderRadius: 2,
                                flexDirection: "column",
                                gap: 2,
                                border: "2px dashed rgba(0,0,0,0.1)",
                              }}
                            >
                              <Typography variant="h5" color="text.secondary">
                                📚 Mathematical Concepts
                              </Typography>
                              <Typography
                                variant="body1"
                                color="text.secondary"
                                textAlign="center"
                                sx={{ maxWidth: 400 }}
                              >
                                Interactive mathematical visualizations would
                                appear here - dynamic animations to help
                                understand complex concepts like{" "}
                                {chapter.title.toLowerCase()}.
                              </Typography>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                Add your Manim animation to bring mathematical
                                concepts to life
                              </Typography>
                            </Box>
                          )}
                        </RemotionVideoErrorBoundary>
                      </Paper>
                    </Box>
                  )}

                  {/* Key Points Section */}
                  <Box
                    sx={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                    }}
                  >
                    <Card
                      elevation={5}
                      sx={{
                        backgroundColor: "rgba(255,255,255,0.95)",
                        borderRadius: 2,
                        opacity: interpolate(
                          frame - chapterStart,
                          [60, 90],
                          [0, 1],
                          { extrapolateRight: "clamp" },
                        ),
                      }}
                    >
                      <CardContent>
                        <Typography
                          variant="h5"
                          component="h3"
                          gutterBottom
                          sx={{
                            color: theme.palette.primary.main,
                            fontWeight: 600,
                            mb: 3,
                          }}
                        >
                          Key Concepts
                        </Typography>

                        {chapter.keyPoints.map((point, pointIndex) => {
                          const pointDelay = 90 + pointIndex * 30;
                          const pointOpacity = interpolate(
                            frame - chapterStart,
                            [pointDelay, pointDelay + 30],
                            [0, 1],
                            { extrapolateRight: "clamp" },
                          );

                          return (
                            <Paper
                              key={pointIndex}
                              elevation={2}
                              sx={{
                                p: 2,
                                mb: 2,
                                backgroundColor:
                                  theme.palette.secondary.main + "10",
                                borderLeft: `4px solid ${theme.palette.secondary.main}`,
                                opacity: pointOpacity,
                                transform: `translateX(${interpolate(
                                  pointOpacity,
                                  [0, 1],
                                  [20, 0],
                                )}px)`,
                              }}
                            >
                              <Typography
                                variant="body1"
                                sx={{
                                  display: "flex",
                                  alignItems: "flex-start",
                                  gap: 1,
                                }}
                              >
                                <span
                                  style={{
                                    color: theme.palette.secondary.main,
                                    fontWeight: "bold",
                                    fontSize: "1.2rem",
                                  }}
                                >
                                  {pointIndex + 1}.
                                </span>
                                {point}
                              </Typography>
                            </Paper>
                          );
                        })}
                      </CardContent>
                    </Card>
                  </Box>
                </Box>

                {/* Progress Bar */}
                <Box
                  sx={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    backgroundColor: "rgba(0,0,0,0.8)",
                    p: 2,
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <Typography
                      variant="body2"
                      sx={{ color: "white", minWidth: 120 }}
                    >
                      Chapter {chapterIndex + 1} of {chapters.length}
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={progress}
                      sx={{
                        flex: 1,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: "rgba(255,255,255,0.2)",
                        "& .MuiLinearProgress-bar": {
                          backgroundColor: theme.palette.secondary.main,
                        },
                      }}
                    />
                    <Typography
                      variant="body2"
                      sx={{ color: "white", minWidth: 60 }}
                    >
                      {Math.round(progress)}%
                    </Typography>
                  </Box>
                </Box>
              </AbsoluteFill>
            </Sequence>
          );
        })}
      </AbsoluteFill>
    </ThemeProvider>
  );
};
