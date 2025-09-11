import { performanceMonitor } from './PerformanceMonitor';

/**
 * MemoryPool - Simple LRU Cache for Resource Management
 * Week 3b - Conservative Enhancement: Memory Pooling
 * 
 * CRITICAL SAFETY FEATURES:
 * - LRU (Least Recently Used) eviction policy
 * - Automatic memory pressure detection and cleanup
 * - Conservative limits with safe defaults
 * - Resource cleanup callbacks for proper disposal
 * - Performance monitoring integration
 */

export interface CacheEntry<T> {
  key: string;
  value: T;
  lastAccessed: number;
  size: number; // Estimated size in bytes
  metadata?: Record<string, any>;
}

export interface MemoryPoolConfig {
  maxItems: number; // Maximum number of items to cache
  maxMemoryMB: number; // Maximum memory usage in MB
  cleanupThresholdMB: number; // Trigger cleanup when memory exceeds this
  ttlMs: number; // Time to live for cached items
  enabled: boolean;
}

export interface MemoryPoolStats {
  totalItems: number;
  totalSizeMB: number;
  hitRate: number;
  missRate: number;
  evictions: number;
  memoryPressure: boolean;
  lastCleanup: number;
}

/**
 * Simple memory pool implementation with LRU eviction
 * - Conservative memory limits
 * - Automatic cleanup on memory pressure
 * - Performance monitoring integration
 * - Safe resource disposal
 */
