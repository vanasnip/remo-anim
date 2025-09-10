# Phase 2: Manim Integration - Technical Specification

## Executive Summary

This specification defines the technical implementation for Phase 2 of the Remotion Recovery Project, focusing on creating a Manim showcase composition and gallery view system. The implementation will provide a centralized interface for browsing, previewing, and integrating Manim mathematical animations into Remotion compositions.

## 1. Architecture Overview

### 1.1 System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Remotion Application                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              ManimShowcase Composition               │   │
│  │                                                      │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │   │
│  │  │   Gallery   │  │   Preview   │  │  Metadata  │  │   │
│  │  │  Component  │◄─┤  Component  │◄─┤   Store    │  │   │
│  │  └─────────────┘  └─────────────┘  └────────────┘  │   │
│  │         ▲               ▲                ▲          │   │
│  │         └───────────────┴────────────────┘          │   │
│  │                    Video Loader                      │   │
│  └──────────────────────────────────────────────────────┘   │
│                             ▲                                │
│                             │                                │
│  ┌──────────────────────────▼──────────────────────────┐   │
│  │            /public/assets/manim/                     │   │
│  │         (Manim Video Files & Metadata)              │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Component Hierarchy

```typescript
<ManimShowcase>
  <GalleryHeader>
    <SearchBar />
    <FilterControls />
    <ViewToggle /> {/* Grid | List */}
  </GalleryHeader>
  
  <GalleryContent>
    <VideoGrid>
      {videos.map(video => (
        <VideoCard>
          <VideoThumbnail />
          <VideoMetadata />
          <VideoActions />
        </VideoCard>
      ))}
    </VideoGrid>
  </GalleryContent>
  
  <VideoPreview>
    <VideoPlayer />
    <VideoDetails />
    <IntegrationCode />
  </VideoPreview>
</ManimShowcase>
```

## 2. Data Structures

### 2.1 Video Metadata Schema

```typescript
interface ManimVideo {
  id: string;                    // Unique identifier
  filename: string;               // File path relative to /public/assets/manim/
  title: string;                  // Display name
  description: string;            // Detailed description
  category: ManimCategory;        // Category enum
  tags: string[];                 // Searchable tags
  duration: number;               // Duration in frames
  dimensions: {
    width: number;
    height: number;
  };
  thumbnail?: string;             // Optional thumbnail path
  createdAt: Date;               // Creation timestamp
  manimScript?: string;          // Optional Python source reference
  parameters?: Record<string, any>; // Configurable parameters
}

enum ManimCategory {
  GEOMETRY = "geometry",
  ALGEBRA = "algebra",
  CALCULUS = "calculus",
  TRIGONOMETRY = "trigonometry",
  PHYSICS = "physics",
  GENERAL = "general"
}
```

### 2.2 Gallery State Management

```typescript
interface GalleryState {
  videos: ManimVideo[];           // All available videos
  filteredVideos: ManimVideo[];   // After search/filter
  selectedVideo: ManimVideo | null; // Currently previewing
  viewMode: 'grid' | 'list';      // Display mode
  filters: {
    category: ManimCategory | null;
    searchQuery: string;
    tags: string[];
  };
  loading: boolean;
  error: string | null;
}
```

## 3. Component Specifications

### 3.1 ManimShowcase (Main Composition)

**Location**: `src/compositions/ManimShowcase/index.tsx`

```typescript
interface ManimShowcaseProps {
  autoplay?: boolean;             // Auto-play previews
  defaultCategory?: ManimCategory; // Initial filter
  columns?: number;                // Grid columns (default: 3)
  showSearch?: boolean;            // Enable search (default: true)
  showFilters?: boolean;           // Enable filters (default: true)
}
```

**Key Features**:
- Responsive grid/list layout
- Real-time search and filtering
- Smooth transitions between views
- Keyboard navigation support

### 3.2 VideoCard Component

**Location**: `src/compositions/ManimShowcase/VideoCard.tsx`

```typescript
interface VideoCardProps {
  video: ManimVideo;
  onSelect: (video: ManimVideo) => void;
  onHover: (video: ManimVideo | null) => void;
  viewMode: 'grid' | 'list';
  isSelected: boolean;
}
```

