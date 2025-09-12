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
  lazyLoading: isProduction,
  virtualScroll: isProduction,
  predictiveLoading: isProduction,
  memoryPooling: isProduction,
  
  // Aggressive optimizations - all enabled in production
  aggressiveCaching: isProduction,
  preconnect: isProduction,
  prefetch: isProduction,
  webpConversion: isProduction,
  
  // Performance tuning
  chunkSizeLimit: 200,
  maxParallelRequests: 6,
  
  // Performance mode - detect based on hostname
  mode: isProduction ? 'production' : 'development',
  
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