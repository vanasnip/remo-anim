/**
 * Performance Configuration
 * Reads environment variables to control performance optimizations
 */

export const performanceConfig = {
  // Core optimizations
  lazyLoading: process.env.ENABLE_LAZY_LOADING === 'true',
  virtualScroll: process.env.ENABLE_VIRTUAL_SCROLL === 'true',
  predictiveLoading: process.env.ENABLE_PREDICTIVE_LOADING === 'true',
  memoryPooling: process.env.ENABLE_MEMORY_POOLING === 'true',
  
  // Aggressive optimizations
  aggressiveCaching: process.env.ENABLE_AGGRESSIVE_CACHING === 'true',
  preconnect: process.env.ENABLE_PRECONNECT === 'true',
  prefetch: process.env.ENABLE_PREFETCH === 'true',
  webpConversion: process.env.ENABLE_WEBP_CONVERSION === 'true',
  
  // Performance tuning
  chunkSizeLimit: parseInt(process.env.CHUNK_SIZE_LIMIT || '200', 10),
  maxParallelRequests: parseInt(process.env.MAX_PARALLEL_REQUESTS || '6', 10),
  
  // Performance mode
  mode: process.env.PERFORMANCE_MODE || 'development',
  
  // Helper methods
  isProduction: () => performanceConfig.mode === 'production',
  isStaging: () => performanceConfig.mode === 'staging',
  isDevelopment: () => performanceConfig.mode === 'development',
  
  // Get all active optimizations
  getActiveOptimizations: () => {
    const active: string[] = [];
    if (performanceConfig.lazyLoading) active.push('Lazy Loading');
    if (performanceConfig.virtualScroll) active.push('Virtual Scrolling');
    if (performanceConfig.predictiveLoading) active.push('Predictive Loading');
    if (performanceConfig.memoryPooling) active.push('Memory Pooling');
    if (performanceConfig.aggressiveCaching) active.push('Aggressive Caching');
    if (performanceConfig.preconnect) active.push('Preconnect');
    if (performanceConfig.prefetch) active.push('Prefetch');
    if (performanceConfig.webpConversion) active.push('WebP Conversion');
    return active;
  },
  
  // Log configuration on startup
  logConfiguration: () => {
    console.log('🚀 Performance Configuration:', {
      mode: performanceConfig.mode,
      activeOptimizations: performanceConfig.getActiveOptimizations(),
      chunkSizeLimit: performanceConfig.chunkSizeLimit + 'KB',
      maxParallelRequests: performanceConfig.maxParallelRequests
    });
  }
};

// Log configuration on module load
if (typeof window !== 'undefined') {
  performanceConfig.logConfiguration();
}

export default performanceConfig;