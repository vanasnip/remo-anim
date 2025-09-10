import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Video,
  staticFile,
  Sequence,
} from "remotion";
import React from "react";

export interface MathLessonProps {
  title: string;
  subtitle?: string;
  chapters: Array<{
    title: string;
    description: string;
    manimVideo?: string;
    keyPoints: string[];
    duration: number;
  }>;
  instructor?: string;
}

export const MathLesson: React.FC<MathLessonProps> = ({
  title = "Mathematics Lesson",
  subtitle = "Learn with Animations",
  chapters = [],
  instructor = "Remotion Academy",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Title screen animation
  const titleOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: "clamp",
  });

  const titleScale = spring({
    frame,
    fps,
    config: { damping: 10 },
  });

  // Calculate total intro duration (3 seconds)
  const introDuration = 90; // 3 seconds at 30fps

  return (
    <AbsoluteFill style={{ backgroundColor: "#1a1a2e" }}>
      {/* Title Sequence */}
      <Sequence from={0} durationInFrames={introDuration}>
        <AbsoluteFill
          style={{
            justifyContent: "center",
            alignItems: "center",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          }}
        >
          <div
            style={{
              textAlign: "center",
              opacity: titleOpacity,
              transform: `scale(${titleScale})`,
            }}
          >
            <h1
              style={{
                fontSize: 72,
                fontWeight: "bold",
                color: "white",
                marginBottom: 20,
                textShadow: "0 4px 20px rgba(0,0,0,0.3)",
                fontFamily: "Arial, sans-serif",
              }}
            >
              {title}
            </h1>
            {subtitle && (
              <p
                style={{
                  fontSize: 32,
                  color: "rgba(255,255,255,0.9)",
                  marginBottom: 40,
                  fontFamily: "Arial, sans-serif",
                }}
              >
                {subtitle}
              </p>
            )}
            {instructor && (
              <p
                style={{
                  fontSize: 24,
                  color: "rgba(255,255,255,0.7)",
                  fontStyle: "italic",
                  fontFamily: "Arial, sans-serif",
                }}
              >
                with {instructor}
              </p>
            )}
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Chapters */}
      {chapters.map((chapter, index) => {
        const chapterStart = introDuration + chapters
          .slice(0, index)
          .reduce((acc, ch) => acc + ch.duration, 0);

        return (
          <Sequence
            key={index}
            from={chapterStart}
            durationInFrames={chapter.duration}
          >
            <AbsoluteFill>
              {/* Background Video */}
              {chapter.manimVideo && (
                <AbsoluteFill style={{ opacity: 0.8 }}>
                  <Video
                    src={staticFile(chapter.manimVideo)}
                    startFrom={0}
                    endAt={chapter.duration}
                  />
                </AbsoluteFill>
              )}

              {/* Chapter Content Overlay */}
              <AbsoluteFill
                style={{
                  background: "linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.7) 100%)",
                }}
              >
                {/* Chapter Title */}
                <div
                  style={{
                    position: "absolute",
                    top: 40,
                    left: 60,
                    right: 60,
                  }}
                >
                  <h2
                    style={{
                      fontSize: 48,
                      fontWeight: "bold",
                      color: "white",
                      marginBottom: 10,
                      textShadow: "0 2px 10px rgba(0,0,0,0.5)",
                      fontFamily: "Arial, sans-serif",
                    }}
                  >
                    {chapter.title}
                  </h2>
                  <p
                    style={{
                      fontSize: 24,
                      color: "rgba(255,255,255,0.8)",
                      fontFamily: "Arial, sans-serif",
                    }}
                  >
                    {chapter.description}
                  </p>
                </div>

                {/* Key Points */}
                <div
                  style={{
                    position: "absolute",
                    bottom: 60,
                    left: 60,
                    right: 60,
                  }}
                >
                  <div
                    style={{
                      background: "rgba(255,255,255,0.1)",
                      backdropFilter: "blur(10px)",
                      borderRadius: 15,
                      padding: 30,
                      border: "1px solid rgba(255,255,255,0.2)",
                    }}
                  >
                    <h3
                      style={{
                        fontSize: 28,
                        fontWeight: "bold",
                        color: "white",
                        marginBottom: 20,
                        fontFamily: "Arial, sans-serif",
                      }}
                    >
                      Key Points
                    </h3>
                    <ul
                      style={{
                        listStyle: "none",
                        padding: 0,
                        margin: 0,
                      }}
                    >
                      {chapter.keyPoints.map((point, pointIndex) => (
                        <li
                          key={pointIndex}
                          style={{
                            fontSize: 20,
                            color: "rgba(255,255,255,0.9)",
                            marginBottom: 10,
                            paddingLeft: 30,
                            position: "relative",
                            fontFamily: "Arial, sans-serif",
                          }}
                        >
                          <span
                            style={{
                              position: "absolute",
                              left: 0,
                              color: "#4fc3f7",
                            }}
                          >
                            ▸
                          </span>
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </AbsoluteFill>
            </AbsoluteFill>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};