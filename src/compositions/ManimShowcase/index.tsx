import React, { useState, useEffect } from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { ManimShowcaseProps, ManimVideo, GalleryState, ManimCategory } from './types';
import { VideoGrid } from './components/VideoGrid';
import { GalleryHeader } from './components/GalleryHeader';
import { VideoPreview } from './components/VideoPreview';
import { ResponsiveStyles } from './components/ResponsiveStyles';
import { mockManimVideos, searchVideos, getVideosByCategory } from './utils/mockData';

/**
 * ManimShowcase - Main composition for browsing and selecting Manim animations
 * 
 * Week 1 Implementation: ✅
 * - Basic gallery grid layout
 * - Video cards with metadata display
 * - Mock data integration
 * - Foundation for search/filter
 * 
 * Week 2 Implementation: ✅
 * - Real-time search functionality
 * - Category and tag filtering
 * - Video preview modal with playback
 * - Enhanced hover effects and animations
 * - Responsive gallery header with controls
 */
export const ManimShowcase: React.FC<ManimShowcaseProps> = ({
  autoplay = false,
  defaultCategory = undefined,
  columns = 3,
  showSearch = true,
  showFilters = true,
}) => {
  // Category colors for hover preview (moved to top to fix initialization error)
  const categoryColors: Record<ManimCategory, string> = {
    [ManimCategory.GEOMETRY]: '#3498db',
    [ManimCategory.ALGEBRA]: '#e74c3c', 
    [ManimCategory.CALCULUS]: '#2ecc71',
    [ManimCategory.TRIGONOMETRY]: '#9b59b6',
    [ManimCategory.PHYSICS]: '#f39c12',
    [ManimCategory.GENERAL]: '#95a5a6',
  };

  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Gallery state management
  const [galleryState, setGalleryState] = useState<GalleryState>({
    videos: [],
    filteredVideos: [],
    selectedVideo: null,
    viewMode: 'grid',
    filters: {
      category: defaultCategory || null,
      searchQuery: '',
      tags: [],
    },
    loading: true,
    error: null,
  });

  // UI state
  const [hoveredVideo, setHoveredVideo] = useState<ManimVideo | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewVideo, setPreviewVideo] = useState<ManimVideo | null>(null);

  // Initialize videos on mount
  useEffect(() => {
    const initializeVideos = () => {
      try {
        let videos = mockManimVideos;
        
        const initialFilters = {
          category: defaultCategory || null,
          searchQuery: '',
          tags: [],
        };
        
        const filteredVideos = applyFilters(mockManimVideos, initialFilters);

        setGalleryState(prev => ({
          ...prev,
          videos: mockManimVideos,
          filteredVideos,
          filters: initialFilters,
          loading: false,
        }));
      } catch (error) {
        setGalleryState(prev => ({
          ...prev,
          error: 'Failed to load videos',
          loading: false,
        }));
      }
    };

    initializeVideos();
  }, [defaultCategory]);

  // Filter and search functionality
  const applyFilters = (videos: ManimVideo[], filters: typeof galleryState.filters): ManimVideo[] => {
    let filtered = videos;

    // Apply search query
    if (filters.searchQuery.trim()) {
      filtered = searchVideos(filters.searchQuery, filtered);
    }

    // Apply category filter
    if (filters.category) {
      filtered = filtered.filter(video => video.category === filters.category);
    }

    // Apply tag filters
    if (filters.tags.length > 0) {
      filtered = filtered.filter(video => 
        filters.tags.some(tag => video.tags.includes(tag))
      );
    }

    return filtered;
  };

  // Event handlers
  const handleVideoSelect = (video: ManimVideo) => {
    setPreviewVideo(video);
    setShowPreview(true);
  };

  const handleVideoHover = (video: ManimVideo | null) => {
    setHoveredVideo(video);
  };

  const handleViewModeChange = (viewMode: 'grid' | 'list') => {
    setGalleryState(prev => ({
      ...prev,
      viewMode,
    }));
  };

  const handleSearch = (searchQuery: string) => {
    const newFilters = { ...galleryState.filters, searchQuery };
    const filteredVideos = applyFilters(galleryState.videos, newFilters);
    
    setGalleryState(prev => ({
      ...prev,
      filters: newFilters,
      filteredVideos,
    }));
  };

  const handleCategoryFilter = (category: ManimCategory | null) => {
    const newFilters = { ...galleryState.filters, category };
    const filteredVideos = applyFilters(galleryState.videos, newFilters);
    
    setGalleryState(prev => ({
      ...prev,
      filters: newFilters,
      filteredVideos,
    }));
  };

  const handlePreviewClose = () => {
    setShowPreview(false);
    setPreviewVideo(null);
  };

  const handleVideoIntegrate = async (video: ManimVideo) => {
    // Integration logic would go here
    console.log('Integrating video:', video.title);
    
    // Simulate integration process
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // For now, just close the preview
    handlePreviewClose();
    
    // In a real implementation, this would:
    // 1. Copy the video file to the project
    // 2. Generate Remotion component code
    // 3. Update project configuration
    // 4. Show success notification
  };

  // Animation values
  const titleOpacity = spring({
    frame,
    fps,
    from: 0,
    to: 1,
    durationInFrames: 30,
  });

  const titleY = spring({
    frame,
    fps,
    from: -20,
    to: 0,
    durationInFrames: 30,
  });

  const contentOpacity = spring({
    frame: frame - 15,
    fps,
    from: 0,
    to: 1,
    durationInFrames: 30,
  });

  // Main container styles
  const containerStyles: React.CSSProperties = {
    width: '100%',
    height: '100%',
    backgroundColor: '#fafafa',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    overflow: 'hidden',
  };

  const headerStyles: React.CSSProperties = {
    padding: '32px 24px 16px 24px',
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e0e0e0',
    opacity: titleOpacity,
    transform: `translateY(${titleY}px)`,
  };

  const titleStyles: React.CSSProperties = {
    margin: '0 0 8px 0',
    fontSize: '32px',
    fontWeight: '700',
    color: '#1976d2',
    textAlign: 'center',
  };

  const subtitleStyles: React.CSSProperties = {
    margin: 0,
    fontSize: '16px',
    color: '#666',
    textAlign: 'center',
  };

  const contentStyles: React.CSSProperties = {
    height: 'calc(100% - 120px)',
    overflowY: 'auto',
    opacity: contentOpacity,
  };

  // Loading state
  if (galleryState.loading) {
    return (
      <div style={{
        ...containerStyles,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          fontSize: '48px',
          marginBottom: '16px',
          animation: 'pulse 2s infinite',
        }}>
          🎬
        </div>
        <h2 style={{
          margin: '0 0 8px 0',
          fontSize: '24px',
          fontWeight: '600',
          color: '#333',
        }}>
          Loading Manim Videos...
        </h2>
        <p style={{
          margin: 0,
          fontSize: '16px',
          color: '#666',
        }}>
          Preparing your mathematical animations
        </p>
      </div>
    );
  }

  // Error state
  if (galleryState.error) {
    return (
      <div style={{
        ...containerStyles,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#e74c3c',
      }}>
        <div style={{
          fontSize: '48px',
          marginBottom: '16px',
        }}>
          ⚠️
        </div>
        <h2 style={{
          margin: '0 0 8px 0',
          fontSize: '24px',
          fontWeight: '600',
        }}>
          Error Loading Videos
        </h2>
        <p style={{
          margin: 0,
          fontSize: '16px',
          opacity: 0.8,
        }}>
          {galleryState.error}
        </p>
      </div>
    );
  }

  return (
    <div style={containerStyles} className="manim-showcase-container">
      <ResponsiveStyles />
      {/* Title Header */}
      <header style={headerStyles} className="manim-showcase-header">
        <h1 style={titleStyles} className="manim-showcase-title">
          Manim Animation Gallery
        </h1>
        <p style={subtitleStyles} className="manim-showcase-subtitle">
          Discover and integrate mathematical animations into your Remotion projects
        </p>
        
        {/* Stats */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '24px',
          marginTop: '16px',
          fontSize: '14px',
          color: '#666',
        }} className="manim-showcase-stats">
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}>
            <span>📹</span>
            <span>{galleryState.filteredVideos.length} of {galleryState.videos.length} Videos</span>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}>
            <span>📐</span>
            <span>{new Set(galleryState.videos.map(v => v.category)).size} Categories</span>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}>
            <span>🏷️</span>
            <span>{new Set(galleryState.videos.flatMap(v => v.tags)).size} Tags</span>
          </div>
        </div>
      </header>

      {/* Gallery Controls */}
      {(showSearch || showFilters) && (
        <GalleryHeader
          onSearch={handleSearch}
          onCategoryFilter={handleCategoryFilter}
          onViewModeChange={handleViewModeChange}
          searchQuery={galleryState.filters.searchQuery}
          selectedCategory={galleryState.filters.category}
          viewMode={galleryState.viewMode}
          showSearch={showSearch}
          showFilters={showFilters}
        />
      )}

      {/* Main Content */}
      <main style={{
        ...contentStyles,
        height: (showSearch || showFilters) ? 'calc(100% - 200px)' : 'calc(100% - 120px)',
      }}>
        <VideoGrid
          videos={galleryState.filteredVideos}
          onVideoSelect={handleVideoSelect}
          onVideoHover={handleVideoHover}
          selectedVideo={previewVideo}
          viewMode={galleryState.viewMode}
          columns={columns}
        />
      </main>

      {/* Video Preview Modal */}
      {showPreview && previewVideo && (
        <VideoPreview
          video={previewVideo}
          onClose={handlePreviewClose}
          onIntegrate={handleVideoIntegrate}
          showCode={false}
        />
      )}

      {/* Hover Preview (Week 2 Enhancement) */}
      {hoveredVideo && !showPreview && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          left: '20px',
          right: '20px',
          backgroundColor: 'rgba(0,0,0,0.95)',
          color: 'white',
          padding: '16px 20px',
          borderRadius: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 500,
          fontSize: '14px',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
              <strong style={{ fontSize: '16px' }}>{hoveredVideo.title}</strong>
              <span style={{
                backgroundColor: categoryColors[hoveredVideo.category as ManimCategory],
                padding: '2px 8px',
                borderRadius: '8px',
                fontSize: '10px',
                fontWeight: 'bold',
                textTransform: 'uppercase',
              }}>
                {hoveredVideo.category}
              </span>
            </div>
            <div style={{ opacity: 0.8, fontSize: '12px' }}>
              {hoveredVideo.description.slice(0, 100)}...
            </div>
            <div style={{ opacity: 0.6, fontSize: '11px', marginTop: '4px' }}>
              {hoveredVideo.filename} • {Math.round(hoveredVideo.duration / 30)}s • {hoveredVideo.dimensions.width}×{hoveredVideo.dimensions.height}
            </div>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginLeft: '16px',
          }}>
            <span style={{ fontSize: '12px', opacity: 0.7 }}>Click to preview</span>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
            }}>
              ▶
            </div>
          </div>
        </div>
      )}
    </div>
  );
};