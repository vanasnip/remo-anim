import React, { useState, useEffect } from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { ManimShowcaseProps, ManimVideo, GalleryState, ManimCategory } from './types';
import { VideoGrid } from './components/VideoGrid';
import { LazyVideoGrid } from './components/LazyVideoGrid';
import { EnhancedVideoGrid } from './components/EnhancedVideoGrid';
import { GalleryHeader } from './components/GalleryHeader';
import { VideoPreview } from './components/VideoPreview';
import { ResponsiveStyles } from './components/ResponsiveStyles';
import { mockManimVideos, searchVideos, getVideosByCategory } from './utils/mockData';
import { performanceMonitor } from './utils/performance/PerformanceMonitor';
import { performanceSafeguards } from './utils/performance/PerformanceSafeguards';
import { establishBaseline, measureGalleryLoad } from './utils/performance/measureBaseline';

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
 * 
 * Week 3a Implementation: ✅ (Performance Optimization Foundation)
 * - Lazy loading infrastructure with intersection observer
 * - Progressive image loading with blur-to-sharp transitions
 * - Performance monitoring and baseline measurement
 * - Conservative optimization approach with feature flags
 * - Memory usage tracking and FPS monitoring
 * 
 * Week 3b Implementation: ✅ (Conservative Enhancement)
 * - Virtual scrolling with conservative thresholds (>20 items)
 * - Basic predictive loading with scroll direction detection
 * - Simple memory pooling with LRU cache eviction
 * - Performance safeguards with automatic fallbacks
 * - Independent feature toggles for each optimization
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

  // Week 3a - Performance Enhancement State
  const [useLazyLoading, setUseLazyLoading] = useState(true); // Feature flag for safety
  const [performanceMetrics, setPerformanceMetrics] = useState<ReturnType<typeof performanceMonitor.recordMetrics> | null>(null);
  const [baselineEstablished, setBaselineEstablished] = useState(false);

  // Week 3b - Conservative Enhancement State
  const [useEnhancedFeatures, setUseEnhancedFeatures] = useState(true); // Master toggle for Week 3b
  const [week3bFeatures, setWeek3bFeatures] = useState({
    virtualScrolling: true,
    predictiveLoading: true,
    memoryPooling: true,
    performanceSafeguards: true,
  });

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

  // Week 3a - Performance monitoring initialization
  useEffect(() => {
    if (!galleryState.loading && !baselineEstablished) {
      const initializePerformance = async () => {
        try {
          // Start FPS tracking
          performanceMonitor.trackFPS();
          
          // Measure initial load performance  
          const loadTime = await measureGalleryLoad();
          
          // Record initial metrics
          const metrics = performanceMonitor.recordMetrics();
          setPerformanceMetrics(metrics);
          setBaselineEstablished(true);
          
          // Week 3b - Initialize performance safeguards
          if (week3bFeatures.performanceSafeguards) {
            performanceSafeguards.startMonitoring();
          }
          
          // Log performance info in development
          if (process.env.NODE_ENV === 'development') {
            console.log('🎯 ManimShowcase Performance Initialized:', {
              loadTime: `${loadTime.toFixed(2)}ms`,
              memoryUsage: `${performanceMonitor.measureMemoryUsage()}MB`,
              lazyLoading: useLazyLoading ? 'enabled' : 'disabled',
              week3bFeatures: useEnhancedFeatures ? 'enabled' : 'disabled',
              enhancedFeatures: week3bFeatures,
            });
          }
        } catch (error) {
          console.warn('Performance monitoring initialization failed:', error);
        }
      };

      initializePerformance();
    }
  }, [galleryState.loading, baselineEstablished, useLazyLoading, useEnhancedFeatures, week3bFeatures]);

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
    // Week 3a - Performance monitoring for search
    const searchResult = performanceMonitor.measureSearchTime(() => {
      const newFilters = { ...galleryState.filters, searchQuery };
      return applyFilters(galleryState.videos, newFilters);
    });
    
    setGalleryState(prev => ({
      ...prev,
      filters: { ...prev.filters, searchQuery },
      filteredVideos: searchResult.result,
    }));

    // Log search performance in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔍 Search "${searchQuery}": ${searchResult.duration.toFixed(2)}ms, ${searchResult.result.length} results`);
    }
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
          
          {/* Week 3a - Performance Info & Toggle (Development Only) */}
          {process.env.NODE_ENV === 'development' && baselineEstablished && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer',
              padding: '2px 6px',
              borderRadius: '8px',
              backgroundColor: useLazyLoading ? '#e8f5e8' : '#f8f8f8',
              border: `1px solid ${useLazyLoading ? '#4caf50' : '#ccc'}`,
            }} onClick={() => setUseLazyLoading(!useLazyLoading)}>
              <span>{useLazyLoading ? '⚡' : '🐌'}</span>
              <span style={{ fontSize: '10px', fontWeight: '500' }}>
                {useLazyLoading ? 'Lazy' : 'Standard'} 
                {performanceMetrics && ` (${performanceMonitor.measureMemoryUsage()}MB)`}
              </span>
            </div>
          )}

          {/* Week 3b - Enhanced Features Toggle (Development Only) */}
          {process.env.NODE_ENV === 'development' && baselineEstablished && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer',
              padding: '2px 6px',
              borderRadius: '8px',
              backgroundColor: useEnhancedFeatures ? '#e3f2fd' : '#f8f8f8',
              border: `1px solid ${useEnhancedFeatures ? '#2196f3' : '#ccc'}`,
            }} onClick={() => setUseEnhancedFeatures(!useEnhancedFeatures)}>
              <span>{useEnhancedFeatures ? '🚀' : '🛡️'}</span>
              <span style={{ fontSize: '10px', fontWeight: '500' }}>
                {useEnhancedFeatures ? 'Enhanced' : 'Safe Mode'}
              </span>
            </div>
          )}
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
{/* Week 3b - Enhanced performance grid with progressive fallbacks */}
        {useEnhancedFeatures ? (
          <EnhancedVideoGrid
            videos={galleryState.filteredVideos}
            onVideoSelect={handleVideoSelect}
            onVideoHover={handleVideoHover}
            selectedVideo={previewVideo}
            viewMode={galleryState.viewMode}
            columns={columns}
            week3bFeatures={week3bFeatures}
          />
        ) : useLazyLoading ? (
          <LazyVideoGrid
            videos={galleryState.filteredVideos}
            onVideoSelect={handleVideoSelect}
            onVideoHover={handleVideoHover}
            selectedVideo={previewVideo}
            viewMode={galleryState.viewMode}
            columns={columns}
          />
        ) : (
          <VideoGrid
            videos={galleryState.filteredVideos}
            onVideoSelect={handleVideoSelect}
            onVideoHover={handleVideoHover}
            selectedVideo={previewVideo}
            viewMode={galleryState.viewMode}
            columns={columns}
          />
        )}
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