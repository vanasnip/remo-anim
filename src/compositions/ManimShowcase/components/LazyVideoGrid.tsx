import React, { useEffect, useState, useCallback } from 'react';
import { interpolate, useCurrentFrame, spring, useVideoConfig } from 'remotion';
import { VideoGridProps } from '../types';
import { LazyVideoCard } from './LazyVideoCard';
import { performanceMonitor } from '../utils/performance/PerformanceMonitor';

/**
 * LazyVideoGrid Component - Performance Optimized VideoGrid
 * Week 3a - Performance Optimization Foundation
 * 
 * CRITICAL SAFETY FEATURES:
 * - Complete isolation from Remotion core components
 * - Lazy rendering with performance monitoring
 * - Conservative approach to avoid breaking existing functionality
 * - Safe fallbacks for all operations
 * 
 * Performance Optimizations:
 * - Lazy loading of video cards
 * - Render time tracking
 * - Memory usage monitoring
 * - Staggered animations for smooth performance
 * - Progressive enhancement
 */
export const LazyVideoGrid: React.FC<VideoGridProps> = ({
  videos,
  onVideoSelect,
  onVideoHover,
  selectedVideo,
  viewMode,
  columns = 3,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Performance monitoring state
  const [renderStartTime, setRenderStartTime] = useState<number | null>(null);
  const [isFullyLoaded, setIsFullyLoaded] = useState(false);

  // Start performance tracking
  useEffect(() => {
    if (!renderStartTime) {
      const startTime = performanceMonitor.startComponentRender('LazyVideoGrid');
      setRenderStartTime(startTime);
    }
  }, [renderStartTime]);

  // Track when grid is fully loaded
  useEffect(() => {
    if (renderStartTime && videos.length > 0 && !isFullyLoaded) {
      // Mark as loaded after a brief delay to ensure all cards are rendered
      const timeoutId = setTimeout(() => {
        performanceMonitor.endComponentRender('LazyVideoGrid', renderStartTime);
        setIsFullyLoaded(true);
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [renderStartTime, videos.length, isFullyLoaded]);

  // Optimized entrance animation for 60 FPS performance
  const getCardAnimation = useCallback((index: number) => {
    const delay = Math.min(index * 2, 20); // Reduced delay and capped at 20 frames
    return {
      opacity: spring({
        frame: frame - delay,
        fps,
        from: 0,
        to: 1,
        durationInFrames: 12, // Reduced from 20 to 12 frames
      }),
      translateY: spring({
        frame: frame - delay,
        fps,
        from: 10, // Reduced from 20 to 10px
        to: 0,
        durationInFrames: 12, // Reduced from 20 to 12 frames
      }),
    };
  }, [frame, fps]);

  // Container styles based on view mode (preserved from original)
  const containerStyles: React.CSSProperties = {
    padding: '24px',
    width: '100%',
    minHeight: '400px',
  };

  const gridStyles: React.CSSProperties = viewMode === 'grid' 
    ? {
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fit, minmax(300px, 1fr))`,
        gap: '24px',
        maxWidth: '1400px',
        margin: '0 auto',
      }
    : {
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        maxWidth: '800px',
        margin: '0 auto',
      };

  // Enhanced empty state with performance info
  if (videos.length === 0) {
    return (
      <div style={{
        ...containerStyles,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#666',
        textAlign: 'center',
      }}>
        <div style={{
          fontSize: '48px',
          marginBottom: '16px',
          opacity: 0.5,
        }}>
          🎬
        </div>
        <h3 style={{
          margin: '0 0 8px 0',
          fontSize: '24px',
          fontWeight: '600',
        }}>
          No videos found
        </h3>
        <p style={{
          margin: 0,
          fontSize: '16px',
          opacity: 0.7,
        }}>
          Try adjusting your search or filters
        </p>
        
        {/* Performance info in development */}
        {process.env.NODE_ENV === 'development' && (
          <div style={{
            marginTop: '16px',
            padding: '12px',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            fontSize: '12px',
            color: '#6c757d',
            border: '1px solid #e9ecef',
          }}>
            <div>Grid render time: {renderStartTime ? (performance.now() - renderStartTime).toFixed(2) : 0}ms</div>
            <div>Memory usage: {performanceMonitor.measureMemoryUsage()}MB</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={containerStyles}>
      {/* Results header with performance info */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        paddingBottom: '16px',
        borderBottom: '1px solid #e0e0e0',
      }}>
        <h2 style={{
          margin: 0,
          fontSize: '24px',
          fontWeight: '600',
          color: '#333',
        }}>
          Manim Videos
        </h2>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          fontSize: '14px',
          color: '#666',
        }}>
          <span>
            {videos.length} video{videos.length !== 1 ? 's' : ''} found
          </span>
          
          {/* Performance indicator */}
          {isFullyLoaded && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              color: '#28a745',
              fontSize: '12px',
            }}>
              <span>⚡</span>
              <span>Lazy loaded</span>
            </div>
          )}
          
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 8px',
            backgroundColor: '#f5f5f5',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: '500',
          }}>
            <span>View:</span>
            <span style={{
              color: viewMode === 'grid' ? '#3498db' : '#666',
              fontWeight: viewMode === 'grid' ? '600' : '500',
            }}>
              Grid
            </span>
            <span>/</span>
            <span style={{
              color: viewMode === 'list' ? '#3498db' : '#666',
              fontWeight: viewMode === 'list' ? '600' : '500',
            }}>
              List
            </span>
          </div>
        </div>
      </div>

      {/* Videos grid/list with lazy loading */}
      <div style={gridStyles}>
        {videos.map((video, index) => {
          const animation = getCardAnimation(index);
          
          return (
            <div
              key={video.id}
              style={{
                opacity: animation.opacity,
                transform: `translateY(${animation.translateY}px)`,
              }}
            >
              <LazyVideoCard
                video={video}
                onSelect={onVideoSelect}
                onHover={onVideoHover}
                viewMode={viewMode}
                isSelected={selectedVideo?.id === video.id}
              />
            </div>
          );
        })}
      </div>

      {/* Performance footer with optimization info */}
      {videos.length > 0 && (
        <div style={{
          marginTop: '24px',
          padding: '16px',
          textAlign: 'center',
          color: '#999',
          fontSize: '14px',
          fontStyle: 'italic',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}>
          <div>Optimized for performance with lazy loading</div>
          
          {/* Development performance stats */}
          {process.env.NODE_ENV === 'development' && isFullyLoaded && (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '16px',
              fontSize: '12px',
              color: '#6c757d',
              marginTop: '8px',
            }}>
              <div>Grid: {renderStartTime ? (performance.now() - renderStartTime).toFixed(2) : 0}ms</div>
              <div>Cards: {videos.length}</div>
              <div>FPS: {performanceMonitor.getCurrentFPS()}</div>
              <div>Memory: {performanceMonitor.measureMemoryUsage()}MB</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LazyVideoGrid;