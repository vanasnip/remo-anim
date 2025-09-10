export interface ManimVideo {
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

export enum ManimCategory {
  GEOMETRY = "geometry",
  ALGEBRA = "algebra",
  CALCULUS = "calculus",
  TRIGONOMETRY = "trigonometry",
  PHYSICS = "physics",
  GENERAL = "general"
}

export interface GalleryState {
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

export interface ManimShowcaseProps {
  autoplay?: boolean;             // Auto-play previews
  defaultCategory?: ManimCategory; // Initial filter
  columns?: number;                // Grid columns (default: 3)
  showSearch?: boolean;            // Enable search (default: true)
  showFilters?: boolean;           // Enable filters (default: true)
}

export interface VideoCardProps {
  video: ManimVideo;
  onSelect: (video: ManimVideo) => void;
  onHover: (video: ManimVideo | null) => void;
  viewMode: 'grid' | 'list';
  isSelected: boolean;
}

export interface VideoPreviewProps {
  video: ManimVideo;
  onClose: () => void;
  onIntegrate: (video: ManimVideo) => void;
  showCode?: boolean;
}

export interface VideoGridProps {
  videos: ManimVideo[];
  onVideoSelect: (video: ManimVideo) => void;
  onVideoHover: (video: ManimVideo | null) => void;
  selectedVideo: ManimVideo | null;
  viewMode: 'grid' | 'list';
  columns?: number;
}

export interface GalleryHeaderProps {
  onSearch: (query: string) => void;
  onCategoryFilter: (category: ManimCategory | null) => void;
  onViewModeChange: (viewMode: 'grid' | 'list') => void;
  searchQuery: string;
  selectedCategory: ManimCategory | null;
  viewMode: 'grid' | 'list';
  showSearch?: boolean;
  showFilters?: boolean;
}

export interface SearchBarProps {
  onSearch: (query: string) => void;
  searchQuery: string;
  placeholder?: string;
  disabled?: boolean;
}

export interface FilterControlsProps {
  onCategoryFilter: (category: ManimCategory | null) => void;
  onTagFilter: (tags: string[]) => void;
  selectedCategory: ManimCategory | null;
  selectedTags: string[];
  showExpanded?: boolean;
}