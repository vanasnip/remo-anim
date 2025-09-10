// Mock for Remotion components and hooks
const React = require("react");

// Mock AbsoluteFill
const AbsoluteFill = ({ children, style, ...props }) =>
  React.createElement(
    "div",
    {
      "data-testid": "absolute-fill",
      style: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        ...style,
      },
      ...props,
    },
    children,
  );

// Mock Sequence
const Sequence = ({ children, from, durationInFrames, ...props }) =>
  React.createElement(
    "div",
    {
      "data-testid": "sequence",
      "data-from": from,
      "data-duration": durationInFrames,
      ...props,
    },
    children,
  );

// Mock Video component
const Video = React.forwardRef(
  ({ src, style, onLoad, onError, ...props }, ref) =>
    React.createElement("video", {
      "data-testid": "remotion-video",
      ref,
      src,
      style,
      onLoad,
      onError,
      ...props,
    }),
);

// Mock Img component
const Img = ({ src, style, ...props }) =>
  React.createElement("img", {
    "data-testid": "remotion-img",
    src,
    style,
    ...props,
  });

// Mock hooks
const useCurrentFrame = jest.fn(() => 30);
const useVideoConfig = jest.fn(() => ({
  fps: 30,
  durationInFrames: 900,
  width: 1920,
  height: 1080,
}));

// Mock interpolate function
const interpolate = jest.fn((input, inputRange, outputRange, options) => {
  // Simple linear interpolation for testing
  const progress = Math.max(
    0,
    Math.min(1, (input - inputRange[0]) / (inputRange[1] - inputRange[0])),
  );
  return outputRange[0] + (outputRange[1] - outputRange[0]) * progress;
});

// Mock spring function
const spring = jest.fn(({ frame, fps, config }) => {
  // Simple animation progress for testing
  return Math.min(1, Math.max(0, frame / 30));
});

// Mock staticFile function
const staticFile = jest.fn((path) => `http://localhost:3000/public/${path}`);

// Mock Composition component
const Composition = ({
  id,
  component,
  durationInFrames,
  fps,
  width,
  height,
  ...props
}) =>
  React.createElement("div", {
    "data-testid": "composition",
    "data-id": id,
    "data-duration": durationInFrames,
    "data-fps": fps,
    "data-width": width,
    "data-height": height,
    ...props,
  });

// Mock Audio component
const Audio = ({ src, ...props }) =>
  React.createElement("audio", {
    "data-testid": "remotion-audio",
    src,
    ...props,
  });

// Export everything as default too for different import styles
const Remotion = {
  AbsoluteFill,
  Sequence,
  Video,
  Img,
  Audio,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  staticFile,
  Composition,
};

module.exports = {
  AbsoluteFill,
  Sequence,
  Video,
  Img,
  Audio,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  staticFile,
  Composition,
  default: Remotion,
  __esModule: true,
};
