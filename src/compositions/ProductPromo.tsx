import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Video,
  staticFile,
} from "remotion";
import React from "react";

export interface ProductPromoProps {
  productName: string;
  features: string[];
  brandColors?: {
    primary?: string;
    secondary?: string;
  };
  tagline?: string;
  manimVideo?: string;
}

export const ProductPromo: React.FC<ProductPromoProps> = ({
  productName = "Amazing Product",
  features = ["Feature 1", "Feature 2", "Feature 3"],
  brandColors = {
    primary: "#1976d2",
    secondary: "#42a5f5",
  },
  tagline = "The future is here",
  manimVideo,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Animation timings
  const titleStart = 0;
  const titleDuration = 60;
  const featuresStart = 45;
  const featureDuration = 30;
  const taglineStart = durationInFrames - 90;

  // Title animation
  const titleOpacity = interpolate(
    frame,
    [titleStart, titleStart + 30],
    [0, 1],
    { extrapolateRight: "clamp" }
  );

  const titleScale = spring({
    frame: frame - titleStart,
    fps,
    config: { damping: 12 },
  });

  // Features animation
  const featuresProgress = features.map((_, index) => {
    const delay = featuresStart + index * 15;
    return spring({
      frame: frame - delay,
      fps,
      config: { damping: 15 },
    });
  });

  // Tagline animation
  const taglineOpacity = interpolate(
    frame,
    [taglineStart, taglineStart + 30],
    [0, 1],
    { extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${brandColors.primary} 0%, ${brandColors.secondary} 100%)`,
      }}
    >
      {/* Background Video */}
      {manimVideo && (
        <AbsoluteFill style={{ opacity: 0.3 }}>
          <Video
            src={staticFile(manimVideo)}
            startFrom={0}
            endAt={durationInFrames}
          />
        </AbsoluteFill>
      )}

      {/* Content */}
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {/* Product Title */}
        <div
          style={{
            position: "absolute",
            top: "20%",
            textAlign: "center",
            width: "100%",
            opacity: titleOpacity,
            transform: `scale(${titleScale})`,
          }}
        >
          <h1
            style={{
              fontSize: 80,
              fontWeight: "bold",
              color: "white",
              textShadow: "0 4px 20px rgba(0,0,0,0.3)",
              margin: 0,
              fontFamily: "Arial, sans-serif",
            }}
          >
            {productName}
          </h1>
        </div>

        {/* Features List */}
        <div
          style={{
            position: "absolute",
            top: "45%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 20,
          }}
        >
          {features.map((feature, index) => (
            <div
              key={feature}
              style={{
                opacity: featuresProgress[index],
                transform: `translateX(${
                  (1 - featuresProgress[index]) * -50
                }px)`,
              }}
            >
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.95)",
                  padding: "15px 40px",
                  borderRadius: 50,
                  boxShadow: "0 8px 30px rgba(0,0,0,0.2)",
                }}
              >
                <span
                  style={{
                    fontSize: 24,
                    fontWeight: 500,
                    color: brandColors.primary,
                    fontFamily: "Arial, sans-serif",
                  }}
                >
                  ✓ {feature}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Tagline */}
        {tagline && (
          <div
            style={{
              position: "absolute",
              bottom: "15%",
              width: "100%",
              textAlign: "center",
              opacity: taglineOpacity,
            }}
          >
            <p
              style={{
                fontSize: 36,
                color: "white",
                fontStyle: "italic",
                textShadow: "0 2px 10px rgba(0,0,0,0.3)",
                margin: 0,
                fontFamily: "Arial, sans-serif",
              }}
            >
              {tagline}
            </p>
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};