**Interactions**:
- Hover: Show preview thumbnail animation
- Click: Open full preview modal
- Double-click: Copy integration code
- Right-click: Context menu with options

### 3.3 VideoPreview Component

**Location**: `src/compositions/ManimShowcase/VideoPreview.tsx`

```typescript
interface VideoPreviewProps {
  video: ManimVideo;
  onClose: () => void;
  onIntegrate: (video: ManimVideo) => void;
  showCode?: boolean;
}
```

**Features**:
- Full-screen video playback
- Playback controls (play, pause, seek, speed)
- Integration code generator
- Export options

## 4. Implementation Requirements

### 4.1 Performance Optimization

```typescript
// Lazy loading configuration
const THUMBNAIL_BATCH_SIZE = 9;
const PREVIEW_PRELOAD_COUNT = 3;
const VIDEO_CACHE_SIZE = 5;

// Intersection Observer for lazy loading
const useLazyLoad = (ref: RefObject<HTMLElement>) => {
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.1, rootMargin: '50px' }
    );
    
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref]);
  
  return isVisible;
};
```

### 4.2 Video Loading Strategy

```typescript
class VideoLoader {
  private cache: Map<string, string> = new Map();
  private preloadQueue: string[] = [];
  
  async loadVideo(filename: string): Promise<string> {
    // Check cache first
    if (this.cache.has(filename)) {
      return this.cache.get(filename)!;
    }
    
    // Load video
    const url = `/assets/manim/${filename}`;
    const blob = await fetch(url).then(r => r.blob());
    const objectUrl = URL.createObjectURL(blob);
    
    // Cache management
    if (this.cache.size >= VIDEO_CACHE_SIZE) {
      const oldest = this.cache.keys().next().value;
      URL.revokeObjectURL(this.cache.get(oldest)!);
      this.cache.delete(oldest);
    }
    
    this.cache.set(filename, objectUrl);
    return objectUrl;
  }
  
  preloadVideos(filenames: string[]) {
    this.preloadQueue = filenames;
    this.processPreloadQueue();
  }
}
```

## 5. User Interface Design

### 5.1 Gallery Layout Specifications

```css
/* Grid View */
.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 24px;
  padding: 24px;
}

/* List View */
.gallery-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 24px;
}

/* Responsive Breakpoints */
@media (max-width: 768px) {
  .gallery-grid {
    grid-template-columns: 1fr;
  }
}

@media (min-width: 769px) and (max-width: 1024px) {
  .gallery-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
```

### 5.2 Animation Specifications

```typescript
// Transition configurations
const transitions = {
  cardHover: {
    scale: spring({ from: 1, to: 1.05 }),
    shadow: interpolate(frame, [0, 10], [0, 20])
  },
  modalOpen: {
    opacity: spring({ from: 0, to: 1 }),
    scale: spring({ from: 0.9, to: 1 })
  },
  filterChange: {
    opacity: interpolate(frame, [0, 15], [0, 1]),
    y: interpolate(frame, [0, 15], [20, 0])
  }
};
```

## 6. Integration Patterns

### 6.1 Using Manim Videos in Compositions

```typescript
// Generated integration code example
import { Video } from 'remotion';
import { ManimVideo } from '@/compositions/ManimShowcase/types';

export const MyComposition = () => {
  const manimVideo: ManimVideo = {
    filename: 'SineWaveAnimation_480p15.mp4',
    title: 'Sine Wave Animation',
    // ... other metadata
  };
  
  return (
    <Video
      src={`/assets/manim/${manimVideo.filename}`}
      startFrom={0}
      endAt={manimVideo.duration}
    />
  );
};
```

### 6.2 Metadata Management

```typescript
// Metadata loader utility
export async function loadManimMetadata(): Promise<ManimVideo[]> {
  // Option 1: Static JSON file
  const response = await fetch('/assets/manim/metadata.json');
  const metadata = await response.json();
  
  // Option 2: Dynamic scanning (development only)
  if (process.env.NODE_ENV === 'development') {
    const videos = await scanManimDirectory();
    return generateMetadata(videos);
  }
  
  return metadata;
}
```

## 7. Testing Strategy

### 7.1 Component Testing

