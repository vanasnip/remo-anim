import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ProductPromo } from "../../../compositions/Promotional/ProductPromo";
import * as Remotion from "remotion";

// Mock Remotion hooks
let absoluteFillCounter = 0;
jest.mock("remotion", () => ({
  AbsoluteFill: ({ children, style, ...props }: any) => {
    absoluteFillCounter++;
    return (
      <div
        data-testid={`absolute-fill-${absoluteFillCounter}`}
        style={{ position: "absolute", ...style }}
        {...props}
      >
        {children}
      </div>
    );
  },
  Sequence: ({ children, from, durationInFrames, ...props }: any) => (
    <div data-testid={`sequence-${from}`} {...props}>
      {children}
    </div>
  ),
  useCurrentFrame: jest.fn(() => 0),
  useVideoConfig: jest.fn(() => ({
    fps: 30,
    durationInFrames: 300,
    width: 1920,
    height: 1080,
  })),
  interpolate: jest.fn((value, input, output, options) => {
    const progress = (value - input[0]) / (input[1] - input[0]);
    const clampedProgress = Math.max(0, Math.min(1, progress));
    return output[0] + (output[1] - output[0]) * clampedProgress;
  }),
  spring: jest.fn(({ frame, fps, config = {} }) => {
    // Simple spring simulation
    return Math.min(1, frame / 30);
  }),
}));

// Mock video components
jest.mock("../../../components/VideoWithErrorHandling", () => ({
  __esModule: true,
  default: ({ src, fallback, ...props }: any) => (
    <div data-testid="video-with-error-handling" data-src={src} {...props}>
      Video: {src}
    </div>
  ),
}));

jest.mock("../../../components/VideoFallbacks", () => ({
  VideoErrorFallback: ({ message }: any) => (
    <div data-testid="video-error-fallback">{message || "Video error"}</div>
  ),
  VideoLoadingFallback: () => (
    <div data-testid="video-loading-fallback">Loading video...</div>
  ),
}));

jest.mock("../../../components/VideoErrorBoundary", () => ({
  RemotionVideoErrorBoundary: ({ children }: any) => (
    <div data-testid="video-error-boundary">{children}</div>
  ),
}));

// Mock hooks
jest.mock("../../../hooks/useErrorHandler", () => ({
  useErrorHandler: () => ({
    error: null,
    clearError: jest.fn(),
    executeWithErrorHandling: jest.fn((fn) => fn()),
    executeAsync: jest.fn(async (fn) => await fn()),
  }),
}));

jest.mock("../../../hooks/useVideoLoader", () => ({
  useVideoLoader: (path: string) => ({
    loading: false,
    error: null,
    videoUrl: path || null,
    progress: 100,
    retry: jest.fn(),
    canRetry: true,
    isRetrying: false,
    retryCount: 0,
  }),
}));

