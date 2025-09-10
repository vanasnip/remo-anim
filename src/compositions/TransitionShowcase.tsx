import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  Sequence,
} from "remotion";
import React from "react";

const transitions = [
  { name: "Fade", color: "#FF6B6B" },
  { name: "Slide", color: "#4ECDC4" },
  { name: "Scale", color: "#45B7D1" },
  { name: "Rotate", color: "#96CEB4" },
  { name: "Blur", color: "#FFEAA7" },
  { name: "Combined", color: "#DDA0DD" },
];

export const TransitionShowcase: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sceneDuration = 90; // 3 seconds per transition

  return (
    <AbsoluteFill style={{ backgroundColor: "#1a1a1a" }}>
      {transitions.map((transition, index) => {
        const start = index * sceneDuration;
        const localFrame = frame - start;
        
        // Calculate animation progress for this scene
        const progress = Math.min(localFrame / 30, 1);
        const exitProgress = Math.max(0, (localFrame - 60) / 30);

        // Different transition effects
        let style: React.CSSProperties = {};

        switch (transition.name) {
          case "Fade":
            style = {
              opacity: interpolate(localFrame, [0, 30, 60, 90], [0, 1, 1, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            };
            break;
          case "Slide":
            style = {
              transform: `translateX(${interpolate(
                localFrame,
                [0, 30, 60, 90],
                [100, 0, 0, -100],
                {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }
              )}%)`,
            };
            break;
          case "Scale":
            style = {
              transform: `scale(${interpolate(
                localFrame,
                [0, 30, 60, 90],
                [0, 1, 1, 0],
                {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }
              )})`,
            };
            break;
          case "Rotate":
            style = {
              transform: `rotate(${interpolate(
                localFrame,
                [0, 30, 60, 90],
                [-180, 0, 0, 180],
                {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }
              )}deg)`,
            };
            break;
          case "Blur":
            style = {
              filter: `blur(${interpolate(
                localFrame,
                [0, 30, 60, 90],
                [20, 0, 0, 20],
                {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }
              )}px)`,
              opacity: interpolate(localFrame, [0, 30, 60, 90], [0, 1, 1, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            };
            break;
          case "Combined":
            style = {
              transform: `scale(${interpolate(
                localFrame,
                [0, 30, 60, 90],
                [0.5, 1, 1, 1.5],
                {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }
              )}) rotate(${interpolate(
                localFrame,
                [0, 30, 60, 90],
                [0, 0, 0, 360],
                {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }
              )}deg)`,
              opacity: interpolate(localFrame, [0, 30, 60, 90], [0, 1, 1, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            };
            break;
        }

        return (
          <Sequence
            key={transition.name}
            from={start}
            durationInFrames={sceneDuration}
          >
            <AbsoluteFill
              style={{
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  ...style,
                  width: 600,
                  height: 400,
                  backgroundColor: transition.color,
                  borderRadius: 20,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
                }}
              >
                <div style={{ textAlign: "center" }}>
                  <h2
                    style={{
                      fontSize: 64,
                      fontWeight: "bold",
                      color: "white",
                      margin: 0,
                      marginBottom: 20,
                      fontFamily: "Arial, sans-serif",
                      textShadow: "0 2px 10px rgba(0,0,0,0.2)",
                    }}
                  >
                    {transition.name}
                  </h2>
                  <p
                    style={{
                      fontSize: 24,
                      color: "rgba(255,255,255,0.9)",
                      margin: 0,
                      fontFamily: "Arial, sans-serif",
                    }}
                  >
                    Transition Effect
                  </p>
                </div>
              </div>
            </AbsoluteFill>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};