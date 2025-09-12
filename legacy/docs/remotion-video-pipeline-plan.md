# Remotion-Based Video Generation Pipeline

_Clean Implementation Plan - December 2024_

## Core Architecture: Remotion as the Central Hub

```
┌─────────────────────────────────────────────────┐
│           REMOTION (React Video Engine)          │
│                                                  │
│  • Programmatic video composition                │
│  • React component-based scenes                  │
│  • Timeline control & sequencing                 │
│  • Data-driven video generation                  │
└─────────────────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┬───────────────┐
        ▼             ▼             ▼               ▼
  [Material-UI]  [Python Manim]  [FFmpeg]    [Claude Code]
   UI Components  Math Animations  Processing  Orchestration
```

## Why Remotion is Central

Remotion serves as the **primary video composition engine** that:

1. **Orchestrates all video elements** - Combines UI, animations, and assets
2. **Provides the timeline** - Controls when each element appears
3. **Handles rendering** - Outputs the final video frames
4. **Enables programmatic control** - React components = video scenes

## Technology Stack Roles

### 1. Remotion (Primary Engine)

- **Role**: Video composition and rendering
- **Features Used**:
  - `<Composition>` - Define video templates
  - `<Sequence>` - Timeline control
  - `<Video>`, `<Audio>`, `<Img>` - Media elements
  - `useCurrentFrame()` - Animation timing
  - `spring()`, `interpolate()` - Smooth animations
- **Output**: Frame sequences or MP4 videos

### 2. Material-UI Community Edition

- **Role**: Consistent UI elements within Remotion
- **Integration**: React components rendered inside Remotion
- **Usage**:

  ```tsx
  // Inside Remotion composition
  import { Button, Card } from "@mui/material";

  export const PromoScene: React.FC = () => {
    return (
      <AbsoluteFill>
        <Card>Product Feature</Card>
      </AbsoluteFill>
    );
  };
  ```

### 3. Python Manim

- **Role**: Generate mathematical animations as video assets
- **Integration**: Creates MP4/MOV files that Remotion imports
- **Workflow**:
  1. Python manim generates animation → `math_anim.mp4`
  2. Remotion imports as asset → `<Video src="math_anim.mp4" />`
  3. Remotion composites with other elements

### 4. FFmpeg

- **Role**: Post-processing and optimization
- **Integration**: Remotion uses FFmpeg internally + custom post-processing
- **Usage**: Format conversion, compression, filters

### 5. Claude Code

- **Role**: Orchestrates the entire pipeline
- **Tasks**:
  - Generate Remotion components
  - Trigger Python manim renders
  - Manage asset pipeline
  - Execute FFmpeg commands

---

## Implementation Phases

### Phase 1: Remotion Foundation (Week 1-2)

**Goal**: Establish Remotion as the core video engine

**Setup**:

```bash
# Create Remotion project
npx create-video@latest my-video-app
cd my-video-app
npm install @mui/material @emotion/react @emotion/styled
```

**Tasks**:

1. ✅ Install Remotion CLI and studio
2. ✅ Create basic composition structure
3. ✅ Integrate Material-UI components
4. ✅ Build first test video with MUI elements
5. ✅ Set up development workflow with hot reload

**Deliverable**: Remotion rendering a 30-second video with MUI components

### Phase 2: Python Manim Integration (Week 3-4)

**Goal**: Connect Python manim animations to Remotion

**Architecture**:

```
Python Manim → MP4 files → Remotion <Video> component
                    ↓
            [File Watcher/Bridge]
```

**Tasks**:

1. ✅ Set up Python manim environment
2. ✅ Create manim-to-Remotion bridge script
3. ✅ Build asset management system
4. ✅ Implement file watcher for automatic imports
5. ✅ Test mathematical animation in Remotion composition

**Deliverable**: Remotion video containing manim mathematical animations

### Phase 3: Video Type Templates (Week 5-6)

**Goal**: Create Remotion templates for each use case

**Templates to Build**:

#### 3.1 Promotional Videos (Remotion + MUI)

```tsx
<Composition
  id="ProductPromo"
  component={ProductPromo}
  durationInFrames={900} // 30 seconds at 30fps
  fps={30}
  width={1920}
  height={1080}
  defaultProps={{
    productName: "Your Product",
    features: [],
    brandColors: {},
  }}
/>
```

#### 3.2 Illustrative Content (Remotion + Manim)

```tsx
<Composition
  id="MathExplainer"
  component={MathExplainer}
  durationInFrames={1800} // 60 seconds
  defaultProps={{
    equation: "e^(iπ) + 1 = 0",
    manimVideo: "euler_identity.mp4",
  }}
/>
```

#### 3.3 Instructive Materials (Remotion + Data)

```tsx
<Composition
  id="Tutorial"
  component={Tutorial}
  durationInFrames={3600} // 2 minutes
  defaultProps={{
    steps: [],
    codeSnippets: [],
    voiceOver: "tutorial_audio.mp3",
  }}
/>
```

#### 3.4 Content Augmentation (Remotion + FFmpeg)

```tsx
<Composition
  id="VideoEnhancer"
  component={VideoEnhancer}
  defaultProps={{
    originalVideo: "input.mp4",
    overlays: [],
    filters: [],
  }}
/>
```

