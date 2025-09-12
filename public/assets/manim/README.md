# Manim Assets Directory

This directory contains Manim-generated mathematical animations for use in the Remotion project.

## Current Animations

### 1. **CircleAreaDemo.mp4**
- **Description**: Demonstrates the circle area formula A = πr²
- **Duration**: ~6 seconds
- **Features**: Blue circle with radius visualization, formula display, 360° rotation
- **Category**: Geometry

### 2. **SineWaveAnimation.mp4**
- **Description**: Sine and cosine wave transformation
- **Duration**: ~4 seconds  
- **Features**: Shows sin(2x) transforming to cos(2x)
- **Category**: Trigonometry

### 3. **TestAnimation.mp4**
- **Description**: Basic test animation with simple shapes
- **Duration**: ~3 seconds
- **Features**: Basic shape transformations
- **Category**: General

## Integration with ManimShowcase Gallery

These videos are automatically loaded in the ManimShowcase Gallery component:
- Access at: http://localhost:3000 → Select "ManimShowcase-Gallery"
- Videos are referenced in `/src/compositions/ManimShowcase/utils/mockData.ts`
- Gallery features search, filtering by category, and video preview

## Adding New Animations

1. Create Manim script in `/src/manim-scripts/`
2. Render with: `manim -pql script_name.py ClassName`
3. Copy output to this directory
4. Update `mockData.ts` with video metadata

## File Naming Convention

- Use descriptive names: `ConceptDemo.mp4`
- Avoid timestamps in production files
- Keep original resolution from Manim render

## Notes

- Videos are served via Remotion's `staticFile()` helper
- Ensure all videos are in MP4 format for browser compatibility
- Keep file sizes reasonable for web delivery (<5MB preferred)