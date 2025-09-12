# Manim Integration Guide

## Overview

This guide explains how **Manim** (Mathematical Animation Engine) is integrated with **Remotion** to create sophisticated mathematical and educational animations.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Python Script  │────▶│  Manim Bridge    │────▶│  Remotion App   │
│  (Create Math)  │     │  (Convert/Meta)  │     │  (Display)      │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                        │                         │
        ▼                        ▼                         ▼
   .py files              .mp4 + .json              React Components
```

## Setup

### Prerequisites

```bash
# Python 3.10+
python --version

# Install Manim
pip install manim

# Install additional dependencies
pip install numpy pillow scipy
```

### Directory Structure

```
manim-scripts/
├── manim_bridge.py      # Bridge script
├── animations/          # Your Manim scenes
│   ├── math_concepts.py
│   ├── physics_demo.py
│   └── algorithm_viz.py
└── output/             # Generated videos
    └── *.mp4
```

## Creating Manim Animations

### 1. Basic Manim Scene

```python
# manim-scripts/animations/example.py
from manim import *

class ExampleScene(Scene):
    def construct(self):
        # Create objects
        circle = Circle(radius=2, color=BLUE)
        square = Square(side_length=3, color=RED)

        # Animate
        self.play(Create(circle))
        self.wait(1)
        self.play(Transform(circle, square))
        self.wait(1)
        self.play(FadeOut(square))
```

### 2. Mathematical Animation

```python
class MathematicalConcept(Scene):
    def construct(self):
        # LaTeX equations
        equation = MathTex(r"e^{i\pi} + 1 = 0")
        equation.scale(2)

        # Graph
        axes = Axes(
            x_range=[-3, 3],
            y_range=[-3, 3],
            axis_config={"color": BLUE}
        )

        func = axes.plot(lambda x: x**2, color=GREEN)

        # Animate sequence
        self.play(Write(equation))
        self.wait()
        self.play(equation.animate.to_edge(UP))
        self.play(Create(axes), Create(func))
        self.wait(2)
```

### 3. 3D Animation

```python
class ThreeDScene(ThreeDScene):
    def construct(self):
        # Configure 3D
        self.set_camera_orientation(phi=75*DEGREES, theta=45*DEGREES)

        # Create 3D objects
        cube = Cube(side_length=2, fill_opacity=0.7)
        sphere = Sphere(radius=1.5, color=BLUE)

        # Animate in 3D
        self.play(Create(cube))
        self.play(
            Rotate(cube, angle=PI/2, axis=UP),
            run_time=2
        )
        self.play(Transform(cube, sphere))
```

## Bridge Script

### manim_bridge.py

```python
#!/usr/bin/env python3
"""Bridge between Manim and Remotion"""

import os
import json
import subprocess
from pathlib import Path

class ManimBridge:
    def __init__(self):
        self.output_dir = Path("../remotion-app/public/assets/manim")
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def render_scene(self, file_path, scene_name, quality="medium"):
        """Render a Manim scene to video"""

        quality_map = {
            "low": "-ql",
            "medium": "-qm",
            "high": "-qh",
            "4k": "-qk"
        }

        cmd = [
            "manim",
            quality_map.get(quality, "-qm"),
            file_path,
            scene_name,
            "-o", f"{scene_name}.mp4"
        ]

        subprocess.run(cmd, check=True)

        # Move to Remotion assets
        source = Path(f"media/videos/{scene_name}/1080p60/{scene_name}.mp4")
        dest = self.output_dir / f"{scene_name}.mp4"
        source.rename(dest)

        # Generate metadata
        metadata = {
            "name": scene_name,
            "duration": self.get_video_duration(dest),
            "fps": 60,
            "width": 1920,
            "height": 1080,
            "quality": quality
        }

        with open(dest.with_suffix('.json'), 'w') as f:
            json.dump(metadata, f, indent=2)

        return dest

    def get_video_duration(self, video_path):
        """Get video duration in seconds"""
        cmd = [
            "ffprobe",
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "json",
            str(video_path)
        ]

        result = subprocess.run(cmd, capture_output=True, text=True)
        data = json.loads(result.stdout)
        return float(data['format']['duration'])

# Usage
if __name__ == "__main__":
    bridge = ManimBridge()

    # Render animations
    animations = [
        ("animations/math_concepts.py", "PythagoreanTheorem"),
        ("animations/physics_demo.py", "PendulumMotion"),
        ("animations/algorithm_viz.py", "QuickSortVisualization")
    ]

    for file_path, scene_name in animations:
        print(f"Rendering {scene_name}...")
        output = bridge.render_scene(file_path, scene_name, quality="high")
        print(f"✓ Saved to {output}")
```

## Integration in Remotion

### 1. Import Manim Video

```tsx
// src/compositions/Educational/MathLesson.tsx
import { Video, staticFile, useCurrentFrame } from "remotion";

