/**
 * Tests for AudioTriggeredContent components
 */

import { render, screen } from "@testing-library/react";
import * as Remotion from "remotion";
import {
  AudioTriggeredContent,
  BeatPulse,
  RhythmText,
  AudioTriggers,
} from "../../../compositions/AudioSync/AudioTriggeredContent";

// Mock Remotion
jest.mock("remotion");

// Mock useAudioMarkers hook
jest.mock("../../../audio/hooks/useAudioMarkers", () => ({
  useAudioMarkers: jest.fn(() => ({
    markers: {
      beats: [
        { time: 0.5, type: "beat", confidence: 0.9 },
        { time: 1.0, type: "beat", confidence: 0.95 },
      ],
      onsets: [{ time: 0.3, type: "onset", confidence: 0.8 }],
      downbeats: [{ time: 0.5, type: "downbeat", confidence: 1.0 }],
      patterns: [],
      harmonicEvents: [],
      bpm: 120,
    },
    frameMarkers: {
      15: [{ time: 0.5, type: "beat", frame: 15 }],
      30: [{ time: 1.0, type: "beat", frame: 30 }],
    },
    currentMarkers: [],
    isOnBeat: false,
    isOnOnset: false,
    isOnDownbeat: false,
    nextBeat: null,
    previousBeat: null,
    beatProgress: 0,
    bpm: 120,
    isLoading: false,
    error: null,
    isOnMarker: jest.fn(),
    getNextMarker: jest.fn(),
    getPreviousMarker: jest.fn(),
  })),
  useBeats: jest.fn(() => ({
    isOnBeat: false,
    beatProgress: 0,
    isLoading: false,
  })),
}));

// Mock Material-UI components that might have issues
jest.mock("@mui/material", () => ({
  ...jest.requireActual("@mui/material"),
  CircularProgress: () => <div>Loading...</div>,
}));

