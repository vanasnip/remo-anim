import * as React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import {
  default as VideoErrorBoundary,
  withVideoErrorBoundary,
  RemotionVideoErrorBoundary,
} from "../../components/VideoErrorBoundary";

// Mock the logging service
jest.mock("../../utils/loggingService", () => ({
  loggingService: {
    error: jest.fn(),
    info: jest.fn(),
    critical: jest.fn(),
  },
}));

const theme = createTheme();
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

// Test component that can throw errors
const ThrowErrorComponent: React.FC<{
  shouldThrow?: boolean;
  errorMessage?: string;
  errorName?: string;
}> = ({
  shouldThrow = false,
  errorMessage = "Test error",
  errorName = "Error",
}) => {
  if (shouldThrow) {
    const error = new Error(errorMessage);
    error.name = errorName;
    throw error;
  }
  return <div>Normal Component</div>;
};

describe("VideoErrorBoundary", () => {
  let originalConsoleError: typeof console.error;

  beforeAll(() => {
    // Suppress React error boundary console.error in tests
    originalConsoleError = console.error;
    console.error = jest.fn();
  });

  afterAll(() => {
    console.error = originalConsoleError;
  });

  beforeEach(() => {
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("normal operation", () => {
    it("should render children when no error occurs", () => {
      render(
        <TestWrapper>
          <VideoErrorBoundary>
            <ThrowErrorComponent shouldThrow={false} />
          </VideoErrorBoundary>
        </TestWrapper>,
      );

      expect(screen.getByText("Normal Component")).toBeInTheDocument();
    });

    it("should not interfere with normal component lifecycle", () => {
      const { rerender } = render(
        <TestWrapper>
          <VideoErrorBoundary>
            <ThrowErrorComponent shouldThrow={false} />
          </VideoErrorBoundary>
        </TestWrapper>,
      );

      rerender(
        <TestWrapper>
          <VideoErrorBoundary>
            <div>Updated Component</div>
          </VideoErrorBoundary>
        </TestWrapper>,
      );

      expect(screen.getByText("Updated Component")).toBeInTheDocument();
    });
  });

  describe("error handling", () => {
    it("should catch and display video-specific errors", () => {
      render(
        <TestWrapper>
          <VideoErrorBoundary>
            <ThrowErrorComponent
              shouldThrow={true}
              errorMessage="Video file not found"
              errorName="VIDEO_NOT_FOUND"
            />
          </VideoErrorBoundary>
        </TestWrapper>,
      );

      expect(screen.getByText("Video Loading Failed")).toBeInTheDocument();
      expect(
        screen.getByText(
          "The video file could not be found. It may have been moved or deleted.",
        ),
      ).toBeInTheDocument();
    });

    it("should display generic error for non-video errors", () => {
      render(
        <TestWrapper>
          <VideoErrorBoundary>
            <ThrowErrorComponent
              shouldThrow={true}
              errorMessage="Generic error"
              errorName="GENERIC_ERROR"
            />
          </VideoErrorBoundary>
        </TestWrapper>,
      );

      expect(screen.getByText("🎬 Video Component Error")).toBeInTheDocument();
      expect(
        screen.getByText("GENERIC_ERROR: Generic error"),
      ).toBeInTheDocument();
    });

    it("should show error ID for debugging", () => {
      render(
        <TestWrapper>
          <VideoErrorBoundary>
            <ThrowErrorComponent shouldThrow={true} />
          </VideoErrorBoundary>
        </TestWrapper>,
      );

      expect(
        screen.getByText(/Error ID: video_error_\d+_/),
      ).toBeInTheDocument();
    });

    it("should show video path when provided", () => {
      const videoPath = "/assets/video/test.mp4";
      render(
        <TestWrapper>
          <VideoErrorBoundary videoPath={videoPath}>
            <ThrowErrorComponent shouldThrow={true} />
          </VideoErrorBoundary>
        </TestWrapper>,
      );

      expect(screen.getByText(`Video: ${videoPath}`)).toBeInTheDocument();
    });
  });

  describe("retry functionality", () => {
    it("should show retry button when retries available", () => {
      render(
        <TestWrapper>
          <VideoErrorBoundary maxRetries={3}>
            <ThrowErrorComponent shouldThrow={true} />
          </VideoErrorBoundary>
        </TestWrapper>,
      );

      const retryButton = screen.getByRole("button", { name: /retry/i });
      expect(retryButton).toBeInTheDocument();
      expect(retryButton).toHaveTextContent("Retry (0/3)");
    });

    it("should reset error state on manual retry", () => {
      const { rerender } = render(
        <TestWrapper>
          <VideoErrorBoundary maxRetries={3}>
            <ThrowErrorComponent shouldThrow={true} />
          </VideoErrorBoundary>
        </TestWrapper>,
      );

      expect(screen.getByText("🎬 Video Component Error")).toBeInTheDocument();

      const retryButton = screen.getByRole("button", { name: /retry/i });
      fireEvent.click(retryButton);

      // Rerender with non-throwing component to simulate fix
      rerender(
        <TestWrapper>
          <VideoErrorBoundary maxRetries={3}>
            <ThrowErrorComponent shouldThrow={false} />
          </VideoErrorBoundary>
        </TestWrapper>,
      );

      expect(screen.getByText("Normal Component")).toBeInTheDocument();
    });

    it("should increment retry count on subsequent errors", () => {
      const { rerender } = render(
        <TestWrapper>
          <VideoErrorBoundary maxRetries={3}>
            <ThrowErrorComponent shouldThrow={true} />
          </VideoErrorBoundary>
        </TestWrapper>,
      );

      // First retry
      fireEvent.click(screen.getByRole("button", { name: /retry.*0\/3/i }));

      rerender(
        <TestWrapper>
          <VideoErrorBoundary maxRetries={3}>
            <ThrowErrorComponent shouldThrow={true} />
          </VideoErrorBoundary>
        </TestWrapper>,
      );

      expect(
        screen.getByRole("button", { name: /retry.*1\/3/i }),
      ).toBeInTheDocument();
    });

    it("should not show retry button when max retries exceeded", () => {
      const { rerender } = render(
        <TestWrapper>
          <VideoErrorBoundary maxRetries={1}>
            <ThrowErrorComponent shouldThrow={true} />
          </VideoErrorBoundary>
        </TestWrapper>,
      );

      // First error - should have retry
      expect(
        screen.getByRole("button", { name: /retry/i }),
      ).toBeInTheDocument();

      // Retry and fail again
      fireEvent.click(screen.getByRole("button", { name: /retry/i }));

      rerender(
        <TestWrapper>
          <VideoErrorBoundary maxRetries={1}>
            <ThrowErrorComponent shouldThrow={true} />
          </VideoErrorBoundary>
        </TestWrapper>,
      );

      // Should not show retry button anymore
      expect(
        screen.queryByRole("button", { name: /retry/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe("auto retry", () => {
    it("should auto retry after timeout when within retry limit", async () => {
      const { rerender } = render(
        <TestWrapper>
          <VideoErrorBoundary maxRetries={3}>
            <ThrowErrorComponent shouldThrow={true} />
          </VideoErrorBoundary>
        </TestWrapper>,
      );

      expect(screen.getByText("🎬 Video Component Error")).toBeInTheDocument();

      // Advance timers to trigger auto retry
      jest.advanceTimersByTime(2000);

      // Simulate successful retry by rendering without error
      rerender(
        <TestWrapper>
          <VideoErrorBoundary maxRetries={3}>
            <ThrowErrorComponent shouldThrow={false} />
          </VideoErrorBoundary>
        </TestWrapper>,
      );

      expect(screen.getByText("Normal Component")).toBeInTheDocument();
    });
  });

  describe("props change reset", () => {
    it("should reset error when resetOnPropsChange is true and video path changes", () => {
      const { rerender } = render(
        <TestWrapper>
          <VideoErrorBoundary resetOnPropsChange={true} videoPath="/video1.mp4">
            <ThrowErrorComponent shouldThrow={true} />
          </VideoErrorBoundary>
        </TestWrapper>,
      );

      expect(screen.getByText("🎬 Video Component Error")).toBeInTheDocument();

      // Change video path
      rerender(
        <TestWrapper>
          <VideoErrorBoundary resetOnPropsChange={true} videoPath="/video2.mp4">
            <ThrowErrorComponent shouldThrow={false} />
          </VideoErrorBoundary>
        </TestWrapper>,
      );

      expect(screen.getByText("Normal Component")).toBeInTheDocument();
    });

    it("should not reset error when resetOnPropsChange is false", () => {
      const { rerender } = render(
        <TestWrapper>
          <VideoErrorBoundary
            resetOnPropsChange={false}
            videoPath="/video1.mp4"
          >
            <ThrowErrorComponent shouldThrow={true} />
          </VideoErrorBoundary>
        </TestWrapper>,
      );

      expect(screen.getByText("🎬 Video Component Error")).toBeInTheDocument();

      // Change video path
      rerender(
        <TestWrapper>
          <VideoErrorBoundary
            resetOnPropsChange={false}
            videoPath="/video2.mp4"
          >
            <ThrowErrorComponent shouldThrow={false} />
          </VideoErrorBoundary>
        </TestWrapper>,
      );

      // Should still show error
      expect(screen.getByText("🎬 Video Component Error")).toBeInTheDocument();
    });
  });

  describe("custom fallback", () => {
    const CustomFallback: React.FC<any> = ({ error, resetError }) => (
      <div>
        <div>Custom Error: {error.message}</div>
        <button onClick={resetError}>Custom Retry</button>
      </div>
    );

    it("should use custom fallback component when provided", () => {
      render(
        <TestWrapper>
          <VideoErrorBoundary fallback={CustomFallback}>
            <ThrowErrorComponent
              shouldThrow={true}
              errorMessage="Custom error"
            />
          </VideoErrorBoundary>
        </TestWrapper>,
      );

      expect(
        screen.getByText("Custom Error: Custom error"),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Custom Retry" }),
      ).toBeInTheDocument();
    });
  });

  describe("copy error details functionality", () => {
    const mockWriteText = jest.fn();
    const mockClipboard = {
      writeText: mockWriteText,
    };

    beforeAll(() => {
      Object.defineProperty(navigator, "clipboard", {
        value: mockClipboard,
        writable: true,
      });
    });

    beforeEach(() => {
      mockWriteText.mockClear();
    });

    it("should copy error details to clipboard", async () => {
      mockWriteText.mockResolvedValue(undefined);
      window.alert = jest.fn();

      render(
        <TestWrapper>
          <VideoErrorBoundary videoPath="/test.mp4">
            <ThrowErrorComponent
              shouldThrow={true}
              errorMessage="Copy test error"
            />
          </VideoErrorBoundary>
        </TestWrapper>,
      );

      const copyButton = screen.getByRole("button", { name: /copy details/i });
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(mockWriteText).toHaveBeenCalledWith(
          expect.stringContaining("Copy test error"),
        );
      });

      expect(window.alert).toHaveBeenCalledWith(
        "Error details copied to clipboard",
      );
    });
  });
});

describe("withVideoErrorBoundary HOC", () => {
  const TestComponent: React.FC<{ message: string }> = ({ message }) => (
    <div>{message}</div>
  );

  it("should wrap component with VideoErrorBoundary", () => {
    const WrappedComponent = withVideoErrorBoundary(TestComponent);

    render(
      <TestWrapper>
        <WrappedComponent message="HOC Test" />
      </TestWrapper>,
    );

    expect(screen.getByText("HOC Test")).toBeInTheDocument();
  });

  it("should apply provided options to error boundary", () => {
    const mockOnError = jest.fn();
    const WrappedComponent = withVideoErrorBoundary(TestComponent, {
      onError: mockOnError,
      maxRetries: 5,
    });

    render(
      <TestWrapper>
        <WrappedComponent message="HOC Test" />
      </TestWrapper>,
    );

    expect(screen.getByText("HOC Test")).toBeInTheDocument();
  });
});

describe("RemotionVideoErrorBoundary", () => {
  it("should render children when no error occurs", () => {
    render(
      <TestWrapper>
        <RemotionVideoErrorBoundary
          videoPath="/test.mp4"
          compositionId="TestComposition"
        >
          <div>Remotion Content</div>
        </RemotionVideoErrorBoundary>
      </TestWrapper>,
    );

    expect(screen.getByText("Remotion Content")).toBeInTheDocument();
  });

  it("should handle composition-specific errors", () => {
    render(
      <TestWrapper>
        <RemotionVideoErrorBoundary
          videoPath="/test.mp4"
          compositionId="TestComposition"
        >
          <ThrowErrorComponent
            shouldThrow={true}
            errorMessage="Composition error"
            errorName="COMPOSITION_ERROR"
          />
        </RemotionVideoErrorBoundary>
      </TestWrapper>,
    );

    expect(screen.getByText("🎬 Video Component Error")).toBeInTheDocument();
  });

  it("should have lower retry count for compositions", () => {
    render(
      <TestWrapper>
        <RemotionVideoErrorBoundary
          videoPath="/test.mp4"
          compositionId="TestComposition"
        >
          <ThrowErrorComponent shouldThrow={true} />
        </RemotionVideoErrorBoundary>
      </TestWrapper>,
    );

    // Should show retry with maxRetries of 2 (as configured)
    const retryButton = screen.getByRole("button", { name: /retry/i });
    expect(retryButton).toHaveTextContent("Retry (0/2)");
  });
});
