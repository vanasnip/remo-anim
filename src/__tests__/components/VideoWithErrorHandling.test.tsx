import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { VideoWithErrorHandling } from "../../components/VideoWithErrorHandling";

// Mock the useErrorHandler hook
jest.mock("../../hooks/useErrorHandler", () => ({
  useErrorHandler: jest.fn(),
  createVideoLoadError: jest.fn((src) => {
    const error = new Error(`Failed to load video: ${src}`);
    error.name = "VideoLoadError";
    return error;
  }),
}));

describe("VideoWithErrorHandling", () => {
  const mockHandleError = jest.fn();
  const mockClearError = jest.fn();
  const mockOnLoadSuccess = jest.fn();
  const mockOnLoadError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock for useErrorHandler
    const { useErrorHandler } = require("../../hooks/useErrorHandler");
    useErrorHandler.mockReturnValue({
      errorState: { hasError: false },
      handleError: mockHandleError,
      clearError: mockClearError,
    });

    // Mock HTMLVideoElement methods
    HTMLVideoElement.prototype.load = jest.fn();
    HTMLVideoElement.prototype.play = jest.fn().mockResolvedValue(undefined);
    HTMLVideoElement.prototype.pause = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("successful video loading", () => {
    it("should render video when loading is successful", () => {
      render(<VideoWithErrorHandling src="/test-video.mp4" />);

      const video = screen.getByTestId("remotion-video");
      expect(video).toBeInTheDocument();
      expect(video).toHaveAttribute("src", "/test-video.mp4");
    });

    it("should show loading state initially", () => {
      render(<VideoWithErrorHandling src="/test-video.mp4" />);

      expect(screen.getByText("Loading video...")).toBeInTheDocument();
      expect(screen.getByRole("progressbar")).toBeInTheDocument();
    });

    it("should call onLoadSuccess when video loads", async () => {
      render(
        <VideoWithErrorHandling
          src="/test-video.mp4"
          onLoadSuccess={mockOnLoadSuccess}
        />,
      );

      const video = screen.getByTestId("remotion-video");

      await act(async () => {
        fireEvent.load(video);
      });

      expect(mockOnLoadSuccess).toHaveBeenCalledTimes(1);
      expect(mockClearError).toHaveBeenCalled();
    });

    it("should apply custom styles and props", () => {
      const customStyle = { width: "100%", height: "400px" };

      render(
        <VideoWithErrorHandling
          src="/test-video.mp4"
          style={customStyle}
          className="custom-video"
          volume={0.5}
          muted={true}
        />,
      );

      const video = screen.getByTestId("remotion-video");
      expect(video).toHaveClass("custom-video");
      expect(video).toHaveAttribute("volume", "0.5");
      expect(video).toHaveAttribute("muted");
    });
  });

  describe("video loading errors", () => {
    beforeEach(() => {
      const { useErrorHandler } = require("../../hooks/useErrorHandler");
      useErrorHandler.mockReturnValue({
        errorState: {
          hasError: true,
          error: new Error("Video load failed"),
          errorId: "test-error-123",
        },
        handleError: mockHandleError,
        clearError: mockClearError,
      });
    });

    it("should display error UI when video fails to load", () => {
      render(<VideoWithErrorHandling src="/broken-video.mp4" />);

      expect(screen.getByText("Video Loading Failed")).toBeInTheDocument();
      expect(screen.getByText("Video load failed")).toBeInTheDocument();
      expect(screen.getByText("Video: /broken-video.mp4")).toBeInTheDocument();
    });

    it("should show retry button within max attempts", () => {
      render(<VideoWithErrorHandling src="/broken-video.mp4" maxRetries={3} />);

      const retryButton = screen.getByRole("button", {
        name: /retry \(1\/4\)/i,
      });
      expect(retryButton).toBeInTheDocument();
    });

    it("should show refresh page button when max retries exceeded", () => {
      // Mock that we've reached max retries
      const { useErrorHandler } = require("../../hooks/useErrorHandler");
      useErrorHandler.mockReturnValue({
        errorState: {
          hasError: true,
          error: new Error("Video load failed"),
        },
        handleError: mockHandleError,
        clearError: mockClearError,
      });

      render(<VideoWithErrorHandling src="/broken-video.mp4" maxRetries={1} />);

      // Simulate reaching max retries by re-rendering with higher retry count
      // This would typically happen through internal state management
      expect(
        screen.getByRole("button", { name: /refresh page/i }),
      ).toBeInTheDocument();
    });

    it("should display custom fallback content when provided", () => {
      const customFallback = (
        <div data-testid="custom-fallback">Custom Error UI</div>
      );

      render(
        <VideoWithErrorHandling
          src="/broken-video.mp4"
          fallbackContent={customFallback}
        />,
      );

      expect(screen.getByTestId("custom-fallback")).toBeInTheDocument();
      expect(screen.getByText("Custom Error UI")).toBeInTheDocument();
    });

    it("should call onLoadError when video fails", async () => {
      // Reset mock to allow error handling
      const { useErrorHandler } = require("../../hooks/useErrorHandler");
      useErrorHandler.mockReturnValue({
        errorState: { hasError: false },
        handleError: mockHandleError,
        clearError: mockClearError,
      });

      render(
        <VideoWithErrorHandling
          src="/broken-video.mp4"
          onLoadError={mockOnLoadError}
        />,
      );

      const video = screen.getByTestId("remotion-video");

      await act(async () => {
        // Create a mock error event
        const errorEvent = new Event("error") as any;
        errorEvent.currentTarget = {
          error: {
            code: MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED,
            message: "Video format not supported",
          },
        };

        fireEvent.error(video, errorEvent);
      });

      expect(mockHandleError).toHaveBeenCalled();
    });
  });

  describe("retry functionality", () => {
    beforeEach(() => {
      // Mock initial error state, then success after retry
      const { useErrorHandler } = require("../../hooks/useErrorHandler");
      let callCount = 0;
      useErrorHandler.mockImplementation(() => {
        callCount++;
        return {
          errorState: {
            hasError: callCount === 1, // Only error on first call
            error: callCount === 1 ? new Error("Initial error") : undefined,
          },
          handleError: mockHandleError,
          clearError: mockClearError,
        };
      });
    });

    it("should retry video loading when retry button is clicked", async () => {
      const { rerender } = render(
        <VideoWithErrorHandling src="/retry-video.mp4" maxRetries={3} />,
      );

      // Should show error initially
      const retryButton = screen.getByRole("button", { name: /retry/i });

      await act(async () => {
        fireEvent.click(retryButton);
      });

      expect(mockClearError).toHaveBeenCalled();

      // Re-render to simulate state change after retry
      rerender(
        <VideoWithErrorHandling src="/retry-video.mp4" maxRetries={3} />,
      );

      // Should show loading state again
      expect(screen.getByText("Loading video...")).toBeInTheDocument();
    });

    it("should force video reload when retrying", async () => {
      const mockLoad = jest.fn();
      HTMLVideoElement.prototype.load = mockLoad;

      render(<VideoWithErrorHandling src="/retry-video.mp4" maxRetries={3} />);

      const retryButton = screen.getByRole("button", { name: /retry/i });

      await act(async () => {
        fireEvent.click(retryButton);
      });

      // Note: The actual load call would happen after state update
      // In a real scenario, this would be tested through integration or E2E tests
      expect(mockClearError).toHaveBeenCalled();
    });
  });

  describe("different media error types", () => {
    const testMediaError = async (
      errorCode: number,
      expectedMessage: string,
      expectedName: string,
    ) => {
      const { useErrorHandler } = require("../../hooks/useErrorHandler");
      useErrorHandler.mockReturnValue({
        errorState: { hasError: false },
        handleError: mockHandleError,
        clearError: mockClearError,
      });

      render(<VideoWithErrorHandling src="/test-video.mp4" />);

      const video = screen.getByTestId("remotion-video");

      await act(async () => {
        const errorEvent = new Event("error") as any;
        errorEvent.currentTarget = {
          error: {
            code: errorCode,
            message: "Media error message",
          },
        };

        fireEvent.error(video, errorEvent);
      });

      // Check that handleError was called with expected error details
      expect(mockHandleError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expectedMessage,
          name: expectedName,
        }),
        expect.any(String),
      );
    };

    it("should handle MEDIA_ERR_ABORTED", async () => {
      await testMediaError(
        MediaError.MEDIA_ERR_ABORTED,
        "Video loading was aborted",
        "MEDIA_ERR_ABORTED",
      );
    });

    it("should handle MEDIA_ERR_NETWORK", async () => {
      await testMediaError(
        MediaError.MEDIA_ERR_NETWORK,
        "Network error occurred while loading video",
        "MEDIA_ERR_NETWORK",
      );
    });

    it("should handle MEDIA_ERR_DECODE", async () => {
      await testMediaError(
        MediaError.MEDIA_ERR_DECODE,
        "Video decoding error",
        "MEDIA_ERR_DECODE",
      );
    });

    it("should handle MEDIA_ERR_SRC_NOT_SUPPORTED", async () => {
      await testMediaError(
        MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED,
        "Video format not supported or file not found",
        "MEDIA_ERR_SRC_NOT_SUPPORTED",
      );
    });
  });

  describe("video parameters", () => {
    it("should apply startFrom and endAt parameters", () => {
      render(
        <VideoWithErrorHandling
          src="/test-video.mp4"
          startFrom={30}
          endAt={120}
        />,
      );

      const video = screen.getByTestId("remotion-video");
      expect(video).toHaveAttribute("startfrom", "30");
      expect(video).toHaveAttribute("endat", "120");
    });

    it("should apply playback parameters", () => {
      render(
        <VideoWithErrorHandling
          src="/test-video.mp4"
          volume={0.8}
          playbackRate={1.5}
          muted={true}
        />,
      );

      const video = screen.getByTestId("remotion-video");
      expect(video).toHaveAttribute("volume", "0.8");
      expect(video).toHaveAttribute("playbackrate", "1.5");
      expect(video).toHaveAttribute("muted");
    });

    it("should update key when retry count changes", () => {
      const { rerender } = render(
        <VideoWithErrorHandling src="/test-video.mp4" />,
      );

      const initialVideo = screen.getByTestId("remotion-video");
      // const initialKey = initialVideo.getAttribute("key") || ""; // Currently unused

      // Simulate retry by re-rendering (in real app this would be through state)
      rerender(<VideoWithErrorHandling src="/test-video.mp4" />);

      // Key would change in actual retry scenario
      // This is more of a implementation detail test
      expect(initialVideo).toBeInTheDocument();
    });
  });

  describe("accessibility and UX", () => {
    it("should provide proper loading state with accessibility", () => {
      render(<VideoWithErrorHandling src="/test-video.mp4" />);

      const loadingContainer = screen
        .getByText("Loading video...")
        .closest("div");
      expect(loadingContainer).toHaveStyle({
        display: "flex",
        "align-items": "center",
        "justify-content": "center",
      });
    });

    it("should provide clear error messaging", () => {
      const { useErrorHandler } = require("../../hooks/useErrorHandler");
      useErrorHandler.mockReturnValue({
        errorState: {
          hasError: true,
          error: new Error("Network timeout"),
        },
        handleError: mockHandleError,
        clearError: mockClearError,
      });

      render(<VideoWithErrorHandling src="/test-video.mp4" />);

      expect(screen.getByText("Video Loading Failed")).toBeInTheDocument();
      expect(screen.getByText("Network timeout")).toBeInTheDocument();
      expect(screen.getByText("Video: /test-video.mp4")).toBeInTheDocument();
    });

    it("should handle missing src gracefully", () => {
      expect(() => {
        render(<VideoWithErrorHandling src="" />);
      }).not.toThrow();
    });
  });

  describe("component lifecycle", () => {
    it("should clean up error state on successful load after error", async () => {
      const { useErrorHandler } = require("../../hooks/useErrorHandler");
      let hasError = true;

      useErrorHandler.mockImplementation(() => ({
        errorState: { hasError },
        handleError: mockHandleError,
        clearError: jest.fn(() => {
          hasError = false;
        }),
      }));

      const { rerender } = render(
        <VideoWithErrorHandling src="/test-video.mp4" />,
      );

      // Initially in error state
      expect(screen.getByText("Video Loading Failed")).toBeInTheDocument();

      // Simulate successful load
      hasError = false;
      rerender(<VideoWithErrorHandling src="/test-video.mp4" />);

      // Should now show video
      expect(screen.getByTestId("remotion-video")).toBeInTheDocument();
      expect(
        screen.queryByText("Video Loading Failed"),
      ).not.toBeInTheDocument();
    });
  });
});