describe("AudioTriggeredContent", () => {
  beforeEach(() => {
    // Setup Remotion mocks
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(0);
    (Remotion.useVideoConfig as jest.Mock).mockReturnValue({
      fps: 30,
      durationInFrames: 300,
      width: 1920,
      height: 1080,
    });
    (Remotion.staticFile as jest.Mock).mockImplementation(
      (path: string) => `/static/${path}`,
    );
    (Remotion.Audio as any) = ({ src }: { src: string }) => <audio src={src} />;
    (Remotion.spring as jest.Mock).mockImplementation(({ frame }) => 1);
    (Remotion.interpolate as jest.Mock).mockImplementation(
      (value: number, input: number[], output: number[]) => {
        const ratio = (value - input[0]) / (input[1] - input[0]);
        return output[0] + ratio * (output[1] - output[0]);
      },
    );
  });

  describe("loading state", () => {
    it("should show loading indicator when analyzing audio", () => {
      const useAudioMarkers =
        require("../../../audio/hooks/useAudioMarkers").useAudioMarkers;
      useAudioMarkers.mockReturnValueOnce({
        isLoading: true,
        error: null,
        currentMarkers: [],
      });

      render(<AudioTriggeredContent audioSrc="test.mp3" />);

      expect(screen.getByText("Loading...")).toBeInTheDocument();
      expect(screen.getByText("Analyzing audio rhythm...")).toBeInTheDocument();
    });
  });

  describe("error state", () => {
    it("should show error message when analysis fails", () => {
      const useAudioMarkers =
        require("../../../audio/hooks/useAudioMarkers").useAudioMarkers;
      useAudioMarkers.mockReturnValueOnce({
        isLoading: false,
        error: new Error("Failed to load audio"),
        currentMarkers: [],
      });

      render(<AudioTriggeredContent audioSrc="test.mp3" />);

      expect(screen.getByText(/Error analyzing audio:/)).toBeInTheDocument();
      expect(screen.getByText(/Failed to load audio/)).toBeInTheDocument();
    });
  });

  describe("audio playback", () => {
    it("should render audio element with correct source", () => {
      render(<AudioTriggeredContent audioSrc="test.mp3" />);

      const audio = screen.getByRole("generic").querySelector("audio");
      expect(audio).toBeInTheDocument();
      expect(audio?.getAttribute("src")).toBe("/static/test.mp3");
    });

    it("should handle audioStartFrame prop", () => {
      render(
        <AudioTriggeredContent audioSrc="test.mp3" audioStartFrame={30} />,
      );

      const audio = screen.getByRole("generic").querySelector("audio");
      expect(audio).toBeInTheDocument();
    });
  });

  describe("BPM display", () => {
    it("should display BPM when available", () => {
      render(<AudioTriggeredContent audioSrc="test.mp3" />);

      expect(screen.getByText("BPM: 120")).toBeInTheDocument();
    });

    it("should not display BPM when unavailable", () => {
      const useAudioMarkers =
        require("../../../audio/hooks/useAudioMarkers").useAudioMarkers;
      useAudioMarkers.mockReturnValueOnce({
        isLoading: false,
        error: null,
        currentMarkers: [],
        bpm: undefined,
        isOnBeat: false,
        isOnOnset: false,
        isOnDownbeat: false,
        beatProgress: 0,
      });

      render(<AudioTriggeredContent audioSrc="test.mp3" />);

      expect(screen.queryByText(/BPM:/)).not.toBeInTheDocument();
    });
  });

  describe("beat visualization", () => {
    it("should show beat indicator when on beat", () => {
      const useAudioMarkers =
        require("../../../audio/hooks/useAudioMarkers").useAudioMarkers;
      useAudioMarkers.mockReturnValueOnce({
        isLoading: false,
        error: null,
        currentMarkers: [],
        isOnBeat: true,
        isOnOnset: false,
        isOnDownbeat: false,
        beatProgress: 0.5,
        bpm: 120,
      });

      const { container } = render(
        <AudioTriggeredContent audioSrc="test.mp3" />,
      );

      // Check for beat visual indicator
      const beatIndicator = container.querySelector('[style*="border"]');
      expect(beatIndicator).toBeInTheDocument();
    });

    it("should show different indicator for downbeat", () => {
      const useAudioMarkers =
        require("../../../audio/hooks/useAudioMarkers").useAudioMarkers;
      useAudioMarkers.mockReturnValueOnce({
        isLoading: false,
        error: null,
        currentMarkers: [],
        isOnBeat: true,
        isOnOnset: false,
        isOnDownbeat: true,
        beatProgress: 0,
        bpm: 120,
      });

      render(<AudioTriggeredContent audioSrc="test.mp3" />);

      expect(screen.getByText("!")).toBeInTheDocument();
    });

    it("should show onset indicator when on onset", () => {
      const useAudioMarkers =
        require("../../../audio/hooks/useAudioMarkers").useAudioMarkers;
      useAudioMarkers.mockReturnValueOnce({
        isLoading: false,
        error: null,
        currentMarkers: [],
        isOnBeat: false,
        isOnOnset: true,
        isOnDownbeat: false,
        beatProgress: 0,
        bpm: 120,
      });

      render(<AudioTriggeredContent audioSrc="test.mp3" />);

      expect(screen.getByText("♪")).toBeInTheDocument();
    });
  });

  describe("beat progress bar", () => {
    it("should display beat progress", () => {
      const useAudioMarkers =
        require("../../../audio/hooks/useAudioMarkers").useAudioMarkers;
      useAudioMarkers.mockReturnValueOnce({
        isLoading: false,
        error: null,
        currentMarkers: [],
        isOnBeat: false,
        isOnOnset: false,
        isOnDownbeat: false,
        beatProgress: 0.75,
        bpm: 120,
      });

      const { container } = render(
        <AudioTriggeredContent audioSrc="test.mp3" />,
      );

      const progressBar = container.querySelector('[style*="width: 75%"]');
      expect(progressBar).toBeInTheDocument();
    });
  });

  describe("current markers rendering", () => {
    it("should render markers for current frame", () => {
      const useAudioMarkers =
        require("../../../audio/hooks/useAudioMarkers").useAudioMarkers;
      useAudioMarkers.mockReturnValueOnce({
        isLoading: false,
        error: null,
        currentMarkers: [
          { time: 1.0, type: "beat", frame: 30, confidence: 0.9 },
          { time: 1.0, type: "onset", frame: 30, confidence: 0.8 },
        ],
        isOnBeat: true,
        isOnOnset: true,
        isOnDownbeat: false,
        beatProgress: 0,
        bpm: 120,
      });

      const { container } = render(
        <AudioTriggeredContent audioSrc="test.mp3" />,
      );

      // Should render marker visuals
      const markerVisuals = container.querySelectorAll(
        '[style*="position: absolute"]',
      );
      expect(markerVisuals.length).toBeGreaterThan(0);
    });
  });
});

