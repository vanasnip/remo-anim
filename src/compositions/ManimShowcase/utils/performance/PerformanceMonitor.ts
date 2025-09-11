/**
 * Performance Monitoring Utility for ManimShowcase
 * Week 3a - Performance Optimization Foundation
 * 
 * CRITICAL: This utility is completely isolated from Remotion core
 * Safe to use without affecting video rendering or Remotion components
 */

export interface PerformanceMetrics {
  loadTime: number;
  fps: number;
  memoryUsage: number;
  searchResponseTime: number;
  renderTime: number;
  timestamp: string;
}

export interface ComponentMetrics {
  componentName: string;
  renderCount: number;
  averageRenderTime: number;
  maxRenderTime: number;
  memoryLeaks: boolean;
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetrics[] = [];
  private componentMetrics: Map<string, ComponentMetrics> = new Map();
  private fpsHistory: number[] = [];
  private lastFrameTime = 0;
  private frameCount = 0;

  private constructor() {}

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  // Safe performance measurement - no DOM manipulation
  measureLoadTime(startTime: number): number {
    return performance.now() - startTime;
  }

  // Track FPS without affecting Remotion's frame handling
  trackFPS(): void {
    const now = performance.now();
    this.frameCount++;
    
    if (now - this.lastFrameTime >= 1000) { // Calculate every second
      const fps = Math.round((this.frameCount * 1000) / (now - this.lastFrameTime));
      this.fpsHistory.push(fps);
      
      // Keep only last 60 seconds of FPS data
      if (this.fpsHistory.length > 60) {
        this.fpsHistory.shift();
      }
      
      this.frameCount = 0;
      this.lastFrameTime = now;
    }
  }

  getCurrentFPS(): number {
    return this.fpsHistory.length > 0 ? this.fpsHistory[this.fpsHistory.length - 1] : 0;
  }

  getAverageFPS(): number {
    if (this.fpsHistory.length === 0) return 0;
    return Math.round(this.fpsHistory.reduce((a, b) => a + b) / this.fpsHistory.length);
  }

  // Memory usage tracking (safe, browser-provided API)
  measureMemoryUsage(): number {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return Math.round(memory.usedJSHeapSize / 1024 / 1024); // Convert to MB
    }
    return 0; // Not available in all browsers
  }

  // Component render time tracking
  startComponentRender(componentName: string): number {
    return performance.now();
  }

  endComponentRender(componentName: string, startTime: number): void {
    const renderTime = performance.now() - startTime;
    
    const existing = this.componentMetrics.get(componentName);
    if (existing) {
      existing.renderCount++;
      existing.averageRenderTime = 
        (existing.averageRenderTime * (existing.renderCount - 1) + renderTime) / existing.renderCount;
      existing.maxRenderTime = Math.max(existing.maxRenderTime, renderTime);
    } else {
      this.componentMetrics.set(componentName, {
        componentName,
        renderCount: 1,
        averageRenderTime: renderTime,
        maxRenderTime: renderTime,
        memoryLeaks: false,
      });
    }
  }

  // Search performance tracking
  measureSearchTime<T>(searchFunction: () => T): { result: T; duration: number } {
    const startTime = performance.now();
    const result = searchFunction();
    const duration = performance.now() - startTime;
    
    return { result, duration };
  }

  // Record complete performance snapshot
  recordMetrics(): PerformanceMetrics {
    const metrics: PerformanceMetrics = {
      loadTime: 0, // Will be set by caller
      fps: this.getCurrentFPS(),
      memoryUsage: this.measureMemoryUsage(),
      searchResponseTime: 0, // Will be updated during searches
      renderTime: this.getAverageRenderTime(),
      timestamp: new Date().toISOString(),
    };

    this.metrics.push(metrics);
    
    // Keep only last 100 measurements
    if (this.metrics.length > 100) {
      this.metrics.shift();
    }

    return metrics;
  }

  private getAverageRenderTime(): number {
    const allComponents = Array.from(this.componentMetrics.values());
    if (allComponents.length === 0) return 0;
    
    const totalTime = allComponents.reduce((sum, comp) => sum + comp.averageRenderTime, 0);
    return Math.round(totalTime / allComponents.length);
  }

  // Get baseline metrics for comparison
  getBaseline(): PerformanceMetrics | null {
    return this.metrics.length > 0 ? this.metrics[0] : null;
  }

  getCurrentMetrics(): PerformanceMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
  }

  getComponentMetrics(): ComponentMetrics[] {
    return Array.from(this.componentMetrics.values());
  }

  // Performance comparison
  compareWithBaseline(): {
    loadTimeImprovement: number;
    fpsImprovement: number;
    memoryReduction: number;
    searchSpeedImprovement: number;
  } | null {
    const baseline = this.getBaseline();
    const current = this.getCurrentMetrics();
    
    if (!baseline || !current) return null;

    return {
      loadTimeImprovement: ((baseline.loadTime - current.loadTime) / baseline.loadTime) * 100,
      fpsImprovement: ((current.fps - baseline.fps) / baseline.fps) * 100,
      memoryReduction: ((baseline.memoryUsage - current.memoryUsage) / baseline.memoryUsage) * 100,
      searchSpeedImprovement: ((baseline.searchResponseTime - current.searchResponseTime) / baseline.searchResponseTime) * 100,
    };
  }

  // Export metrics for analysis
  exportMetrics(): {
    performanceHistory: PerformanceMetrics[];
    componentMetrics: ComponentMetrics[];
    summary: {
      totalMeasurements: number;
      averageFPS: number;
      averageMemoryUsage: number;
      improvementOverTime: ReturnType<PerformanceMonitor['compareWithBaseline']>;
    };
  } {
    const summary = {
      totalMeasurements: this.metrics.length,
      averageFPS: this.getAverageFPS(),
      averageMemoryUsage: this.metrics.length > 0 
        ? Math.round(this.metrics.reduce((sum, m) => sum + m.memoryUsage, 0) / this.metrics.length)
        : 0,
      improvementOverTime: this.compareWithBaseline(),
    };

    return {
      performanceHistory: [...this.metrics],
      componentMetrics: Array.from(this.componentMetrics.values()),
      summary,
    };
  }

  // Clear all metrics (useful for testing)
  reset(): void {
    this.metrics = [];
    this.componentMetrics.clear();
    this.fpsHistory = [];
    this.frameCount = 0;
    this.lastFrameTime = 0;
  }
}

// Singleton instance export
export const performanceMonitor = PerformanceMonitor.getInstance();