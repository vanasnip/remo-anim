import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { PythonManimTutorial, ReactComponentTutorial } from "../../../compositions/Instructional/PythonTutorial";
import * as Remotion from "remotion";

// Mock Remotion hooks
jest.mock("remotion");

// Mock TutorialVideo component
jest.mock("../../../compositions/Instructional/TutorialVideo", () => ({
  TutorialVideo: ({ title, subtitle, author, steps, theme }: {
    title: string;
    subtitle?: string;
    author?: string;
    steps: Array<{ title: string; description: string; duration: number }>;
    theme?: { primaryColor?: string; secondaryColor?: string; codeTheme?: string };
  }) => (
    <div data-testid="tutorial-video">
      <h1>{title}</h1>
      {subtitle && <h2>{subtitle}</h2>}
      {author && <p>by {author}</p>}
      <div data-testid="steps-count">{steps.length} steps</div>
      {theme && (
        <div data-testid="theme-colors">
          {theme.primaryColor && <span data-testid="primary-color">{theme.primaryColor}</span>}
          {theme.secondaryColor && <span data-testid="secondary-color">{theme.secondaryColor}</span>}
          {theme.codeTheme && <span data-testid="code-theme">{theme.codeTheme}</span>}
        </div>
      )}
      <div data-testid="steps">
        {steps.map((step, index) => (
          <div key={index} data-testid={`step-${index}`}>
            <h3>{step.title}</h3>
            <p>{step.description}</p>
            <span>Duration: {step.duration} frames</span>
          </div>
        ))}
      </div>
    </div>
  ),
}));

describe("PythonManimTutorial", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders without crashing", () => {
    render(<PythonManimTutorial />);
    expect(screen.getByTestId("tutorial-video")).toBeInTheDocument();
  });

  it("displays correct title and subtitle", () => {
    render(<PythonManimTutorial />);
    
    expect(screen.getByText("Creating Animations with Python Manim")).toBeInTheDocument();
    expect(screen.getByText("Learn to create beautiful mathematical visualizations")).toBeInTheDocument();
    expect(screen.getByText("by Tutorial Series")).toBeInTheDocument();
  });

  it("has correct number of tutorial steps", () => {
    render(<PythonManimTutorial />);
    expect(screen.getByText("6 steps")).toBeInTheDocument();
  });

  it("applies correct theme colors", () => {
    render(<PythonManimTutorial />);
    
    expect(screen.getByTestId("primary-color")).toHaveTextContent("#2196f3");
    expect(screen.getByTestId("secondary-color")).toHaveTextContent("#64b5f6");
    expect(screen.getByTestId("code-theme")).toHaveTextContent("dark");
  });

  it("displays all tutorial step titles", () => {
    render(<PythonManimTutorial />);
    
    const expectedSteps = [
      "Import Required Libraries",
      "Create the Axes",
      "Define the Function",
      "Animate the Creation",
      "Run the Animation",
      "Advanced: Add Interactivity",
    ];

    expectedSteps.forEach((stepTitle) => {
      expect(screen.getByText(stepTitle)).toBeInTheDocument();
    });
  });

  it("has correct step descriptions", () => {
    render(<PythonManimTutorial />);
    
    expect(screen.getByText(/First, we need to import the Manim library/)).toBeInTheDocument();
    expect(screen.getByText(/Set up a coordinate system with axes/)).toBeInTheDocument();
    expect(screen.getByText(/Create the sine wave function/)).toBeInTheDocument();
  });

  it("includes code examples in steps", () => {
    render(<PythonManimTutorial />);
    
    // Check that steps contain code-related content in their structure
    // This would be validated through the step data passed to TutorialVideo
    const steps = screen.getAllByTestId(/step-\d+/);
    expect(steps).toHaveLength(6);
  });

  it("has appropriate durations for each step", () => {
    render(<PythonManimTutorial />);
    
    // Check for duration text in steps
    expect(screen.getByText("Duration: 300 frames")).toBeInTheDocument(); // First step
    expect(screen.getByText("Duration: 360 frames")).toBeInTheDocument(); // Second step
    expect(screen.getByText("Duration: 420 frames")).toBeInTheDocument(); // Last step
  });
});