### Phase 4: Production Optimization (Week 7-8)

**Goal**: Optimize Remotion rendering pipeline

**Optimizations**:

1. **Rendering Performance**
   - Configure concurrent rendering
   - Implement render caching
   - Use `@remotion/lambda` for parallel rendering (local)

2. **Asset Pipeline**
   - Pre-render manim animations
   - Optimize asset loading
   - Implement progressive rendering

3. **Quality Settings**

   ```tsx
   // Development: Fast preview
   await renderMedia({
     composition,
     codec: "h264",
     crf: 28, // Lower quality, faster
   });

   // Production: High quality
   await renderMedia({
     composition,
     codec: "h264",
     crf: 18, // Higher quality
     pixelFormat: "yuv420p10le", // 10-bit color
   });
   ```

---

## File Structure

```
video-generation-system/
├── src/
│   ├── compositions/       # Remotion compositions
│   │   ├── Promotional/
│   │   ├── Illustrative/
│   │   ├── Instructive/
│   │   └── Augmentation/
│   ├── components/        # Reusable React/MUI components
│   ├── assets/           # Static assets
│   └── Root.tsx          # Remotion entry point
├── manim/
│   ├── scenes/           # Python manim scenes
│   ├── output/           # Rendered manim videos
│   └── bridge.py         # Bridge script
├── public/               # Public assets
├── scripts/
│   ├── render.ts         # Rendering scripts
│   └── optimize.sh       # FFmpeg optimization
└── remotion.config.ts    # Remotion configuration
```

---

## Development Workflow

### Daily Development Cycle

1. **Start Remotion Studio**

   ```bash
   npm start
   # Opens http://localhost:3000
   ```

2. **Live Development**
   - Edit React components → See changes instantly
   - Adjust timing in Remotion Studio
   - Preview compositions in browser

3. **Manim Integration**

   ```bash
   # Terminal 1: Run manim watcher
   python manim/bridge.py --watch

   # Terminal 2: Remotion studio
   npm start
   ```

4. **Render Output**

   ```bash
   # Quick preview
   npm run build -- --props='{"title":"Test"}'

   # Production render
   npm run build:hq -- --props='{"title":"Final"}'
   ```

### Claude Code Orchestration Points

Claude Code assists at these key points:

1. **Component Generation** - Creates Remotion compositions
2. **Data Binding** - Connects data sources to video props
3. **Asset Management** - Organizes manim outputs
4. **Render Automation** - Batch rendering with different data
5. **Quality Control** - Validates output, runs tests

---

## Success Metrics

### Performance Targets

- **Remotion Studio**: < 100ms hot reload
- **Preview Render**: < 30 seconds for 1-minute video
- **Production Render**: 1.5-2.5 fps on your MacBook Pro
- **Asset Loading**: < 2 seconds for all assets

### Quality Standards

- **Resolution**: 1080p standard, 4K capable
- **Frame Rate**: 30fps standard, 60fps capable
- **Color Depth**: 8-bit standard, 10-bit for production
- **Compression**: CRF 23 standard, CRF 18 for high quality

---

## Quick Start Commands

```bash
# Install everything
npm install
pip install manim

# Start development
npm start

# Render a composition
npx remotion render src/index.tsx ProductPromo out/promo.mp4

# Render with custom props
npx remotion render src/index.tsx ProductPromo out/promo.mp4 \
  --props='{"productName":"Amazing App","features":["Fast","Secure","Simple"]}'

# Render specific frame range
npx remotion render src/index.tsx ProductPromo out/promo.mp4 \
  --frames=0-150  # First 5 seconds at 30fps

# List all compositions
npx remotion compositions src/index.tsx
```

---

## Key Remotion Concepts

### 1. Composition

Defines a video template with configurable props:

```tsx
export const MyVideo: React.FC<{ title: string }> = ({ title }) => {
  return <AbsoluteFill>{title}</AbsoluteFill>;
};
```

### 2. Sequence

Controls when elements appear on timeline:

```tsx
<Sequence from={0} durationInFrames={90}>
  <Title />
</Sequence>
<Sequence from={90} durationInFrames={120}>
  <MainContent />
</Sequence>
```

### 3. Animation Helpers

```tsx
const frame = useCurrentFrame();
const opacity = interpolate(frame, [0, 30], [0, 1]);
const scale = spring({ frame, fps: 30 });
```

### 4. Data-Driven Videos

```tsx
// Render 100 personalized videos from JSON data
const users = await loadUsers();
for (const user of users) {
  await renderMedia({
    composition: "UserWelcome",
    inputProps: { name: user.name, data: user.data },
  });
}
```

---

## Why This Architecture Works

1. **Remotion Centrality**: All video logic lives in React components
2. **Modularity**: Each technology handles its specialty
3. **Flexibility**: Easy to swap or upgrade individual components
4. **Developer Experience**: Hot reload, visual preview, familiar React
5. **Performance**: Optimized for your MacBook Pro specs
6. **Scalability**: Can grow from local to cloud rendering

---

## Next Steps

1. **Create project directory**

   ```bash
   mkdir ~/video-generation
   cd ~/video-generation
   ```

2. **Initialize Remotion project**

   ```bash
   npx create-video@latest .
   ```

3. **Start building your first composition**

Ready to begin Phase 1?
