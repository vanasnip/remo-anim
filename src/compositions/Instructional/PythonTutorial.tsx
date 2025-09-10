import * as React from "react";
import { TutorialVideo } from "./TutorialVideo";

// Example tutorial: Python Manim Animation Creation
export const PythonManimTutorial: React.FC = () => {
  const tutorialSteps = [
    {
      title: "Import Required Libraries",
      description:
        "First, we need to import the Manim library and create our scene class. Manim provides all the tools we need for mathematical animations.",
      duration: 300, // 10 seconds at 30fps
      codeSnippet: {
        language: "python",
        code: `from manim import *
import numpy as np

class SineWaveAnimation(Scene):
    def construct(self):
        # Your animation code goes here
        pass`,
        filename: "sine_wave.py",
        highlights: [1, 4],
      },
      tipText: "Always inherit from Scene class for basic animations",
      // voiceOverAudio: "audio/step1.mp3", // Commented out to avoid missing audio file error
    },
    {
      title: "Create the Axes",
      description:
        "Set up a coordinate system with axes. We'll use NumberPlane for a grid background and add labeled axes on top.",
      duration: 360,
      codeSnippet: {
        language: "python",
        code: `    def construct(self):
        # Create axes
        axes = Axes(
            x_range=[-3, 3, 1],
            y_range=[-2, 2, 1],
            x_length=10,
            y_length=6,
            axis_config={"color": BLUE},
        )

        # Add labels
        labels = axes.get_axis_labels(x_label="x", y_label="f(x)")`,
        filename: "sine_wave.py",
        startLine: 5,
        highlights: [3, 4, 5],
      },
      keyboardShortcut: "Ctrl+S to save your file",
      tipText: "Adjust x_range and y_range to fit your function",
    },
    {
      title: "Define the Function",
      description:
        "Create the sine wave function that we want to visualize. We'll use a lambda function for simplicity.",
      duration: 300,
      codeSnippet: {
        language: "python",
        code: `        # Define sine function
        sine_func = lambda x: np.sin(x)

        # Create the graph
        sine_graph = axes.plot(
            sine_func,
            color=YELLOW,
            stroke_width=3,
        )

        # Add a label
        func_label = MathTex("f(x) = \\sin(x)", color=YELLOW)
        func_label.to_corner(UR)`,
        filename: "sine_wave.py",
        startLine: 17,
        highlights: [2, 5, 6, 7],
      },
      manimVideo: "assets/manim/SineWaveAnimation_latest.mp4",
    },
    {
      title: "Animate the Creation",
      description:
        "Now let's add animations to make the visualization engaging. We'll animate the axes appearing first, then draw the function.",
      duration: 360,
      codeSnippet: {
        language: "python",
        code: `        # Animate the scene
        self.play(Create(axes), Write(labels))
        self.wait(1)

        self.play(
            Create(sine_graph),
            Write(func_label),
            run_time=3
        )
        self.wait(2)

        # Add a moving dot
        dot = Dot(color=RED)
        dot.move_to(axes.c2p(0, 0))
        self.play(FadeIn(dot))`,
        filename: "sine_wave.py",
        startLine: 30,
        highlights: [2, 5, 6, 7],
      },
      tipText: "Use run_time parameter to control animation speed",
    },
    {
      title: "Run the Animation",
      description:
        "Save your file and run it using the Manim command. The output will be saved in the media folder.",
      duration: 300,
      terminalOutput: `$ manim -pql sine_wave.py SineWaveAnimation
Manim Community v0.18.0

[12/28/24 10:30:45] INFO     Animation 0 : Create(Axes)
                    INFO     Animation 1 : Write(Labels)
                    INFO     Animation 2 : Create(Graph)
                    INFO     Animation 3 : Write(MathTex)

File ready at: media/videos/sine_wave/480p15/SineWaveAnimation.mp4`,
      keyboardShortcut: "Terminal: Ctrl+C to stop rendering",
      tipText: "Use -pql for preview quality, -pqh for high quality",
    },
    {
      title: "Advanced: Add Interactivity",
      description:
        "Let's add a moving dot that traces along the sine wave, showing the relationship between x and f(x).",
      duration: 420,
      codeSnippet: {
        language: "python",
        code: `        # Create value tracker for animation
        x_tracker = ValueTracker(0)

        # Create dot that follows the function
        moving_dot = always_redraw(lambda:
            Dot(color=RED).move_to(
                axes.c2p(x_tracker.get_value(),
                        sine_func(x_tracker.get_value()))
            )
        )

        # Create vertical line
        v_line = always_redraw(lambda:
            axes.get_vertical_line(
                axes.c2p(x_tracker.get_value(),
                        sine_func(x_tracker.get_value()))
            )
        )

        # Animate
        self.add(moving_dot, v_line)
        self.play(x_tracker.animate.set_value(3), run_time=5)
        self.play(x_tracker.animate.set_value(-3), run_time=5)`,
        filename: "sine_wave.py",
        startLine: 45,
        highlights: [5, 6, 7, 20, 21],
      },
      manimVideo: "assets/manim/SineWaveAnimation_latest.mp4",
      tipText:
        "always_redraw creates dynamic objects that update automatically",
    },
  ];

  return (
    <TutorialVideo
      title="Creating Animations with Python Manim"
      subtitle="Learn to create beautiful mathematical visualizations"
      author="Tutorial Series"
      steps={tutorialSteps}
      // backgroundMusic="audio/background_tutorial.mp3" // Commented out to avoid missing audio file error
      theme={{
        primaryColor: "#2196f3",
        secondaryColor: "#64b5f6",
        codeTheme: "dark",
      }}
    />
  );
};

