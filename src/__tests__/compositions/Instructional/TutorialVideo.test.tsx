import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { TutorialVideo } from "../../../compositions/Instructional/TutorialVideo";
import * as Remotion from "remotion";

// Mock Remotion hooks
jest.mock("remotion");

// Mock react-syntax-highlighter
jest.mock("react-syntax-highlighter", () => ({
  Prism: ({
    children,
    language,
    showLineNumbers,
    ...props
  }: React.PropsWithChildren<{
    language?: string;
    style?: Record<string, unknown>;
    customStyle?: React.CSSProperties;
    showLineNumbers?: boolean;
  }>) => (
    <pre
      data-testid="syntax-highlighter"
      data-language={language}
      data-show-line-numbers={showLineNumbers}
      {...props}
    >
      {children}
    </pre>
  ),
}));

jest.mock("react-syntax-highlighter/dist/esm/styles/prism", () => ({
  vscDarkPlus: {},
}));

const mockSteps = [
  {
    title: "Step 1: Setup",
    description: "This is the first step of our tutorial",
    duration: 180,
    codeSnippet: {
      language: "javascript",
      code: `console.log("Hello world");`,
      filename: "hello.js",
      highlights: [1],
    },
    tipText: "Remember to save your file",
  },
  {
    title: "Step 2: Testing",
    description: "Now we'll test our code",
    duration: 240,
    terminalOutput: `$ node hello.js\nHello world`,
    keyboardShortcut: "Ctrl+Enter",
  },
  {
    title: "Step 3: Deploy",
    description: "Time to deploy our application",
    duration: 300,
    manimVideo: "assets/deploy.mp4",
    voiceOverAudio: "audio/deploy.mp3",
  },
];

