import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from "remotion";
import {
  Card,
  CardContent,
  Typography,
  Box,
  Paper,
  Tabs,
  Tab,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import * as React from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CodeIcon from "@mui/icons-material/Code";
import BuildIcon from "@mui/icons-material/Build";

const theme = createTheme({
  palette: {
    primary: {
      main: "#61dafb", // React blue
    },
    secondary: {
      main: "#282c34", // Dark background
    },
    success: {
      main: "#4caf50",
    },
  },
  typography: {
    fontFamily: '"Segoe UI", "Roboto", "Helvetica", "Arial", sans-serif',
  },
});

export const ReactComponentTutorial: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Tutorial sections
  const sections = [
    {
      title: "Introduction to React Components",
      duration: 90, // 3 seconds
      type: "intro",
    },
    {
      title: "Creating a Functional Component",
      duration: 300, // 10 seconds
      type: "code",
      files: [
        {
          name: "Button.tsx",
          language: "tsx",
          code: `import React from 'react';

interface ButtonProps {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

export const Button: React.FC<ButtonProps> = ({
  label,
  onClick,
  variant = 'primary'
}) => {
  return (
    <button
      className={\`btn btn-\${variant}\`}
      onClick={onClick}
    >
      {label}
    </button>
  );
};`,
        },
      ],
      points: [
        "Define TypeScript interface for props",
        "Use React.FC for type safety",
        "Implement default props",
        "Export for reusability",
      ],
    },
    {
      title: "Adding Styles with CSS Modules",
      duration: 240, // 8 seconds
      type: "code",
      files: [
        {
          name: "Button.module.css",
          language: "css",
          code: `.btn {
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 20px rgba(0,0,0,0.2);
}`,
        },
      ],
      points: [
        "Use CSS Modules for scoped styles",
        "Apply gradient backgrounds",
        "Add hover effects",
        "Ensure responsive design",
      ],
    },
    {
      title: "Using the Component",
      duration: 300, // 10 seconds
      type: "code",
      files: [
        {
          name: "App.tsx",
          language: "tsx",
          code: `import React, { useState } from 'react';
import { Button } from './components/Button';

function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="app">
      <h1>React Component Demo</h1>
      <p>Count: {count}</p>

      <Button
        label="Increment"
        onClick={() => setCount(count + 1)}
        variant="primary"
      />

      <Button
        label="Reset"
        onClick={() => setCount(0)}
        variant="secondary"
      />
    </div>
  );
}

export default App;`,
        },
      ],
      points: [
        "Import custom components",
        "Manage state with useState",
        "Pass props to components",
        "Handle events properly",
      ],
    },
    {
      title: "Testing Your Component",
      duration: 240, // 8 seconds
      type: "code",
      files: [
        {
          name: "Button.test.tsx",
          language: "tsx",
          code: `import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('Button Component', () => {
  test('renders with label', () => {
    render(<Button label="Click me" onClick={() => {}} />);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  test('handles click events', () => {
    const handleClick = jest.fn();
    render(<Button label="Test" onClick={handleClick} />);

    fireEvent.click(screen.getByText('Test'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  test('applies correct variant class', () => {
    const { rerender } = render(
      <Button label="Test" onClick={() => {}} variant="primary" />
    );
    expect(screen.getByRole('button')).toHaveClass('btn-primary');
  });
});`,
        },
      ],
      points: [
        "Write unit tests with Jest",
        "Use Testing Library for DOM queries",
        "Test user interactions",
        "Verify component behavior",
      ],
    },
    {
      title: "Best Practices & Summary",
      duration: 180, // 6 seconds
      type: "summary",
      points: [
        "✅ Use TypeScript for type safety",
        "✅ Keep components small and focused",
        "✅ Write comprehensive tests",
        "✅ Document prop interfaces",
        "✅ Follow React naming conventions",
        "✅ Optimize for performance",
      ],
    },
  ];

  // Calculate current section
  let currentSection = 0;
  let accumulatedFrames = 0;
  for (let i = 0; i < sections.length; i++) {
    if (
      frame >= accumulatedFrames &&
      frame < accumulatedFrames + sections[i].duration
    ) {
      currentSection = i;
      break;
    }
    accumulatedFrames += sections[i].duration;
  }

  const section = sections[currentSection];
  const sectionOffset =
    frame -
    sections.slice(0, currentSection).reduce((acc, s) => acc + s.duration, 0);

  // Animation values
  const titleScale = spring({
    frame: sectionOffset - 10,
    fps,
    config: {
      damping: 12,
    },
  });

  const contentFade = interpolate(sectionOffset, [15, 45], [0, 1], {
    extrapolateRight: "clamp",
  });

  const codeSlide = interpolate(sectionOffset, [20, 50], [50, 0], {
    extrapolateRight: "clamp",
  });

  // Tab state for file switcher
  const [selectedFile, setSelectedFile] = React.useState(0);

  return (
    <ThemeProvider theme={theme}>
      <AbsoluteFill
        style={{
          background: "linear-gradient(135deg, #282c34 0%, #1a1d23 100%)",
        }}
      >
        {/* React Logo Background */}
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            opacity: 0.05,
            fontSize: "40rem",
            color: "#61dafb",
            animation: "spin 20s linear infinite",
            "@keyframes spin": {
              from: { transform: "translate(-50%, -50%) rotate(0deg)" },
              to: { transform: "translate(-50%, -50%) rotate(360deg)" },
            },
          }}
        >
          ⚛️
        </Box>

        {/* Header */}
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            backgroundColor: "rgba(40, 44, 52, 0.95)",
            borderBottom: "3px solid #61dafb",
            p: 2,
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <Typography
                variant="h4"
                sx={{
                  color: "#61dafb",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                }}
              >
                ⚛️ React Component Tutorial
              </Typography>
            </Box>
            <Chip
              label={`Section ${currentSection + 1} / ${sections.length}`}
              sx={{
                backgroundColor: "#61dafb",
                color: "#282c34",
                fontWeight: 700,
              }}
            />
          </Box>
        </Box>

        {/* Main Content */}
        <Box
          sx={{
            position: "absolute",
            top: 80,
            left: 0,
            right: 0,
            bottom: 60,
            p: 3,
          }}
        >
          {/* Section Title */}
          <Typography
            variant="h3"
            sx={{
              color: "white",
              textAlign: "center",
              mb: 3,
              transform: `scale(${titleScale})`,
              opacity: contentFade,
            }}
          >
            {section.title}
          </Typography>

          {/* Content based on section type */}
          {section.type === "intro" && (
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "60%",
              }}
            >
              <Paper
                elevation={10}
                sx={{
                  p: 4,
                  backgroundColor: "rgba(97, 218, 251, 0.1)",
                  border: "2px solid #61dafb",
                  borderRadius: 4,
                  opacity: contentFade,
                }}
              >
                <Typography
                  variant="h5"
                  sx={{
                    color: "white",
                    textAlign: "center",
                    mb: 2,
                  }}
                >
                  Learn to build reusable React components
                </Typography>
                <Typography
                  variant="body1"
                  sx={{
                    color: "rgba(255,255,255,0.8)",
                    textAlign: "center",
                  }}
                >
                  TypeScript • Testing • Best Practices
                </Typography>
              </Paper>
            </Box>
          )}

          {section.type === "code" && section.files && (
            <Box sx={{ display: "flex", gap: 3, height: "80%" }}>
              {/* Code Editor */}
              <Paper
                elevation={10}
                sx={{
                  flex: 2,
                  backgroundColor: "#1e1e1e",
                  borderRadius: 2,
                  overflow: "hidden",
                  opacity: contentFade,
                  transform: `translateX(${-codeSlide}px)`,
                }}
              >
                {/* File Tabs */}
                {section.files.length > 1 && (
                  <Tabs
                    value={selectedFile}
                    onChange={(_, value) => setSelectedFile(value)}
                    sx={{
                      backgroundColor: "#2d2d30",
                      borderBottom: "1px solid #3e3e42",
                      minHeight: 40,
                      "& .MuiTab-root": {
                        color: "#969696",
                        minHeight: 40,
                        textTransform: "none",
                      },
                      "& .Mui-selected": {
                        color: "#ffffff",
                        backgroundColor: "#1e1e1e",
                      },
                    }}
                  >
                    {section.files.map((file, index) => (
                      <Tab
                        key={index}
                        label={
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                            }}
                          >
                            <CodeIcon sx={{ fontSize: 16 }} />
                            {file.name}
                          </Box>
                        }
                      />
                    ))}
                  </Tabs>
                )}

                {/* Code Content */}
                <Box sx={{ overflow: "auto", height: "calc(100% - 40px)" }}>
                  <SyntaxHighlighter
                    language={section.files[selectedFile].language}
                    style={atomDark}
                    customStyle={{
                      margin: 0,
                      padding: "1.5rem",
                      fontSize: "0.95rem",
                      backgroundColor: "transparent",
                      height: "100%",
                    }}
                    showLineNumbers
                  >
                    {section.files[selectedFile].code}
                  </SyntaxHighlighter>
                </Box>
              </Paper>

              {/* Key Points */}
              {section.points && (
                <Paper
                  elevation={5}
                  sx={{
                    flex: 1,
                    p: 3,
                    backgroundColor: "rgba(255,255,255,0.95)",
                    borderRadius: 2,
                    opacity: contentFade,
                    transform: `translateX(${codeSlide}px)`,
                  }}
                >
                  <Typography
                    variant="h6"
                    sx={{
                      color: "#282c34",
                      fontWeight: 700,
                      mb: 2,
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                    }}
                  >
                    <BuildIcon /> Key Concepts
                  </Typography>
                  <List>
                    {section.points.map((point, index) => {
                      const pointDelay = index * 20;
                      const pointOpacity = interpolate(
                        sectionOffset,
                        [30 + pointDelay, 60 + pointDelay],
                        [0, 1],
                        { extrapolateRight: "clamp" },
                      );

                      return (
                        <ListItem
                          key={index}
                          sx={{
                            opacity: pointOpacity,
                            transform: `translateX(${interpolate(
                              pointOpacity,
                              [0, 1],
                              [20, 0],
                            )}px)`,
                          }}
                        >
                          <ListItemIcon>
                            <CheckCircleIcon sx={{ color: "#4caf50" }} />
                          </ListItemIcon>
                          <ListItemText primary={point} />
                        </ListItem>
                      );
                    })}
                  </List>
                </Paper>
              )}
            </Box>
          )}

          {section.type === "summary" && section.points && (
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "60%",
              }}
            >
              <Card
                elevation={10}
                sx={{
                  maxWidth: 600,
                  p: 4,
                  backgroundColor: "rgba(255,255,255,0.95)",
                  opacity: contentFade,
                }}
              >
                <CardContent>
                  <Typography
                    variant="h5"
                    sx={{
                      color: "#282c34",
                      fontWeight: 700,
                      mb: 3,
                      textAlign: "center",
                    }}
                  >
                    🎯 Best Practices
                  </Typography>
                  {section.points.map((point, index) => (
                    <Typography
                      key={index}
                      variant="body1"
                      sx={{
                        mb: 1,
                        opacity: interpolate(
                          sectionOffset,
                          [30 + index * 15, 60 + index * 15],
                          [0, 1],
                          { extrapolateRight: "clamp" },
                        ),
                      }}
                    >
                      {point}
                    </Typography>
                  ))}
                </CardContent>
              </Card>
            </Box>
          )}
        </Box>

        {/* Footer Progress Bar */}
        <Box
          sx={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: "rgba(40, 44, 52, 0.95)",
            p: 2,
          }}
        >
          <Box
            sx={{
              height: 4,
              backgroundColor: "rgba(255,255,255,0.1)",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <Box
              sx={{
                width: `${(frame / 2700) * 100}%`,
                height: "100%",
                backgroundColor: "#61dafb",
                transition: "width 0.1s linear",
              }}
            />
          </Box>
        </Box>
      </AbsoluteFill>
    </ThemeProvider>
  );
};
