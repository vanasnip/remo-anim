import { performanceMonitor } from './PerformanceMonitor';

/**
 * PerformanceSafeguards - Conservative Performance Protection
 * Week 3b - Conservative Enhancement: Performance Safeguards
 * 
 * CRITICAL SAFETY FEATURES:
 * - Real-time performance monitoring with automatic fallbacks
 * - Conservative thresholds to prevent performance degradation
 * - Feature flags for easy toggling of optimizations
 * - Automatic recovery mechanisms
 * - User-configurable performance budgets
 */

export interface PerformanceBudget {
  minFPS: number;
  maxMemoryMB: number;
  maxRenderTimeMs: number;
  maxSearchTimeMs: number;
  fallbackAfterViolations: number; // Number of budget violations before fallback
}

export interface FeatureFlags {
  virtualScrolling: boolean;
  predictiveLoading: boolean;
  memoryPooling: boolean;
  lazyLoading: boolean;
  autoFallback: boolean;
}

export interface PerformanceStatus {
  isHealthy: boolean;
  violations: {
    fps: boolean;
    memory: boolean;
    renderTime: boolean;
    searchTime: boolean;
  };
  violationCount: number;
  lastViolation: number;
  recommendedAction: 'none' | 'throttle' | 'fallback' | 'disable';
  activeFeatures: Partial<FeatureFlags>;
}

/**
 * Conservative performance safeguard system
 * - Monitors key performance metrics
 * - Automatically disables features on performance issues
 * - Provides safe fallback mechanisms
 * - Respects user device capabilities
 */
export class PerformanceSafeguards {
  private static instance: PerformanceSafeguards;
  private budget: PerformanceBudget;
  private featureFlags: FeatureFlags;
  private violationHistory: number[] = [];
  private lastHealthCheck = 0;
  private healthCheckInterval = 5000; // Check every 5 seconds (reduced frequency)
  private isMonitoring = false;
  private monitoringInterval: NodeJS.Timeout | null = null;

  private constructor() {
    // Conservative defaults (adjusted for modern browsers)
    this.budget = {
      minFPS: 45, // Fallback if FPS drops below 45 (more reasonable)
      maxMemoryMB: 150, // Fallback if memory exceeds 150MB (increased for modern apps)
      maxRenderTimeMs: 100, // Fallback if render takes >100ms
      maxSearchTimeMs: 50, // Fallback if search takes >50ms
      fallbackAfterViolations: 5, // Fallback after 5 violations (more tolerant)
    };

    this.featureFlags = {
      virtualScrolling: true,
      predictiveLoading: true,
      memoryPooling: true,
      lazyLoading: true,
      autoFallback: true,
    };
  }

  static getInstance(): PerformanceSafeguards {
    if (!PerformanceSafeguards.instance) {
      PerformanceSafeguards.instance = new PerformanceSafeguards();
    }
    return PerformanceSafeguards.instance;
  }

  /**
   * Start performance monitoring
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.checkPerformanceHealth();
    }, this.healthCheckInterval);

    if (process.env.NODE_ENV === 'development') {
      console.log('🛡️ Performance safeguards activated');
    }
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
  }

  /**
   * Check current performance health
   */
  checkPerformanceHealth(): PerformanceStatus {
    const now = performance.now();
    
    // Get current metrics
    const fps = performanceMonitor.getCurrentFPS();
    const memoryMB = performanceMonitor.measureMemoryUsage();
    const metrics = performanceMonitor.getCurrentMetrics();
    
    // Check violations
    const violations = {
      fps: fps > 0 && fps < this.budget.minFPS,
      memory: memoryMB > this.budget.maxMemoryMB,
      renderTime: metrics?.renderTime ? metrics.renderTime > this.budget.maxRenderTimeMs : false,
      searchTime: metrics?.searchResponseTime ? metrics.searchResponseTime > this.budget.maxSearchTimeMs : false,
    };

    const hasViolations = Object.values(violations).some(v => v);
    
    // Track violations over time
    if (hasViolations) {
      this.violationHistory.push(now);
      
      // Keep only recent violations (last 60 seconds)
      this.violationHistory = this.violationHistory.filter(
        time => now - time < 60000
      );
    }

    const violationCount = this.violationHistory.length;
    const lastViolation = this.violationHistory.length > 0 ? 
      this.violationHistory[this.violationHistory.length - 1] : 0;

    // Determine recommended action
    let recommendedAction: PerformanceStatus['recommendedAction'] = 'none';
    
    if (violationCount >= this.budget.fallbackAfterViolations) {
      recommendedAction = 'fallback';
    } else if (violationCount >= 2) {
      recommendedAction = 'throttle';
    } else if (hasViolations) {
      recommendedAction = 'throttle';
    }

    // Auto-fallback if enabled
    if (this.featureFlags.autoFallback && recommendedAction === 'fallback') {
      this.triggerAutoFallback();
    }

    const status: PerformanceStatus = {
      isHealthy: !hasViolations && violationCount === 0,
      violations,
      violationCount,
      lastViolation,
      recommendedAction,
      activeFeatures: { ...this.featureFlags },
    };

    // Development logging
    if (process.env.NODE_ENV === 'development' && hasViolations) {
      console.warn('⚠️ Performance budget violation:', {
        fps: fps || 'unknown',
        memoryMB,
        violations,
        violationCount,
        recommendedAction,
      });
    }

    this.lastHealthCheck = now;
    return status;
  }