describe("TutorialVideo", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(0);
    (Remotion.useVideoConfig as jest.Mock).mockReturnValue({
      fps: 30,
      durationInFrames: 720,
      width: 1920,
      height: 1080,
    });
  });

  it("renders without crashing", () => {
    render(
      <TutorialVideo
        title="Test Tutorial"
        steps={mockSteps}
      />
    );
    expect(screen.getByText("Test Tutorial")).toBeInTheDocument();
  });

  it("displays title, subtitle, and author", () => {
    render(
      <TutorialVideo
        title="My Tutorial"
        subtitle="Learn Something Cool"
        author="John Doe"
        steps={mockSteps}
      />
    );

    expect(screen.getByText("My Tutorial")).toBeInTheDocument();
    expect(screen.getByText("Learn Something Cool")).toBeInTheDocument();
    expect(screen.getByText("by John Doe")).toBeInTheDocument();
  });

  it("shows progress indicator with correct step count", () => {
    render(
      <TutorialVideo
        title="Test Tutorial"
        steps={mockSteps}
      />
    );

    expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();
  });

  it("displays current step content", () => {
    render(
      <TutorialVideo
        title="Test Tutorial"
        steps={mockSteps}
      />
    );

    expect(screen.getByText("Step 1: Setup")).toBeInTheDocument();
    expect(screen.getByText("This is the first step of our tutorial")).toBeInTheDocument();
  });

  it("shows code snippet when provided", () => {
    render(
      <TutorialVideo
        title="Test Tutorial"
        steps={mockSteps}
      />
    );

    const codeBlock = screen.getByTestId("syntax-highlighter");
    expect(codeBlock).toBeInTheDocument();
    expect(codeBlock).toHaveAttribute("data-language", "javascript");
    expect(codeBlock).toHaveAttribute("data-show-line-numbers", "true");
  });

  it("displays filename in code header", () => {
    render(
      <TutorialVideo
        title="Test Tutorial"
        steps={mockSteps}
      />
    );

    expect(screen.getByText("hello.js")).toBeInTheDocument();
  });

  it("shows tip text when provided", () => {
    render(
      <TutorialVideo
        title="Test Tutorial"
        steps={mockSteps}
      />
    );

    expect(screen.getByText("Pro Tip:")).toBeInTheDocument();
    expect(screen.getByText("Remember to save your file")).toBeInTheDocument();
  });

  it("transitions to second step correctly", () => {
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(200); // Second step

    render(
      <TutorialVideo
        title="Test Tutorial"
        steps={mockSteps}
      />
    );

    expect(screen.getByText("Step 2: Testing")).toBeInTheDocument();
    expect(screen.getByText("Now we'll test our code")).toBeInTheDocument();
  });

  it("shows terminal output when provided", () => {
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(200); // Second step

    render(
      <TutorialVideo
        title="Test Tutorial"
        steps={mockSteps}
      />
    );

    expect(screen.getByText("Terminal")).toBeInTheDocument();
    expect(screen.getByText(/\$ node hello\.js/)).toBeInTheDocument();
  });

  it("displays keyboard shortcut when provided", () => {
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(200); // Second step

    render(
      <TutorialVideo
        title="Test Tutorial"
        steps={mockSteps}
      />
    );

    expect(screen.getByText("Keyboard shortcut:")).toBeInTheDocument();
    expect(screen.getByText("Ctrl+Enter")).toBeInTheDocument();
  });

  it("shows video when provided", () => {
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(450); // Third step

    render(
      <TutorialVideo
        title="Test Tutorial"
        steps={mockSteps}
      />
    );

    const video = screen.getByTestId("remotion-video");
    expect(video).toBeInTheDocument();
    expect(video).toHaveAttribute("src", "http://localhost:3000/public/assets/deploy.mp4");
  });

  it("handles audio when provided", () => {
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(450); // Third step

    render(
      <TutorialVideo
        title="Test Tutorial"
        steps={mockSteps}
        backgroundMusic="audio/bg.mp3"
      />
    );

    // Background music should be rendered
    const backgroundAudio = screen.getByTestId("remotion-audio");
    expect(backgroundAudio).toBeInTheDocument();
  });

  it("applies custom theme colors", () => {
    render(
      <TutorialVideo
        title="Test Tutorial"
        steps={mockSteps}
        theme={{
          primaryColor: "#ff0000",
          secondaryColor: "#00ff00",
          codeTheme: "dark",
        }}
      />
    );

    // Title should use primary color
    const title = screen.getByText("Test Tutorial");
    expect(title.parentElement).toHaveStyle("color: #ff0000");
  });

  it("calculates progress correctly", () => {
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(360); // 50% through

    render(
      <TutorialVideo
        title="Test Tutorial"
        steps={mockSteps}
      />
    );

    expect(screen.getByText("12s / 24s")).toBeInTheDocument();
  });

  it("updates step indicator based on current step", () => {
    const { rerender } = render(
      <TutorialVideo
        title="Test Tutorial"
        steps={mockSteps}
      />
    );

    expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();

    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(200);
    rerender(
      <TutorialVideo
        title="Test Tutorial"
        steps={mockSteps}
      />
    );

    expect(screen.getByText("Step 2 of 3")).toBeInTheDocument();
  });

  it("handles spring animation for title", () => {
    const mockSpring = Remotion.spring as jest.Mock;
    mockSpring.mockReturnValue(0.8);

    render(
      <TutorialVideo
        title="Test Tutorial"
        steps={mockSteps}
      />
    );

    expect(mockSpring).toHaveBeenCalledWith(
      expect.objectContaining({
        frame: 0,
        fps: 30,
        from: 0,
        to: 1,
        config: expect.objectContaining({
          damping: 12,
          stiffness: 200,
        }),
      })
    );
  });

  it("animates code appearance with typing effect", () => {
    const mockInterpolate = Remotion.interpolate as jest.Mock;
    mockInterpolate.mockImplementation((frame, inputRange, outputRange) => {
      if (inputRange[0] === 0 && inputRange[1] === 30) {
        return Math.min(1, frame / 30);
      }
      return outputRange[0];
    });

    render(
      <TutorialVideo
        title="Test Tutorial"
        steps={mockSteps}
      />
    );

    expect(mockInterpolate).toHaveBeenCalled();
  });

  it("displays all step titles in stepper", () => {
    render(
      <TutorialVideo
        title="Test Tutorial"
        steps={mockSteps}
      />
    );

    mockSteps.forEach((step) => {
      expect(screen.getByText(step.title)).toBeInTheDocument();
    });
  });

  it("handles empty steps array", () => {
    render(
      <TutorialVideo
        title="Test Tutorial"
        steps={[]}
      />
    );

    expect(screen.getByText("Test Tutorial")).toBeInTheDocument();
    expect(screen.getByText("Step 0 of 0")).toBeInTheDocument();
  });

  it("applies line highlighting to code", () => {
    const stepsWithHighlights = [
      {
        ...mockSteps[0],
        codeSnippet: {
          ...mockSteps[0].codeSnippet!,
          highlights: [1, 3],
        },
      },
    ];

    render(
      <TutorialVideo
        title="Test Tutorial"
        steps={stepsWithHighlights}
      />
    );

    const codeBlock = screen.getByTestId("syntax-highlighter");
    expect(codeBlock).toBeInTheDocument();
  });

  it("shows copy button in code header", () => {
    render(
      <TutorialVideo
        title="Test Tutorial"
        steps={mockSteps}
      />
    );

    // MUI IconButton with ContentCopy should be present
    const copyButton = screen.getByRole("button");
    expect(copyButton).toBeInTheDocument();
  });

  it("animates terminal cursor blinking", () => {
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(200); // Second step with terminal

    render(
      <TutorialVideo
        title="Test Tutorial"
        steps={mockSteps}
      />
    );

    // Terminal should contain a cursor character
    expect(screen.getByText(/█/)).toBeInTheDocument();
  });

  it("handles step with start line number", () => {
    const stepsWithStartLine = [
      {
        ...mockSteps[0],
        codeSnippet: {
          ...mockSteps[0].codeSnippet!,
          startLine: 5,
        },
      },
    ];

    render(
      <TutorialVideo
        title="Test Tutorial"
        steps={stepsWithStartLine}
      />
    );

    const codeBlock = screen.getByTestId("syntax-highlighter");
    expect(codeBlock).toBeInTheDocument();
  });
});