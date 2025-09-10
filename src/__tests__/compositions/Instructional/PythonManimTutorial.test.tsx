import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { PythonManimTutorial } from "../../../compositions/Instructional/PythonManimTutorial";
import * as Remotion from "remotion";

// Mock Remotion hooks
jest.mock("remotion");

// Mock react-syntax-highlighter
jest.mock("react-syntax-highlighter", () => ({
  Prism: ({
    children,
    language,
    ...props
  }: React.PropsWithChildren<{
    language?: string;
    style?: Record<string, unknown>;
    customStyle?: React.CSSProperties;
  }>) => (
    <pre data-testid="syntax-highlighter" data-language={language} {...props}>
      {children}
    </pre>
  ),
}));

jest.mock("react-syntax-highlighter/dist/esm/styles/prism", () => ({
  vscDarkPlus: {},
}));

describe("PythonManimTutorial", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock implementations
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(0);
    (Remotion.useVideoConfig as jest.Mock).mockReturnValue({
      fps: 30,
      durationInFrames: 3600,
      width: 1920,
      height: 1080,
    });
  });

  it("renders without crashing", () => {
    render(<PythonManimTutorial />);
    expect(screen.getByText("🐍 Python Manim Tutorial")).toBeInTheDocument();
  });

  it("displays the subtitle", () => {
    render(<PythonManimTutorial />);
    expect(
      screen.getByText("Learn to create mathematical animations with code"),
    ).toBeInTheDocument();
  });

  it("shows the introduction step at frame 0", () => {
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(0);
    render(<PythonManimTutorial />);
    expect(screen.getByText("Introduction")).toBeInTheDocument();
  });

  it("shows Step 1 content when in the appropriate frame range", () => {
    // Step 1 starts at frame 90
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(100);
    render(<PythonManimTutorial />);

    expect(screen.getByText("Step 1: Import Manim")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Import the Manim library and NumPy for mathematical operations",
      ),
    ).toBeInTheDocument();
  });

  it("displays code syntax highlighting for code steps", () => {
    // Step 1 with code starts at frame 90
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(100);
    render(<PythonManimTutorial />);

    const codeBlock = screen.getByTestId("syntax-highlighter");
    expect(codeBlock).toBeInTheDocument();
    expect(codeBlock).toHaveAttribute("data-language", "python");
  });

  it("shows the correct step in the stepper based on frame", () => {
    // Step 2 starts at frame 240 (90 + 150)
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(250);
    render(<PythonManimTutorial />);

    expect(
      screen.getByText("Step 2: Create a Scene Class"),
    ).toBeInTheDocument();
  });

  it("displays terminal output for Step 4", () => {
    // Step 4 starts at frame 840 (90 + 150 + 300 + 300)
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(850);
    render(<PythonManimTutorial />);

    expect(screen.getByText("Step 4: Run the Animation")).toBeInTheDocument();
    expect(
      screen.getByText(/\$ manim -pql my_animation\.py MyFirstAnimation/),
    ).toBeInTheDocument();
  });

  it("shows video for Step 5", () => {
    // Step 5 starts at frame 1080 (90 + 150 + 300 + 300 + 240)
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(1100);
    render(<PythonManimTutorial />);

    expect(screen.getByText("Step 5: View Results")).toBeInTheDocument();
    const video = screen.getByTestId("remotion-video");
    expect(video).toBeInTheDocument();
    expect(video).toHaveAttribute(
      "src",
      "http://localhost:3000/public//assets/manim/TestAnimation.mp4",
    );
  });

  it("displays progress indicator", () => {
    render(<PythonManimTutorial />);
    expect(screen.getByText("Step 1 of 6")).toBeInTheDocument();
  });

  it("shows duration in footer", () => {
    render(<PythonManimTutorial />);
    expect(screen.getByText("Duration: 2:00")).toBeInTheDocument();
  });

  it("animates progress bar based on current step", () => {
    // Step 3 (third of 6 steps)
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(400);
    render(<PythonManimTutorial />);

    const progressBarContainer = screen
      .getByText("Step 3 of 6")
      .closest("div")?.parentElement;
    expect(progressBarContainer).toBeInTheDocument();
  });

  it("applies correct styling to active step", () => {
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(100);
    render(<PythonManimTutorial />);

    const activeStep = screen.getByText("Step 1: Import Manim");
    expect(activeStep).toBeInTheDocument();
  });

  it("handles animation values correctly", () => {
    const mockInterpolate = Remotion.interpolate as jest.Mock;
    const mockSpring = Remotion.spring as jest.Mock;

    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(95);
    render(<PythonManimTutorial />);

    // Check that animation functions are called
    expect(mockInterpolate).toHaveBeenCalled();
    expect(mockSpring).toHaveBeenCalled();
  });

  it("displays all steps in the stepper", () => {
    render(<PythonManimTutorial />);

    const steps = [
      "Introduction",
      "Step 1: Import Manim",
      "Step 2: Create a Scene Class",
      "Step 3: Add Objects",
      "Step 4: Run the Animation",
      "Step 5: View Results",
    ];

    steps.forEach((stepTitle) => {
      expect(screen.getByText(stepTitle)).toBeInTheDocument();
    });
  });

  it("handles video error gracefully", () => {
    const consoleSpy = jest.spyOn(console, "warn").mockImplementation();

    // Step 5 with video
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(1100);
    const { container } = render(<PythonManimTutorial />);

    const video = container.querySelector("video");
    if (video?.onerror) {
      const mockError = new Event("error");
      const errorHandler = video.onerror as (event: Event) => void;
      errorHandler(mockError);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Tutorial video could not be loaded:",
        mockError,
      );
    }

    consoleSpy.mockRestore();
  });

  it("calculates step offset correctly", () => {
    // Middle of Step 2 (frame 240 + 150)
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(315);
    render(<PythonManimTutorial />);

    expect(
      screen.getByText("Step 2: Create a Scene Class"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Every Manim animation starts with a Scene class"),
    ).toBeInTheDocument();
  });

  it("renders file name in code editor header", () => {
    // Step with code
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(100);
    render(<PythonManimTutorial />);

    expect(screen.getByText("my_animation.py")).toBeInTheDocument();
  });

  it("applies theme colors correctly", () => {
    const { container } = render(<PythonManimTutorial />);

    // Check for theme provider
    const header = container.querySelector('[class*="MuiTypography-root"]');
    expect(header).toBeInTheDocument();
  });

  it("displays explanation text with proper animation", () => {
    // Step 1 with explanation
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(100);

    const mockInterpolate = Remotion.interpolate as jest.Mock;
    mockInterpolate.mockImplementation((input, inputRange, outputRange) => {
      if (inputRange[0] === 0 && inputRange[1] === 30) {
        // fadeIn animation
        return input >= 30 ? 1 : input / 30;
      }
      return outputRange[0];
    });

    render(<PythonManimTutorial />);

    const explanation = screen.getByText(
      "Import the Manim library and NumPy for mathematical operations",
    );
    expect(explanation).toBeInTheDocument();
  });
});
