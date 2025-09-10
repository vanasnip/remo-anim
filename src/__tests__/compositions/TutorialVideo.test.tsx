import * as React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { TutorialVideo } from "../../compositions/Instructional/TutorialVideo";
import { useCurrentFrame, useVideoConfig } from "remotion";

// Mock Remotion hooks
jest.mock("remotion", () => ({
  ...jest.requireActual("remotion"),
  useCurrentFrame: jest.fn(() => 0),
  useVideoConfig: jest.fn(() => ({
    fps: 30,
    durationInFrames: 3600,
    width: 1920,
    height: 1080,
  })),
  interpolate: jest.fn((frame, inputRange, outputRange) => outputRange[0]),
  spring: jest.fn(() => 1),
  Audio: ({
    src,
    ...props
  }: React.AudioHTMLAttributes<HTMLAudioElement> & { src: string }) => (
    <audio data-testid="audio" src={src} {...props} />
  ),
  Video: ({
    src,
    ...props
  }: React.VideoHTMLAttributes<HTMLVideoElement> & { src: string }) => (
    <video data-testid="video" src={src} {...props} />
  ),
  Img: ({
    src,
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement> & { src: string }) => (
    <img data-testid="img" src={src} {...props} />
  ),
  AbsoluteFill: ({
    children,
    ...props
  }: React.PropsWithChildren<React.HTMLAttributes<HTMLDivElement>>) => (
    <div data-testid="absolute-fill" {...props}>
      {children}
    </div>
  ),
  Sequence: ({
    children,
    from,
    durationInFrames,
  }: React.PropsWithChildren<{
    from?: number;
    durationInFrames?: number;
  }>) => (
    <div
      data-testid="sequence"
      data-from={from}
      data-duration={durationInFrames}
    >
      {children}
    </div>
  ),
  staticFile: (path: string) => `/static/${path}`,
}));

// Mock syntax highlighter
jest.mock("react-syntax-highlighter", () => ({
  Prism: ({
    children,
    language,
    ...props
  }: React.PropsWithChildren<{
    language?: string;
    style?: Record<string, unknown>;
  }>) => (
    <pre data-testid="code-block" data-language={language} {...props}>
      <code>{children}</code>
    </pre>
  ),
}));

jest.mock("react-syntax-highlighter/dist/esm/styles/prism", () => ({
  vscDarkPlus: {},
}));

describe("TutorialVideo Component", () => {
  const mockSteps = [
    {
      title: "Step 1: Setup",
      description: "Initialize the project",
      duration: 300,
      codeSnippet: {
        language: "javascript",
        code: 'console.log("Hello World");',
        filename: "index.js",
        highlights: [1],
      },
      tipText: "Remember to save your file",
      keyboardShortcut: "Ctrl+S",
    },
    {
      title: "Step 2: Run",
      description: "Execute the script",
      duration: 300,
      terminalOutput: "$ node index.js\nHello World",
      manimVideo: "animation.mp4",
      voiceOverAudio: "narration.mp3",
    },
  ];

  const defaultProps = {
    title: "Test Tutorial",
    subtitle: "Learning to code",
    author: "Test Author",
    steps: mockSteps,
    backgroundMusic: "background.mp3",
    theme: {
      primaryColor: "#1976d2",
      secondaryColor: "#42a5f5",
      codeTheme: "dark" as const,
    },
  };

  beforeEach(() => {
    (useCurrentFrame as jest.Mock).mockReturnValue(0);
    (useVideoConfig as jest.Mock).mockReturnValue({
      fps: 30,
      durationInFrames: 600,
      width: 1920,
      height: 1080,
    });
  });

  it("renders tutorial title and subtitle", () => {
    render(<TutorialVideo {...defaultProps} />);

    expect(screen.getByText("Test Tutorial")).toBeInTheDocument();
    expect(screen.getByText("Learning to code")).toBeInTheDocument();
    expect(screen.getByText("by Test Author")).toBeInTheDocument();
  });

  it("displays the first step content at frame 0", () => {
    render(<TutorialVideo {...defaultProps} />);

    expect(screen.getByText("Step 1: Setup")).toBeInTheDocument();
    expect(screen.getByText("Initialize the project")).toBeInTheDocument();
  });

  it("shows code snippet with syntax highlighting", () => {
    render(<TutorialVideo {...defaultProps} />);

    const codeBlock = screen.getByTestId("code-block");
    expect(codeBlock).toBeInTheDocument();
    expect(codeBlock).toHaveAttribute("data-language", "javascript");
  });

  it("displays keyboard shortcut when provided", () => {
    render(<TutorialVideo {...defaultProps} />);

    expect(screen.getByText(/Ctrl\+S/)).toBeInTheDocument();
  });

  it("shows pro tip when provided", () => {
    render(<TutorialVideo {...defaultProps} />);

    expect(screen.getByText("Remember to save your file")).toBeInTheDocument();
  });

  it("renders step indicator with correct progress", () => {
    render(<TutorialVideo {...defaultProps} />);

    expect(screen.getByText("Step 1: Setup")).toBeInTheDocument();
    expect(screen.getByText("Step 2: Run")).toBeInTheDocument();
  });

  it("switches to second step when frame advances", () => {
    (useCurrentFrame as jest.Mock).mockReturnValue(350);

    render(<TutorialVideo {...defaultProps} />);

    expect(screen.getByText("Step 2: Run")).toBeInTheDocument();
    expect(screen.getByText("Execute the script")).toBeInTheDocument();
  });

  it("renders terminal output for appropriate steps", () => {
    (useCurrentFrame as jest.Mock).mockReturnValue(350);

    render(<TutorialVideo {...defaultProps} />);

    expect(screen.getByText(/Terminal/)).toBeInTheDocument();
  });

  it("includes background music audio element", () => {
    render(<TutorialVideo {...defaultProps} />);

    const audioElements = screen.getAllByTestId("audio");
    const backgroundAudio = audioElements.find(
      (el) => el.getAttribute("src") === "/static/background.mp3",
    );
    expect(backgroundAudio).toBeInTheDocument();
  });

  it("includes voice-over audio for steps", () => {
    (useCurrentFrame as jest.Mock).mockReturnValue(350);

    render(<TutorialVideo {...defaultProps} />);

    const audioElements = screen.getAllByTestId("audio");
    const voiceOverAudio = audioElements.find(
      (el) => el.getAttribute("src") === "/static/narration.mp3",
    );
    expect(voiceOverAudio).toBeInTheDocument();
  });

  it("shows manim video when provided", () => {
    (useCurrentFrame as jest.Mock).mockReturnValue(350);

    render(<TutorialVideo {...defaultProps} />);

    const videoElement = screen.getByTestId("video");
    expect(videoElement).toHaveAttribute("src", "/static/animation.mp4");
  });

  it("displays current step and total steps", () => {
    render(<TutorialVideo {...defaultProps} />);

    expect(screen.getByText(/Step 1 of 2/)).toBeInTheDocument();
  });

  it("shows time progress", () => {
    render(<TutorialVideo {...defaultProps} />);

    expect(screen.getByText(/0s \/ 20s/)).toBeInTheDocument();
  });

  it("applies theme colors correctly", () => {
    const { container } = render(<TutorialVideo {...defaultProps} />);

    const styledElements = container.querySelectorAll('[style*="1976d2"]');
    expect(styledElements.length).toBeGreaterThan(0);
  });

  it("handles missing optional props gracefully", () => {
    const minimalProps = {
      title: "Minimal Tutorial",
      steps: [
        {
          title: "Single Step",
          description: "Basic step",
          duration: 300,
        },
      ],
    };

    render(<TutorialVideo {...minimalProps} />);

    expect(screen.getByText("Minimal Tutorial")).toBeInTheDocument();
    expect(screen.getByText("Single Step")).toBeInTheDocument();
  });

  it("handles empty steps array", () => {
    const emptyProps = {
      ...defaultProps,
      steps: [],
    };

    render(<TutorialVideo {...emptyProps} />);

    expect(screen.getByText("Test Tutorial")).toBeInTheDocument();
    // Should not crash
  });

  it("calculates step timings correctly", () => {
    const { rerender } = render(<TutorialVideo {...defaultProps} />);

    // First step (frames 0-299)
    (useCurrentFrame as jest.Mock).mockReturnValue(150);
    rerender(<TutorialVideo {...defaultProps} />);
    expect(screen.getByText("Step 1: Setup")).toBeInTheDocument();

    // Second step (frames 300-599)
    (useCurrentFrame as jest.Mock).mockReturnValue(450);
    rerender(<TutorialVideo {...defaultProps} />);
    expect(screen.getByText("Step 2: Run")).toBeInTheDocument();
  });
});