```typescript
// Example test for VideoCard
describe('VideoCard', () => {
  it('should display video thumbnail', () => {
    const video = mockManimVideo();
    const { getByAltText } = render(
      <VideoCard video={video} {...defaultProps} />
    );
    expect(getByAltText(video.title)).toBeInTheDocument();
  });
  
  it('should trigger onSelect when clicked', () => {
    const onSelect = jest.fn();
    const { getByRole } = render(
      <VideoCard video={mockVideo} onSelect={onSelect} />
    );
    fireEvent.click(getByRole('button'));
    expect(onSelect).toHaveBeenCalledWith(mockVideo);
  });
});
```

### 7.2 Performance Testing

```typescript
// Performance benchmarks
const PERFORMANCE_TARGETS = {
  initialLoad: 2000,        // ms
  thumbnailLoad: 500,       // ms per thumbnail
  filterResponse: 100,      // ms
  searchDebounce: 300,      // ms
  previewOpen: 200,         // ms
};
```

## 8. File Structure

```
src/compositions/ManimShowcase/
├── index.tsx                 # Main composition
├── types.ts                  # TypeScript interfaces
├── components/
│   ├── GalleryHeader.tsx    # Search and filters
│   ├── VideoGrid.tsx        # Grid layout
│   ├── VideoList.tsx        # List layout
│   ├── VideoCard.tsx        # Individual video card
│   ├── VideoPreview.tsx     # Preview modal
│   └── VideoPlayer.tsx      # Custom player controls
├── hooks/
│   ├── useManimVideos.ts    # Video loading hook
│   ├── useVideoFilter.ts    # Filter logic
│   ├── useLazyLoad.ts       # Lazy loading
│   └── useVideoCache.ts     # Cache management
├── utils/
│   ├── videoLoader.ts       # Video loading utility
│   ├── metadataParser.ts    # Metadata parsing
│   └── codeGenerator.ts     # Integration code gen
└── styles/
    ├── gallery.css          # Gallery styles
    └── animations.css       # Transition styles
```

## 9. Dependencies

### 9.1 Required Packages
- Already installed in project (no new dependencies needed)
- Uses existing: remotion, react, @mui/material

### 9.2 Optional Enhancements
```json
{
  "fuse.js": "^6.6.2",        // Fuzzy search (optional)
  "react-intersection-observer": "^9.5.0" // Lazy loading (optional)
}
```

## 10. Success Criteria

### 10.1 Functional Requirements
- ✅ Display all Manim videos in gallery
- ✅ Search videos by title, description, tags
- ✅ Filter by category
- ✅ Preview videos on hover
- ✅ Full preview with controls
- ✅ Generate integration code
- ✅ Responsive design

### 10.2 Performance Requirements
- ✅ Initial load < 2 seconds
- ✅ Smooth scrolling (60 FPS)
- ✅ Preview load < 500ms
- ✅ Search response < 100ms
- ✅ Memory usage < 100MB

### 10.3 Quality Requirements
- ✅ TypeScript strict mode
- ✅ 80% test coverage
- ✅ Zero console errors
- ✅ WCAG 2.1 AA compliance
- ✅ Cross-browser support

## 11. Implementation Timeline

### Week 1: Foundation
- Set up ManimShowcase composition structure
- Implement basic gallery grid
- Create VideoCard component
- Load and display video metadata

### Week 2: Interactivity
- Add search functionality
- Implement category filters
- Create VideoPreview modal
- Add hover preview effects

### Week 3: Optimization
- Implement lazy loading
- Add video caching
- Optimize thumbnail generation
- Performance profiling

### Week 4: Polish
- Finalize UI/UX
- Complete test coverage
- Documentation
- Integration examples

## 12. Risk Mitigation

### 12.1 Technical Risks
- **Large video files**: Implement progressive loading
- **Browser compatibility**: Use standard video formats
- **Performance degradation**: Monitor and optimize continuously
- **Metadata sync**: Automated metadata generation script

### 12.2 Mitigation Strategies
- Implement graceful fallbacks
- Progressive enhancement approach
- Comprehensive error handling
- Performance monitoring

---

**Document Version**: 1.0  
**Last Updated**: 2025-09-10  
**Status**: Ready for Implementation