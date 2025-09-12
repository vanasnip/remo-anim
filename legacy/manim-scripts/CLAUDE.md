# Manim Scripts Directory Guidelines

## Purpose

This directory contains Manim animation scripts that generate mathematical visualizations.

## Key Patterns to Follow

### 1. Scene Structure

- Each script should define a Scene class inheriting from `manim.Scene`
- Keep scenes focused on a single concept or animation
- Use descriptive class names (e.g., `CircleAreaProof`, not `Scene1`)

### 2. Output Management

- All rendered outputs go to `/manim_output/` (gitignored)
- Use consistent quality settings: `-pql` for preview, `-pqh` for production
- Never commit rendered video files

### 3. Bridge Integration

- Scripts should output metadata to `manim_output/metadata.json`
- Include frame counts, duration, and key animation points
- Use the bridge manifest format for Remotion integration

### 4. Code Standards

```python
# ✅ GOOD: Clear, self-documenting
class CircleAreaVisualization(Scene):
    """Demonstrates circle area formula derivation"""
    def construct(self):
        # Create elements
        circle = Circle(radius=2, color=BLUE)
        # ...

# ❌ BAD: Unclear naming, no documentation
class MyScene(Scene):
    def construct(self):
        c = Circle(2)  # What is this?
```

### 5. Animation Best Practices

- Use `self.play()` with explicit animations
- Group related animations with `AnimationGroup`
- Add `self.wait()` for pacing
- Comment complex mathematical transformations

### 6. Testing Commands

```bash
# Quick preview
manim -pql circle_area.py CircleAreaVisualization

# Full render
manim -pqh circle_area.py CircleAreaVisualization

# Extract metadata
python ../bridge/extract_metadata.py circle_area.py
```

## Auto-validation on Save

When saving `.py` files in this directory:

1. Black formats to 100-char lines
2. Ruff checks for critical errors
3. Import order is automatically fixed

## Common Issues & Solutions

| Issue             | Solution                            |
| ----------------- | ----------------------------------- |
| Import errors     | Ensure `from manim import *` at top |
| Output not found  | Check `/manim_output/` directory    |
| Bridge sync fails | Verify metadata.json is generated   |
| Formatting errors | Let Black handle it on save         |

## Required Imports

```python
from manim import *
import numpy as np  # For mathematical operations
import json  # For metadata export
```
