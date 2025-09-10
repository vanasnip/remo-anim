// Manual mock for Remotion
import * as React from "react";

interface AbsoluteFillProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export const AbsoluteFill = ({
  children,
  style,
  ...props
}: AbsoluteFillProps) => (
  <div
    data-testid="absolute-fill"
    style={{
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      ...style,
    }}
    {...props}
  >
    {children}
  </div>
);

interface SequenceProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  from?: number;
  durationInFrames?: number;
}

export const Sequence = ({
  children,
  from,
  durationInFrames,
  ...props
}: SequenceProps) => (
  <div
    data-testid="sequence"
    data-from={from}
    data-duration={durationInFrames}
    {...props}
  >
    {children}
  </div>
);

interface VideoProps extends React.VideoHTMLAttributes<HTMLVideoElement> {
  src: string;
  onError?: (event: React.SyntheticEvent<HTMLVideoElement, Event>) => void;
}

export const Video = React.forwardRef<HTMLVideoElement, VideoProps>(
  ({ src, style, onError, ...props }, ref) => (
    <video
      data-testid="remotion-video"
      ref={ref}
      src={src}
      style={style}
      onError={onError}
      {...props}
    />
  ),
);

Video.displayName = "Video";

interface ImgProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
}

export const Img = ({ src, style, ...props }: ImgProps) => (
  <img data-testid="remotion-img" src={src} style={style} {...props} />
);

export const useCurrentFrame = jest.fn(() => 30);

export const useVideoConfig = jest.fn(() => ({
  fps: 30,
  durationInFrames: 900,
  width: 1920,
  height: 1080,
}));

interface InterpolateOptions {
  extrapolateLeft?: "clamp" | "extend" | "identity";
  extrapolateRight?: "clamp" | "extend" | "identity";
}

export const interpolate = jest.fn(
  (
    input: number,
    inputRange: number[],
    outputRange: number[],
    options?: InterpolateOptions,
  ) => {
    const progress = Math.max(
      0,
      Math.min(1, (input - inputRange[0]) / (inputRange[1] - inputRange[0])),
    );
    return outputRange[0] + (outputRange[1] - outputRange[0]) * progress;
  },
);

interface SpringConfig {
  damping?: number;
  stiffness?: number;
  mass?: number;
}

interface SpringProps {
  frame: number;
  fps: number;
  config?: SpringConfig;
}

export const spring = jest.fn(({ frame }: SpringProps) => {
  return Math.min(1, Math.max(0, frame / 30));
});

export const staticFile = jest.fn((path: string) => path);
