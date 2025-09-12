#!/bin/bash

echo "🎬 Rendering Manim Showcase Demos..."
echo "=================================="

# Create output directory
mkdir -p output

# Render the full gallery
echo ""
echo "1. Rendering ManimShowcase Gallery (60 seconds)..."
npx remotion render ManimShowcase-Gallery output/ManimShowcase-Gallery.mp4 \
  --codec h264 \
  --frames 0-300 \
  --concurrency 1

# Render just the geometry showcase  
echo ""
echo "2. Rendering ManimShowcase Geometry (30 seconds)..."
npx remotion render ManimShowcase-Geometry output/ManimShowcase-Geometry.mp4 \
  --codec h264 \
  --frames 0-150 \
  --concurrency 1

echo ""
echo "✅ Rendering complete!"
echo "Output files:"
echo "  - output/ManimShowcase-Gallery.mp4"
echo "  - output/ManimShowcase-Geometry.mp4"