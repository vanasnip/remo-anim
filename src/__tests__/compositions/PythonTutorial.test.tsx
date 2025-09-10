import * as React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
  PythonManimTutorial,
  ReactComponentTutorial,
} from "../../compositions/Instructional/PythonTutorial";
import { useCurrentFrame, useVideoConfig } from "remotion";

// Mock Remotion hooks and components
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

// Mock TutorialVideo component to test prop passing
interface MockTutorialVideoProps {
  title?: string;
  subtitle?: string;
  author?: string;
  steps?: Array<{
    title: string;
    duration: number;
    [key: string]: unknown;
  }>;
  theme?: {
    primaryColor?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

jest.mock("../../compositions/Instructional/TutorialVideo", () => ({
  TutorialVideo: (props: MockTutorialVideoProps) => (
    <div data-testid="tutorial-video">
      <div data-testid="tutorial-title">{props.title}</div>
      <div data-testid="tutorial-subtitle">{props.subtitle}</div>
      <div data-testid="tutorial-author">{props.author}</div>
      <div data-testid="tutorial-steps-count">{props.steps?.length || 0}</div>
      <div data-testid="tutorial-theme-primary">
        {props.theme?.primaryColor}
      </div>
      {props.steps?.map((step, index) => (
        <div key={index} data-testid={`step-${index}`}>
          <span data-testid={`step-title-${index}`}>{step.title}</span>
          <span data-testid={`step-duration-${index}`}>{step.duration}</span>
        </div>
      ))}
    </div>
  ),
}));

describe("PythonManimTutorial Component", () => {
  beforeEach(() => {
    (useCurrentFrame as jest.Mock).mockReturnValue(0);
    (useVideoConfig as jest.Mock).mockReturnValue({
      fps: 30,
      durationInFrames: 3600,
      width: 1920,
      height: 1080,
    });
  });

  it("renders with correct title and subtitle", () => {
    render(<PythonManimTutorial />);

    expect(screen.getByTestId("tutorial-title")).toHaveTextContent(
      "Creating Animations with Python Manim",
    );
    expect(screen.getByTestId("tutorial-subtitle")).toHaveTextContent(
      "Learn to create beautiful mathematical visualizations",
    );
  });

  it("has correct number of tutorial steps", () => {
    render(<PythonManimTutorial />);

    expect(screen.getByTestId("tutorial-steps-count")).toHaveTextContent("6");
  });

  it("includes all expected step titles", () => {
    render(<PythonManimTutorial />);

    const expectedSteps = [
      "Import Required Libraries",
      "Create the Axes",
      "Define the Function",
      "Animate the Creation",
      "Run the Animation",
      "Advanced: Add Interactivity",
    ];

    expectedSteps.forEach((title, index) => {
      expect(screen.getByTestId(`step-title-${index}`)).toHaveTextContent(
        title,
      );
    });
  });

  it("sets correct theme colors", () => {
    render(<PythonManimTutorial />);

    expect(screen.getByTestId("tutorial-theme-primary")).toHaveTextContent(
      "#2196f3",
    );
  });

  it("includes correct step durations", () => {
    render(<PythonManimTutorial />);

    const durations = ["300", "360", "300", "360", "300", "420"];

    durations.forEach((duration, index) => {
      expect(screen.getByTestId(`step-duration-${index}`)).toHaveTextContent(
        duration,
      );
    });
  });

  it("has author attribution", () => {
    render(<PythonManimTutorial />);

    expect(screen.getByTestId("tutorial-author")).toHaveTextContent(
      "Tutorial Series",
    );
  });
});

describe("ReactComponentTutorial Component", () => {
  beforeEach(() => {
    (useCurrentFrame as jest.Mock).mockReturnValue(0);
    (useVideoConfig as jest.Mock).mockReturnValue({
      fps: 30,
      durationInFrames: 2700,
      width: 1920,
      height: 1080,
    });
  });

  it("renders with correct title and subtitle", () => {
    render(<ReactComponentTutorial />);

    expect(screen.getByTestId("tutorial-title")).toHaveTextContent(
      "Building Reusable React Components",
    );
    expect(screen.getByTestId("tutorial-subtitle")).toHaveTextContent(
      "TypeScript, Testing, and Best Practices",
    );
  });

  it("has correct number of tutorial steps", () => {
    render(<ReactComponentTutorial />);

    expect(screen.getByTestId("tutorial-steps-count")).toHaveTextContent("3");
  });

  it("includes all expected React tutorial steps", () => {
    render(<ReactComponentTutorial />);

    const expectedSteps = [
      "Create a New Component",
      "Add Loading State",
      "Test the Component",
    ];

    expectedSteps.forEach((title, index) => {
      expect(screen.getByTestId(`step-title-${index}`)).toHaveTextContent(
        title,
      );
    });
  });

  it("sets React-specific theme colors", () => {
    render(<ReactComponentTutorial />);

    expect(screen.getByTestId("tutorial-theme-primary")).toHaveTextContent(
      "#61dafb",
    );
  });

  it("includes correct step durations for React tutorial", () => {
    render(<ReactComponentTutorial />);

    const durations = ["300", "300", "360"];

    durations.forEach((duration, index) => {
      expect(screen.getByTestId(`step-duration-${index}`)).toHaveTextContent(
        duration,
      );
    });
  });

  it("has author attribution", () => {
    render(<ReactComponentTutorial />);

    expect(screen.getByTestId("tutorial-author")).toHaveTextContent(
      "React Series",
    );
  });
});
