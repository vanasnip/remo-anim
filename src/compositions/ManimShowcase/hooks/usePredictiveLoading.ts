import { useEffect, useState, useCallback, useRef } from 'react';
import { performanceMonitor } from '../utils/performance/PerformanceMonitor';

/**
 * usePredictiveLoading Hook
 * Week 3b - Conservative Enhancement: Basic Predictive Loading
 * 
 * CRITICAL SAFETY FEATURES:
 * - Simple scroll direction detection without ML complexity
 * - Memory-conscious preloading with automatic limits
 * - Respect browser resources and user preferences
 * - Conservative approach with easy feature toggling
 * - Performance monitoring with automatic throttling
 */

export interface ScrollDirection {
  direction: 'up' | 'down' | 'idle';
  velocity: number;
  confidence: number; // 0-1 scale of direction confidence
}

export interface PredictiveLoadingConfig {
  enabled: boolean;
  preloadCount: number; // Number of items to preload in scroll direction
  memoryLimit: number; // MB limit before throttling preloading
  velocityThreshold: number; // px/ms minimum velocity to trigger preloading
  confidenceThreshold: number; // 0-1 minimum confidence to preload
  throttleMs: number; // Minimum ms between preload decisions
}

export interface PredictiveLoadingResult {
  scrollDirection: ScrollDirection;
  shouldPreload: boolean;
  preloadIndexes: number[];
  memoryPressure: boolean;
  isThrottled: boolean;
  stats: {
    preloadedCount: number;
    memoryUsage: number;
    scrollVelocity: number;
    directionChanges: number;
  };
}

/**
 * Conservative predictive loading implementation
 * - Simple scroll direction tracking
 * - Basic velocity calculation
 * - Memory-aware preloading decisions
 * - User behavior pattern detection (no ML, just simple patterns)
 */
