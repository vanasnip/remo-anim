import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { EnhancedTimeline } from "../../components/EnhancedTimeline";
import type { Annotation } from "../../compositions/Augmented/ContentAugmentation";
import * as Remotion from "remotion";

// Mock Remotion hooks
jest.mock("remotion");

describe("EnhancedTimeline", () => {
  const mockAnnotations: Annotation[] = [
    {
      id: "1",
      type: "info",
      text: "Information",
      startFrame: 30,
      endFrame: 90,
      position: { x: 50, y: 50 },
    },
    {
      id: "2",
      type: "warning",
      text: "Warning",
      startFrame: 120,
      endFrame: 180,
      position: { x: 70, y: 30 },
    },
    {
      id: "3",
      type: "success",
      text: "Success",
      startFrame: 200,
      endFrame: 260,
      position: { x: 30, y: 70 },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(0);
    (Remotion.useVideoConfig as jest.Mock).mockReturnValue({
      fps: 30,
      durationInFrames: 300,
      width: 1920,
      height: 1080,
    });
  });

  it("renders without crashing", () => {
    render(<EnhancedTimeline annotations={[]} />);

    // Should have timeline container
    const timeline = screen.getByRole("generic");
    expect(timeline).toBeInTheDocument();
  });

  it("displays progress bar at correct position", () => {
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(150); // 50% of 300 frames

    const { container } = render(
      <EnhancedTimeline annotations={mockAnnotations} />,
    );

    // Check for progress bar with 50% width
    const progressBar = container.querySelector('[style*="width: 50%"]');
    expect(progressBar).toBeInTheDocument();
  });

  it("shows annotation markers", () => {
    const { container } = render(
      <EnhancedTimeline annotations={mockAnnotations} />,
    );

    // Should have annotation markers for each annotation
    const markers = container.querySelectorAll(
      '[style*="position: absolute"][style*="backgroundColor"]',
    );
    expect(markers.length).toBeGreaterThanOrEqual(mockAnnotations.length);
  });

  it("highlights active annotations", () => {
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(60); // Within first annotation

    const { container } = render(
      <EnhancedTimeline annotations={mockAnnotations} />,
    );

    // Active annotation should have different styling (higher z-index or different scale)
    const activeMarkers = container.querySelectorAll('[style*="zIndex: 10"]');
    expect(activeMarkers.length).toBeGreaterThan(0);
  });

  it("displays current time correctly", () => {
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(150); // 5 seconds at 30fps

    render(<EnhancedTimeline annotations={mockAnnotations} />);

    expect(screen.getByText("5s / 10s")).toBeInTheDocument();
  });

  it("shows frame numbers when enabled", () => {
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(150);

    render(
      <EnhancedTimeline
        annotations={mockAnnotations}
        showFrameNumbers={true}
      />,
    );

    expect(screen.getByText("Frame 150")).toBeInTheDocument();
  });

  it("hides frame numbers when disabled", () => {
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(150);

    render(
      <EnhancedTimeline
        annotations={mockAnnotations}
        showFrameNumbers={false}
      />,
    );

    expect(screen.queryByText("Frame 150")).not.toBeInTheDocument();
  });

  it("displays active annotation labels", () => {
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(60); // Within first annotation

    render(
      <EnhancedTimeline
        annotations={mockAnnotations}
        showAnnotationLabels={true}
      />,
    );

    expect(screen.getByText("Information")).toBeInTheDocument();
  });

  it("hides annotation labels when disabled", () => {
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(60); // Within first annotation

    render(
      <EnhancedTimeline
        annotations={mockAnnotations}
        showAnnotationLabels={false}
      />,
    );

    expect(screen.queryByText("Information")).not.toBeInTheDocument();
  });

  it("calls onAnnotationHover when hovering over annotation", () => {
    const mockOnAnnotationHover = jest.fn();

    const { container } = render(
      <EnhancedTimeline
        annotations={mockAnnotations}
        interactive={true}
        onAnnotationHover={mockOnAnnotationHover}
      />,
    );

    // Find annotation marker and trigger hover
    const marker = container.querySelector(
      '[style*="position: absolute"][style*="backgroundColor"]',
    );
    if (marker) {
      fireEvent.mouseEnter(marker);
      expect(mockOnAnnotationHover).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          type: expect.any(String),
        }),
      );
    }
  });

  it("calls onTimelineClick when clicking on timeline", () => {
    const mockOnTimelineClick = jest.fn();

    const { container } = render(
      <EnhancedTimeline
        annotations={mockAnnotations}
        interactive={true}
        onTimelineClick={mockOnTimelineClick}
      />,
    );

    // Find timeline container and trigger click
    const timeline = container.firstChild as HTMLElement;

    // Mock getBoundingClientRect
    const mockRect = {
      left: 0,
      top: 0,
      right: 1000,
      bottom: 100,
      width: 1000,
      height: 100,
    };

    jest
      .spyOn(timeline, "getBoundingClientRect")
      .mockReturnValue(mockRect as DOMRect);

    // Click at 50% position (should correspond to frame 150)
    fireEvent.click(timeline, {
      clientX: 500, // 50% of 1000px width
    });

    expect(mockOnTimelineClick).toHaveBeenCalledWith(150);
  });

  it("doesn't call interaction callbacks when interactive is false", () => {
    const mockOnAnnotationHover = jest.fn();
    const mockOnTimelineClick = jest.fn();

    const { container } = render(
      <EnhancedTimeline
        annotations={mockAnnotations}
        interactive={false}
        onAnnotationHover={mockOnAnnotationHover}
        onTimelineClick={mockOnTimelineClick}
      />,
    );

    // Try to interact with annotation marker
    const marker = container.querySelector(
      '[style*="position: absolute"][style*="backgroundColor"]',
    );
    if (marker) {
      fireEvent.mouseEnter(marker);
    }

    // Try to click on timeline
    const timeline = container.firstChild as HTMLElement;
    fireEvent.click(timeline);

    expect(mockOnAnnotationHover).not.toHaveBeenCalled();
    expect(mockOnTimelineClick).not.toHaveBeenCalled();
  });

  it("handles custom height prop", () => {
    const { container } = render(
      <EnhancedTimeline annotations={[]} height={120} />,
    );

    const timeline = container.firstChild as HTMLElement;
    expect(timeline).toHaveStyle("height: 120px");
  });

  it("displays playback status indicator", () => {
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(150); // Playing

    const { container } = render(
      <EnhancedTimeline annotations={mockAnnotations} />,
    );

    // Should show play icon when frame > 0 and < duration
    const playIcon = container.querySelector('[data-testid="PlayArrowIcon"]');
    expect(playIcon).toBeInTheDocument();
  });

  it("shows pause icon when at start or end", () => {
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(0); // At start

    const { container } = render(
      <EnhancedTimeline annotations={mockAnnotations} />,
    );

    // Should show pause icon when frame = 0
    const pauseIcon = container.querySelector('[data-testid="PauseIcon"]');
    expect(pauseIcon).toBeInTheDocument();
  });

  it("limits displayed annotation labels to prevent overflow", () => {
    // Create many overlapping annotations
    const manyAnnotations: Annotation[] = Array.from(
      { length: 10 },
      (_, i) => ({
        id: `annotation-${i}`,
        type: "info",
        text: `Annotation ${i}`,
        startFrame: 0,
        endFrame: 100,
        position: { x: 50, y: 50 },
      }),
    );

    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(50); // All active

    render(
      <EnhancedTimeline
        annotations={manyAnnotations}
        showAnnotationLabels={true}
      />,
    );

    // Should only show maximum 3 labels
    const labels = screen.getAllByText(/Annotation \d/);
    expect(labels.length).toBeLessThanOrEqual(3);
  });

  it("shows time segments for better visualization", () => {
    const { container } = render(
      <EnhancedTimeline annotations={mockAnnotations} />,
    );

    // Should have time segment dividers
    const segments = container.querySelectorAll(
      '[style*="backgroundColor: rgba(255,255,255,0.3)"]',
    );
    expect(segments.length).toBeGreaterThan(0);
  });

  it("handles empty annotations array", () => {
    render(<EnhancedTimeline annotations={[]} />);

    // Should still display time and progress
    expect(screen.getByText(/\d+s \/ \d+s/)).toBeInTheDocument();
  });

  it("applies different colors for different annotation types", () => {
    const { container } = render(
      <EnhancedTimeline annotations={mockAnnotations} />,
    );

    // Should have markers with different colors
    const infoMarker = container.querySelector('[style*="#2196f3"]');
    const warningMarker = container.querySelector('[style*="#ff9800"]');
    const successMarker = container.querySelector('[style*="#4caf50"]');

    expect(infoMarker).toBeInTheDocument();
    expect(warningMarker).toBeInTheDocument();
    expect(successMarker).toBeInTheDocument();
  });
});
