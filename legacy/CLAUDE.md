# Remotion + Manim Animation Project

## Project Overview

This project combines **Remotion** (React-based video creation) with **Manim** (Mathematical animation library) to create sophisticated educational and promotional videos programmatically.

### Key Technologies

- **Remotion**: React-based programmatic video generation
- **Manim**: Python library for mathematical animations
- **Material-UI**: Consistent design system
- **TypeScript**: Type-safe development
- **Jest**: Comprehensive testing (70+ tests)

### Documentation

- 📚 [Project Overview](./docs/project-overview.md) - Complete project guide
- 🧪 [Testing Guide](./docs/testing-guide.md) - Testing strategies and patterns
- 🔧 [Pre-commit Guide](./docs/pre-commit-guide.md) - Git hooks and quality checks
- 🎬 [Remotion Guide](./remotion-app/CLAUDE.md) - Remotion-specific instructions
- ⚡ [Performance Optimization](./docs/phase-4-performance-optimization.md) - Phase 4 performance guide

## Quick Start

### Development

```bash
# Start Remotion dev server
cd remotion-app && npm run dev

# Run Manim animations
cd manim-scripts && python manim_bridge.py

# Run tests
cd remotion-app && npm test

# Performance testing
cd remotion-app && npm run test:performance

# Batch rendering
cd remotion-app && npm run render:batch
```

### Quality Checks

```bash
# Auto-formatting (runs on commit)
git commit -m "Your message"

# Manual linting
cd remotion-app && npm run lint

# Type checking
npm run type-check
```

## Project Structure

```
anim/
├── remotion-app/         # React video application
│   ├── src/
│   │   ├── compositions/ # Video templates
│   │   └── __tests__/    # Test suites
│   └── public/assets/    # Manim outputs
├── manim-scripts/        # Python animations
├── docs/                 # Documentation
└── .claude/              # Shared AI resources
```

## Current Phase Status

✅ **Phase 1**: Project setup and configuration
✅ **Phase 2**: Manim integration and bridge creation
✅ **Phase 3**: Video template implementation
✅ **Phase 4**: Performance optimization & production rendering
✅ **Phase 5**: Pre-commit optimization
✅ **Phase 6**: Comprehensive testing (70+ tests)

## Pre-commit Configuration

This project uses **simplified pre-commit hooks** for essential checks:

- ✨ **Prettier** - Auto-formats code
- 🔍 **Basic validation** - JSON/YAML syntax
- 🛡️ **Security** - Blocks large files and private keys

Complex checks (ESLint, TypeScript, tests) run manually or in CI/CD.

To skip hooks when needed:

```bash
git commit --no-verify -m "Emergency fix"
```

## Task Tracking with Archon MCP

This project uses **Archon MCP** for task tracking and project management.

### Project ID

The Archon project ID is stored in `.env.local`:

```
ARCHON_PROJECT_ID=1cd1b78a-7313-44ff-8bb6-f9cdd4181012
```

This ID connects to the Archon task management system and should be used for all project-related operations.

### Available Archon Tools

- **Task Management**: Create, update, and track tasks
- **Document Management**: Manage project documents with automatic versioning
- **Project Features**: Track and manage project features
- **Version Control**: Automatic version snapshots for all document updates

### Usage

When working on this project, use the Archon MCP tools to:

1. Track development tasks and their status
2. Manage project documentation
3. Coordinate multi-agent workflows
4. Maintain project history through automatic versioning

The Archon server is configured at: `http://localhost:8051/mcp`

## Video Templates Available

### 1. Educational Content

- Mathematical concept visualizations
- Physics demonstrations
- Algorithm explanations

### 2. Instructional Tutorials

- **PythonManimTutorial** - Step-by-step Manim guide
- **ReactComponentTutorial** - React development tutorial
- Code syntax highlighting with multiple file support

### 3. Content Augmentation

- Overlay annotations on existing videos
- 6 annotation types: callout, highlight, arrow, info, warning, success
- Timeline visualization and zoom effects

### 4. Promotional Videos

- Product launches
- Feature highlights
- Call-to-action animations

## Development Workflow

1. **Create content** in `remotion-app/src/compositions/`
2. **Generate animations** with `manim-scripts/`
3. **Test thoroughly** with Jest test suites
4. **Commit changes** (auto-formatted by pre-commit)
5. **Track progress** with Archon MCP

## Important Notes

### Git Workflow

- Pre-commit hooks run automatically
- Prettier formats code on commit
- Use `--no-verify` only for emergencies

### Testing

- Run tests before major commits: `npm test`
- Maintain >70% code coverage
- Mock external dependencies properly

### Code Quality

- TypeScript strict mode enabled
- No `any` types in production code
- Follow Material-UI theming
