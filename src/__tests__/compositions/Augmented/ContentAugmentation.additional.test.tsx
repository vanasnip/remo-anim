import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
  ContentAugmentation,
  type Annotation,
} from "../../../compositions/Augmented/ContentAugmentation";
import * as Remotion from "remotion";

// Mock Remotion hooks
jest.mock("remotion");

describe("ContentAugmentation - Additional Test Coverage", () => {
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

  describe("Edge Cases and Error Handling", () => {
    it("handles empty annotations array", () => {
      render(
        <ContentAugmentation sourceVideo="/test-video.mp4" annotations={[]} />,
      );

      // Should still render video
      expect(screen.getByTestId("remotion-video")).toBeInTheDocument();
    });

    it("handles malformed annotation without position", () => {
      const malformedAnnotation = {
        id: "malformed",
        type: "callout" as const,
        text: "Test",
        startFrame: 0,
        endFrame: 50,
        // Missing position property
      } as any;

      (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(25);

      expect(() => {
        render(
          <ContentAugmentation
            sourceVideo="/test.mp4"
            annotations={[malformedAnnotation]}
          />,
        );
      }).not.toThrow();
    });

    it("handles negative frame values gracefully", () => {
      const annotation: Annotation = {
        id: "negative",
        type: "callout",
        text: "Test",
        startFrame: -10,
        endFrame: 10,
        position: { x: 50, y: 50 },
      };

      (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(5);

      render(
        <ContentAugmentation
          sourceVideo="/test.mp4"
          annotations={[annotation]}
        />,
      );

      expect(screen.getByText("Test")).toBeInTheDocument();
    });

    it("handles very large frame values", () => {
      const annotation: Annotation = {
        id: "large",
        type: "callout",
        text: "Large frame",
        startFrame: 999999,
        endFrame: 1000000,
        position: { x: 50, y: 50 },
      };

      (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(999999);

      render(
        <ContentAugmentation
          sourceVideo="/test.mp4"
          annotations={[annotation]}
        />,
      );

      expect(screen.getByText("Large frame")).toBeInTheDocument();
    });

    it("handles annotations with extreme position values", () => {
      const extremeAnnotations: Annotation[] = [
        {
          id: "top-left",
          type: "callout",
          text: "Top left",
          startFrame: 0,
          endFrame: 50,
          position: { x: 0, y: 0 },
        },
        {
          id: "bottom-right",
          type: "callout",
          text: "Bottom right",
          startFrame: 0,
          endFrame: 50,
          position: { x: 100, y: 100 },
        },
        {
          id: "negative",
          type: "callout",
          text: "Negative",
          startFrame: 0,
          endFrame: 50,
          position: { x: -10, y: -10 },
        },
        {
          id: "over-100",
          type: "callout",
          text: "Over 100",
          startFrame: 0,
          endFrame: 50,
          position: { x: 150, y: 150 },
        },
      ];

      (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(25);

      render(
        <ContentAugmentation
          sourceVideo="/test.mp4"
          annotations={extremeAnnotations}
        />,
      );

      expect(screen.getByText("Top left")).toBeInTheDocument();
      expect(screen.getByText("Bottom right")).toBeInTheDocument();
      expect(screen.getByText("Negative")).toBeInTheDocument();
      expect(screen.getByText("Over 100")).toBeInTheDocument();
    });
  });

  describe("Performance and Animation Edge Cases", () => {
    it("handles zero-duration annotations", () => {
      const zeroDurationAnnotation: Annotation = {
        id: "zero",
        type: "callout",
        text: "Zero duration",
        startFrame: 50,
        endFrame: 50, // Same as start
        position: { x: 50, y: 50 },
      };

      (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(50);

      render(
        <ContentAugmentation
          sourceVideo="/test.mp4"
          annotations={[zeroDurationAnnotation]}
        />,
      );

      expect(screen.getByText("Zero duration")).toBeInTheDocument();
    });

    it("handles very short annotations (1 frame)", () => {
      const shortAnnotation: Annotation = {
        id: "short",
        type: "info",
        text: "Short",
        startFrame: 100,
        endFrame: 101, // 1 frame duration
        position: { x: 50, y: 50 },
      };

      (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(100);

      render(
        <ContentAugmentation
          sourceVideo="/test.mp4"
          annotations={[shortAnnotation]}
        />,
      );

      expect(screen.getByText("Short")).toBeInTheDocument();
    });

    it("handles overlapping animations correctly", () => {
      const overlappingAnnotations: Annotation[] = Array.from(
        { length: 10 },
        (_, i) => ({
          id: `overlap-${i}`,
          type: "info" as const,
          text: `Overlap ${i}`,
          startFrame: i * 5, // Each starts 5 frames after the previous
          endFrame: i * 5 + 50, // Each lasts 50 frames
          position: { x: 10 + i * 8, y: 10 + i * 8 },
        }),
      );

      (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(25);

      render(
        <ContentAugmentation
          sourceVideo="/test.mp4"
          annotations={overlappingAnnotations}
        />,
      );

      // Several should be visible at frame 25
      expect(screen.getByText("Overlap 0")).toBeInTheDocument();
      expect(screen.getByText("Overlap 1")).toBeInTheDocument();
      expect(screen.getByText("Overlap 2")).toBeInTheDocument();
    });

    it("handles rapid frame changes in spring animation", () => {
      const springCalls: number[] = [];
      (Remotion.spring as jest.Mock).mockImplementation(({ frame }) => {
        springCalls.push(frame);
        return Math.min(frame / 15, 1); // Simulate spring animation
      });

      const annotation: Annotation = {
        id: "spring-test",
        type: "callout",
        text: "Spring test",
        startFrame: 100,
        endFrame: 200,
        position: { x: 50, y: 50 },
      };

      // Simulate rapid frame changes
      const frames = [100, 105, 110, 115, 120];
      frames.forEach((frame) => {
        (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(frame);
        render(
          <ContentAugmentation
            sourceVideo="/test.mp4"
            annotations={[annotation]}
          />,
        );
      });

      // Verify spring was called for each frame relative to annotation start
      expect(springCalls).toEqual([0, 5, 10, 15, 20]);
    });
  });

  describe("Zoom Effects and Timeline Features", () => {
    it("applies correct zoom origin for annotations at different positions", () => {
      const cornerAnnotations: Annotation[] = [
        {
          id: "top-left",
          type: "highlight",
          text: "",
          startFrame: 0,
          endFrame: 100,
          position: { x: 10, y: 10 },
        },
        {
          id: "bottom-right",
          type: "highlight",
          text: "",
          startFrame: 100,
          endFrame: 200,
          position: { x: 90, y: 90 },
        },
      ];

      // Test first annotation
      (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(50);
      const { container, rerender } = render(
        <ContentAugmentation
          sourceVideo="/test.mp4"
          annotations={cornerAnnotations}
          enableZoomEffects={true}
        />,
      );

      let zoomContainer = container.querySelector(
        '[style*="transform-origin"]',
      );
      expect(zoomContainer).toHaveStyle("transform-origin: 10% 10%");

      // Test second annotation
      (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(150);
      rerender(
        <ContentAugmentation
          sourceVideo="/test.mp4"
          annotations={cornerAnnotations}
          enableZoomEffects={true}
        />,
      );

      zoomContainer = container.querySelector('[style*="transform-origin"]');
      expect(zoomContainer).toHaveStyle("transform-origin: 90% 90%");
    });

    it("timeline shows correct progress at various time points", () => {
      const testPoints = [
        { frame: 0, expectedTime: "0s" },
        { frame: 30, expectedTime: "1s" },
        { frame: 150, expectedTime: "5s" },
        { frame: 450, expectedTime: "15s" },
        { frame: 900, expectedTime: "30s" },
      ];

      testPoints.forEach(({ frame, expectedTime }) => {
        (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(frame);
        render(
          <ContentAugmentation
            sourceVideo="/test.mp4"
            annotations={[]}
            showTimeline={true}
          />,
        );

        expect(screen.getByText(expectedTime)).toBeInTheDocument();
      });
    });

    it("timeline markers render for all annotation types", () => {
      const allTypeAnnotations: Annotation[] = [
        {
          id: "callout",
          type: "callout",
          text: "Callout",
          startFrame: 0,
          endFrame: 100,
          position: { x: 20, y: 20 },
        },
        {
          id: "highlight",
          type: "highlight",
          text: "",
          startFrame: 100,
          endFrame: 200,
          position: { x: 40, y: 40 },
        },
        {
          id: "arrow",
          type: "arrow",
          text: "Arrow",
          startFrame: 200,
          endFrame: 300,
          position: { x: 60, y: 60 },
          target: { x: 80, y: 80 },
        },
        {
          id: "info",
          type: "info",
          text: "Info",
          startFrame: 300,
          endFrame: 400,
          position: { x: 30, y: 70 },
        },
        {
          id: "warning",
          type: "warning",
          text: "Warning",
          startFrame: 400,
          endFrame: 500,
          position: { x: 70, y: 30 },
        },
        {
          id: "success",
          type: "success",
          text: "Success",
          startFrame: 500,
          endFrame: 600,
          position: { x: 50, y: 50 },
        },
      ];

      (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(0);

      const { container } = render(
        <ContentAugmentation
          sourceVideo="/test.mp4"
          annotations={allTypeAnnotations}
          showTimeline={true}
        />,
      );

      // Check for timeline markers (should be 6 markers for 6 annotations)
      const markers = container.querySelectorAll('[style*="opacity: 0.5"]');
      expect(markers.length).toBe(6);
    });
  });

  describe("Accessibility and User Experience", () => {
    it("maintains proper z-index layering", () => {
      const layeredAnnotations: Annotation[] = [
        {
          id: "background",
          type: "highlight",
          text: "",
          startFrame: 0,
          endFrame: 100,
          position: { x: 50, y: 50 },
        },
        {
          id: "foreground",
          type: "callout",
          text: "Front",
          startFrame: 0,
          endFrame: 100,
          position: { x: 50, y: 50 },
        },
      ];

      (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(50);

      const { container } = render(
        <ContentAugmentation
          sourceVideo="/test.mp4"
          annotations={layeredAnnotations}
        />,
      );

      const callout = container.querySelector('[style*="z-index: 100"]');
      const highlight = container.querySelector('[style*="z-index: 90"]');

      expect(callout).toBeInTheDocument();
      expect(highlight).toBeInTheDocument();
    });

    it("handles long text in annotations gracefully", () => {
      const longTextAnnotation: Annotation = {
        id: "long-text",
        type: "callout",
        text: "This is a very long annotation text that should be handled gracefully by the component without breaking the layout or causing overflow issues in the video player interface",
        startFrame: 0,
        endFrame: 100,
        position: { x: 50, y: 50 },
      };

      (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(50);

      render(
        <ContentAugmentation
          sourceVideo="/test.mp4"
          annotations={[longTextAnnotation]}
        />,
      );

      expect(
        screen.getByText(/This is a very long annotation text/),
      ).toBeInTheDocument();
    });

    it("handles special characters in annotation text", () => {
      const specialCharAnnotation: Annotation = {
        id: "special",
        type: "info",
        text: "Special chars: áéíóú ñ ç @#$%^&*()[]{}|\\:;\"'<>?/.,+=~`",
        startFrame: 0,
        endFrame: 100,
        position: { x: 50, y: 50 },
      };

      (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(50);

      render(
        <ContentAugmentation
          sourceVideo="/test.mp4"
          annotations={[specialCharAnnotation]}
        />,
      );

      expect(screen.getByText(/Special chars:/)).toBeInTheDocument();
    });

    it("handles empty string text in annotations", () => {
      const emptyTextAnnotations: Annotation[] = [
        {
          id: "empty-callout",
          type: "callout",
          text: "",
          startFrame: 0,
          endFrame: 100,
          position: { x: 25, y: 25 },
        },
        {
          id: "empty-info",
          type: "info",
          text: "",
          startFrame: 0,
          endFrame: 100,
          position: { x: 75, y: 75 },
        },
      ];

      (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(50);

      expect(() => {
        render(
          <ContentAugmentation
            sourceVideo="/test.mp4"
            annotations={emptyTextAnnotations}
          />,
        );
      }).not.toThrow();
    });
  });

  describe("Video Source Handling", () => {
    it("handles various video file extensions", () => {
      const videoTypes = [".mp4", ".webm", ".mov", ".avi"];

      videoTypes.forEach((ext) => {
        render(
          <ContentAugmentation
            sourceVideo={`/test-video${ext}`}
            annotations={[]}
          />,
        );

        const video = screen.getByTestId("remotion-video");
        expect(video).toHaveAttribute("src", `/public/test-video${ext}`);
      });
    });

    it("handles relative and absolute video paths", () => {
      const paths = [
        "video.mp4",
        "./video.mp4",
        "../video.mp4",
        "/absolute/path/video.mp4",
        "assets/manim/video.mp4",
      ];

      paths.forEach((path) => {
        render(<ContentAugmentation sourceVideo={path} annotations={[]} />);

        const video = screen.getByTestId("remotion-video");
        expect(video).toHaveAttribute("src", `/public/${path}`);
      });
    });

    it("handles video loading with different network conditions", () => {
      const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();

      const { container } = render(
        <ContentAugmentation
          sourceVideo="/slow-loading-video.mp4"
          annotations={[]}
        />,
      );

      const video = container.querySelector("video");
      if (video?.onerror) {
        // Simulate network error
        const networkError = new Event("error");
        (video.onerror as (event: Event) => void)(networkError);

        expect(consoleWarnSpy).toHaveBeenCalledWith(
          "Source video could not be loaded:",
          networkError,
        );
      }

      consoleWarnSpy.mockRestore();
    });
  });
});