export const usePredictiveLoading = <T>(
  items: T[],
  currentVisibleRange: { start: number; end: number },
  config: PredictiveLoadingConfig
): PredictiveLoadingResult => {
  const [scrollDirection, setScrollDirection] = useState<ScrollDirection>({
    direction: 'idle',
    velocity: 0,
    confidence: 0,
  });
  
  const [preloadedIndexes, setPreloadedIndexes] = useState<Set<number>>(new Set());
  const [lastThrottleTime, setLastThrottleTime] = useState(0);
  const [directionChanges, setDirectionChanges] = useState(0);
  
  // Refs for tracking scroll behavior
  const lastScrollTop = useRef(0);
  const lastScrollTime = useRef(0);
  const scrollHistory = useRef<{ position: number; time: number; direction: 'up' | 'down' | 'idle' }[]>([]);
  const memoryPressureDetected = useRef(false);

  // Detect scroll direction and calculate velocity
  const analyzeScrollBehavior = useCallback((scrollTop: number) => {
    const now = performance.now();
    const timeDelta = now - lastScrollTime.current;
    const positionDelta = scrollTop - lastScrollTop.current;
    
    // Skip if too little time has passed (avoid noise)
    if (timeDelta < 16) return; // ~60fps threshold
    
    const velocity = Math.abs(positionDelta) / timeDelta; // px/ms
    const newDirection: 'up' | 'down' | 'idle' = 
      Math.abs(positionDelta) < 5 ? 'idle' :
      positionDelta > 0 ? 'down' : 'up';
    
    // Add to scroll history for confidence calculation
    scrollHistory.current.push({ position: scrollTop, time: now, direction: newDirection });
    
    // Keep only last 10 scroll events for analysis
    if (scrollHistory.current.length > 10) {
      scrollHistory.current.shift();
    }
    
    // Calculate direction confidence based on recent history
    const recentDirections = scrollHistory.current.slice(-5).map(h => h.direction);
    const consistentDirection = recentDirections.filter(d => d === newDirection).length;
    const confidence = consistentDirection / recentDirections.length;
    
    // Track direction changes for user behavior analysis
    if (scrollDirection.direction !== 'idle' && 
        newDirection !== 'idle' && 
        scrollDirection.direction !== newDirection) {
      setDirectionChanges(prev => prev + 1);
    }
    
    setScrollDirection({
      direction: newDirection,
      velocity,
      confidence,
    });
    
    lastScrollTop.current = scrollTop;
    lastScrollTime.current = now;
  }, [scrollDirection.direction]);

  // Check memory pressure
  const checkMemoryPressure = useCallback(() => {
    const memoryUsage = performanceMonitor.measureMemoryUsage();
    const isUnderPressure = memoryUsage > config.memoryLimit;
    
    if (isUnderPressure && !memoryPressureDetected.current) {
      memoryPressureDetected.current = true;
      console.warn('🧠 Memory pressure detected, throttling predictive loading:', {
        currentUsage: memoryUsage,
        limit: config.memoryLimit,
      });
    } else if (!isUnderPressure && memoryPressureDetected.current) {
      memoryPressureDetected.current = false;
      console.log('✅ Memory pressure resolved, resuming predictive loading');
    }
    
    return isUnderPressure;
  }, [config.memoryLimit]);

  // Determine what to preload based on scroll behavior
  const calculatePreloadIndexes = useCallback(() => {
    if (!config.enabled || 
        scrollDirection.direction === 'idle' ||
        scrollDirection.velocity < config.velocityThreshold ||
        scrollDirection.confidence < config.confidenceThreshold) {
      return [];
    }
    
    const { start, end } = currentVisibleRange;
    const preloadIndexes: number[] = [];
    
    if (scrollDirection.direction === 'down') {
      // Preload items after visible range
      for (let i = 1; i <= config.preloadCount; i++) {
        const index = end + i;
        if (index < items.length) {
          preloadIndexes.push(index);
        }
      }
    } else if (scrollDirection.direction === 'up') {
      // Preload items before visible range
      for (let i = 1; i <= config.preloadCount; i++) {
        const index = start - i;
        if (index >= 0) {
          preloadIndexes.push(index);
        }
      }
    }
    
    return preloadIndexes;
  }, [config, scrollDirection, currentVisibleRange, items.length]);

  // Main preloading logic
  const shouldPreload = useCallback(() => {
    const now = performance.now();
    
    // Check throttling
    if (now - lastThrottleTime < config.throttleMs) {
      return false;
    }
    
    // Check memory pressure
    if (checkMemoryPressure()) {
      return false;
    }
    
    // Check if we meet the criteria for preloading
    const meetsVelocityThreshold = scrollDirection.velocity >= config.velocityThreshold;
    const meetsConfidenceThreshold = scrollDirection.confidence >= config.confidenceThreshold;
    const notIdle = scrollDirection.direction !== 'idle';
    
    return config.enabled && meetsVelocityThreshold && meetsConfidenceThreshold && notIdle;
  }, [config, scrollDirection, lastThrottleTime, checkMemoryPressure]);

  // Update preloaded indexes
  const preloadIndexes = calculatePreloadIndexes();
  const shouldExecutePreload = shouldPreload();
  
  useEffect(() => {
    if (shouldExecutePreload && preloadIndexes.length > 0) {
      setPreloadedIndexes(prev => {
        const newSet = new Set(prev);
        preloadIndexes.forEach(index => newSet.add(index));
        return newSet;
      });
      
      setLastThrottleTime(performance.now());
      
      // Development logging
      if (process.env.NODE_ENV === 'development') {
        console.log('🔮 Predictive preloading:', {
          direction: scrollDirection.direction,
          velocity: scrollDirection.velocity.toFixed(2),
          confidence: scrollDirection.confidence.toFixed(2),
          preloadIndexes,
          memoryUsage: performanceMonitor.measureMemoryUsage(),
        });
      }
    }
  }, [shouldExecutePreload, preloadIndexes, scrollDirection]);

  // Cleanup old preloaded indexes to prevent memory leaks
  useEffect(() => {
    const { start, end } = currentVisibleRange;
    const bufferZone = config.preloadCount * 2; // Keep some buffer
    
    setPreloadedIndexes(prev => {
      const filtered = new Set<number>();
      prev.forEach(index => {
        // Keep indexes that are within reasonable range of visible area
        if (index >= start - bufferZone && index <= end + bufferZone) {
          filtered.add(index);
        }
      });
      return filtered;
    });
  }, [currentVisibleRange, config.preloadCount]);

  // Performance stats
  const stats = {
    preloadedCount: preloadedIndexes.size,
    memoryUsage: performanceMonitor.measureMemoryUsage(),
    scrollVelocity: scrollDirection.velocity,
    directionChanges,
  };

  return {
    scrollDirection,
    shouldPreload: shouldExecutePreload,
    preloadIndexes,
    memoryPressure: memoryPressureDetected.current,
    isThrottled: performance.now() - lastThrottleTime < config.throttleMs,
    stats,
  };
};

// Expose scroll behavior analyzer for integration with scroll handlers
export const createScrollBehaviorAnalyzer = (onScrollAnalysis: (scrollTop: number) => void) => {
  return (e: React.UIEvent<HTMLDivElement>) => {
    onScrollAnalysis(e.currentTarget.scrollTop);
  };
};

export default usePredictiveLoading;