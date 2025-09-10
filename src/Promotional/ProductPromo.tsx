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
  Button,
  Box,
  Stack,
  Paper,
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
      main: "#86A8E7",
    },
    secondary: {
      main: "#91EAE4",
    },
  },
  typography: {
    fontFamily: '"Inter", "Helvetica", "Arial", sans-serif',
  },
});

export type ProductPromoProps = {
  productName: string;
  features: string[];
  brandColors?: {
    primary?: string;
    secondary?: string;
  };
  tagline?: string;
  manimVideo?: string; // Optional manim video to include
};

export const ProductPromo: React.FC<ProductPromoProps> = ({
  productName = "Amazing Product",
  features = ["Fast", "Secure", "Simple", "Scalable", "Reliable"],
  brandColors,
  tagline = "The future is here",
  manimVideo,
}) => {
  // Error handling for the component
  const { handleError } = useErrorHandler({
    onError: (error, context) => {
      console.error(`ProductPromo component error (${context}):`, error);
    },
  });

  // Progressive video loading with fallbacks
  const videoLoader = useVideoLoader(manimVideo || "", {
    maxRetries: 3,
    fallbackPaths: [
      "/assets/manim/fallback-demo.mp4",
      "/assets/video/product-demo-placeholder.mp4",
    ],
    enableProgressiveLoading: true,
    preloadMetadata: true,
  });

  // Validate props with error handling
  React.useEffect(() => {
    try {
      if (!productName || productName.trim().length === 0) {
        throw new Error("Product name is required and cannot be empty");
      }
      if (!features || features.length === 0) {
        throw new Error("At least one feature is required");
      }
      if (features.some((feature) => !feature || feature.trim().length === 0)) {
        throw new Error("All features must have valid text");
      }
    } catch (error) {
      handleError(error as Error, "Props validation");
    }
  }, [productName, features, handleError]);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Custom theme with brand colors
  const customTheme = React.useMemo(
    () =>
      createTheme({
        ...theme,
        palette: {
          ...theme.palette,
          primary: {
            main: brandColors?.primary || "#86A8E7",
          },
          secondary: {
            main: brandColors?.secondary || "#91EAE4",
          },
        },
      }),
    [brandColors],
  );

  // Animation values for 30-second timeline

  // Title entrance (0-3 seconds / frames 0-90)
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

  // Subtitle fade in (2-4 seconds / frames 60-120)
  const subtitleOpacity = interpolate(frame, [60, 90], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Features card (5-15 seconds / frames 150-450)
  const cardOpacity = interpolate(frame, [150, 180], [0, 1], {
    extrapolateRight: "clamp",
  });

  const cardY = interpolate(frame, [150, 180], [50, 0], {
    extrapolateRight: "clamp",
  });

  // Manim video integration (15-25 seconds / frames 450-750)
  const videoOpacity = interpolate(frame, [450, 480], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Call to action (25-30 seconds / frames 750-900)
  const ctaScale = spring({
    frame: frame - 750,
    fps,
    config: { damping: 10 },
  });

  return (
    <ThemeProvider theme={customTheme}>
      <AbsoluteFill
        style={{
          background: `linear-gradient(135deg, ${customTheme.palette.primary.main}22 0%, ${customTheme.palette.secondary.main}22 100%)`,
        }}
      >
        {/* Opening Title Sequence (0-5 seconds) */}
        <Sequence from={0} durationInFrames={150}>
          <AbsoluteFill
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              gap: "2rem",
            }}
          >
            <Typography
              variant="h1"
              component="h1"
              style={{
                transform: `scale(${titleScale})`,
                opacity: titleOpacity,
                fontSize: "6rem",
                fontWeight: 700,
                background: `linear-gradient(90deg, ${customTheme.palette.primary.main} 0%, ${customTheme.palette.secondary.main} 100%)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                textAlign: "center",
                textShadow: "0 4px 20px rgba(0,0,0,0.1)",
              }}
            >
              {productName}
            </Typography>

            {tagline && (
              <Typography
                variant="h3"
                component="p"
                style={{
                  fontSize: "2rem",
                  fontWeight: 300,
                  color: "#555",
                  textAlign: "center",
                  opacity: subtitleOpacity,
                }}
              >
                {tagline}
              </Typography>
            )}
          </AbsoluteFill>
        </Sequence>

        {/* Features Showcase (5-15 seconds) */}
        <Sequence from={150} durationInFrames={300}>
          <AbsoluteFill
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: cardOpacity,
              transform: `translateY(${cardY}px)`,
            }}
          >
            <Card
              elevation={10}
              sx={{
                width: "85%",
                maxWidth: 900,
                borderRadius: 4,
                background: "rgba(255, 255, 255, 0.95)",
                backdropFilter: "blur(10px)",
              }}
            >
              <CardContent sx={{ p: 6 }}>
                <Typography
                  variant="h2"
                  component="h2"
                  gutterBottom
                  sx={{ mb: 5, textAlign: "center", color: "text.primary" }}
                >
                  Why Choose {productName}?
                </Typography>
                <Stack spacing={3}>
                  {features.map((feature, index) => {
                    const featureDelay = index * 20; // Stagger by 20 frames
                    const featureProgress = spring({
                      frame: frame - 180 - featureDelay,
                      fps,
                      config: { damping: 15 },
                    });

                    return (
                      <Paper
                        key={feature}
                        elevation={3}
                        sx={{
                          p: 3,
                          borderLeft: `4px solid ${customTheme.palette.primary.main}`,
                          transform: `translateX(${interpolate(
                            featureProgress,
                            [0, 1],
                            [-100, 0],
                          )}px)`,
                          opacity: featureProgress,
                        }}
                      >
                        <Typography variant="h5" component="div">
                          ✨ {feature}
                        </Typography>
                      </Paper>
                    );
                  })}
                </Stack>
              </CardContent>
            </Card>
          </AbsoluteFill>
        </Sequence>

        {/* Manim Video Integration (15-25 seconds) */}
        {manimVideo && (
          <Sequence from={450} durationInFrames={300}>
            <RemotionVideoErrorBoundary
              videoPath={manimVideo}
              compositionId="ProductPromo"
            >
              <AbsoluteFill
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: videoOpacity,
                }}
              >
                <Box
                  sx={{
                    width: "80%",
                    maxWidth: 1200,
                    borderRadius: 4,
                    overflow: "hidden",
                    boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
                  }}
                >
                  {/* Progressive Loading States */}
                  {videoLoader.loading && (
                    <VideoLoadingFallback
                      width={800}
                      height={450}
                      progress={videoLoader.progress}
                      message={
                        videoLoader.isRetrying
                          ? "Retrying video load..."
                          : "Loading product demo..."
                      }
                      showProgress={true}
                      animated={true}
                    />
                  )}

                  {videoLoader.error && !videoLoader.loading && (
                    <VideoErrorFallback
                      width={800}
                      height={450}
                      error={videoLoader.error}
                      onRetry={
                        videoLoader.canRetry ? videoLoader.retry : undefined
                      }
                      retryCount={videoLoader.retryCount}
                      maxRetries={3}
                      canRetry={videoLoader.canRetry}
                      videoPath={manimVideo}
                      showDetails={true}
                    />
                  )}

                  {videoLoader.videoUrl &&
                    !videoLoader.loading &&
                    !videoLoader.error && (
                      <VideoWithErrorHandling
                        src={videoLoader.videoUrl}
                        startFrom={0}
                        endAt={300}
                        maxRetries={1} // Lower retries since videoLoader already handled retries
                        onLoadError={(error) => {
                          handleError(error, "Promotional video playback");
                        }}
                        fallbackContent={
                          <VideoErrorFallback
                            width={800}
                            height={450}
                            error={
                              new Error(
                                "Video playback failed after successful load",
                              )
                            }
                            onRetry={videoLoader.retry}
                            canRetry={videoLoader.canRetry}
                            videoPath={manimVideo}
                            showDetails={false}
                          />
                        }
                      />
                    )}

                  {/* Fallback when no video is available but still showing a placeholder */}
                  {!manimVideo && (
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        minHeight: 450,
                        bgcolor: "rgba(0,0,0,0.05)",
                        borderRadius: 2,
                        flexDirection: "column",
                        gap: 2,
                        border: "2px dashed rgba(0,0,0,0.1)",
                      }}
                    >
                      <Typography variant="h4" color="text.secondary">
                        🎬 Interactive Demo
                      </Typography>
                      <Typography
                        variant="body1"
                        color="text.secondary"
                        textAlign="center"
                        sx={{ maxWidth: 400 }}
                      >
                        Imagine your product in action here - dynamic
                        visualizations show real capabilities and engage your
                        audience.
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Add your Manim video to bring this section to life
                      </Typography>
                    </Box>
                  )}
                </Box>

                {/* Overlay caption - only show if we have content to show */}
                {(videoLoader.videoUrl || videoLoader.loading) && (
                  <Typography
                    variant="h4"
                    component="div"
                    sx={{
                      position: "absolute",
                      bottom: 100,
                      color: "white",
                      backgroundColor: "rgba(0,0,0,0.7)",
                      px: 4,
                      py: 2,
                      borderRadius: 2,
                    }}
                  >
                    {videoLoader.loading
                      ? "Loading your demo..."
                      : "See the magic in action"}
                  </Typography>
                )}
              </AbsoluteFill>
            </RemotionVideoErrorBoundary>
          </Sequence>
        )}

        {/* Call to Action (25-30 seconds) */}
        <Sequence from={750} durationInFrames={150}>
          <AbsoluteFill
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              gap: "3rem",
            }}
          >
            <Typography
              variant="h2"
              component="h2"
              style={{
                fontSize: "4rem",
                fontWeight: 600,
                color: "#333",
                textAlign: "center",
                transform: `scale(${ctaScale})`,
              }}
            >
              Ready to Get Started?
            </Typography>

            <Stack direction="row" spacing={3}>
              <Button
                variant="contained"
                size="large"
                color="primary"
                sx={{
                  fontSize: "1.5rem",
                  py: 2,
                  px: 6,
                  borderRadius: 50,
                  transform: `scale(${ctaScale})`,
                  boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
                  background: `linear-gradient(45deg, ${customTheme.palette.primary.main} 30%, ${customTheme.palette.secondary.main} 90%)`,
                }}
              >
                Start Free Trial
              </Button>

              <Button
                variant="outlined"
                size="large"
                color="primary"
                sx={{
                  fontSize: "1.5rem",
                  py: 2,
                  px: 6,
                  borderRadius: 50,
                  transform: `scale(${ctaScale * 0.9})`,
                  borderWidth: 2,
                }}
              >
                Learn More
              </Button>
            </Stack>

            <Typography
              variant="body1"
              style={{
                fontSize: "1.2rem",
                color: "#666",
                opacity: interpolate(frame, [800, 850], [0, 1]),
              }}
            >
              No credit card required • Setup in minutes
            </Typography>
          </AbsoluteFill>
        </Sequence>
      </AbsoluteFill>
    </ThemeProvider>
  );
};
