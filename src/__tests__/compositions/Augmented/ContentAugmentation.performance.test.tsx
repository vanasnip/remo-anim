import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
  ContentAugmentation,
  type Annotation,
} from "../../../compositions/Augmented/ContentAugmentation";
import * as Remotion from "remotion";

// Mock Remotion hooks
jest.mock("remotion");

describe("ContentAugmentation - Performance Tests", () => {
  const mockVideoConfig = {
    fps: 30,
    durationInFrames: 1800, // 60 seconds
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

  describe("Rendering Performance", () => {
    it("handles large number of annotations efficiently", () => {
      // Generate 100 annotations spread across the timeline
      const manyAnnotations: Annotation[] = Array.from(
        { length: 100 },
        (_, i) => ({
          id: `perf-${i}`,
          type: (
            ["callout", "info", "warning", "success", "highlight"] as const
          )[i % 5],
          text: `Annotation ${i}`,
          startFrame: i * 10,
          endFrame: i * 10 + 50,
          position: {
            x: 20 + (i % 10) * 8,
            y: 20 + Math.floor(i / 10) * 8,
          },
        }),
      );

      const startTime = performance.now();

      render(
        <ContentAugmentation
          sourceVideo="/test-video.mp4"
          annotations={manyAnnotations}
        />,
      );

      const renderTime = performance.now() - startTime;

      // Should render within reasonable time (less than 100ms)
      expect(renderTime).toBeLessThan(100);
    });

    it("filters active annotations efficiently", () => {
      // Create annotations that span the entire timeline
      const allTimeAnnotations: Annotation[] = Array.from(
        { length: 500 },
        (_, i) => ({
          id: `filter-${i}`,
          type: "info" as const,
          text: `Filter test ${i}`,
          startFrame: i,
          endFrame: i + 10,
          position: { x: 50, y: 50 },
        }),
      );

      // Test frame in the middle where only a few annotations should be active
      (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(250);

      const startTime = performance.now();

      render(
        <ContentAugmentation
          sourceVideo="/test-video.mp4"
          annotations={allTimeAnnotations}
        />,
      );

      const filterTime = performance.now() - startTime;

      // Filtering should be efficient even with many annotations
      expect(filterTime).toBeLessThan(50);
    });

    it("handles rapid re-renders without performance degradation", () => {
      const annotations: Annotation[] = [
        {
          id: "rapid-test",
          type: "callout",
          text: "Rapid render test",
          startFrame: 0,
          endFrame: 100,
          position: { x: 50, y: 50 },
        },
      ];

      const renderTimes: number[] = [];

      // Simulate rapid frame changes (common in video playback)
      for (let frame = 0; frame < 100; frame += 5) {
        (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(frame);

        const startTime = performance.now();
        render(
          <ContentAugmentation
            sourceVideo="/test-video.mp4"
            annotations={annotations}
          />,
        );
        const renderTime = performance.now() - startTime;

        renderTimes.push(renderTime);
      }

      // Average render time should be consistent (no degradation)
      const avgRenderTime =
        renderTimes.reduce((a, b) => a + b) / renderTimes.length;
      const maxRenderTime = Math.max(...renderTimes);

      expect(avgRenderTime).toBeLessThan(20); // Average under 20ms
      expect(maxRenderTime).toBeLessThan(100); // Max under 100ms
    });

    it("memory usage remains stable with complex animations", () => {
      const complexAnnotations: Annotation[] = [
        // Multiple overlapping highlights (expensive animations)
        ...Array.from({ length: 20 }, (_, i) => ({
          id: `highlight-${i}`,
          type: "highlight" as const,
          text: "",
          startFrame: i * 5,
          endFrame: i * 5 + 60,
          position: { x: 30 + (i % 5) * 15, y: 30 + Math.floor(i / 5) * 15 },
        })),
        // Multiple arrows with complex paths
        ...Array.from({ length: 10 }, (_, i) => ({
          id: `arrow-${i}`,
          type: "arrow" as const,
          text: `Arrow ${i}`,
          startFrame: i * 10,
          endFrame: i * 10 + 40,
          position: { x: 10 + i * 9, y: 10 + i * 9 },
          target: { x: 90 - i * 9, y: 90 - i * 9 },
        })),
      ];

      // Test multiple frames to simulate continuous playback
      const testFrames = [0, 25, 50, 75, 100, 125, 150, 175, 200];

      testFrames.forEach((frame) => {
        (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(frame);

        const startTime = performance.now();
        render(
          <ContentAugmentation
            sourceVideo="/test-video.mp4"
            annotations={complexAnnotations}
            enableZoomEffects={true}
          />,
        );
        const renderTime = performance.now() - startTime;

        // Complex animations should still render efficiently
        expect(renderTime).toBeLessThan(150);
      });
    });
  });

  describe("Animation Performance", () => {
    it("spring animations perform efficiently", () => {
      let springCallCount = 0;
      (Remotion.spring as jest.Mock).mockImplementation((params) => {
        springCallCount++;
        return Math.min(params.frame / 15, 1);
      });

      const springTestAnnotations: Annotation[] = Array.from(
        { length: 20 },
        (_, i) => ({
          id: `spring-${i}`,
          type: "callout" as const,
          text: `Spring ${i}`,
          startFrame: i * 5,
          endFrame: i * 5 + 50,
          position: { x: 25 + (i % 4) * 20, y: 25 + Math.floor(i / 4) * 20 },
        }),
      );

      (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(50);

      const startTime = performance.now();
      render(
        <ContentAugmentation
          sourceVideo="/test-video.mp4"
          annotations={springTestAnnotations}
        />,
      );
      const renderTime = performance.now() - startTime;

      // Should handle multiple spring animations efficiently
      expect(renderTime).toBeLessThan(100);
      expect(springCallCount).toBeGreaterThan(0);
    });

    it("interpolation animations perform efficiently", () => {
      let interpolateCallCount = 0;
      (Remotion.interpolate as jest.Mock).mockImplementation(
        (input, inputRange, outputRange, options) => {
          interpolateCallCount++;
          // Simple linear interpolation for testing
          const t = (input - inputRange[0]) / (inputRange[1] - inputRange[0]);
          return outputRange[0] + t * (outputRange[1] - outputRange[0]);
        },
      );

      const interpolateTestAnnotations: Annotation[] = Array.from(
        { length: 15 },
        (_, i) => ({
          id: `interpolate-${i}`,
          type: "callout" as const,
          text: `Interpolate ${i}`,
          startFrame: i * 8,
          endFrame: i * 8 + 60,
          position: { x: 30 + (i % 3) * 25, y: 30 + Math.floor(i / 3) * 25 },
        }),
      );

      (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(80);

      const startTime = performance.now();
      render(
        <ContentAugmentation
          sourceVideo="/test-video.mp4"
          annotations={interpolateTestAnnotations}
        />,
      );
      const renderTime = performance.now() - startTime;

      // Should handle multiple interpolations efficiently
      expect(renderTime).toBeLessThan(80);
      expect(interpolateCallCount).toBeGreaterThan(0);
    });

    it("zoom effects don't significantly impact performance", () => {
      const zoomTestAnnotation: Annotation = {
        id: "zoom-test",
        type: "highlight",
        text: "",
        startFrame: 0,
        endFrame: 200,
        position: { x: 50, y: 50 },
      };

      // Test with zoom effects enabled
      (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(100);

      const startTimeWithZoom = performance.now();
      render(
        <ContentAugmentation
          sourceVideo="/test-video.mp4"
          annotations={[zoomTestAnnotation]}
          enableZoomEffects={true}
        />,
      );
      const renderTimeWithZoom = performance.now() - startTimeWithZoom;

      // Test with zoom effects disabled
      const startTimeWithoutZoom = performance.now();
      render(
        <ContentAugmentation
          sourceVideo="/test-video.mp4"
          annotations={[zoomTestAnnotation]}
          enableZoomEffects={false}
        />,
      );
      const renderTimeWithoutZoom = performance.now() - startTimeWithoutZoom;

      // Zoom effects should not add significant overhead (less than 50% increase)
      expect(renderTimeWithZoom).toBeLessThan(renderTimeWithoutZoom * 1.5);
    });
  });

  describe("Memory and Resource Management", () => {
    it("cleans up properly on unmount", () => {
      const testAnnotations: Annotation[] = [
        {
          id: "cleanup-test",
          type: "callout",
          text: "Cleanup test",
          startFrame: 0,
          endFrame: 100,
          position: { x: 50, y: 50 },
        },
      ];

      const { unmount } = render(
        <ContentAugmentation
          sourceVideo="/test-video.mp4"
          annotations={testAnnotations}
        />,
      );

      // Unmount should not throw errors
      expect(() => unmount()).not.toThrow();
    });

    it("handles props changes efficiently", () => {
      const initialAnnotations: Annotation[] = [
        {
          id: "props-test",
          type: "info",
          text: "Initial",
          startFrame: 0,
          endFrame: 100,
          position: { x: 50, y: 50 },
        },
      ];

      const updatedAnnotations: Annotation[] = [
        {
          id: "props-test",
          type: "info",
          text: "Updated",
          startFrame: 0,
          endFrame: 100,
          position: { x: 60, y: 60 },
        },
      ];

      (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(50);

      const { rerender } = render(
        <ContentAugmentation
          sourceVideo="/test-video.mp4"
          annotations={initialAnnotations}
        />,
      );

      const startTime = performance.now();
      rerender(
        <ContentAugmentation
          sourceVideo="/test-video.mp4"
          annotations={updatedAnnotations}
        />,
      );
      const rerenderTime = performance.now() - startTime;

      // Prop updates should be efficient
      expect(rerenderTime).toBeLessThan(50);
    });
  });

  describe("Stress Testing", () => {
    it("handles maximum realistic annotation load", () => {
      // Simulate a very complex educational video with many annotations
      const maxAnnotations: Annotation[] = Array.from(
        { length: 1000 },
        (_, i) => ({
          id: `stress-${i}`,
          type: (
            [
              "callout",
              "info",
              "warning",
              "success",
              "highlight",
              "arrow",
            ] as const
          )[i % 6],
          text: `Stress test annotation ${i} with some longer text content`,
          startFrame: (i * 2) % 1800, // Spread across 60-second video
          endFrame: ((i * 2) % 1800) + 30, // 1-second duration each
          position: {
            x: 10 + (i % 20) * 4,
            y: 10 + Math.floor((i % 400) / 20) * 4,
          },
          ...(i % 6 === 5 && {
            target: {
              x: 90 - (i % 20) * 4,
              y: 90 - Math.floor((i % 400) / 20) * 4,
            },
          }),
          color:
            i % 3 === 0
              ? `#${(i % 16777215).toString(16).padStart(6, "0")}`
              : undefined,
          size: (["small", "medium", "large"] as const)[i % 3],
        }),
      );

      // Test at a busy point in the timeline
      (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(900);

      const startTime = performance.now();

      expect(() => {
        render(
          <ContentAugmentation
            sourceVideo="/stress-test-video.mp4"
            annotations={maxAnnotations}
            showTimeline={true}
            enableZoomEffects={true}
          />,
        );
      }).not.toThrow();

      const stressTestTime = performance.now() - startTime;

      // Even under extreme load, should complete within reasonable time
      expect(stressTestTime).toBeLessThan(1000); // 1 second max
    });

    it("maintains performance with continuous timeline scrubbing", () => {
      const scrubTestAnnotations: Annotation[] = Array.from(
        { length: 50 },
        (_, i) => ({
          id: `scrub-${i}`,
          type: "callout" as const,
          text: `Scrub ${i}`,
          startFrame: i * 10,
          endFrame: i * 10 + 30,
          position: { x: 25 + (i % 5) * 15, y: 25 + Math.floor(i / 5) * 15 },
        }),
      );

      const scrubTimes: number[] = [];

      // Simulate scrubbing through the timeline
      for (let frame = 0; frame < 500; frame += 10) {
        (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(frame);

        const startTime = performance.now();
        render(
          <ContentAugmentation
            sourceVideo="/scrub-test-video.mp4"
            annotations={scrubTestAnnotations}
            showTimeline={true}
            enableZoomEffects={true}
          />,
        );
        const scrubTime = performance.now() - startTime;

        scrubTimes.push(scrubTime);
      }

      const avgScrubTime =
        scrubTimes.reduce((a, b) => a + b) / scrubTimes.length;
      const maxScrubTime = Math.max(...scrubTimes);

      // Scrubbing should maintain consistent performance
      expect(avgScrubTime).toBeLessThan(30); // Average under 30ms
      expect(maxScrubTime).toBeLessThan(100); // Peak under 100ms
    });
  });
});