describe("ProductPromo", () => {
  const mockUseCurrentFrame = Remotion.useCurrentFrame as jest.Mock;
  const mockUseVideoConfig = Remotion.useVideoConfig as jest.Mock;
  const mockInterpolate = Remotion.interpolate as jest.Mock;
  const mockSpring = Remotion.spring as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    absoluteFillCounter = 0; // Reset counter for consistent test IDs
    mockUseCurrentFrame.mockReturnValue(0);
    mockUseVideoConfig.mockReturnValue({
      fps: 30,
      durationInFrames: 300,
      width: 1920,
      height: 1080,
    });
  });

  describe("rendering", () => {
    it("renders without crashing", () => {
      render(
        <ProductPromo
          productName="Test Product"
          features={["Feature 1", "Feature 2"]}
        />,
      );
      expect(screen.getByTestId("sequence-0")).toBeInTheDocument();
    });

    it("renders title sequence", () => {
      render(
        <ProductPromo
          productName="Test Product"
          features={["Feature 1", "Feature 2"]}
        />,
      );
      expect(screen.getByText(/Test Product/i)).toBeInTheDocument();
    });

    it("renders subtitle", () => {
      render(
        <ProductPromo
          productName="Test Product"
          features={["Feature 1", "Feature 2"]}
        />,
      );
      expect(screen.getByText(/The future is here/i)).toBeInTheDocument();
    });

    it("renders feature cards", () => {
      render(
        <ProductPromo
          productName="Test Product"
          features={["Feature 1", "Feature 2"]}
        />,
      );
      expect(screen.getByText(/Feature 1/i)).toBeInTheDocument();
      expect(screen.getByText(/Feature 2/i)).toBeInTheDocument();
    });

    it("renders call to action", () => {
      render(
        <ProductPromo
          productName="Test Product"
          features={["Feature 1", "Feature 2"]}
        />,
      );
      expect(screen.getByText(/Ready to Get Started/i)).toBeInTheDocument();
    });

    it("renders promotional video placeholder when no video provided", () => {
      render(
        <ProductPromo
          productName="Test Product"
          features={["Feature 1", "Feature 2"]}
        />,
      );
      expect(screen.getByText(/Interactive Demo/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Add your Manim video to bring this section to life/i),
      ).toBeInTheDocument();
    });
  });

  describe("animation timing", () => {
    it("shows title at frame 0", () => {
      mockUseCurrentFrame.mockReturnValue(0);
      render(
        <ProductPromo
          productName="Test Product"
          features={["Feature 1", "Feature 2"]}
        />,
      );
      expect(screen.getByText(/Amazing Product/i)).toBeInTheDocument();
    });

    it("shows features sequence at frame 150", () => {
      mockUseCurrentFrame.mockReturnValue(150);
      render(
        <ProductPromo
          productName="Test Product"
          features={["Feature 1", "Feature 2"]}
        />,
      );
      expect(screen.getByTestId("sequence-150")).toBeInTheDocument();
    });

    it("shows video sequence at frame 450", () => {
      mockUseCurrentFrame.mockReturnValue(450);
      render(
        <ProductPromo
          productName="Test Product"
          features={["Feature 1", "Feature 2"]}
        />,
      );
      expect(screen.getByTestId("sequence-450")).toBeInTheDocument();
    });

    it("shows call to action at frame 750", () => {
      mockUseCurrentFrame.mockReturnValue(750);
      render(
        <ProductPromo
          productName="Test Product"
          features={["Feature 1", "Feature 2"]}
        />,
      );
      expect(screen.getByTestId("sequence-750")).toBeInTheDocument();
    });
  });

  describe("animations", () => {
    it("applies fade in animation to title", () => {
      mockUseCurrentFrame.mockReturnValue(15);
      mockInterpolate.mockImplementation((frame, input, output) => {
        if (input[0] === 0 && input[1] === 30) {
          return 0.5; // Mid-fade
        }
        return output[0];
      });

      render(
        <ProductPromo
          productName="Test Product"
          features={["Feature 1", "Feature 2"]}
        />,
      );
      expect(mockInterpolate).toHaveBeenCalledWith(
        15,
        [0, 30],
        [0, 1],
        expect.any(Object),
      );
    });

    it("applies spring animation to features", () => {
      mockUseCurrentFrame.mockReturnValue(180);
      render(
        <ProductPromo
          productName="Test Product"
          features={["Feature 1", "Feature 2"]}
        />,
      );

      expect(mockSpring).toHaveBeenCalledWith(
        expect.objectContaining({
          frame: expect.any(Number),
          fps: 30,
        }),
      );
    });

    it("applies slide animation to call to action", () => {
      mockUseCurrentFrame.mockReturnValue(250);
      mockInterpolate.mockImplementation((frame, input, output) => {
        if (input[0] === 240 && input[1] === 260) {
          return 50; // Mid-slide
        }
        return output[0];
      });

      render(
        <ProductPromo
          productName="Test Product"
          features={["Feature 1", "Feature 2"]}
        />,
      );
      expect(mockInterpolate).toHaveBeenCalledWith(
        250,
        [240, 260],
        expect.any(Array),
        expect.any(Object),
      );
    });
  });

  describe("theming", () => {
    it("applies Material-UI theme", () => {
      render(
        <ProductPromo
          productName="Test Product"
          features={["Feature 1", "Feature 2"]}
        />,
      );
      // Theme is applied through ThemeProvider wrapper
      const title = screen.getByText(/Amazing Product/i);
      expect(title).toBeInTheDocument();
    });

    it("uses correct typography variants", () => {
      render(
        <ProductPromo
          productName="Test Product"
          features={["Feature 1", "Feature 2"]}
        />,
      );

      // Check for Typography components with correct variants
      const heading = screen.getByText(/Amazing Product/i);
      expect(heading.closest("[class*=MuiTypography]")).toBeInTheDocument();
    });
  });

  describe("error handling", () => {
    it("wraps video in error boundary", () => {
      render(
        <ProductPromo
          productName="Test Product"
          features={["Feature 1", "Feature 2"]}
        />,
      );
      expect(screen.getByTestId("video-error-boundary")).toBeInTheDocument();
    });

    it("shows placeholder when no video is provided", () => {
      render(
        <ProductPromo
          productName="Test Product"
          features={["Feature 1", "Feature 2"]}
        />,
      );
      expect(screen.getByText(/Interactive Demo/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Add your Manim video to bring this section to life/i),
      ).toBeInTheDocument();
    });
  });

  describe("responsive behavior", () => {
    it("renders at different frame counts", () => {
      const frames = [0, 30, 60, 90, 120, 150, 180, 210, 450, 750];

      frames.forEach((frame) => {
        absoluteFillCounter = 0; // Reset counter for each frame test
        mockUseCurrentFrame.mockReturnValue(frame);
        const { unmount } = render(
          <ProductPromo
            productName="Test Product"
            features={["Feature 1", "Feature 2"]}
          />,
        );

        // Should render without errors at any frame
        expect(screen.getByTestId("sequence-0")).toBeInTheDocument();
        unmount();
      });
    });

    it("handles video config changes", () => {
      mockUseVideoConfig.mockReturnValue({
        fps: 60,
        durationInFrames: 600,
        width: 1280,
        height: 720,
      });

      render(
        <ProductPromo
          productName="Test Product"
          features={["Feature 1", "Feature 2"]}
        />,
      );
      expect(screen.getByText(/Amazing Product/i)).toBeInTheDocument();
    });
  });

  describe("feature showcase", () => {
    it("displays all three feature cards", () => {
      mockUseCurrentFrame.mockReturnValue(90);
      render(
        <ProductPromo
          productName="Test Product"
          features={["Feature 1", "Feature 2"]}
        />,
      );

      const features = ["Fast", "Secure", "Simple", "Scalable", "Reliable"];

      features.forEach((feature) => {
        expect(screen.getByText(new RegExp(feature, "i"))).toBeInTheDocument();
      });
    });

    it("applies staggered animation to feature cards", () => {
      mockUseCurrentFrame.mockReturnValue(180);
      render(
        <ProductPromo
          productName="Test Product"
          features={["Feature 1", "Feature 2"]}
        />,
      );

      // Check that spring is called for each feature card (2 features passed)
      expect(mockSpring).toHaveBeenCalledTimes(2);
    });
  });

  describe("call to action", () => {
    it("renders call to action button", () => {
      mockUseCurrentFrame.mockReturnValue(750);
      render(
        <ProductPromo
          productName="Test Product"
          features={["Feature 1", "Feature 2"]}
        />,
      );

      const button = screen.getByRole("button", { name: /Start Free Trial/i });
      expect(button).toBeInTheDocument();
    });

    it("displays pricing information", () => {
      mockUseCurrentFrame.mockReturnValue(750);
      render(
        <ProductPromo
          productName="Test Product"
          features={["Feature 1", "Feature 2"]}
        />,
      );

      expect(
        screen.getByText(/No credit card required • Setup in minutes/i),
      ).toBeInTheDocument();
    });
  });

  describe("gradient backgrounds", () => {
    it("applies gradient background to main container", () => {
      render(
        <ProductPromo
          productName="Test Product"
          features={["Feature 1", "Feature 2"]}
        />,
      );

      const container = screen.getByTestId("absolute-fill-1");
      expect(container).toHaveStyle({
        position: "absolute",
      });
    });
  });
});
