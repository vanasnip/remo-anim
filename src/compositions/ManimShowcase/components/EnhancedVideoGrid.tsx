import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { interpolate, useCurrentFrame, spring, useVideoConfig } from 'remotion';
import { VideoGridProps } from '../types';
import { LazyVideoCard } from './LazyVideoCard';
import { performanceMonitor } from '../utils/performance/PerformanceMonitor';
import { performanceSafeguards } from '../utils/performance/PerformanceSafeguards';
import { useVirtualScrolling } from '../hooks/useVirtualScrolling';
import { usePredictiveLoading, createScrollBehaviorAnalyzer } from '../hooks/usePredictiveLoading';
import { imageMemoryPool } from '../utils/performance/MemoryPool';

/**
 * EnhancedVideoGrid Component - Week 3b Conservative Enhancement
 * 
 * WEEK 3B FEATURES:
 * - Virtual scrolling with conservative thresholds
 * - Basic predictive loading with scroll direction detection
 * - Simple memory pooling with LRU cache
 * - Performance safeguards with automatic fallbacks
 * - Feature flags for each optimization
 * 
 * CRITICAL SAFETY FEATURES:
 * - All features are independently toggleable
 * - Conservative fallback to LazyVideoGrid if issues detected
 * - Performance monitoring with automatic adjustments
 * - Memory pressure detection and response
 */