  /**
   * Automatically disable features based on performance
   */
  private triggerAutoFallback(): void {
    const originalFlags = { ...this.featureFlags };
    
    // Progressive fallback - disable most expensive features first
    if (this.featureFlags.virtualScrolling) {
      this.featureFlags.virtualScrolling = false;
      console.warn('🔄 Auto-disabled virtual scrolling due to performance issues');
    } else if (this.featureFlags.predictiveLoading) {
      this.featureFlags.predictiveLoading = false;
      console.warn('🔄 Auto-disabled predictive loading due to performance issues');
    } else if (this.featureFlags.memoryPooling) {
      this.featureFlags.memoryPooling = false;
      console.warn('🔄 Auto-disabled memory pooling due to performance issues');
    }

    // Clear violation history after fallback
    this.violationHistory = [];

    // Log the fallback
    if (process.env.NODE_ENV === 'development') {
      console.log('🛡️ Performance fallback applied:', {
        before: originalFlags,
        after: this.featureFlags,
      });
    }
  }

  /**
   * Manually toggle a feature flag
   */
  toggleFeature(feature: keyof FeatureFlags, enabled?: boolean): void {
    this.featureFlags[feature] = enabled ?? !this.featureFlags[feature];
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`🎛️ Feature ${feature}: ${this.featureFlags[feature] ? 'enabled' : 'disabled'}`);
    }
  }

  /**
   * Get current feature flags
   */
  getFeatureFlags(): FeatureFlags {
    return { ...this.featureFlags };
  }

  /**
   * Update performance budget
   */
  updateBudget(budget: Partial<PerformanceBudget>): void {
    this.budget = { ...this.budget, ...budget };
    
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Performance budget updated:', this.budget);
    }
  }

  /**
   * Get current performance budget
   */
  getBudget(): PerformanceBudget {
    return { ...this.budget };
  }

  /**
   * Reset all features to enabled state
   */
  resetFeatures(): void {
    this.featureFlags = {
      virtualScrolling: true,
      predictiveLoading: true,
      memoryPooling: true,
      lazyLoading: true,
      autoFallback: true,
    };
    
    this.violationHistory = [];
    
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 All performance features reset to enabled');
    }
  }

  /**
   * Get performance report for debugging
   */
  getPerformanceReport(): {
    status: PerformanceStatus;
    budget: PerformanceBudget;
    features: FeatureFlags;
    history: {
      violations: number[];
      isMonitoring: boolean;
      lastHealthCheck: number;
    };
  } {
    return {
      status: this.checkPerformanceHealth(),
      budget: this.getBudget(),
      features: this.getFeatureFlags(),
      history: {
        violations: [...this.violationHistory],
        isMonitoring: this.isMonitoring,
        lastHealthCheck: this.lastHealthCheck,
      },
    };
  }

  /**
   * Destroy the safeguards and clean up
   */
  destroy(): void {
    this.stopMonitoring();
    this.violationHistory = [];
  }
}

// Singleton instance export
export const performanceSafeguards = PerformanceSafeguards.getInstance();

export default performanceSafeguards;