// Example 2: React Component Tutorial
export const ReactComponentTutorial: React.FC = () => {
  const tutorialSteps = [
    {
      title: "Create a New Component",
      description:
        "Start by creating a new React functional component with TypeScript. We'll build a reusable Button component.",
      duration: 300,
      codeSnippet: {
        language: "typescript",
        code: `import React from 'react';
import { Button, ButtonProps } from '@mui/material';

interface CustomButtonProps extends ButtonProps {
  loading?: boolean;
  icon?: React.ReactNode;
}

export const CustomButton: React.FC<CustomButtonProps> = ({
  children,
  loading = false,
  icon,
  disabled,
  ...props
}) => {
  return (
    <Button
      disabled={disabled || loading}
      startIcon={icon}
      {...props}
    >
      {loading ? 'Loading...' : children}
    </Button>
  );
};`,
        filename: "CustomButton.tsx",
        highlights: [4, 5, 6, 9, 10, 11],
      },
      tipText: "Extend MUI ButtonProps to inherit all standard props",
    },
    {
      title: "Add Loading State",
      description:
        "Implement a loading spinner that appears when the button is in a loading state.",
      duration: 300,
      codeSnippet: {
        language: "typescript",
        code: `import { CircularProgress } from '@mui/material';

// Inside the component
{loading && (
  <CircularProgress
    size={16}
    sx={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      marginTop: '-8px',
      marginLeft: '-8px',
    }}
  />
)}`,
        filename: "CustomButton.tsx",
        startLine: 25,
        highlights: [5, 6, 7],
      },
      keyboardShortcut: "VS Code: Ctrl+Space for IntelliSense",
    },
    {
      title: "Test the Component",
      description:
        "Write unit tests to ensure your component works correctly in different scenarios.",
      duration: 360,
      codeSnippet: {
        language: "typescript",
        code: `import { render, screen, fireEvent } from '@testing-library/react';
import { CustomButton } from './CustomButton';

describe('CustomButton', () => {
  it('renders children correctly', () => {
    render(<CustomButton>Click me</CustomButton>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('shows loading text when loading', () => {
    render(<CustomButton loading>Click me</CustomButton>);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('is disabled when loading', () => {
    render(<CustomButton loading>Click me</CustomButton>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});`,
        filename: "CustomButton.test.tsx",
        highlights: [5, 6, 7, 11, 12],
      },
      terminalOutput: `$ npm test CustomButton.test.tsx

PASS  src/components/CustomButton.test.tsx
  CustomButton
    ✓ renders children correctly (25 ms)
    ✓ shows loading text when loading (10 ms)
    ✓ is disabled when loading (8 ms)

Test Suites: 1 passed, 1 total
Tests:       3 passed, 3 total`,
    },
  ];

  return (
    <TutorialVideo
      title="Building Reusable React Components"
      subtitle="TypeScript, Testing, and Best Practices"
      author="React Series"
      steps={tutorialSteps}
      theme={{
        primaryColor: "#61dafb",
        secondaryColor: "#282c34",
        codeTheme: "dark",
      }}
    />
  );
};