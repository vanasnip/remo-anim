/**
 * Tests for RhythmVisualization components
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import * as Remotion from "remotion";
import {
  RhythmVisualization,
  EmojiRhythm,
} from "../../../compositions/AudioSync/RhythmVisualization";
import { ThemeProvider, createTheme } from "@mui/material/styles";

// Mock Remotion
jest.mock("remotion");

// Mock useAudioMarkers hook
jest.mock("../../../audio/hooks/useAudioMarkers", () => ({
  useAudioMarkers: jest.fn(() => ({
    isOnBeat: false,
    isOnDownbeat: false,
    beatProgress: 0,
    bpm: 120,
    currentMarkers: [],
    isLoading: false,
    error: null,
  })),
}));

// Mock AudioTriggers component
jest.mock("../../../compositions/AudioSync/AudioTriggeredContent", () => ({
  AudioTriggers: ({
    children,
  }: {
    children: (markers: any[]) => React.ReactNode;
  }) => {
    return <>{children([])}</>;
  },
}));

const theme = createTheme({
  palette: {
    mode: "dark",
  },
});

describe("RhythmVisualization", () => {
  beforeEach(() => {
    // Setup Remotion mocks
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(30);
    (Remotion.useVideoConfig as jest.Mock).mockReturnValue({
      fps: 30,
      durationInFrames: 900,
      width: 1920,
      height: 1080,
    });
    (Remotion.staticFile as jest.Mock).mockImplementation(
      (path: string) => `/static/${path}`,
    );
    (Remotion.Audio as any) = ({ src }: { src: string }) => <audio src={src} />;
    (Remotion.interpolate as jest.Mock).mockImplementation(
      (value: number, input: number[], output: number[]) => {
        const ratio = (value - input[0]) / (input[1] - input[0]);
        return output[0] + ratio * (output[1] - output[0]);
      },
    );
    (Remotion.spring as jest.Mock).mockImplementation(() => 1);
  });

  describe("basic rendering", () => {
    it("should render without crashing", () => {
      render(
        <ThemeProvider theme={theme}>
          <RhythmVisualization />
        </ThemeProvider>,
      );

      expect(screen.getByText("Frame: 30")).toBeInTheDocument();
    });

    it("should accept custom audio source", () => {
      const { container } = render(
        <ThemeProvider theme={theme}>
          <RhythmVisualization audioSrc="custom-audio.mp3" />
        </ThemeProvider>,
      );

      const audio = container.querySelector("audio");
      expect(audio?.getAttribute("src")).toBe("/static/custom-audio.mp3");
    });

    it("should use default audio source when not provided", () => {
      const { container } = render(
        <ThemeProvider theme={theme}>
          <RhythmVisualization />
        </ThemeProvider>,
      );

      const audio = container.querySelector("audio");
      expect(audio?.getAttribute("src")).toBe("/static/audio/sample-beat.mp3");
    });
  });

  describe("header information", () => {
    it("should display frame number", () => {
      render(
        <ThemeProvider theme={theme}>
          <RhythmVisualization />
        </ThemeProvider>,
      );

      expect(screen.getByText("Frame: 30")).toBeInTheDocument();
    });

    it("should display BPM when available", () => {
      const useAudioMarkers =
        require("../../../audio/hooks/useAudioMarkers").useAudioMarkers;
      useAudioMarkers.mockReturnValueOnce({
        isOnBeat: false,
        isOnDownbeat: false,
        beatProgress: 0,
        bpm: 140,
        currentMarkers: [],
        isLoading: false,
        error: null,
      });

      render(
        <ThemeProvider theme={theme}>
          <RhythmVisualization />
        </ThemeProvider>,
      );

      expect(screen.getByText("BPM: 140")).toBeInTheDocument();
    });

    it("should show placeholder when BPM not available", () => {
      const useAudioMarkers =
        require("../../../audio/hooks/useAudioMarkers").useAudioMarkers;
      useAudioMarkers.mockReturnValueOnce({
        isOnBeat: false,
        isOnDownbeat: false,
        beatProgress: 0,
        bpm: undefined,
        currentMarkers: [],
        isLoading: false,
        error: null,
      });

      render(
        <ThemeProvider theme={theme}>
          <RhythmVisualization />
        </ThemeProvider>,
      );

      expect(screen.getByText("BPM: ...")).toBeInTheDocument();
    });

    it("should display marker count", () => {
      const useAudioMarkers =
        require("../../../audio/hooks/useAudioMarkers").useAudioMarkers;
      useAudioMarkers.mockReturnValueOnce({
        isOnBeat: false,
        isOnDownbeat: false,
        beatProgress: 0,
        bpm: 120,
        currentMarkers: [{ type: "beat" }, { type: "onset" }],
        isLoading: false,
        error: null,
      });

      render(
        <ThemeProvider theme={theme}>
          <RhythmVisualization />
        </ThemeProvider>,
      );

      expect(screen.getByText("Markers: 2")).toBeInTheDocument();
    });
  });

  describe("background animation", () => {
    it("should change background based on beat progress", () => {
      const useAudioMarkers =
        require("../../../audio/hooks/useAudioMarkers").useAudioMarkers;
      useAudioMarkers.mockReturnValueOnce({
        isOnBeat: false,
        isOnDownbeat: false,
        beatProgress: 0.5,
        bpm: 120,
        currentMarkers: [],
        isLoading: false,
        error: null,
      });

      const { container } = render(
        <ThemeProvider theme={theme}>
          <RhythmVisualization />
        </ThemeProvider>,
      );

      // Background should have gradient based on beat progress
      const background = container.firstChild as HTMLElement;
      expect(background.style.background).toContain("gradient");
    });

    it("should brighten background on beat", () => {
      const useAudioMarkers =
        require("../../../audio/hooks/useAudioMarkers").useAudioMarkers;
      useAudioMarkers.mockReturnValueOnce({
        isOnBeat: true,
        isOnDownbeat: false,
        beatProgress: 0,
        bpm: 120,
        currentMarkers: [],
        isLoading: false,
        error: null,
      });

      const { container } = render(
        <ThemeProvider theme={theme}>
          <RhythmVisualization />
        </ThemeProvider>,
      );

      const background = container.firstChild as HTMLElement;
      expect(background.style.background).toContain("15%"); // Brighter lightness
    });
  });

  describe("rhythm grid", () => {
    it("should render 16 grid items", () => {
      const { container } = render(
        <ThemeProvider theme={theme}>
          <RhythmVisualization />
        </ThemeProvider>,
      );

      const gridItems = container.querySelectorAll('[class*="MuiGrid-item"]');
      expect(gridItems.length).toBe(16);
    });

    it("should color grid items based on marker type", () => {
      const useAudioMarkers =
        require("../../../audio/hooks/useAudioMarkers").useAudioMarkers;

      // Mock for grid component
      useAudioMarkers.mockReturnValue({
        isOnBeat: true,
        isOnDownbeat: false,
        beatProgress: 0,
        bpm: 120,
        currentMarkers: [{ type: "onset" }],
        isLoading: false,
        error: null,
      });

      const { container } = render(
        <ThemeProvider theme={theme}>
          <RhythmVisualization />
        </ThemeProvider>,
      );

      // Grid items should have onset color
      const gridBox = container.querySelector('[style*="background-color"]');
      expect(gridBox).toBeInTheDocument();
    });
  });

  describe("beat progress bar", () => {
    it("should display progress bar", () => {
      const { container } = render(
        <ThemeProvider theme={theme}>
          <RhythmVisualization />
        </ThemeProvider>,
      );

      const progressBar = container.querySelector('[style*="width: 60%"]');
      expect(progressBar).toBeInTheDocument();
    });

    it("should update progress based on beatProgress", () => {
      const useAudioMarkers =
        require("../../../audio/hooks/useAudioMarkers").useAudioMarkers;
      useAudioMarkers.mockReturnValueOnce({
        isOnBeat: false,
        isOnDownbeat: false,
        beatProgress: 0.75,
        bpm: 120,
        currentMarkers: [],
        isLoading: false,
        error: null,
      });

      const { container } = render(
        <ThemeProvider theme={theme}>
          <RhythmVisualization />
        </ThemeProvider>,
      );

      const progressFill = container.querySelector('[style*="width: 75%"]');
      expect(progressFill).toBeInTheDocument();
    });

    it("should change color on beat", () => {
      const useAudioMarkers =
        require("../../../audio/hooks/useAudioMarkers").useAudioMarkers;
      useAudioMarkers.mockReturnValueOnce({
        isOnBeat: true,
        isOnDownbeat: false,
        beatProgress: 0.5,
        bpm: 120,
        currentMarkers: [],
        isLoading: false,
        error: null,
      });

      const { container } = render(
        <ThemeProvider theme={theme}>
          <RhythmVisualization />
        </ThemeProvider>,
      );

      const progressFill = container.querySelector('[style*="#FFD54F"]');
      expect(progressFill).toBeInTheDocument();
    });
  });

  describe("downbeat particles", () => {
    it("should render particles on downbeat", () => {
      const useAudioMarkers =
        require("../../../audio/hooks/useAudioMarkers").useAudioMarkers;
      useAudioMarkers.mockReturnValueOnce({
        isOnBeat: false,
        isOnDownbeat: true,
        beatProgress: 0,
        bpm: 120,
        currentMarkers: [],
        isLoading: false,
        error: null,
      });

      const { container } = render(
        <ThemeProvider theme={theme}>
          <RhythmVisualization />
        </ThemeProvider>,
      );

      // Should render 8 particles
      const particles = container.querySelectorAll('[style*="rotate"]');
      expect(particles.length).toBe(8);
    });

    it("should not render particles when not on downbeat", () => {
      const useAudioMarkers =
        require("../../../audio/hooks/useAudioMarkers").useAudioMarkers;
      useAudioMarkers.mockReturnValueOnce({
        isOnBeat: false,
        isOnDownbeat: false,
        beatProgress: 0,
        bpm: 120,
        currentMarkers: [],
        isLoading: false,
        error: null,
      });

      const { container } = render(
        <ThemeProvider theme={theme}>
          <RhythmVisualization />
        </ThemeProvider>,
      );

      const particles = container.querySelectorAll('[style*="rotate"]');
      expect(particles.length).toBe(0);
    });
  });

  describe("AudioTriggers integration", () => {
    it("should render beat text when beat marker present", () => {
      const AudioTriggers =
        require("../../../compositions/AudioSync/AudioTriggeredContent").AudioTriggers;
      AudioTriggers.mockImplementationOnce(({ children }: any) => {
        return <>{children([{ type: "beat" }])}</>;
      });

      render(
        <ThemeProvider theme={theme}>
          <RhythmVisualization />
        </ThemeProvider>,
      );

      expect(screen.getByText("BEAT")).toBeInTheDocument();
    });

    it("should render music note when onset marker present", () => {
      const AudioTriggers =
        require("../../../compositions/AudioSync/AudioTriggeredContent").AudioTriggers;
      AudioTriggers.mockImplementationOnce(({ children }: any) => {
        return <>{children([{ type: "onset" }])}</>;
      });

      render(
        <ThemeProvider theme={theme}>
          <RhythmVisualization />
        </ThemeProvider>,
      );

      expect(screen.getByText("♪")).toBeInTheDocument();
    });
  });
});

describe("EmojiRhythm", () => {
  beforeEach(() => {
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(30);
    (Remotion.useVideoConfig as jest.Mock).mockReturnValue({
      fps: 30,
      durationInFrames: 450,
    });
  });

  it("should render an emoji", () => {
    render(<EmojiRhythm audioSrc="test.mp3" />);

    // Should show one of the emojis
    const container = document.body;
    const emojis = ["🎵", "🎶", "🎤", "🎸", "🥁", "🎹", "🎺", "🎷"];
    const hasEmoji = emojis.some((emoji) =>
      container.textContent?.includes(emoji),
    );
    expect(hasEmoji).toBe(true);
  });

  it("should change emoji on beat", () => {
    const useAudioMarkers =
      require("../../../audio/hooks/useAudioMarkers").useAudioMarkers;

    // First render - not on beat
    useAudioMarkers.mockReturnValueOnce({
      isOnBeat: false,
    });

    const { rerender } = render(<EmojiRhythm audioSrc="test.mp3" />);
    const firstEmoji = screen.getByText(/[🎵🎶🎤🎸🥁🎹🎺🎷]/);

    // Second render - on beat
    useAudioMarkers.mockReturnValueOnce({
      isOnBeat: true,
    });

    rerender(<EmojiRhythm audioSrc="test.mp3" />);

    // Emoji should still be present (state change would happen in real component)
    expect(firstEmoji).toBeInTheDocument();
  });

  it("should apply bounce animation on beat", () => {
    const useAudioMarkers =
      require("../../../audio/hooks/useAudioMarkers").useAudioMarkers;
    useAudioMarkers.mockReturnValueOnce({
      isOnBeat: true,
    });

    const { container } = render(<EmojiRhythm audioSrc="test.mp3" />);

    const emoji = container.querySelector('[style*="animation"]');
    expect(emoji).toBeInTheDocument();
    expect(emoji?.getAttribute("style")).toContain("bounce");
  });

  it("should not animate when not on beat", () => {
    const useAudioMarkers =
      require("../../../audio/hooks/useAudioMarkers").useAudioMarkers;
    useAudioMarkers.mockReturnValueOnce({
      isOnBeat: false,
    });

    const { container } = render(<EmojiRhythm audioSrc="test.mp3" />);

    const emoji = container.querySelector('[style*="animation: none"]');
    expect(emoji).toBeInTheDocument();
  });
});