export const MathLesson: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <Video
        src={staticFile("/assets/manim/PythagoreanTheorem.mp4")}
        startFrom={0}
        endAt={300} // 10 seconds at 30fps
      />
    </AbsoluteFill>
  );
};
```

### 2. Synchronize with React Content

```tsx
export const HybridAnimation: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Manim plays from 1-6 seconds
  const MANIM_START = 30; // 1 second
  const MANIM_END = 180; // 6 seconds

  return (
    <AbsoluteFill>
      {/* Introduction */}
      {frame < MANIM_START && (
        <Box>
          <Typography variant="h1">Mathematical Concepts</Typography>
        </Box>
      )}

      {/* Manim Animation */}
      {frame >= MANIM_START && frame < MANIM_END && (
        <Video
          src={staticFile("/assets/manim/MathConcept.mp4")}
          startFrom={frame - MANIM_START}
        />
      )}

      {/* Conclusion */}
      {frame >= MANIM_END && (
        <Box>
          <Typography variant="h2">Key Takeaways</Typography>
        </Box>
      )}
    </AbsoluteFill>
  );
};
```

### 3. Overlay Annotations

```tsx
export const AnnotatedManimVideo: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      {/* Manim video as background */}
      <Video
        src={staticFile("/assets/manim/Algorithm.mp4")}
        style={{ width: "100%", height: "100%" }}
      />

      {/* Overlay explanations */}
      <Box
        sx={{
          position: "absolute",
          bottom: 100,
          left: 50,
          right: 50,
          background: "rgba(0,0,0,0.8)",
          p: 3,
          borderRadius: 2,
        }}
      >
        {frame < 60 && (
          <Typography color="white">
            Step 1: Initialize the algorithm
          </Typography>
        )}
        {frame >= 60 && frame < 120 && (
          <Typography color="white">Step 2: Process the data</Typography>
        )}
      </Box>
    </AbsoluteFill>
  );
};
```

## Rendering Commands

### Manim Rendering

```bash
# Low quality (preview)
manim -ql animations/example.py ExampleScene

# Medium quality (development)
manim -qm animations/example.py ExampleScene

# High quality (production)
manim -qh animations/example.py ExampleScene

# 4K quality
manim -qk animations/example.py ExampleScene

# With specific flags
manim -qh --fps 60 --resolution 1920,1080 animations/example.py Scene
```

### Batch Rendering

```bash
# Run bridge script to render all
cd manim-scripts
python manim_bridge.py

# Or specific scenes
python -c "
from manim_bridge import ManimBridge
bridge = ManimBridge()
bridge.render_scene('animations/math.py', 'Calculus', 'high')
"
```

## Best Practices

### 1. Performance

- Keep animations under 30 seconds
- Use appropriate quality for development vs production
- Cache rendered videos in `public/assets/manim/`

### 2. Synchronization

- Match frame rates (Manim: 60fps, Remotion: 30fps)
- Use metadata JSON for timing information
- Test frame alignment carefully

### 3. File Management

```
public/assets/manim/
├── PythagoreanTheorem.mp4
├── PythagoreanTheorem.json  # Metadata
├── QuickSort.mp4
└── QuickSort.json
```

### 4. Color Consistency

```python
# Define consistent colors
BRAND_BLUE = "#2196F3"
BRAND_GREEN = "#4CAF50"
BRAND_ORANGE = "#FF9800"

# Use in Manim
circle = Circle(color=BRAND_BLUE)
```

## Troubleshooting

| Issue             | Solution                              |
| ----------------- | ------------------------------------- |
| Manim not found   | Ensure `manim` is in PATH             |
| FFmpeg errors     | Install ffmpeg: `brew install ffmpeg` |
| Video not loading | Check path with `staticFile()`        |
| Timing mismatch   | Verify fps settings                   |
| Quality issues    | Use `-qh` or `-qk` flags              |

## Advanced Techniques

### 1. Custom Manim Config

```python
# manim.cfg
[CLI]
frame_rate = 60
pixel_height = 1080
pixel_width = 1920
background_color = WHITE
```

### 2. Programmatic Control

```python
def render_with_params(text, color):
    class DynamicScene(Scene):
        def construct(self):
            title = Text(text, color=color)
            self.play(Write(title))

    # Render with custom params
    scene = DynamicScene()
    scene.render()
```

### 3. Metadata Enhanced Bridge

```python
def generate_enhanced_metadata(video_path, scene_obj):
    return {
        "name": scene_obj.__class__.__name__,
        "duration": get_duration(video_path),
        "keyframes": extract_keyframes(scene_obj),
        "concepts": scene_obj.concepts,  # Custom attribute
        "difficulty": scene_obj.difficulty,
        "prerequisites": scene_obj.prerequisites
    }
```

## Resources

- [Manim Documentation](https://docs.manim.community/)
- [Manim Gallery](https://docs.manim.community/en/stable/examples.html)
- [3Blue1Brown Videos](https://www.3blue1brown.com/) - Created with Manim
- [Remotion + Video Guide](../remotion-app/CLAUDE.md)
