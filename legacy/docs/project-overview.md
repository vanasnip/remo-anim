# Remotion + Manim Animation Project

## Overview

This project combines **Remotion** (React-based video creation) with **Manim** (Mathematical animation library) to create sophisticated educational and promotional videos programmatically.

## Project Structure

```
anim/
├── remotion-app/           # Remotion React application
│   ├── src/
│   │   ├── compositions/   # Video templates
│   │   │   ├── Augmented/  # Content augmentation overlays
│   │   │   ├── Educational/ # Educational content
│   │   │   ├── Instructional/ # Tutorial videos
│   │   │   └── Promotional/ # Marketing materials
│   │   ├── __tests__/      # Comprehensive test suites
│   │   └── __mocks__/      # Test mocks
│   └── public/
│       └── assets/         # Static assets and Manim outputs
├── manim-scripts/          # Python Manim animations
│   └── manim_bridge.py     # Bridge between Manim and Remotion
├── docs/                   # Project documentation
└── .claude/               # Cross-project shared resources

```

## Technology Stack

### Frontend (Remotion)

- **React 18** with TypeScript
- **Remotion** for programmatic video generation
- **Material-UI** for consistent design components
- **react-syntax-highlighter** for code display

### Backend (Manim)

- **Python 3.10+**
- **Manim Community Edition** for mathematical animations
- **NumPy** for mathematical operations

### Development Tools

- **Jest** & **React Testing Library** for testing
- **ESLint** & **Prettier** for code quality
- **Pre-commit** hooks for automated checks
- **Archon MCP** for task tracking

## Key Features

### 1. Video Templates

#### Promotional Videos

- Product launches
- Feature highlights
- Brand storytelling
- Call-to-action animations

#### Educational Content

- Mathematical concepts visualization
- Code tutorials with syntax highlighting
- Step-by-step learning paths
- Interactive demonstrations

#### Instructional Materials

- Python/Manim tutorials
- React component tutorials
- Developer guides
- Technical documentation

#### Content Augmentation

- Overlay annotations on existing videos
- 6 annotation types: callout, highlight, arrow, info, warning, success
- Timeline visualization
- Zoom effects for focus

### 2. Manim Integration

The project seamlessly integrates Manim animations into Remotion videos:

1. **Creation**: Python scripts generate Manim animations
2. **Bridge**: `manim_bridge.py` handles conversion and metadata
3. **Integration**: Remotion compositions import and display animations
4. **Synchronization**: Frame-perfect timing between React and Manim

### 3. Testing Infrastructure

Comprehensive test coverage with 70+ test cases:

- Component rendering tests
- Animation timing verification
- User interaction testing
- Error boundary testing
- Mock implementations for external dependencies

## Getting Started

### Prerequisites

```bash
# Node.js 18+ and npm
node --version  # Should be 18+

# Python 3.10+
python --version  # Should be 3.10+

# Manim dependencies
pip install manim numpy
```

### Installation

```bash
# Clone the repository
git clone https://github.com/vanasnip/anim.git
cd anim

# Install Remotion dependencies
cd remotion-app
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Archon project ID
```

### Development Workflow

```bash
# Start Remotion development server
cd remotion-app
npm run dev

# Run Manim animations
cd ../manim-scripts
python manim_bridge.py

# Run tests
cd remotion-app
npm test

# Build for production
npm run build
```

## Creating New Content

### 1. New Video Template

```tsx
// remotion-app/src/compositions/YourCategory/YourVideo.tsx
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { Typography, Box } from "@mui/material";

export const YourVideo: React.FC = () => {
  const frame = useCurrentFrame();

  // Your animation logic here

  return <AbsoluteFill>{/* Your content */}</AbsoluteFill>;
};
```

### 2. New Manim Animation

```python
# manim-scripts/your_animation.py
from manim import *

class YourAnimation(Scene):
    def construct(self):
        # Your Manim code here
        circle = Circle()
        self.play(Create(circle))
```

### 3. Register in Root

```tsx
// remotion-app/src/Root.tsx
import { YourVideo } from "./compositions/YourCategory/YourVideo";

<Composition
  id="YourVideo"
  component={YourVideo}
  durationInFrames={300}
  fps={30}
  width={1920}
  height={1080}
/>;
```

## Quality Assurance

### Pre-commit Hooks

The project uses streamlined pre-commit hooks for essential checks:

- **Prettier** formatting for consistent code style
- **Basic file checks** (trailing whitespace, EOL, merge conflicts)
- **File validation** (JSON, YAML syntax)

### Manual Quality Checks

```bash
# Run ESLint
cd remotion-app && npm run lint

# Type checking
npm run type-check

# Run all tests
npm test

# Python linting
black manim-scripts/
ruff check manim-scripts/
```

## Project Management

This project uses **Archon MCP** for task tracking:

- Project ID: `1cd1b78a-7313-44ff-8bb6-f9cdd4181012`
- Server: `http://localhost:8051/mcp`
- Features: Task management, document versioning, progress tracking

## Phase Completion Status

- ✅ **Phase 1**: Project setup and configuration
- ✅ **Phase 2**: Manim integration and bridge creation
- ✅ **Phase 3**: Video template implementation
  - Promotional videos with Material-UI
  - Educational content with Manim
  - Instructional tutorials with code highlighting
  - Content augmentation with overlays
- ✅ **Phase 4**: Comprehensive testing (70+ tests)
- ✅ **Phase 5**: Pre-commit optimization

## Next Steps

1. **Content Creation**: Build more video templates
2. **Animation Library**: Expand Manim animation collection
3. **API Integration**: Add data-driven video generation
4. **CI/CD Pipeline**: Automate builds and deployments
5. **Documentation**: Expand user guides and examples

## Contributing

See [CONTRIBUTING.md](./contributing.md) for guidelines on:

- Code style and standards
- Testing requirements
- Pull request process
- Documentation standards

## License

This project is proprietary. All rights reserved.
