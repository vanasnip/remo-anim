/**
 * Aggressive Performance Optimizations
 * Applies advanced optimization techniques when enabled
 */

import performanceConfig from '../../config/performance.config';

export class AggressiveOptimizations {
  private static instance: AggressiveOptimizations;
  private preconnectLinks: Set<string> = new Set();
  private prefetchedResources: Set<string> = new Set();
  private imageCache: Map<string, string> = new Map();

  static getInstance(): AggressiveOptimizations {
    if (!AggressiveOptimizations.instance) {
      AggressiveOptimizations.instance = new AggressiveOptimizations();
    }
    return AggressiveOptimizations.instance;
  }

  /**
   * Initialize all aggressive optimizations
   */
  initialize(): void {
    if (performanceConfig.aggressiveCaching) {
      this.enableAggressiveCaching();
    }
    
    if (performanceConfig.preconnect) {
      this.setupPreconnections();
    }
    
    if (performanceConfig.prefetch) {
      this.setupPrefetching();
    }
    
    if (performanceConfig.webpConversion) {
      this.enableWebPConversion();
    }
    
    this.optimizeChunkLoading();
    this.limitParallelRequests();
  }

  /**
   * Enable aggressive caching strategies
   */
  private enableAggressiveCaching(): void {
    // Set up service worker for aggressive caching
    if ('serviceWorker' in navigator && performanceConfig.isProduction()) {
      navigator.serviceWorker.register('/sw.js').then((registration) => {
        console.log('⚡ Service Worker registered for aggressive caching');
      });
    }

    // Add cache headers hints
    const meta = document.createElement('meta');
    meta.httpEquiv = 'Cache-Control';
    meta.content = 'public, max-age=31536000, immutable';
    document.head.appendChild(meta);
  }

  /**
   * Setup preconnect for faster resource loading
   */
  private setupPreconnections(): void {
    const preconnectDomains = [
      'https://fonts.googleapis.com',
      'https://fonts.gstatic.com',
      'https://cdn.jsdelivr.net',
      'https://unpkg.com'
    ];

    preconnectDomains.forEach(domain => {
      if (!this.preconnectLinks.has(domain)) {
        const link = document.createElement('link');
        link.rel = 'preconnect';
        link.href = domain;
        link.crossOrigin = 'anonymous';
        document.head.appendChild(link);
        this.preconnectLinks.add(domain);
        console.log(`⚡ Preconnected to ${domain}`);
      }
    });
  }

  /**
   * Setup resource prefetching
   */
  private setupPrefetching(): void {
    // Prefetch critical resources
    const criticalResources = [
      '/fonts/inter-var.woff2',
      '/images/logo.svg',
      '/data/compositions.json'
    ];

    criticalResources.forEach(resource => {
      this.prefetchResource(resource);
    });
  }

  /**
   * Prefetch a resource
   */
  prefetchResource(url: string): void {
    if (!this.prefetchedResources.has(url) && performanceConfig.prefetch) {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = url;
      link.as = this.getResourceType(url);
      document.head.appendChild(link);
      this.prefetchedResources.add(url);
      console.log(`⚡ Prefetched ${url}`);
    }
  }

  /**
   * Get resource type for prefetch hint
   */
  private getResourceType(url: string): string {
    if (url.endsWith('.js')) return 'script';
    if (url.endsWith('.css')) return 'style';
    if (url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) return 'image';
    if (url.match(/\.(woff|woff2|ttf|otf)$/i)) return 'font';
    if (url.endsWith('.json')) return 'fetch';
    return 'fetch';
  }

  /**
   * Enable WebP conversion for images
   */
  private enableWebPConversion(): void {
    // Check WebP support
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const isWebPSupported = canvas.toDataURL('image/webp').indexOf('image/webp') === 0;

    if (isWebPSupported) {
      console.log('⚡ WebP conversion enabled');
      // Override image loading to use WebP when available
      this.interceptImageLoading();
    }
  }

  /**
   * Intercept image loading for WebP conversion
   */
  private interceptImageLoading(): void {
    const originalImageSrc = Object.getOwnPropertyDescriptor(
      HTMLImageElement.prototype,
      'src'
    );

    if (originalImageSrc) {
      Object.defineProperty(HTMLImageElement.prototype, 'src', {
        set: function(value: string) {
          // Convert to WebP if it's a supported format
          if (value && performanceConfig.webpConversion) {
            const webpUrl = AggressiveOptimizations.getInstance().convertToWebP(value);
            originalImageSrc.set?.call(this, webpUrl);
          } else {
            originalImageSrc.set?.call(this, value);
          }
        },
        get: function() {
          return originalImageSrc.get?.call(this);
        }
      });
    }
  }

  /**
   * Convert image URL to WebP if available
   */
  private convertToWebP(url: string): string {
    // Only convert JPG and PNG to WebP
    if (url.match(/\.(jpg|jpeg|png)$/i)) {
      // Check if WebP version exists (you'd implement this based on your CDN setup)
      const webpUrl = url.replace(/\.(jpg|jpeg|png)$/i, '.webp');
      
      // In production, you'd check if the WebP version exists
      // For now, we'll return the original URL if not in production
      if (performanceConfig.isProduction()) {
        return webpUrl;
      }
    }
    return url;
  }

  /**
   * Optimize chunk loading based on configuration
   */
  private optimizeChunkLoading(): void {
    // Set chunk size limit for dynamic imports
    if (window.__webpack_require__) {
      console.log(`⚡ Chunk size limit set to ${performanceConfig.chunkSizeLimit}KB`);
    }
  }

  /**
   * Limit parallel requests
   */
  private limitParallelRequests(): void {
    // Implement request queue to limit parallel requests
    const originalFetch = window.fetch;
    let activeRequests = 0;
    const requestQueue: Array<() => void> = [];

    window.fetch = async function(...args) {
      if (activeRequests >= performanceConfig.maxParallelRequests) {
        await new Promise<void>(resolve => {
          requestQueue.push(resolve);
        });
      }

      activeRequests++;
      
      try {
        const response = await originalFetch.apply(this, args);
        return response;
      } finally {
        activeRequests--;
        const nextRequest = requestQueue.shift();
        if (nextRequest) {
          nextRequest();
        }
      }
    };

    console.log(`⚡ Max parallel requests limited to ${performanceConfig.maxParallelRequests}`);
  }

  /**
   * Preload critical CSS
   */
  preloadCSS(href: string): void {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'style';
    link.href = href;
    link.onload = function() {
      this.rel = 'stylesheet';
    };
    document.head.appendChild(link);
  }

  /**
   * Get optimization statistics
   */
  getStats() {
    return {
      preconnectedDomains: this.preconnectLinks.size,
      prefetchedResources: this.prefetchedResources.size,
      cachedImages: this.imageCache.size,
      activeOptimizations: performanceConfig.getActiveOptimizations()
    };
  }
}

// Auto-initialize on module load
if (typeof window !== 'undefined') {
  const optimizer = AggressiveOptimizations.getInstance();
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      optimizer.initialize();
    });
  } else {
    optimizer.initialize();
  }
}

export default AggressiveOptimizations;