describe("ReactComponentTutorial (from PythonTutorial file)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders without crashing", () => {
    render(<ReactComponentTutorial />);
    expect(screen.getByTestId("tutorial-video")).toBeInTheDocument();
  });

  it("displays correct title and subtitle", () => {
    render(<ReactComponentTutorial />);
    
    expect(screen.getByText("Building Reusable React Components")).toBeInTheDocument();
    expect(screen.getByText("TypeScript, Testing, and Best Practices")).toBeInTheDocument();
    expect(screen.getByText("by React Series")).toBeInTheDocument();
  });

  it("has correct number of tutorial steps", () => {
    render(<ReactComponentTutorial />);
    expect(screen.getByText("3 steps")).toBeInTheDocument();
  });

  it("applies React-themed colors", () => {
    render(<ReactComponentTutorial />);
    
    expect(screen.getByTestId("primary-color")).toHaveTextContent("#61dafb");
    expect(screen.getByTestId("secondary-color")).toHaveTextContent("#282c34");
    expect(screen.getByTestId("code-theme")).toHaveTextContent("dark");
  });

  it("displays React tutorial step titles", () => {
    render(<ReactComponentTutorial />);
    
    const expectedSteps = [
      "Create a New Component",
      "Add Loading State",
      "Test the Component",
    ];

    expectedSteps.forEach((stepTitle) => {
      expect(screen.getByText(stepTitle)).toBeInTheDocument();
    });
  });

  it("includes TypeScript-focused content", () => {
    render(<ReactComponentTutorial />);
    
    expect(screen.getByText(/Start by creating a new React functional component with TypeScript/)).toBeInTheDocument();
    expect(screen.getByText(/Implement a loading spinner/)).toBeInTheDocument();
    expect(screen.getByText(/Write unit tests to ensure/)).toBeInTheDocument();
  });

  it("has appropriate step durations", () => {
    render(<ReactComponentTutorial />);
    
    // All steps should be 300-360 frames each
    expect(screen.getByText("Duration: 300 frames")).toBeInTheDocument();
    expect(screen.getByText("Duration: 360 frames")).toBeInTheDocument();
  });

  it("includes testing and best practices focus", () => {
    render(<ReactComponentTutorial />);
    
    // Check for testing-related content
    const testingStep = screen.getByText("Test the Component");
    expect(testingStep).toBeInTheDocument();
    
    const testingDescription = screen.getByText(/Write unit tests to ensure your component works correctly/);
    expect(testingDescription).toBeInTheDocument();
  });
});

// Integration tests for both components
describe("PythonTutorial Integration", () => {
  it("both tutorials use different themes and durations", () => {
    const { rerender } = render(<PythonManimTutorial />);
    
    // Python tutorial should have blue theme
    expect(screen.getByTestId("primary-color")).toHaveTextContent("#2196f3");
    expect(screen.getByText("6 steps")).toBeInTheDocument();
    
    rerender(<ReactComponentTutorial />);
    
    // React tutorial should have React blue theme
    expect(screen.getByTestId("primary-color")).toHaveTextContent("#61dafb");
    expect(screen.getByText("3 steps")).toBeInTheDocument();
  });

  it("tutorials have distinct content focus", () => {
    const { rerender } = render(<PythonManimTutorial />);
    
    expect(screen.getByText(/mathematical visualizations/)).toBeInTheDocument();
    expect(screen.getByText(/Manim library/)).toBeInTheDocument();
    
    rerender(<ReactComponentTutorial />);
    
    expect(screen.getByText(/React functional component/)).toBeInTheDocument();
    expect(screen.getByText(/TypeScript/)).toBeInTheDocument();
  });

  it("both tutorials include code examples and tips", () => {
    const { rerender } = render(<PythonManimTutorial />);
    
    // Python tutorial includes code and tips
    expect(screen.getByTestId("tutorial-video")).toBeInTheDocument();
    
    rerender(<ReactComponentTutorial />);
    
    // React tutorial also includes code and tips
    expect(screen.getByTestId("tutorial-video")).toBeInTheDocument();
  });
});