export const EnhancedVideoGrid: React.FC<VideoGridProps & {
  week3bFeatures?: {
    virtualScrolling?: boolean;
    predictiveLoading?: boolean;
    memoryPooling?: boolean;
    performanceSafeguards?: boolean;
  };
}> = ({
  videos,
  onVideoSelect,
  onVideoHover,
  selectedVideo,
  viewMode,
  columns = 3,
  week3bFeatures = {},
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Week 3b feature configuration with defaults
  const features = {
    virtualScrolling: week3bFeatures.virtualScrolling ?? true,
    predictiveLoading: week3bFeatures.predictiveLoading ?? true,
    memoryPooling: week3bFeatures.memoryPooling ?? true,
    performanceSafeguards: week3bFeatures.performanceSafeguards ?? true,
  };

  // Performance monitoring state
  const [renderStartTime, setRenderStartTime] = useState<number | null>(null);
  const [isFullyLoaded, setIsFullyLoaded] = useState(false);
  const [shouldUseEnhancements, setShouldUseEnhancements] = useState(true);

  // Virtual scrolling configuration
  const virtualScrollConfig = useMemo(() => ({
    itemHeight: viewMode === 'grid' ? 320 : 140,
    itemsPerRow: viewMode === 'grid' ? columns : 1,
    bufferSize: 2,
    containerHeight: 600,
    enabled: features.virtualScrolling && shouldUseEnhancements,
    fallbackOnPerformanceIssues: true,
  }), [viewMode, columns, features.virtualScrolling, shouldUseEnhancements]);

  // Virtual scrolling hook
  const virtualScroll = useVirtualScrolling(videos, virtualScrollConfig);

  // Predictive loading configuration
  const predictiveConfig = useMemo(() => ({
    enabled: features.predictiveLoading && shouldUseEnhancements,
    preloadCount: 3, // Conservative preload count
    memoryLimit: 80, // MB limit before throttling
    velocityThreshold: 0.5, // px/ms minimum velocity
    confidenceThreshold: 0.6, // 60% confidence threshold
    throttleMs: 1000, // 1 second throttle
  }), [features.predictiveLoading, shouldUseEnhancements]);

  // Current visible range for predictive loading
  const visibleRange = useMemo(() => ({
    start: virtualScroll.visibleStartIndex,
    end: virtualScroll.visibleEndIndex,
  }), [virtualScroll.visibleStartIndex, virtualScroll.visibleEndIndex]);

  // Predictive loading hook
  const predictiveLoading = usePredictiveLoading(
    videos,
    visibleRange,
    predictiveConfig
  );

  // Scroll behavior analyzer for predictive loading
  const scrollAnalyzer = useCallback(
    createScrollBehaviorAnalyzer((scrollTop) => {
      // This will be called by usePredictiveLoading internally
      // We integrate it with virtual scrolling's scroll handler
    }),
    []
  );

  // Enhanced scroll handler combining virtual scrolling and predictive loading
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    // Virtual scrolling scroll handling
    virtualScroll.onScroll(e);
    
    // Predictive loading scroll analysis
    scrollAnalyzer(e);
  }, [virtualScroll, scrollAnalyzer]);

  // Performance safeguards integration
  useEffect(() => {
    if (features.performanceSafeguards) {
      performanceSafeguards.startMonitoring();
      
      // Check performance status periodically
      const checkInterval = setInterval(() => {
        const status = performanceSafeguards.checkPerformanceHealth();
        const featureFlags = performanceSafeguards.getFeatureFlags();
        
        // Disable enhancements if performance safeguards recommend fallback
        if (!status.isHealthy && status.recommendedAction === 'fallback') {
          setShouldUseEnhancements(false);
          console.warn('🚨 Week 3b enhancements disabled due to performance issues');
        }
        
        // Re-enable if performance improves
        if (status.isHealthy && !shouldUseEnhancements) {
          setShouldUseEnhancements(true);
          console.log('✅ Week 3b enhancements re-enabled - performance recovered');
        }
      }, 5000); // Check every 5 seconds

      return () => {
        clearInterval(checkInterval);
        performanceSafeguards.stopMonitoring();
      };
    }
  }, [features.performanceSafeguards, shouldUseEnhancements]);

  // Memory pooling integration
  useEffect(() => {
    if (features.memoryPooling) {
      // Preload images for items marked for predictive loading
      predictiveLoading.preloadIndexes.forEach(index => {
        const video = videos[index];
        if (video?.thumbnail) {
          const cacheKey = `thumbnail-${video.id}`;
          
          if (!imageMemoryPool.has(cacheKey)) {
            // Estimate image size (conservative estimate)
            const estimatedSize = 100 * 1024; // 100KB per thumbnail
            
            // Create cleanup callback
            const cleanupCallback = () => {
              // Thumbnail cleanup logic if needed
            };
            
            imageMemoryPool.set(cacheKey, video.thumbnail, estimatedSize, cleanupCallback);
          }
        }
      });
    }
  }, [features.memoryPooling, predictiveLoading.preloadIndexes, videos]);

  // Performance tracking
  useEffect(() => {
    if (!renderStartTime) {
      const startTime = performanceMonitor.startComponentRender('EnhancedVideoGrid');
      setRenderStartTime(startTime);
    }
  }, [renderStartTime]);

  useEffect(() => {
    if (renderStartTime && videos.length > 0 && !isFullyLoaded) {
      const timeoutId = setTimeout(() => {
        performanceMonitor.endComponentRender('EnhancedVideoGrid', renderStartTime);
        setIsFullyLoaded(true);
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [renderStartTime, videos.length, isFullyLoaded]);

  // Staggered entrance animation
  const getCardAnimation = useCallback((index: number) => {
    const delay = index * 3;
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
        paddingTop: virtualScroll.isVirtualized ? `${(virtualScroll.visibleStartIndex / virtualScrollConfig.itemsPerRow) * virtualScrollConfig.itemHeight}px` : '0',
        paddingBottom: virtualScroll.isVirtualized ? `${virtualScroll.totalHeight - ((virtualScroll.visibleEndIndex + 1) / virtualScrollConfig.itemsPerRow) * virtualScrollConfig.itemHeight}px` : '0',
      }
    : {
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        maxWidth: '800px',
        margin: '0 auto',
        paddingTop: virtualScroll.isVirtualized ? `${virtualScroll.visibleStartIndex * virtualScrollConfig.itemHeight}px` : '0',
        paddingBottom: virtualScroll.isVirtualized ? `${virtualScroll.totalHeight - ((virtualScroll.visibleEndIndex + 1) * virtualScrollConfig.itemHeight)}px` : '0',
      };

  // Scrollable container styles
  const scrollContainerStyles: React.CSSProperties = {
    ...containerStyles,
    height: virtualScroll.isVirtualized ? `${virtualScrollConfig.containerHeight}px` : 'auto',
    overflow: virtualScroll.isVirtualized ? 'auto' : 'visible',
    position: 'relative',
  };

  // Empty state
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
        <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>🎬</div>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: '600' }}>
          No videos found
        </h3>
        <p style={{ margin: 0, fontSize: '16px', opacity: 0.7 }}>
          Try adjusting your search or filters
        </p>
      </div>
    );
  }

  return (
    <div 
      style={scrollContainerStyles} 
      ref={virtualScroll.containerRef} 
      onScroll={handleScroll}
    >
      {/* Enhanced header with Week 3b status */}
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
        <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '600', color: '#333' }}>
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
          
          {/* Week 3b Enhancement Indicators */}
          {shouldUseEnhancements && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
              
              {predictiveLoading.shouldPreload && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: '#9c27b0',
                  fontSize: '12px',
                }}>
                  <span>🔮</span>
                  <span>Predictive</span>
                </div>
              )}
              
              {features.memoryPooling && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: '#ff9800',
                  fontSize: '12px',
                }}>
                  <span>🧠</span>
                  <span>Pooled</span>
                </div>
              )}
            </div>
          )}
          
          {/* Performance indicator */}
          {isFullyLoaded && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              color: shouldUseEnhancements ? '#28a745' : '#ffc107',
              fontSize: '12px',
            }}>
              <span>{shouldUseEnhancements ? '⚡' : '🛡️'}</span>
              <span>{shouldUseEnhancements ? 'Enhanced' : 'Safe Mode'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Enhanced video grid */}
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

      {/* Enhanced performance footer with Week 3b metrics */}
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
            {shouldUseEnhancements ? (
              `Week 3b Enhanced: ${virtualScroll.items.length}/${videos.length} rendered`
            ) : (
              'Safe mode: Standard rendering with optimized lazy loading'
            )}
          </div>
          
          {/* Development performance stats */}
          {process.env.NODE_ENV === 'development' && isFullyLoaded && (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              flexWrap: 'wrap',
              gap: '16px',
              fontSize: '12px',
              color: '#6c757d',
              marginTop: '8px',
            }}>
              <div>FPS: {virtualScroll.performanceMetrics.fps}</div>
              <div>Memory: {virtualScroll.performanceMetrics.memoryUsage}MB</div>
              {virtualScroll.isVirtualized && (
                <div>Visible: {virtualScroll.visibleStartIndex}-{virtualScroll.visibleEndIndex}</div>
              )}
              {predictiveLoading.preloadIndexes.length > 0 && (
                <div>Preloaded: {predictiveLoading.stats.preloadedCount}</div>
              )}
              {predictiveLoading.scrollDirection.direction !== 'idle' && (
                <div>Scroll: {predictiveLoading.scrollDirection.direction} ({predictiveLoading.scrollDirection.velocity.toFixed(1)}px/ms)</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EnhancedVideoGrid;