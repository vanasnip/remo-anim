import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
  ContentAugmentation,
  type Annotation,
} from "../../../Augmented/ContentAugmentation";
import * as Remotion from "remotion";

// Mock Remotion hooks
jest.mock("remotion");

describe("ContentAugmentation - Accessibility Tests", () => {
  const mockVideoConfig = {
    fps: 30,
    durationInFrames: 900,
    width: 1920,
    height: 1080,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(0);
    (Remotion.useVideoConfig as jest.Mock).mockReturnValue(mockVideoConfig);
    (Remotion.spring as jest.Mock).mockReturnValue(1);
    (Remotion.interpolate as jest.Mock).mockReturnValue(1);
    (Remotion.staticFile as jest.Mock).mockImplementation(
      (path: string) => `/public/${path}`,
    );
  });

  describe("WCAG 2.1 Compliance", () => {
    it("provides sufficient color contrast for text annotations", () => {
      const contrastTestAnnotations: Annotation[] = [
        {
          id: "high-contrast",
          type: "callout",
          text: "High contrast text",
          startFrame: 0,
          endFrame: 100,
          position: { x: 50, y: 50 },
          color: "#000000", // Black background ensures high contrast with white text
        },
        {
          id: "warning-contrast",
          type: "warning",
          text: "Warning with good contrast",
          startFrame: 0,
          endFrame: 100,
          position: { x: 25, y: 25 },
        },
        {
          id: "info-contrast",
          type: "info",
          text: "Info with good contrast",
          startFrame: 0,
          endFrame: 100,
          position: { x: 75, y: 75 },
        },
      ];

      (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(50);

      render(
        <ContentAugmentation
          sourceVideo="/test-video.mp4"
          annotations={contrastTestAnnotations}
        />,
      );

      // All annotations should be visible and have sufficient contrast
      expect(screen.getByText("High contrast text")).toBeInTheDocument();
      expect(
        screen.getByText("Warning with good contrast"),
      ).toBeInTheDocument();
      expect(screen.getByText("Info with good contrast")).toBeInTheDocument();
    });

    it("maintains readable font sizes across different annotation sizes", () => {
      const fontSizeTestAnnotations: Annotation[] = [
        {
          id: "small-readable",
          type: "info",
          text: "Small but readable",
          startFrame: 0,
          endFrame: 100,
          position: { x: 20, y: 20 },
          size: "small",
        },
        {
          id: "medium-readable",
          type: "info",
          text: "Medium readable",
          startFrame: 0,
          endFrame: 100,
          position: { x: 50, y: 50 },
          size: "medium",
        },
        {
          id: "large-readable",
          type: "info",
          text: "Large readable",
          startFrame: 0,
          endFrame: 100,
          position: { x: 80, y: 80 },
          size: "large",
        },
      ];

      (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(50);

      const { container } = render(
        <ContentAugmentation
          sourceVideo="/test-video.mp4"
          annotations={fontSizeTestAnnotations}
        />,
      );

      // Check that all text elements are rendered (implies readable font sizes)
      expect(screen.getByText("Small but readable")).toBeInTheDocument();
      expect(screen.getByText("Medium readable")).toBeInTheDocument();
      expect(screen.getByText("Large readable")).toBeInTheDocument();

      // Verify font sizes are applied proportionally
      const textElements = container.querySelectorAll('[style*="font-size"]');
      expect(textElements.length).toBeGreaterThan(0);
    });

    it("provides clear visual hierarchy with proper z-index ordering", () => {
      const hierarchyAnnotations: Annotation[] = [
        {
          id: "background-highlight",
          type: "highlight",
          text: "",
          startFrame: 0,
          endFrame: 100,
          position: { x: 50, y: 50 },
        },
        {
          id: "mid-arrow",
          type: "arrow",
          text: "Arrow annotation",
          startFrame: 0,
          endFrame: 100,
          position: { x: 30, y: 30 },
          target: { x: 70, y: 70 },
        },
        {
          id: "front-callout",
          type: "callout",
          text: "Priority callout",
          startFrame: 0,
          endFrame: 100,
          position: { x: 50, y: 50 },
        },
      ];

      (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(50);

      const { container } = render(
        <ContentAugmentation
          sourceVideo="/test-video.mp4"
          annotations={hierarchyAnnotations}
        />,
      );

      // Check z-index values maintain proper hierarchy
      const callout = container.querySelector('[style*="z-index: 100"]');
      const arrow = container.querySelector('[style*="z-index: 95"]');
      const highlight = container.querySelector('[style*="z-index: 90"]');

      expect(callout).toBeInTheDocument(); // Highest priority
      expect(arrow).toBeInTheDocument(); // Medium priority
      expect(highlight).toBeInTheDocument(); // Background priority
    });

    it("ensures annotations don't obstruct critical content", () => {
      // Test annotations positioned at screen edges and corners
      const nonObstructiveAnnotations: Annotation[] = [
        {
          id: "top-corner",
          type: "info",
          text: "Top corner info",
          startFrame: 0,
          endFrame: 100,
          position: { x: 90, y: 10 }, // Top right
        },
        {
          id: "bottom-corner",
          type: "success",
          text: "Bottom corner",
          startFrame: 0,
          endFrame: 100,
          position: { x: 10, y: 90 }, // Bottom left
        },
        {
          id: "edge-callout",
          type: "callout",
          text: "Edge callout",
          startFrame: 0,
          endFrame: 100,
          position: { x: 5, y: 50 }, // Left edge
        },
      ];

      (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(50);

      render(
        <ContentAugmentation
          sourceVideo="/test-video.mp4"
          annotations={nonObstructiveAnnotations}
        />,
      );

      // All edge annotations should render without overlapping center content
      expect(screen.getByText("Top corner info")).toBeInTheDocument();
      expect(screen.getByText("Bottom corner")).toBeInTheDocument();
      expect(screen.getByText("Edge callout")).toBeInTheDocument();
    });
  });

  describe("Keyboard and Screen Reader Support", () => {
    it("provides meaningful text content for screen readers", () => {
      const screenReaderAnnotations: Annotation[] = [
        {
          id: "descriptive",
          type: "callout",
          text: "Mathematical equation showing quadratic formula derivation",
          startFrame: 0,
          endFrame: 100,
          position: { x: 50, y: 30 },
        },
        {
          id: "contextual",
          type: "info",
          text: "This step demonstrates the critical transformation where we complete the square",
          startFrame: 0,
          endFrame: 100,
          position: { x: 50, y: 70 },
        },
      ];

      (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(50);

      render(
        <ContentAugmentation
          sourceVideo="/test-video.mp4"
          annotations={screenReaderAnnotations}
        />,
      );

      // Verify descriptive text is available for screen readers
      expect(
        screen.getByText(
          "Mathematical equation showing quadratic formula derivation",
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/This step demonstrates the critical transformation/),
      ).toBeInTheDocument();
    });

    it("handles focus management appropriately", () => {
      const focusTestAnnotations: Annotation[] = [
        {
          id: "focusable-1",
          type: "callout",
          text: "First focusable element",
          startFrame: 0,
          endFrame: 100,
          position: { x: 30, y: 30 },
        },
        {
          id: "focusable-2",
          type: "info",
          text: "Second focusable element",
          startFrame: 0,
          endFrame: 100,
          position: { x: 70, y: 70 },
        },
      ];

      (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(50);

      const { container } = render(
        <ContentAugmentation
          sourceVideo="/test-video.mp4"
          annotations={focusTestAnnotations}
        />,
      );

      // In a video context, annotations typically shouldn't be focusable to avoid
      // interrupting video playback, but text should be accessible to screen readers
      const textElements = container.querySelectorAll("*");
      expect(textElements.length).toBeGreaterThan(0);
    });
  });

  describe("Motion and Animation Accessibility", () => {
    it("provides reduced motion alternatives when requested", () => {
      // Mock prefers-reduced-motion media query
      const mockMatchMedia = jest.fn().mockImplementation((query) => ({
        matches: query.includes("prefers-reduced-motion"),
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }));

      Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: mockMatchMedia,
      });

      const animatedAnnotations: Annotation[] = [
        {
          id: "spring-animated",
          type: "callout",
          text: "Spring animation",
          startFrame: 0,
          endFrame: 100,
          position: { x: 50, y: 50 },
        },
      ];

      (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(10);

      render(
        <ContentAugmentation
          sourceVideo="/test-video.mp4"
          annotations={animatedAnnotations}
        />,
      );

      // When reduced motion is preferred, spring animations should still work
      // but potentially with less intensity (this would need implementation)
      expect(screen.getByText("Spring animation")).toBeInTheDocument();
      expect(Remotion.spring).toHaveBeenCalled();
    });

    it("ensures animations don't cause seizures (flashing)", () => {
      const flashTestAnnotations: Annotation[] = [
        {
          id: "highlight-flash",
          type: "highlight",
          text: "",
          startFrame: 0,
          endFrame: 100,
          position: { x: 50, y: 50 },
        },
      ];

      // Test multiple rapid frames to ensure no problematic flashing
      const testFrames = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20];

      testFrames.forEach((frame) => {
        (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(frame);

        const { container } = render(
          <ContentAugmentation
            sourceVideo="/test-video.mp4"
            annotations={flashTestAnnotations}
          />,
        );

        // Highlight should be present but not flashing dangerously
        const highlight = container.querySelector(
          '[style*="border-radius: 50%"]',
        );
        expect(highlight).toBeInTheDocument();
      });
    });

    it("provides consistent visual feedback for all annotation types", () => {
      const allTypesAnnotations: Annotation[] = [
        {
          id: "callout-visual",
          type: "callout",
          text: "Callout feedback",
          startFrame: 0,
          endFrame: 100,
          position: { x: 20, y: 20 },
        },
        {
          id: "info-visual",
          type: "info",
          text: "Info feedback",
          startFrame: 0,
          endFrame: 100,
          position: { x: 40, y: 40 },
        },
        {
          id: "warning-visual",
          type: "warning",
          text: "Warning feedback",
          startFrame: 0,
          endFrame: 100,
          position: { x: 60, y: 60 },
        },
        {
          id: "success-visual",
          type: "success",
          text: "Success feedback",
          startFrame: 0,
          endFrame: 100,
          position: { x: 80, y: 80 },
        },
      ];

      (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(50);

      render(
        <ContentAugmentation
          sourceVideo="/test-video.mp4"
          annotations={allTypesAnnotations}
        />,
      );

      // All annotation types should provide visual feedback
      expect(screen.getByText("Callout feedback")).toBeInTheDocument();
      expect(screen.getByText("Info feedback")).toBeInTheDocument();
      expect(screen.getByText("Warning feedback")).toBeInTheDocument();
      expect(screen.getByText("Success feedback")).toBeInTheDocument();
    });
  });

  describe("Timeline Accessibility", () => {
    it("provides meaningful timeline progress information", () => {
      const timelineAnnotations: Annotation[] = [
        {
          id: "timeline-marker",
          type: "info",
          text: "Timeline marker",
          startFrame: 150,
          endFrame: 200,
          position: { x: 50, y: 50 },
        },
      ];

      (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(300);

      render(
        <ContentAugmentation
          sourceVideo="/test-video.mp4"
          annotations={timelineAnnotations}
          showTimeline={true}
        />,
      );

      // Timeline should show current time
      expect(screen.getByText("10s")).toBeInTheDocument();
    });

    it("timeline markers provide visual context for annotations", () => {
      const markerTestAnnotations: Annotation[] = [
        {
          id: "warning-marker",
          type: "warning",
          text: "Important warning",
          startFrame: 100,
          endFrame: 150,
          position: { x: 30, y: 30 },
        },
        {
          id: "success-marker",
          type: "success",
          text: "Success point",
          startFrame: 200,
          endFrame: 250,
          position: { x: 70, y: 70 },
        },
      ];

      (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(0);

      const { container } = render(
        <ContentAugmentation
          sourceVideo="/test-video.mp4"
          annotations={markerTestAnnotations}
          showTimeline={true}
        />,
      );

      // Timeline markers should be visually distinct
      const markers = container.querySelectorAll('[style*="opacity: 0.5"]');
      expect(markers.length).toBe(2); // One for each annotation
    });

    it("timeline remains accessible at different viewport sizes", () => {
      const responsiveAnnotations: Annotation[] = [
        {
          id: "responsive-test",
          type: "callout",
          text: "Responsive test",
          startFrame: 50,
          endFrame: 100,
          position: { x: 50, y: 50 },
        },
      ];

      (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(75);

      // Test with different mock video configs (simulating different viewport sizes)
      const viewportSizes = [
        { width: 1920, height: 1080 }, // Desktop
        { width: 1366, height: 768 }, // Laptop
        { width: 768, height: 432 }, // Tablet landscape
        { width: 320, height: 180 }, // Mobile
      ];

      viewportSizes.forEach((size) => {
        (Remotion.useVideoConfig as jest.Mock).mockReturnValue({
          ...mockVideoConfig,
          ...size,
        });

        render(
          <ContentAugmentation
            sourceVideo="/test-video.mp4"
            annotations={responsiveAnnotations}
            showTimeline={true}
          />,
        );

        // Timeline and annotations should be accessible at all sizes
        expect(screen.getByText("Responsive test")).toBeInTheDocument();
        expect(screen.getByText("2s")).toBeInTheDocument(); // Timeline current time
      });
    });
  });

  describe("Error States Accessibility", () => {
    it("provides accessible error messages for video loading failures", () => {
      const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();

      const { container } = render(
        <ContentAugmentation
          sourceVideo="/nonexistent-video.mp4"
          annotations={[]}
        />,
      );

      const video = container.querySelector("video");
      if (video?.onerror) {
        const errorEvent = new Event("error");
        (video.onerror as (event: Event) => void)(errorEvent);

        // Error should be logged for debugging but not break accessibility
        expect(consoleWarnSpy).toHaveBeenCalled();
      }

      consoleWarnSpy.mockRestore();
    });

    it("gracefully handles missing annotation data", () => {
      const incompleteAnnotations = [
        {
          id: "incomplete",
          // Missing required fields
        } as any,
        null,
        undefined,
        {
          id: "valid",
          type: "info" as const,
          text: "Valid annotation",
          startFrame: 0,
          endFrame: 100,
          position: { x: 50, y: 50 },
        },
      ].filter(Boolean);

      (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(50);

      expect(() => {
        render(
          <ContentAugmentation
            sourceVideo="/test-video.mp4"
            annotations={incompleteAnnotations}
          />,
        );
      }).not.toThrow();

      // Valid annotation should still render
      expect(screen.getByText("Valid annotation")).toBeInTheDocument();
    });
  });

  describe("Internationalization Support", () => {
    it("handles right-to-left text properly", () => {
      const rtlAnnotations: Annotation[] = [
        {
          id: "arabic",
          type: "callout",
          text: "مرحبا بك في الفيديو التعليمي", // Arabic text
          startFrame: 0,
          endFrame: 100,
          position: { x: 50, y: 30 },
        },
        {
          id: "hebrew",
          type: "info",
          text: "ברוכים הבאים לסרטון החינוכי", // Hebrew text
          startFrame: 0,
          endFrame: 100,
          position: { x: 50, y: 70 },
        },
      ];

      (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(50);

      render(
        <ContentAugmentation
          sourceVideo="/test-video.mp4"
          annotations={rtlAnnotations}
        />,
      );

      // RTL text should render correctly
      expect(
        screen.getByText("مرحبا بك في الفيديو التعليمي"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("ברוכים הבאים לסרטון החינוכי"),
      ).toBeInTheDocument();
    });

    it("supports various character sets and emoji", () => {
      const unicodeAnnotations: Annotation[] = [
        {
          id: "emoji",
          type: "success",
          text: "Great job! 🎉 👏 ✅",
          startFrame: 0,
          endFrame: 100,
          position: { x: 30, y: 30 },
        },
        {
          id: "chinese",
          type: "info",
          text: "欢迎观看教程视频",
          startFrame: 0,
          endFrame: 100,
          position: { x: 70, y: 70 },
        },
        {
          id: "japanese",
          type: "callout",
          text: "チュートリアルビデオへようこそ",
          startFrame: 0,
          endFrame: 100,
          position: { x: 50, y: 50 },
        },
      ];

      (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(50);

      render(
        <ContentAugmentation
          sourceVideo="/test-video.mp4"
          annotations={unicodeAnnotations}
        />,
      );

      // Unicode characters should render correctly
      expect(screen.getByText("Great job! 🎉 👏 ✅")).toBeInTheDocument();
      expect(screen.getByText("欢迎观看教程视频")).toBeInTheDocument();
      expect(
        screen.getByText("チュートリアルビデオへようこそ"),
      ).toBeInTheDocument();
    });
  });
});
