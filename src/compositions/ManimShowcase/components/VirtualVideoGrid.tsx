import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { interpolate, useCurrentFrame, spring, useVideoConfig } from 'remotion';
import { VideoGridProps } from '../types';
import { LazyVideoCard } from './LazyVideoCard';
import { performanceMonitor } from '../utils/performance/PerformanceMonitor';
import { useVirtualScrolling } from '../hooks/useVirtualScrolling';

/**
 * VirtualVideoGrid Component - Performance Optimized Video Grid with Virtual Scrolling
 * Week 3b - Conservative Enhancement: Virtual Scrolling
 * 
 * CRITICAL SAFETY FEATURES:
 * - Conservative virtual scrolling with automatic fallback
 * - Performance monitoring with real-time adjustments
 * - Buffer zones to prevent content flashing
 * - Memory-conscious rendering with cleanup
 * - Feature flags for easy disabling
 * 
 * Performance Features:
 * - Virtual scrolling for large galleries (>20 items)
 * - Automatic performance monitoring and fallback
 * - Buffer rendering for smooth scrolling
 * - Memory usage tracking and optimization
 */
export const VirtualVideoGrid: React.FC<VideoGridProps & {
  enableVirtualScrolling?: boolean;
  virtualScrollFallbackOnPerformanceIssues?: boolean;
}> = ({
  videos,
  onVideoSelect,
  onVideoHover,
  selectedVideo,
  viewMode,
  columns = 3,
  enableVirtualScrolling = true,
  virtualScrollFallbackOnPerformanceIssues = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Performance monitoring state
  const [renderStartTime, setRenderStartTime] = useState<number | null>(null);
  const [isFullyLoaded, setIsFullyLoaded] = useState(false);

  // Calculate dynamic layout properties
  const layoutConfig = useMemo(() => {
    const itemHeight = viewMode === 'grid' ? 320 : 140; // Height per item
    const itemsPerRow = viewMode === 'grid' ? columns : 1;
    const containerHeight = 600; // Approximate container height
    
    return {
      itemHeight,
      itemsPerRow,
      bufferSize: 2, // 2 rows buffer for smooth scrolling
      containerHeight,
      enabled: enableVirtualScrolling,
      fallbackOnPerformanceIssues: virtualScrollFallbackOnPerformanceIssues,
    };
  }, [viewMode, columns, enableVirtualScrolling, virtualScrollFallbackOnPerformanceIssues]);

  // Virtual scrolling hook
  const virtualScroll = useVirtualScrolling(videos, layoutConfig);

  // Start performance tracking
  useEffect(() => {
    if (!renderStartTime) {
      const startTime = performanceMonitor.startComponentRender('VirtualVideoGrid');
      setRenderStartTime(startTime);
    }
  }, [renderStartTime]);

  // Track when grid is fully loaded
  useEffect(() => {
    if (renderStartTime && videos.length > 0 && !isFullyLoaded) {
      const timeoutId = setTimeout(() => {
        performanceMonitor.endComponentRender('VirtualVideoGrid', renderStartTime);
        setIsFullyLoaded(true);
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [renderStartTime, videos.length, isFullyLoaded]);

  // Staggered entrance animation for cards
  const getCardAnimation = useCallback((index: number) => {
    const delay = index * 3; // 3 frame delay between cards
    return {
      opacity: spring({
        frame: frame - delay,
        fps,
        from: 0,
        to: 1,
        durationInFrames: 20,
      }),
      translateY: spring({
        frame: frame - delay,
        fps,
        from: 20,
        to: 0,
        durationInFrames: 20,
      }),
    };
  }, [frame, fps]);

  // Container styles
  const containerStyles: React.CSSProperties = {
    padding: '24px',
    width: '100%',
    minHeight: '400px',
  };

  // Grid styles with virtual scrolling support
  const gridStyles: React.CSSProperties = viewMode === 'grid' 
    ? {
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fit, minmax(300px, 1fr))`,
        gap: '24px',
        maxWidth: '1400px',
        margin: '0 auto',
        paddingTop: virtualScroll.isVirtualized ? `${(virtualScroll.visibleStartIndex / layoutConfig.itemsPerRow) * layoutConfig.itemHeight}px` : '0',
        paddingBottom: virtualScroll.isVirtualized ? `${virtualScroll.totalHeight - ((virtualScroll.visibleEndIndex + 1) / layoutConfig.itemsPerRow) * layoutConfig.itemHeight}px` : '0',
      }
    : {
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        maxWidth: '800px',
        margin: '0 auto',
        paddingTop: virtualScroll.isVirtualized ? `${virtualScroll.visibleStartIndex * layoutConfig.itemHeight}px` : '0',
        paddingBottom: virtualScroll.isVirtualized ? `${virtualScroll.totalHeight - ((virtualScroll.visibleEndIndex + 1) * layoutConfig.itemHeight)}px` : '0',
      };

  // Scrollable container styles for virtual scrolling
  const scrollContainerStyles: React.CSSProperties = {
    ...containerStyles,
    height: virtualScroll.isVirtualized ? `${layoutConfig.containerHeight}px` : 'auto',
    overflow: virtualScroll.isVirtualized ? 'auto' : 'visible',
    position: 'relative',
  };

  // Enhanced empty state
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
      </div>
    );
  }

  return (
    <div style={scrollContainerStyles} ref={virtualScroll.containerRef} onScroll={virtualScroll.onScroll}>
      {/* Results header with virtual scrolling info */}
      <div style={{
        position: virtualScroll.isVirtualized ? 'sticky' : 'static',
        top: 0,
        backgroundColor: '#fafafa',
        zIndex: 10,
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
          
          {/* Virtual scrolling indicator */}
          {virtualScroll.isVirtualized && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              color: '#2196f3',
              fontSize: '12px',
            }}>
              <span>🚀</span>
              <span>Virtual</span>
            </div>
          )}
          
          {/* Performance indicator */}
          {isFullyLoaded && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              color: virtualScroll.performanceMetrics.isPerformant ? '#28a745' : '#ffc107',
              fontSize: '12px',
            }}>
              <span>{virtualScroll.performanceMetrics.isPerformant ? '⚡' : '⚠️'}</span>
              <span>{virtualScroll.performanceMetrics.isPerformant ? 'Optimized' : 'Standard'}</span>
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

      {/* Virtualized video grid */}
      <div style={gridStyles}>
        {virtualScroll.items.map((virtualItem) => {
          const animation = getCardAnimation(virtualItem.index);
          
          return (
            <div
              key={virtualItem.data.id}
              style={{
                opacity: animation.opacity,
                transform: `translateY(${animation.translateY}px)`,
              }}
            >
              <LazyVideoCard
                video={virtualItem.data}
                onSelect={onVideoSelect}
                onHover={onVideoHover}
                viewMode={viewMode}
                isSelected={selectedVideo?.id === virtualItem.data.id}
              />
            </div>
          );
        })}
      </div>

      {/* Performance footer with virtual scrolling metrics */}
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
          <div>
            {virtualScroll.isVirtualized 
              ? `Virtual scrolling with ${virtualScroll.items.length}/${videos.length} items rendered`
              : 'Standard rendering with lazy loading'
            }
          </div>
          
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
              <div>Rendered: {virtualScroll.performanceMetrics.renderedItems}/{virtualScroll.performanceMetrics.totalItems}</div>
              <div>FPS: {virtualScroll.performanceMetrics.fps}</div>
              <div>Memory: {virtualScroll.performanceMetrics.memoryUsage}MB</div>
              {virtualScroll.isVirtualized && (
                <div>Visible: {virtualScroll.visibleStartIndex}-{virtualScroll.visibleEndIndex}</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VirtualVideoGrid;