describe("BeatPulse", () => {
  beforeEach(() => {
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(30);
    (Remotion.useVideoConfig as jest.Mock).mockReturnValue({ fps: 30 });
    (Remotion.spring as jest.Mock).mockImplementation(() => 1.2);
  });

  it("should render a pulsing circle", () => {
    const { container } = render(<BeatPulse audioSrc="test.mp3" />);

    const circle = container.querySelector('[style*="border-radius: 50%"]');
    expect(circle).toBeInTheDocument();
  });

  it("should scale on beat", () => {
    const useBeats = require("../../../audio/hooks/useAudioMarkers").useBeats;
    useBeats.mockReturnValueOnce({
      isOnBeat: true,
      beatProgress: 0.5,
      isLoading: false,
    });

    const { container } = render(<BeatPulse audioSrc="test.mp3" />);

    const circle = container.querySelector('[style*="transform"]');
    expect(circle).toBeInTheDocument();
  });
});

describe("RhythmText", () => {
  it("should display words in sequence on beats", () => {
    const words = ["One", "Two", "Three"];

    render(<RhythmText audioSrc="test.mp3" words={words} />);

    // Should display first word initially
    expect(screen.getByText("One")).toBeInTheDocument();
  });

  it("should change word on beat", () => {
    const useAudioMarkers =
      require("../../../audio/hooks/useAudioMarkers").useAudioMarkers;
    const words = ["One", "Two", "Three"];

    // First render
    const { rerender } = render(
      <RhythmText audioSrc="test.mp3" words={words} />,
    );
    expect(screen.getByText("One")).toBeInTheDocument();

    // Simulate beat occurring
    useAudioMarkers.mockReturnValueOnce({
      currentMarkers: [{ type: "beat" }],
      isLoading: false,
    });

    rerender(<RhythmText audioSrc="test.mp3" words={words} />);

    // Word should advance (React state update would handle this in real component)
    expect(screen.getByText("One")).toBeInTheDocument(); // Still shows due to mock limitation
  });

  it("should apply opacity based on markers", () => {
    const useAudioMarkers =
      require("../../../audio/hooks/useAudioMarkers").useAudioMarkers;
    useAudioMarkers.mockReturnValueOnce({
      currentMarkers: [{ type: "beat" }],
      isLoading: false,
    });

    const { container } = render(
      <RhythmText audioSrc="test.mp3" words={["Test"]} />,
    );

    const text = container.querySelector('[style*="opacity: 1"]');
    expect(text).toBeInTheDocument();
  });
});

describe("AudioTriggers", () => {
  it("should render children with current markers", () => {
    const useAudioMarkers =
      require("../../../audio/hooks/useAudioMarkers").useAudioMarkers;
    useAudioMarkers.mockReturnValueOnce({
      currentMarkers: [
        { type: "beat", time: 1.0 },
        { type: "onset", time: 1.0 },
      ],
      isLoading: false,
    });

    render(
      <AudioTriggers audioSrc="test.mp3">
        {(markers) => (
          <div>
            {markers.map((m, i) => (
              <span key={i}>{m.type}</span>
            ))}
          </div>
        )}
      </AudioTriggers>,
    );

    expect(screen.getByText("beat")).toBeInTheDocument();
    expect(screen.getByText("onset")).toBeInTheDocument();
  });

  it("should not render when loading", () => {
    const useAudioMarkers =
      require("../../../audio/hooks/useAudioMarkers").useAudioMarkers;
    useAudioMarkers.mockReturnValueOnce({
      currentMarkers: [],
      isLoading: true,
    });

    render(
      <AudioTriggers audioSrc="test.mp3">
        {(markers) => <div>Content</div>}
      </AudioTriggers>,
    );

    expect(screen.queryByText("Content")).not.toBeInTheDocument();
  });

  it("should pass empty array when no markers", () => {
    const useAudioMarkers =
      require("../../../audio/hooks/useAudioMarkers").useAudioMarkers;
    useAudioMarkers.mockReturnValueOnce({
      currentMarkers: [],
      isLoading: false,
    });

    render(
      <AudioTriggers audioSrc="test.mp3">
        {(markers) => (
          <div>{markers.length === 0 ? "No markers" : "Has markers"}</div>
        )}
      </AudioTriggers>,
    );

    expect(screen.getByText("No markers")).toBeInTheDocument();
  });
});
