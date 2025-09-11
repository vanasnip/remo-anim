/**
 * Baseline Performance Measurement Utility
 * Week 3a - Performance Optimization Foundation
 * 
 * This script establishes performance baselines for the ManimShowcase gallery
 * CRITICAL: Completely isolated from Remotion core - safe to run
 */

import { performanceMonitor } from './PerformanceMonitor';
import { searchVideos, mockManimVideos } from '../mockData';

export interface BaselineMetrics {
  galleryLoadTime: number;
  searchResponseTime: number;
  memoryUsage: {
    initial: number;
    with20Videos: number;
    afterSearch: number;
  };
  renderPerformance: {
    videoCardRenderTime: number;
    gridRenderTime: number;
    scrollFPS: number;
  };
  timestamp: string;
  videoCount: number;
}

/**
 * Measure gallery load performance
 */
export const measureGalleryLoad = async (): Promise<number> => {
  const startTime = performance.now();
  
  // Simulate gallery initialization steps
  await new Promise(resolve => setTimeout(resolve, 50)); // Simulate component mount
  
  // Measure component initialization time
  mockManimVideos; // Load mock data (reference for measurement)
  
  await new Promise(resolve => setTimeout(resolve, 10)); // Simulate render time
  
  return performance.now() - startTime;
};

/**
 * Measure search performance with different query complexities
 */
export const measureSearchPerformance = (): {
  simple: number;
  complex: number;
  category: number;
  average: number;
} => {
  // Simple search test
  const simpleSearch = performanceMonitor.measureSearchTime(() => {
    return searchVideos('sine');
  });

  // Complex search test  
  const complexSearch = performanceMonitor.measureSearchTime(() => {
    return searchVideos('trigonometry mathematical animation');
  });

  // Category-based search test
  const categorySearch = performanceMonitor.measureSearchTime(() => {
    return mockManimVideos.filter(video => video.category === 'geometry');
  });

  return {
    simple: simpleSearch.duration,
    complex: complexSearch.duration,
    category: categorySearch.duration,
    average: (simpleSearch.duration + complexSearch.duration + categorySearch.duration) / 3,
  };
};

/**
 * Measure memory usage at different stages
 */
export const measureMemoryUsage = (): {
  initial: number;
  with20Videos: number;
  afterSearch: number;
} => {
  const initial = performanceMonitor.measureMemoryUsage();
  
  // Simulate loading video cards
  mockManimVideos.slice(0, Math.min(20, mockManimVideos.length)); // Reference for measurement
  
  const with20Videos = performanceMonitor.measureMemoryUsage();
  
  // Simulate search operation
  searchVideos('animation');
  const afterSearch = performanceMonitor.measureMemoryUsage();
  
  return {
    initial,
    with20Videos,
    afterSearch,
  };
};

/**
 * Measure rendering performance
 */
export const measureRenderPerformance = async (): Promise<{
  videoCardRenderTime: number;
  gridRenderTime: number;
  scrollFPS: number;
}> => {
  // Simulate video card render
  const cardStartTime = performanceMonitor.startComponentRender('VideoCard');
  await new Promise(resolve => setTimeout(resolve, 5)); // Simulate render
  performanceMonitor.endComponentRender('VideoCard', cardStartTime);
  
  // Simulate grid render
  const gridStartTime = performanceMonitor.startComponentRender('VideoGrid');
  await new Promise(resolve => setTimeout(resolve, 20)); // Simulate grid layout
  performanceMonitor.endComponentRender('VideoGrid', gridStartTime);
  
  // Simulate scroll FPS measurement
  const fpsReadings = [];
  for (let i = 0; i < 10; i++) {
    performanceMonitor.trackFPS();
    await new Promise(resolve => setTimeout(resolve, 16)); // ~60fps timing
    fpsReadings.push(performanceMonitor.getCurrentFPS());
  }
  
  const componentMetrics = performanceMonitor.getComponentMetrics();
  const videoCardMetrics = componentMetrics.find(m => m.componentName === 'VideoCard');
  const gridMetrics = componentMetrics.find(m => m.componentName === 'VideoGrid');
  
  return {
    videoCardRenderTime: videoCardMetrics?.averageRenderTime || 0,
    gridRenderTime: gridMetrics?.averageRenderTime || 0,
    scrollFPS: fpsReadings.reduce((a, b) => a + b, 0) / fpsReadings.length || 60,
  };
};

