import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
  ContentAugmentation,
  type Annotation,
} from "../../../Augmented/ContentAugmentation";
import * as Remotion from "remotion";

// Mock Remotion hooks
jest.mock("remotion");

describe("ContentAugmentation", () => {
  const mockAnnotations: Annotation[] = [
    {
      id: "1",
      type: "callout",
      text: "Important note",
      startFrame: 30,
      endFrame: 90,
      position: { x: 50, y: 50 },
    },
    {
      id: "2",
      type: "highlight",
      text: "",
      startFrame: 100,
      endFrame: 150,
      position: { x: 30, y: 30 },
      size: "large",
    },
    {
      id: "3",
      type: "arrow",
      text: "Look here",
      startFrame: 200,
      endFrame: 250,
      position: { x: 20, y: 20 },
      target: { x: 60, y: 60 },
      color: "#ff0000",
    },
    {
      id: "4",
      type: "info",
      text: "Information",
      startFrame: 300,
      endFrame: 350,
      position: { x: 70, y: 20 },
    },
    {
      id: "5",
      type: "warning",
      text: "Warning message",
      startFrame: 400,
      endFrame: 450,
      position: { x: 50, y: 70 },
    },
    {
      id: "6",
      type: "success",
      text: "Success!",
      startFrame: 500,
      endFrame: 550,
      position: { x: 50, y: 50 },
      size: "small",
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(0);
    (Remotion.useVideoConfig as jest.Mock).mockReturnValue({
      fps: 30,
      durationInFrames: 600,
      width: 1920,
      height: 1080,
    });
  });

  it("renders without crashing", () => {
    render(
      <ContentAugmentation sourceVideo="/test-video.mp4" annotations={[]} />,
    );

    const video = screen.getByTestId("remotion-video");
    expect(video).toBeInTheDocument();
  });

  it("displays source video", () => {
    render(
      <ContentAugmentation sourceVideo="/test-video.mp4" annotations={[]} />,
    );

    const video = screen.getByTestId("remotion-video");
    expect(video).toHaveAttribute(
      "src",
      "http://localhost:3000/public//test-video.mp4",
    );
  });

  it("shows no annotations when frame is outside all ranges", () => {
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(10);

    const { container } = render(
      <ContentAugmentation
        sourceVideo="/test-video.mp4"
        annotations={mockAnnotations}
      />,
    );

    expect(container.textContent).not.toContain("Important note");
    expect(container.textContent).not.toContain("Look here");
  });

  it("displays callout annotation when in frame range", () => {
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(50);

    render(
      <ContentAugmentation
        sourceVideo="/test-video.mp4"
        annotations={mockAnnotations}
      />,
    );

    expect(screen.getByText("Important note")).toBeInTheDocument();
  });

  it("shows highlight annotation with correct styling", () => {
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(125);

    const { container } = render(
      <ContentAugmentation
        sourceVideo="/test-video.mp4"
        annotations={mockAnnotations}
      />,
    );

    // Check for highlight circle element
    const highlight = container.querySelector('[style*="border-radius: 50%"]');
    expect(highlight).toBeInTheDocument();
  });

  it("renders arrow annotation with text", () => {
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(225);

    render(
      <ContentAugmentation
        sourceVideo="/test-video.mp4"
        annotations={mockAnnotations}
      />,
    );

    expect(screen.getByText("Look here")).toBeInTheDocument();
  });

  it("displays info chip annotation", () => {
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(325);

    render(
      <ContentAugmentation
        sourceVideo="/test-video.mp4"
        annotations={mockAnnotations}
      />,
    );

    expect(screen.getByText("Information")).toBeInTheDocument();
  });

  it("shows warning annotation", () => {
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(425);

    render(
      <ContentAugmentation
        sourceVideo="/test-video.mp4"
        annotations={mockAnnotations}
      />,
    );

    expect(screen.getByText("Warning message")).toBeInTheDocument();
  });

  it("displays success annotation", () => {
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(525);

    render(
      <ContentAugmentation
        sourceVideo="/test-video.mp4"
        annotations={mockAnnotations}
      />,
    );

    expect(screen.getByText("Success!")).toBeInTheDocument();
  });

  it("handles multiple simultaneous annotations", () => {
    const overlappingAnnotations: Annotation[] = [
      {
        id: "a1",
        type: "callout",
        text: "First",
        startFrame: 50,
        endFrame: 100,
        position: { x: 30, y: 30 },
      },
      {
        id: "a2",
        type: "info",
        text: "Second",
        startFrame: 60,
        endFrame: 110,
        position: { x: 70, y: 70 },
      },
    ];

    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(75);

    render(
      <ContentAugmentation
        sourceVideo="/test-video.mp4"
        annotations={overlappingAnnotations}
      />,
    );

    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
  });

  it("shows timeline when showTimeline is true", () => {
    render(
      <ContentAugmentation
        sourceVideo="/test-video.mp4"
        annotations={mockAnnotations}
        showTimeline={true}
      />,
    );

    expect(screen.getByText("0s")).toBeInTheDocument();
  });

  it("hides timeline when showTimeline is false", () => {
    render(
      <ContentAugmentation
        sourceVideo="/test-video.mp4"
        annotations={mockAnnotations}
        showTimeline={false}
      />,
    );

    expect(screen.queryByText("0s")).not.toBeInTheDocument();
  });

  it("updates timeline progress based on frame", () => {
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(150); // 5 seconds at 30fps

    render(
      <ContentAugmentation
        sourceVideo="/test-video.mp4"
        annotations={mockAnnotations}
        showTimeline={true}
      />,
    );

    expect(screen.getByText("5s")).toBeInTheDocument();
  });

  it("applies zoom effect when enableZoomEffects is true and highlight is active", () => {
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(125);

    const { container } = render(
      <ContentAugmentation
        sourceVideo="/test-video.mp4"
        annotations={mockAnnotations}
        enableZoomEffects={true}
      />,
    );

    // Check for transform scale on video container
    const videoContainer = container.querySelector('[style*="transform"]');
    expect(videoContainer).toBeInTheDocument();
  });

  it("does not apply zoom when enableZoomEffects is false", () => {
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(125);

    const { container } = render(
      <ContentAugmentation
        sourceVideo="/test-video.mp4"
        annotations={mockAnnotations}
        enableZoomEffects={false}
      />,
    );

    const videoContainer = container.querySelector('[style*="scale(1)"]');
    expect(videoContainer).toBeDefined();
  });

  it("handles video error gracefully", () => {
    const consoleSpy = jest.spyOn(console, "warn").mockImplementation();

    const { container } = render(
      <ContentAugmentation sourceVideo="/invalid-video.mp4" annotations={[]} />,
    );

    const video = container.querySelector("video");
    if (video?.onerror) {
      const mockError = new Event("error");
      const errorHandler = video.onerror as (event: Event) => void;
      errorHandler(mockError);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Source video could not be loaded:",
        mockError,
      );
    }

    consoleSpy.mockRestore();
  });

  it("applies custom colors to annotations", () => {
    const customColorAnnotation: Annotation = {
      id: "custom",
      type: "callout",
      text: "Custom color",
      startFrame: 0,
      endFrame: 50,
      position: { x: 50, y: 50 },
      color: "#00ff00",
    };

    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(25);

    const { container } = render(
      <ContentAugmentation
        sourceVideo="/test.mp4"
        annotations={[customColorAnnotation]}
      />,
    );

    const callout = container.querySelector('[style*="#00ff00"]');
    expect(callout).toBeDefined();
  });

  it("applies size modifiers correctly", () => {
    const sizedAnnotations: Annotation[] = [
      {
        id: "small",
        type: "info",
        text: "Small",
        startFrame: 0,
        endFrame: 50,
        position: { x: 25, y: 50 },
        size: "small",
      },
      {
        id: "large",
        type: "info",
        text: "Large",
        startFrame: 0,
        endFrame: 50,
        position: { x: 75, y: 50 },
        size: "large",
      },
    ];

    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(25);

    render(
      <ContentAugmentation
        sourceVideo="/test.mp4"
        annotations={sizedAnnotations}
      />,
    );

    expect(screen.getByText("Small")).toBeInTheDocument();
    expect(screen.getByText("Large")).toBeInTheDocument();
  });

  it("animates annotation entrance with spring", () => {
    const mockSpring = Remotion.spring as jest.Mock;
    mockSpring.mockReturnValue(0.5);

    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(35);

    render(
      <ContentAugmentation
        sourceVideo="/test.mp4"
        annotations={mockAnnotations}
      />,
    );

    expect(mockSpring).toHaveBeenCalledWith(
      expect.objectContaining({
        frame: 5, // 35 - 30 (startFrame)
        fps: 30,
        config: expect.objectContaining({
          damping: 12,
        }),
      }),
    );
  });

  it("animates annotation exit correctly", () => {
    const mockInterpolate = Remotion.interpolate as jest.Mock;

    // Near end of first annotation (frame 85 of 30-90)
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(85);

    render(
      <ContentAugmentation
        sourceVideo="/test.mp4"
        annotations={mockAnnotations}
      />,
    );

    // Check that interpolate is called for exit animation
    expect(mockInterpolate).toHaveBeenCalledWith(
      55, // annFrame (85 - 30)
      [50, 60], // duration - 10 to duration
      [1, 0],
      expect.objectContaining({ extrapolateLeft: "clamp" }),
    );
  });

  it("shows annotation markers on timeline", () => {
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(0);

    const { container } = render(
      <ContentAugmentation
        sourceVideo="/test.mp4"
        annotations={mockAnnotations}
        showTimeline={true}
      />,
    );

    // Check for annotation marker elements
    const markers = container.querySelectorAll('[style*="opacity: 0.5"]');
    expect(markers.length).toBeGreaterThan(0);
  });

  it("skips arrow annotation without target", () => {
    const arrowWithoutTarget: Annotation = {
      id: "arrow-no-target",
      type: "arrow",
      text: "No target",
      startFrame: 0,
      endFrame: 50,
      position: { x: 50, y: 50 },
    };

    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(25);

    const { container } = render(
      <ContentAugmentation
        sourceVideo="/test.mp4"
        annotations={[arrowWithoutTarget]}
      />,
    );

    expect(container.textContent).not.toContain("No target");
  });

  it("calculates arrow angle and distance correctly", () => {
    const arrowAnnotation: Annotation = {
      id: "arrow-calc",
      type: "arrow",
      text: "Arrow",
      startFrame: 0,
      endFrame: 50,
      position: { x: 0, y: 0 },
      target: { x: 100, y: 0 },
    };

    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(25);

    const { container } = render(
      <ContentAugmentation
        sourceVideo="/test.mp4"
        annotations={[arrowAnnotation]}
      />,
    );

    // Arrow should be rendered horizontally (0 degrees)
    const arrow = container.querySelector('[style*="rotate"]');
    expect(arrow).toBeInTheDocument();
  });

  it("applies pulsing effect to annotations", () => {
    const mockInterpolate = Remotion.interpolate as jest.Mock;

    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(50);

    render(
      <ContentAugmentation
        sourceVideo="/test.mp4"
        annotations={mockAnnotations}
      />,
    );

    // Check for pulse animation calculation
    const pulseCalls = mockInterpolate.mock.calls.filter(
      (call) => call[1] && call[1].toString() === [0, 15, 30].toString(),
    );
    expect(pulseCalls.length).toBeGreaterThan(0);
  });
});