export class MemoryPool<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private config: MemoryPoolConfig;
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    lastCleanup: 0,
  };
  
  private cleanupCallbacks = new Map<string, () => void>();
  private memoryCheckInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<MemoryPoolConfig> = {}) {
    this.config = {
      maxItems: config.maxItems || 15, // Conservative default
      maxMemoryMB: config.maxMemoryMB || 50, // Conservative memory limit
      cleanupThresholdMB: config.cleanupThresholdMB || 40,
      ttlMs: config.ttlMs || 300000, // 5 minutes TTL
      enabled: config.enabled !== false,
    };

    // Start periodic memory monitoring
    if (this.config.enabled) {
      this.startMemoryMonitoring();
    }
  }

  /**
   * Get item from cache
   */
  get(key: string): T | null {
    if (!this.config.enabled) return null;

    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check TTL
    const now = performance.now();
    if (now - entry.lastAccessed > this.config.ttlMs) {
      this.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update access time for LRU
    entry.lastAccessed = now;
    this.stats.hits++;
    
    return entry.value;
  }

  /**
   * Set item in cache with size estimation
   */
  set(key: string, value: T, estimatedSizeBytes: number = 1024, cleanupCallback?: () => void): void {
    if (!this.config.enabled) return;

    const now = performance.now();
    
    // Remove existing entry if present
    if (this.cache.has(key)) {
      this.delete(key);
    }

    const entry: CacheEntry<T> = {
      key,
      value,
      lastAccessed: now,
      size: estimatedSizeBytes,
      metadata: { createdAt: now },
    };

    // Register cleanup callback if provided
    if (cleanupCallback) {
      this.cleanupCallbacks.set(key, cleanupCallback);
    }

    this.cache.set(key, entry);

    // Trigger cleanup if needed
    this.maybeCleanup();
  }

  /**
   * Delete specific item from cache
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Run cleanup callback if present
    const cleanupCallback = this.cleanupCallbacks.get(key);
    if (cleanupCallback) {
      try {
        cleanupCallback();
      } catch (error) {
        console.warn('Cache cleanup callback failed:', error);
      }
      this.cleanupCallbacks.delete(key);
    }

    return this.cache.delete(key);
  }

  /**
   * Clear all cached items
   */
  clear(): void {
    // Run all cleanup callbacks
    this.cleanupCallbacks.forEach((callback, key) => {
      try {
        callback();
      } catch (error) {
        console.warn(`Cleanup callback failed for ${key}:`, error);
      }
    });

    this.cache.clear();
    this.cleanupCallbacks.clear();
    this.stats.lastCleanup = performance.now();
  }

  /**
   * Check if cleanup is needed and perform it
   */
  private maybeCleanup(): void {
    const shouldCleanup = 
      this.cache.size > this.config.maxItems ||
      this.getTotalSizeMB() > this.config.cleanupThresholdMB ||
      this.isUnderMemoryPressure();

    if (shouldCleanup) {
      this.cleanup();
    }
  }

  /**
   * Perform LRU cleanup
   */
  private cleanup(): void {
    const now = performance.now();
    const entries = Array.from(this.cache.values());

    // Sort by last accessed (LRU first)
    entries.sort((a, b) => a.lastAccessed - b.lastAccessed);

    let removedCount = 0;
    const targetSize = Math.floor(this.config.maxItems * 0.8); // Remove to 80% capacity
    const targetMemoryMB = this.config.maxMemoryMB * 0.8;

    for (const entry of entries) {
      if (this.cache.size <= targetSize && 
          this.getTotalSizeMB() <= targetMemoryMB) {
        break;
      }

      // Remove old or TTL-expired entries first
      const isExpired = now - entry.lastAccessed > this.config.ttlMs;
      const isOld = now - entry.lastAccessed > this.config.ttlMs * 0.5;

      if (isExpired || isOld || removedCount < this.cache.size - targetSize) {
        this.delete(entry.key);
        removedCount++;
        this.stats.evictions++;
      }
    }

    this.stats.lastCleanup = now;

    // Development logging
    if (process.env.NODE_ENV === 'development' && removedCount > 0) {
      console.log('🧹 Memory pool cleanup:', {
        removed: removedCount,
        remaining: this.cache.size,
        memoryMB: this.getTotalSizeMB(),
        reason: this.isUnderMemoryPressure() ? 'memory pressure' : 'size limit',
      });
    }
  }

  /**
   * Check for system memory pressure
   */
  private isUnderMemoryPressure(): boolean {
    const systemMemoryMB = performanceMonitor.measureMemoryUsage();
    return systemMemoryMB > 100; // Conservative threshold
  }

  /**
   * Get total cached size in MB
   */
  private getTotalSizeMB(): number {
    let totalBytes = 0;
    this.cache.forEach(entry => {
      totalBytes += entry.size;
    });
    return totalBytes / 1024 / 1024;
  }

  /**
   * Start periodic memory monitoring
   */
  private startMemoryMonitoring(): void {
    this.memoryCheckInterval = setInterval(() => {
      if (this.isUnderMemoryPressure()) {
        this.cleanup();
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Stop memory monitoring
   */
  destroy(): void {
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = null;
    }
    this.clear();
  }

  /**
   * Get current pool statistics
   */
  getStats(): MemoryPoolStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    
    return {
      totalItems: this.cache.size,
      totalSizeMB: this.getTotalSizeMB(),
      hitRate: totalRequests > 0 ? this.stats.hits / totalRequests : 0,
      missRate: totalRequests > 0 ? this.stats.misses / totalRequests : 0,
      evictions: this.stats.evictions,
      memoryPressure: this.isUnderMemoryPressure(),
      lastCleanup: this.stats.lastCleanup,
    };
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    if (!this.config.enabled) return false;
    
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Check TTL
    const now = performance.now();
    if (now - entry.lastAccessed > this.config.ttlMs) {
      this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Get all cache keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }
}

// Singleton instance for image cache
export const imageMemoryPool = new MemoryPool<HTMLImageElement>({
  maxItems: 10,
  maxMemoryMB: 30,
  cleanupThresholdMB: 25,
  ttlMs: 300000, // 5 minutes
});

// Singleton instance for video thumbnail cache
export const videoThumbnailPool = new MemoryPool<string>({
  maxItems: 15,
  maxMemoryMB: 20,
  cleanupThresholdMB: 18,
  ttlMs: 600000, // 10 minutes
});

export default MemoryPool;