# Remotion Compositions Directory Guidelines

## Purpose

This directory contains Remotion compositions that consume Manim outputs and create final videos.

## Key Patterns to Follow

### 1. Composition Structure

```tsx
// ✅ GOOD: Type-safe, clear props
interface CompositionProps {
  manimData: ManimMetadata;
  duration: number;
}

export const MathVisualization: React.FC<CompositionProps> = ({
  manimData,
}) => {
  // ...
};

// ❌ BAD: Untyped, unclear
export const Comp = (props: any) => {
  // ...
};
```

### 2. Manim Asset Integration

- Import Manim outputs from `/public/assets/manim/`
- Use `staticFile()` for production builds
- Never hardcode absolute paths
- Always check asset existence

### 3. Frame Synchronization

```tsx
// Use Remotion's timing utilities
const frame = useCurrentFrame();
const { fps } = useVideoConfig();
const progress = interpolate(frame, [0, durationInFrames], [0, 1]);
```

### 4. Component Organization

```
compositions/
├── Educational/           # Teaching-focused animations
│   ├── MathConcepts/
│   └── PhysicsDemo/
├── Promotional/          # Marketing materials
├── Technical/           # Technical documentation
└── shared/             # Reusable components
    ├── ManimPlayer.tsx
    └── ProgressBar.tsx
```

### 5. TypeScript Standards

- Always define prop interfaces
- Use `React.FC` for components
- Avoid `any` types
- Export types alongside components

### 6. Styling Approach

- Use Material-UI components
- Follow theme consistency
- Responsive by default
- Avoid inline styles

```tsx
// ✅ GOOD: Using theme
const useStyles = makeStyles((theme) => ({
  container: {
    padding: theme.spacing(2),
    backgroundColor: theme.palette.background.paper,
  }
}));

// ❌ BAD: Inline styles
<div style={{padding: 16, background: 'white'}}>
```

### 7. Performance Patterns

- Memoize expensive calculations
- Use `useMemo` for derived state
- Lazy load heavy components
- Profile with React DevTools

## Auto-validation on Save

When saving `.tsx/.ts` files:

1. Prettier formats with 100-char lines
2. ESLint checks for issues
3. Imports are organized
4. TypeScript types are validated

## Common Issues & Solutions

| Issue                   | Solution                           |
| ----------------------- | ---------------------------------- |
| Manim asset not loading | Check `/public/assets/manim/` path |
| Type errors             | Define interfaces for all props    |
| Performance lag         | Use React.memo and useMemo         |
| Build fails             | Run `npm run type-check`           |

## Required Imports

```tsx
import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { Box, Typography } from "@mui/material";
```

## Testing Your Composition

```bash
# Development preview
npm run dev

# Build for production
npm run build

# Type checking
npm run type-check
```
