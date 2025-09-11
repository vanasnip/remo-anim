/**
 * Performance Configuration
 * Reads environment variables to control performance optimizations
 */

// Default to production settings since Vercel env vars don't reach browser
const isProduction = typeof window !== 'undefined' && 
  (window.location.hostname === 'remotion-recovery.vercel.app' || 
   window.location.hostname.includes('vercel.app'));

export const performanceConfig = {
  // Core optimizations - all enabled in production
  lazyLoading: isProduction || process.env.ENABLE_LAZY_LOADING === 'true',
  virtualScroll: isProduction || process.env.ENABLE_VIRTUAL_SCROLL === 'true',
  predictiveLoading: isProduction || process.env.ENABLE_PREDICTIVE_LOADING === 'true',
  memoryPooling: isProduction || process.env.ENABLE_MEMORY_POOLING === 'true',
  
  // Aggressive optimizations - all enabled in production
  aggressiveCaching: isProduction || process.env.ENABLE_AGGRESSIVE_CACHING === 'true',
  preconnect: isProduction || process.env.ENABLE_PRECONNECT === 'true',
  prefetch: isProduction || process.env.ENABLE_PREFETCH === 'true',
  webpConversion: isProduction || process.env.ENABLE_WEBP_CONVERSION === 'true',
  
  // Performance tuning
  chunkSizeLimit: parseInt(process.env.CHUNK_SIZE_LIMIT || '200', 10),
  maxParallelRequests: parseInt(process.env.MAX_PARALLEL_REQUESTS || '6', 10),
  
  // Performance mode - detect based on hostname
  mode: isProduction ? 'production' : (process.env.PERFORMANCE_MODE || 'development'),
  
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