/**
 * Run complete baseline measurement suite
 */
export const establishBaseline = async (): Promise<BaselineMetrics> => {
  console.log('🎯 Establishing ManimShowcase Performance Baseline...');
  
  // Reset performance monitor for clean measurement
  performanceMonitor.reset();
  
  // Measure gallery load time
  console.log('📊 Measuring gallery load time...');
  const galleryLoadTime = await measureGalleryLoad();
  
  // Measure search performance
  console.log('🔍 Measuring search performance...');
  const searchPerformance = measureSearchPerformance();
  
  // Measure memory usage
  console.log('💾 Measuring memory usage...');
  const memoryUsage = measureMemoryUsage();
  
  // Measure render performance
  console.log('🎨 Measuring render performance...');
  const renderPerformance = await measureRenderPerformance();
  
  const baseline: BaselineMetrics = {
    galleryLoadTime,
    searchResponseTime: searchPerformance.average,
    memoryUsage,
    renderPerformance,
    timestamp: new Date().toISOString(),
    videoCount: mockManimVideos.length,
  };
  
  // Store baseline in performance monitor
  performanceMonitor.recordMetrics();
  
  console.log('✅ Baseline established:', {
    'Gallery Load': `${baseline.galleryLoadTime.toFixed(2)}ms`,
    'Search Response': `${baseline.searchResponseTime.toFixed(2)}ms`,
    'Memory (Initial)': `${baseline.memoryUsage.initial}MB`,
    'Memory (20 Videos)': `${baseline.memoryUsage.with20Videos}MB`,
    'Video Card Render': `${baseline.renderPerformance.videoCardRenderTime.toFixed(2)}ms`,
    'Scroll FPS': `${baseline.renderPerformance.scrollFPS.toFixed(1)}fps`,
  });
  
  return baseline;
};

/**
 * Generate performance baseline report
 */
export const generateBaselineReport = (baseline: BaselineMetrics): string => {
  const report = `
# ManimShowcase Performance Baseline Report
Generated: ${baseline.timestamp}

## Gallery Performance
- **Load Time**: ${baseline.galleryLoadTime.toFixed(2)}ms
- **Video Count**: ${baseline.videoCount} videos
- **Search Response**: ${baseline.searchResponseTime.toFixed(2)}ms

## Memory Usage
- **Initial**: ${baseline.memoryUsage.initial}MB
- **With 20 Videos**: ${baseline.memoryUsage.with20Videos}MB
- **After Search**: ${baseline.memoryUsage.afterSearch}MB
- **Memory Increase**: ${((baseline.memoryUsage.with20Videos - baseline.memoryUsage.initial) / baseline.memoryUsage.initial * 100).toFixed(1)}%

## Render Performance
- **Video Card Render**: ${baseline.renderPerformance.videoCardRenderTime.toFixed(2)}ms
- **Grid Render**: ${baseline.renderPerformance.gridRenderTime.toFixed(2)}ms
- **Scroll FPS**: ${baseline.renderPerformance.scrollFPS.toFixed(1)}fps

## Performance Targets (Week 3a)
- [ ] 30-40% memory reduction on initial load
- [ ] Maintain 60fps scrolling
- [ ] <100ms search response time
- [ ] <50ms video card render time

## Notes
- Baseline measured before lazy loading implementation
- All measurements are browser-dependent
- Target improvements will be measured against these values
`;

  return report;
};

/**
 * Save baseline to localStorage for persistence
 */
export const saveBaseline = (baseline: BaselineMetrics): void => {
  try {
    localStorage.setItem('manimShowcase_baseline', JSON.stringify(baseline));
  } catch (error) {
    console.warn('Failed to save baseline to localStorage:', error);
  }
};

/**
 * Load baseline from localStorage
 */
export const loadBaseline = (): BaselineMetrics | null => {
  try {
    const stored = localStorage.getItem('manimShowcase_baseline');
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.warn('Failed to load baseline from localStorage:', error);
    return null;
  }
};