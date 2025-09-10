import * as React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import {
  VideoLoadingFallback,
  VideoErrorFallback,
  VideoUnavailableFallback,
  ProgressiveVideoFallback,
  WithProgressiveLoading,
} from "../../components/VideoFallbacks";

const theme = createTheme();
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

describe("VideoFallbacks Components", () => {
  describe("VideoLoadingFallback", () => {
    it("should render loading state with default props", () => {
      render(
        <TestWrapper>
          <VideoLoadingFallback />
        </TestWrapper>,
      );

      expect(screen.getByText("Loading video...")).toBeInTheDocument();
      expect(screen.getByRole("progressbar")).toBeInTheDocument();
    });

    it("should show progress when provided", () => {
      render(
        <TestWrapper>
          <VideoLoadingFallback progress={50} showProgress={true} />
        </TestWrapper>,
      );

      expect(screen.getByText("50% loaded")).toBeInTheDocument();
    });

    it("should display custom message", () => {
      const customMessage = "Loading educational content...";
      render(
        <TestWrapper>
          <VideoLoadingFallback message={customMessage} />
        </TestWrapper>,
      );

      expect(screen.getByText(customMessage)).toBeInTheDocument();
    });

    it("should apply custom dimensions", () => {
      const { container } = render(
        <TestWrapper>
          <VideoLoadingFallback width={800} height={600} />
        </TestWrapper>,
      );

      const fallbackElement = container.firstChild as HTMLElement;
      expect(fallbackElement).toHaveStyle({
        width: "800px",
        height: "600px",
      });
    });

    it("should show animated skeleton when enabled", () => {
      const { container } = render(
        <TestWrapper>
          <VideoLoadingFallback animated={true} />
        </TestWrapper>,
      );

      expect(container.querySelector(".MuiSkeleton-root")).toBeInTheDocument();
    });
  });

  describe("VideoErrorFallback", () => {
    const mockError = new Error("Test error message");
    const mockRetry = jest.fn();

    beforeEach(() => {
      mockRetry.mockClear();
    });

    it("should render error state with default props", () => {
      render(
        <TestWrapper>
          <VideoErrorFallback error={mockError} />
        </TestWrapper>,
      );

      expect(screen.getByText("Video Loading Failed")).toBeInTheDocument();
      expect(
        screen.getByText(
          "An unexpected error occurred while loading the video.",
        ),
      ).toBeInTheDocument();
    });

    it("should display specific error messages for known error types", () => {
      const networkError = { ...mockError, name: "MEDIA_ERR_NETWORK" };
      render(
        <TestWrapper>
          <VideoErrorFallback error={networkError} />
        </TestWrapper>,
      );

      expect(
        screen.getByText(
          "Network error occurred. Please check your internet connection.",
        ),
      ).toBeInTheDocument();
    });

    it("should show retry button when retry is available", () => {
      render(
        <TestWrapper>
          <VideoErrorFallback
            error={mockError}
            onRetry={mockRetry}
            canRetry={true}
            retryCount={1}
            maxRetries={3}
          />
        </TestWrapper>,
      );

      const retryButton = screen.getByRole("button", { name: /retry/i });
      expect(retryButton).toBeInTheDocument();
      expect(retryButton).toHaveTextContent("Retry (1/3)");
    });

    it("should call onRetry when retry button is clicked", () => {
      render(
        <TestWrapper>
          <VideoErrorFallback
            error={mockError}
            onRetry={mockRetry}
            canRetry={true}
          />
        </TestWrapper>,
      );

      const retryButton = screen.getByRole("button", { name: /retry/i });
      fireEvent.click(retryButton);

      expect(mockRetry).toHaveBeenCalledTimes(1);
    });

    it("should not show retry button when canRetry is false", () => {
      render(
        <TestWrapper>
          <VideoErrorFallback
            error={mockError}
            onRetry={mockRetry}
            canRetry={false}
          />
        </TestWrapper>,
      );

      expect(
        screen.queryByRole("button", { name: /retry/i }),
      ).not.toBeInTheDocument();
    });

    it("should show video path when provided", () => {
      const videoPath = "/assets/video/test.mp4";
      render(
        <TestWrapper>
          <VideoErrorFallback error={mockError} videoPath={videoPath} />
        </TestWrapper>,
      );

      expect(screen.getByText(`Path: ${videoPath}`)).toBeInTheDocument();
    });

    it("should show error details when showDetails is true", () => {
      render(
        <TestWrapper>
          <VideoErrorFallback error={mockError} showDetails={true} />
        </TestWrapper>,
      );

      const detailsButton = screen.getByRole("button", { name: /details/i });
      expect(detailsButton).toBeInTheDocument();

      fireEvent.click(detailsButton);
      expect(screen.getByText(/Error.*Test error message/)).toBeInTheDocument();
    });

    it("should apply correct severity styling based on error type", () => {
      const notFoundError = { ...mockError, name: "VIDEO_NOT_FOUND" };
      render(
        <TestWrapper>
          <VideoErrorFallback error={notFoundError} showDetails={true} />
        </TestWrapper>,
      );

      const detailsButton = screen.getByRole("button", { name: /details/i });
      fireEvent.click(detailsButton);

      expect(screen.getByRole("alert")).toHaveClass("MuiAlert-standardError");
    });
  });

  describe("VideoUnavailableFallback", () => {
    it("should render unavailable state with default props", () => {
      render(
        <TestWrapper>
          <VideoUnavailableFallback />
        </TestWrapper>,
      );

      expect(screen.getByText("Video Unavailable")).toBeInTheDocument();
      expect(
        screen.getByText(
          "This video is temporarily unavailable. Please try again later.",
        ),
      ).toBeInTheDocument();
    });

    it("should display custom title and message", () => {
      const customTitle = "Educational Content Unavailable";
      const customMessage = "Math animation is being processed.";

      render(
        <TestWrapper>
          <VideoUnavailableFallback
            title={customTitle}
            message={customMessage}
          />
        </TestWrapper>,
      );

      expect(screen.getByText(customTitle)).toBeInTheDocument();
      expect(screen.getByText(customMessage)).toBeInTheDocument();
    });

    it("should show action button when onAction is provided", () => {
      const mockAction = jest.fn();
      const actionLabel = "Try Again";

      render(
        <TestWrapper>
          <VideoUnavailableFallback
            onAction={mockAction}
            actionLabel={actionLabel}
          />
        </TestWrapper>,
      );

      const actionButton = screen.getByRole("button", { name: actionLabel });
      expect(actionButton).toBeInTheDocument();

      fireEvent.click(actionButton);
      expect(mockAction).toHaveBeenCalledTimes(1);
    });

    it("should hide placeholder when showPlaceholder is false", () => {
      const { container } = render(
        <TestWrapper>
          <VideoUnavailableFallback showPlaceholder={false} />
        </TestWrapper>,
      );

      // The placeholder icon should not be visible
      expect(
        container.querySelector('[style*="opacity: 0.1"]'),
      ).not.toBeInTheDocument();
    });
  });

  describe("ProgressiveVideoFallback", () => {
    it("should render loading stage", () => {
      render(
        <TestWrapper>
          <ProgressiveVideoFallback stage="loading" />
        </TestWrapper>,
      );

      expect(screen.getByText("Locating video...")).toBeInTheDocument();
    });

    it("should render metadata stage with progress", () => {
      render(
        <TestWrapper>
          <ProgressiveVideoFallback stage="metadata" progress={75} />
        </TestWrapper>,
      );

      expect(
        screen.getByText("Loading video information..."),
      ).toBeInTheDocument();
      expect(screen.getByText("75% loaded")).toBeInTheDocument();
    });

    it("should render ready stage", () => {
      render(
        <TestWrapper>
          <ProgressiveVideoFallback stage="ready" />
        </TestWrapper>,
      );

      expect(screen.getByText("Video ready")).toBeInTheDocument();
    });

    it("should render error stage with VideoErrorFallback", () => {
      const mockError = new Error("Progressive loading failed");
      const mockRetry = jest.fn();

      render(
        <TestWrapper>
          <ProgressiveVideoFallback
            stage="error"
            error={mockError}
            onRetry={mockRetry}
            canRetry={true}
          />
        </TestWrapper>,
      );

      expect(screen.getByText("Video Loading Failed")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /retry/i }),
      ).toBeInTheDocument();
    });
  });

  describe("WithProgressiveLoading", () => {
    it("should render loading fallback initially", () => {
      render(
        <TestWrapper>
          <WithProgressiveLoading videoPath="/test.mp4">
            {({ videoUrl, isLoading, error, retry }) => (
              <div>
                {isLoading && <div>Custom Loading</div>}
                {videoUrl && <div>Video: {videoUrl}</div>}
                {error && <div>Error: {error.message}</div>}
              </div>
            )}
          </WithProgressiveLoading>
        </TestWrapper>,
      );

      expect(screen.getByText("Locating video...")).toBeInTheDocument();
    });

    it("should call children function with loaded video after delay", async () => {
      render(
        <TestWrapper>
          <WithProgressiveLoading videoPath="/test.mp4">
            {({ videoUrl, isLoading, error, retry }) => (
              <div>
                {isLoading && <div>Custom Loading</div>}
                {videoUrl && <div>Video: {videoUrl}</div>}
                {error && <div>Error: {error.message}</div>}
              </div>
            )}
          </WithProgressiveLoading>
        </TestWrapper>,
      );

      // Initially shows loading
      expect(screen.getByText("Locating video...")).toBeInTheDocument();

      // After timeout, should show the video
      await waitFor(
        () => {
          expect(screen.getByText("Video: /test.mp4")).toBeInTheDocument();
        },
        { timeout: 2000 },
      );
    });

    it("should handle fallback paths", () => {
      render(
        <TestWrapper>
          <WithProgressiveLoading
            videoPath="/test.mp4"
            fallbackPaths={["/fallback1.mp4", "/fallback2.mp4"]}
          >
            {({ videoUrl, isLoading, error, retry }) => (
              <div>
                {isLoading && <div>Loading with fallbacks</div>}
                {videoUrl && <div>Video: {videoUrl}</div>}
              </div>
            )}
          </WithProgressiveLoading>
        </TestWrapper>,
      );

      expect(screen.getByText("Loading with fallbacks")).toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("should have proper ARIA labels for progress indicators", () => {
      render(
        <TestWrapper>
          <VideoLoadingFallback showProgress={true} progress={50} />
        </TestWrapper>,
      );

      const progressBar = screen.getByRole("progressbar");
      expect(progressBar).toHaveAttribute("aria-valuenow", "50");
    });

    it("should have proper semantic structure for error messages", () => {
      render(
        <TestWrapper>
          <VideoErrorFallback
            error={new Error("Test error")}
            showDetails={true}
          />
        </TestWrapper>,
      );

      const detailsButton = screen.getByRole("button", { name: /details/i });
      fireEvent.click(detailsButton);

      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    it("should support keyboard navigation for interactive elements", () => {
      const mockRetry = jest.fn();
      render(
        <TestWrapper>
          <VideoErrorFallback
            error={new Error("Test error")}
            onRetry={mockRetry}
            canRetry={true}
          />
        </TestWrapper>,
      );

      const retryButton = screen.getByRole("button", { name: /retry/i });
      retryButton.focus();
      fireEvent.keyDown(retryButton, { key: "Enter" });

      expect(mockRetry).toHaveBeenCalledTimes(1);
    });
  });
});
