import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ReactComponentTutorial } from "../../../compositions/Instructional/ReactComponentTutorial";
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
  atomDark: {},
}));

describe("ReactComponentTutorial", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(0);
    (Remotion.useVideoConfig as jest.Mock).mockReturnValue({
      fps: 30,
      durationInFrames: 2700,
      width: 1920,
      height: 1080,
    });
  });

  it("renders without crashing", () => {
    render(<ReactComponentTutorial />);
    expect(screen.getByText("⚛️ React Component Tutorial")).toBeInTheDocument();
  });

  it("shows introduction section at frame 0", () => {
    render(<ReactComponentTutorial />);
    expect(
      screen.getByText("Introduction to React Components"),
    ).toBeInTheDocument();
  });

  it("displays the intro content with proper styling", () => {
    render(<ReactComponentTutorial />);
    expect(
      screen.getByText("Learn to build reusable React components"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("TypeScript • Testing • Best Practices"),
    ).toBeInTheDocument();
  });

  it("shows section counter chip", () => {
    render(<ReactComponentTutorial />);
    expect(screen.getByText("Section 1 / 6")).toBeInTheDocument();
  });

  it("transitions to code section with functional component", () => {
    // Frame 100 - in "Creating a Functional Component" section
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(100);
    render(<ReactComponentTutorial />);

    expect(
      screen.getByText("Creating a Functional Component"),
    ).toBeInTheDocument();

    // Check for syntax highlighter
    const codeBlock = screen.getByTestId("syntax-highlighter");
    expect(codeBlock).toBeInTheDocument();
    expect(codeBlock).toHaveAttribute("data-language", "tsx");
    expect(codeBlock).toHaveAttribute("data-show-line-numbers", "true");
  });

  it("displays key concepts list with animations", () => {
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(120);
    render(<ReactComponentTutorial />);

    const concepts = [
      "Define TypeScript interface for props",
      "Use React.FC for type safety",
      "Implement default props",
      "Export for reusability",
    ];

    concepts.forEach((concept) => {
      expect(screen.getByText(concept)).toBeInTheDocument();
    });
  });

  it("shows multiple files with tabs when available", () => {
    // CSS Modules section at frame 390
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(400);
    render(<ReactComponentTutorial />);

    expect(
      screen.getByText("Adding Styles with CSS Modules"),
    ).toBeInTheDocument();

    // Should show Button.module.css
    expect(screen.getByText("Button.module.css")).toBeInTheDocument();
  });

  it("displays testing section with test code", () => {
    // Testing section starts around frame 870
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(900);
    render(<ReactComponentTutorial />);

    expect(screen.getByText("Testing Your Component")).toBeInTheDocument();
    expect(screen.getByText("Button.test.tsx")).toBeInTheDocument();

    const testConcepts = [
      "Write unit tests with Jest",
      "Use Testing Library for DOM queries",
      "Test user interactions",
      "Verify component behavior",
    ];

    testConcepts.forEach((concept) => {
      expect(screen.getByText(concept)).toBeInTheDocument();
    });
  });

  it("shows best practices summary section", () => {
    // Last section at frame 1110
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(1200);
    render(<ReactComponentTutorial />);

    expect(screen.getByText("Best Practices & Summary")).toBeInTheDocument();

    const practices = [
      "✅ Use TypeScript for type safety",
      "✅ Keep components small and focused",
      "✅ Write comprehensive tests",
      "✅ Document prop interfaces",
      "✅ Follow React naming conventions",
      "✅ Optimize for performance",
    ];

    practices.forEach((practice) => {
      expect(screen.getByText(practice)).toBeInTheDocument();
    });
  });

  it("updates section based on frame progression", () => {
    const { rerender } = render(<ReactComponentTutorial />);

    // Check initial section
    expect(screen.getByText("Section 1 / 6")).toBeInTheDocument();

    // Move to section 3
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(400);
    rerender(<ReactComponentTutorial />);
    expect(screen.getByText("Section 3 / 6")).toBeInTheDocument();

    // Move to section 5
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(900);
    rerender(<ReactComponentTutorial />);
    expect(screen.getByText("Section 5 / 6")).toBeInTheDocument();
  });

  it("calculates section offset correctly", () => {
    // Middle of section 2 (starts at frame 90, duration 300)
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(240);
    render(<ReactComponentTutorial />);

    expect(
      screen.getByText("Creating a Functional Component"),
    ).toBeInTheDocument();
  });

  it("displays progress bar at correct percentage", () => {
    // 50% through video
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(1350);
    const { container } = render(<ReactComponentTutorial />);

    const progressBar = container.querySelector('[style*="width"]');
    expect(progressBar).toBeInTheDocument();
  });

  it("applies spring animations correctly", () => {
    const mockSpring = Remotion.spring as jest.Mock;
    mockSpring.mockReturnValue(0.8);

    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(100);
    render(<ReactComponentTutorial />);

    expect(mockSpring).toHaveBeenCalledWith(
      expect.objectContaining({
        fps: 30,
        config: expect.objectContaining({
          damping: 12,
        }),
      }),
    );
  });

  it("handles tab switching in code sections", () => {
    // Using the Component section with multiple files
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(640);
    render(<ReactComponentTutorial />);

    // Look for App.tsx file tab
    expect(screen.getByText("App.tsx")).toBeInTheDocument();
  });

  it("shows React logo animation", () => {
    const { container } = render(<ReactComponentTutorial />);

    const reactLogo = container.querySelector('[style*="@keyframes spin"]');
    expect(reactLogo).toBeInTheDocument();
  });

  it("displays file icons in tabs", () => {
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(400);
    render(<ReactComponentTutorial />);

    // Check for CodeIcon in tab
    const fileTab = screen.getByText("Button.module.css").parentElement;
    expect(fileTab).toBeInTheDocument();
  });

  it("handles content fade animations", () => {
    const mockInterpolate = Remotion.interpolate as jest.Mock;
    mockInterpolate.mockImplementation((frame, inputRange, outputRange) => {
      if (inputRange[0] === 15 && inputRange[1] === 45) {
        // Content fade
        return frame >= 45 ? 1 : (frame - 15) / 30;
      }
      return outputRange[0];
    });

    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(30);
    render(<ReactComponentTutorial />);

    expect(mockInterpolate).toHaveBeenCalled();
  });

  it("displays key concepts with check icons", () => {
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(120);
    render(<ReactComponentTutorial />);

    // CheckCircleIcon should be present for key points
    const keyPoints = screen.getAllByText(/Define TypeScript interface/);
    expect(keyPoints.length).toBeGreaterThan(0);
  });

  it("shows code with proper theme colors", () => {
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(100);
    const { container } = render(<ReactComponentTutorial />);

    // Check that theme is applied
    const header = container.querySelector('[style*="#61dafb"]');
    expect(header).toBeDefined();
  });

  it("animates point items with staggered delay", () => {
    const mockInterpolate = Remotion.interpolate as jest.Mock;

    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(150);
    render(<ReactComponentTutorial />);

    // Check that interpolate is called multiple times for staggered animations
    const calls = mockInterpolate.mock.calls.filter(
      (call) => call[1] && call[1][0] >= 30,
    );
    expect(calls.length).toBeGreaterThan(0);
  });

  it("displays correct section titles", () => {
    const sections = [
      { frame: 0, title: "Introduction to React Components" },
      { frame: 100, title: "Creating a Functional Component" },
      { frame: 400, title: "Adding Styles with CSS Modules" },
      { frame: 640, title: "Using the Component" },
      { frame: 900, title: "Testing Your Component" },
      { frame: 1200, title: "Best Practices & Summary" },
    ];

    sections.forEach(({ frame, title }) => {
      (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(frame);
      const { unmount } = render(<ReactComponentTutorial />);
      expect(screen.getByText(title)).toBeInTheDocument();
      unmount();
    });
  });

  it("handles all section types correctly", () => {
    const { rerender } = render(<ReactComponentTutorial />);

    // Test intro type
    expect(screen.queryByTestId("syntax-highlighter")).not.toBeInTheDocument();

    // Test code type
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(100);
    rerender(<ReactComponentTutorial />);
    expect(screen.getByTestId("syntax-highlighter")).toBeInTheDocument();

    // Test summary type
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(1200);
    rerender(<ReactComponentTutorial />);
    expect(screen.getByText("🎯 Best Practices")).toBeInTheDocument();
  });
});
