import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { performanceMonitor } from '../utils/performance/PerformanceMonitor';

/**
 * useVirtualScrolling Hook
 * Week 3b - Conservative Enhancement: Virtual Scrolling
 * 
 * CRITICAL SAFETY FEATURES:
 * - Conservative implementation with fallback to standard grid
 * - Performance budget monitoring with automatic fallback
 * - Buffer zones to prevent content jumping
 * - Memory-conscious rendering with automatic cleanup
 * - Feature flag support for easy disabling
 */

export interface VirtualScrollConfig {
  itemHeight: number;
  itemsPerRow: number;
  bufferSize: number; // Number of extra rows to render above/below
  containerHeight: number;
  enabled: boolean;
  fallbackOnPerformanceIssues: boolean;
}

export interface VirtualScrollItem<T> {
  index: number;
  data: T;
  isVisible: boolean;
  isBuffered: boolean;
}

export interface VirtualScrollResult<T> {
  items: VirtualScrollItem<T>[];
  totalHeight: number;
  scrollTop: number;
  visibleStartIndex: number;
  visibleEndIndex: number;
  isVirtualized: boolean;
  containerRef: React.RefObject<HTMLDivElement>;
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  performanceMetrics: {
    renderedItems: number;
    totalItems: number;
    memoryUsage: number;
    fps: number;
    isPerformant: boolean;
  };
}

/**
 * Conservative virtual scrolling implementation
 * - Only virtualizes when there are enough items (>20)
 * - Maintains buffer zones for smooth scrolling
 * - Monitors performance and falls back if needed
 * - Respects memory constraints
 */
export const useVirtualScrolling = <T>(
  items: T[],
  config: VirtualScrollConfig
): VirtualScrollResult<T> => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [isPerformant, setIsPerformant] = useState(true);
  const [performanceCheckCount, setPerformanceCheckCount] = useState(0);
  const lastPerformanceCheck = useRef(0);

  // Performance monitoring
  const checkPerformance = useCallback(() => {
    const now = performance.now();
    
    // Only check performance every 2 seconds to avoid overhead
    if (now - lastPerformanceCheck.current < 2000) return;
    
    const fps = performanceMonitor.getCurrentFPS();
    const memoryUsage = performanceMonitor.measureMemoryUsage();
    
    // Performance thresholds for fallback
    const fpsThreshold = 50; // Fall back if FPS drops below 50
    const memoryThreshold = 150; // Fall back if memory usage exceeds 150MB
    
    const currentlyPerformant = fps >= fpsThreshold && memoryUsage <= memoryThreshold;
    
    if (!currentlyPerformant) {
      setPerformanceCheckCount(prev => prev + 1);
      
      // Fall back after 3 consecutive performance issues
      if (performanceCheckCount >= 2) {
        setIsPerformant(false);
        console.warn('🔄 Virtual scrolling disabled due to performance issues:', {
          fps,
          memoryUsage,
          thresholds: { fpsThreshold, memoryThreshold }
        });
      }
    } else {
      setPerformanceCheckCount(0);
    }
    
    lastPerformanceCheck.current = now;
  }, [performanceCheckCount]);

  // Determine if virtualization should be enabled
  const shouldVirtualize = useMemo(() => {
    if (!config.enabled || !isPerformant) return false;
    
    // Conservative threshold: only virtualize with >20 items
    if (items.length <= 20) return false;
    
    // Disable if container height is too small
    if (config.containerHeight < 400) return false;
    
    return true;
  }, [config.enabled, isPerformant, items.length, config.containerHeight]);

  // Calculate visible range with buffer
  const visibleRange = useMemo(() => {
    if (!shouldVirtualize) {
      return {
        startIndex: 0,
        endIndex: items.length - 1,
        visibleStartIndex: 0,
        visibleEndIndex: items.length - 1,
      };
    }

    const rowHeight = config.itemHeight;
    const itemsPerRow = config.itemsPerRow;
    
    const visibleStartRow = Math.floor(scrollTop / rowHeight);
    const visibleEndRow = Math.ceil((scrollTop + config.containerHeight) / rowHeight);
    
    // Add buffer rows for smooth scrolling
    const bufferedStartRow = Math.max(0, visibleStartRow - config.bufferSize);
    const bufferedEndRow = Math.min(
      Math.ceil(items.length / itemsPerRow) - 1,
      visibleEndRow + config.bufferSize
    );
    
    return {
      startIndex: bufferedStartRow * itemsPerRow,
      endIndex: Math.min(items.length - 1, (bufferedEndRow + 1) * itemsPerRow - 1),
      visibleStartIndex: visibleStartRow * itemsPerRow,
      visibleEndIndex: Math.min(items.length - 1, (visibleEndRow + 1) * itemsPerRow - 1),
    };
  }, [shouldVirtualize, scrollTop, config, items.length]);

  // Create virtual items
  const virtualItems = useMemo(() => {
    return items.slice(visibleRange.startIndex, visibleRange.endIndex + 1).map((item, index) => {
      const absoluteIndex = visibleRange.startIndex + index;
      const isVisible = absoluteIndex >= visibleRange.visibleStartIndex && 
                       absoluteIndex <= visibleRange.visibleEndIndex;
      const isBuffered = !isVisible;

      return {
        index: absoluteIndex,
        data: item,
        isVisible,
        isBuffered,
      };
    });
  }, [items, visibleRange]);

  // Calculate total height for scrollbar
  const totalHeight = useMemo(() => {
    if (!shouldVirtualize) return 0;
    
    const totalRows = Math.ceil(items.length / config.itemsPerRow);
    return totalRows * config.itemHeight;
  }, [shouldVirtualize, items.length, config.itemsPerRow, config.itemHeight]);

  // Scroll handler with performance monitoring
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const newScrollTop = e.currentTarget.scrollTop;
    setScrollTop(newScrollTop);
    
    // Check performance periodically
    checkPerformance();
  }, [checkPerformance]);

  // Performance metrics for monitoring
  const performanceMetrics = useMemo(() => {
    return {
      renderedItems: virtualItems.length,
      totalItems: items.length,
      memoryUsage: performanceMonitor.measureMemoryUsage(),
      fps: performanceMonitor.getCurrentFPS(),
      isPerformant,
    };
  }, [virtualItems.length, items.length, isPerformant]);

  // Reset performance state when items change significantly
  useEffect(() => {
    setIsPerformant(true);
    setPerformanceCheckCount(0);
  }, [items.length]);

  // Development logging
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🖼️ Virtual Scrolling State:', {
        enabled: shouldVirtualize,
        totalItems: items.length,
        renderedItems: virtualItems.length,
        visibleRange: `${visibleRange.visibleStartIndex}-${visibleRange.visibleEndIndex}`,
        performance: performanceMetrics,
      });
    }
  }, [shouldVirtualize, items.length, virtualItems.length, visibleRange, performanceMetrics]);

  return {
    items: virtualItems,
    totalHeight,
    scrollTop,
    visibleStartIndex: visibleRange.visibleStartIndex,
    visibleEndIndex: visibleRange.visibleEndIndex,
    isVirtualized: shouldVirtualize,
    containerRef,
    onScroll: handleScroll,
    performanceMetrics,
  };
};

export default useVirtualScrolling;