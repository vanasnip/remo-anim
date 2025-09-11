import React, { useState, useCallback } from 'react';
import { useImageLazyLoading } from '../hooks/useIntersectionObserver';
import { performanceMonitor } from '../utils/performance/PerformanceMonitor';

/**
 * LazyImage Component
 * Week 3a - Progressive Image Loading Infrastructure
 * 
 * CRITICAL SAFETY FEATURES:
 * - Complete isolation from Remotion video components
 * - No interference with Remotion's image/video rendering
 * - Safe fallbacks for missing images
 * - Conservative loading approach
 */

export interface LazyImageProps {
  src: string;
  alt: string;
  width?: number | string;
  height?: number | string;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
  blurDataUrl?: string;
  onLoad?: () => void;
  onError?: () => void;
  disabled?: boolean;
  priority?: boolean; // For above-the-fold images
}

/**
 * Progressive image loading with blur-to-sharp transition
 * Features:
 * - Intersection observer for lazy loading
 * - WebP format support with fallbacks
 * - Blur placeholder during loading
 * - Performance monitoring integration
 * - Safe error handling
 */
export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  width,
  height,
  className,
  style,
  placeholder,
  blurDataUrl,
  onLoad,
  onError,
  disabled = false,
  priority = false,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);
  const [loadStartTime, setLoadStartTime] = useState<number | null>(null);

  // Use lazy loading unless priority is set or lazy loading is disabled
  const shouldLazyLoad = !priority && !disabled;
  const { isIntersecting, ref } = useImageLazyLoading(disabled || priority);

  // Determine if we should start loading
  const shouldLoad = priority || !shouldLazyLoad || isIntersecting;

  // Generate WebP version URL if source is not already WebP
  const getWebPUrl = (originalUrl: string): string => {
    if (originalUrl.includes('.webp')) return originalUrl;
    return originalUrl.replace(/\.(jpg|jpeg|png)$/i, '.webp');
  };

  // Handle successful image load
  const handleLoad = useCallback(() => {
    setIsLoaded(true);
    setIsError(false);
    
    // Track loading performance
    if (loadStartTime) {
      const loadDuration = performance.now() - loadStartTime;
      performanceMonitor.endComponentRender('LazyImage', loadStartTime);
    }
    
    onLoad?.();
  }, [loadStartTime, onLoad]);

  // Handle image loading error
  const handleError = useCallback(() => {
    setIsError(true);
    setIsLoaded(false);
    onError?.();
  }, [onError]);

  // Start performance tracking when loading begins
  const handleLoadStart = useCallback(() => {
    if (!loadStartTime) {
      const startTime = performanceMonitor.startComponentRender('LazyImage');
      setLoadStartTime(startTime);
    }
  }, [loadStartTime]);

  // Base styles for the image container
  const containerStyles: React.CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#f5f5f5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width,
    height,
    ...style,
  };

  // Image styles with transition effects
  const imageStyles: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transition: 'opacity 0.3s ease-in-out, filter 0.3s ease-in-out',
    opacity: isLoaded ? 1 : 0,
    filter: isLoaded ? 'blur(0px)' : 'blur(10px)',
  };

  // Placeholder styles
  const placeholderStyles: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: '#f0f0f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#999',
    fontSize: '14px',
    opacity: isLoaded ? 0 : 1,
    transition: 'opacity 0.3s ease-in-out',
    pointerEvents: 'none',
  };

  // Error state styles
  const errorStyles: React.CSSProperties = {
    ...placeholderStyles,
    backgroundColor: '#ffe6e6',
    color: '#d32f2f',
    opacity: isError ? 1 : 0,
  };

  return (
    <div ref={ref} className={className} style={containerStyles}>
      {/* Blur placeholder if provided */}
      {blurDataUrl && !isLoaded && (
        <img
          src={blurDataUrl}
          alt=""
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            filter: 'blur(10px)',
            transform: 'scale(1.1)', // Slight scale to hide edges
          }}
        />
      )}

      {/* Main image - only render when should load */}
      {shouldLoad && !isError && (
        <>
          {/* Try WebP first */}
          <picture>
            <source srcSet={getWebPUrl(src)} type="image/webp" />
            <img
              src={src}
              alt={alt}
              style={imageStyles}
              onLoad={handleLoad}
              onError={handleError}
              onLoadStart={handleLoadStart}
              loading={priority ? 'eager' : 'lazy'}
            />
          </picture>
        </>
      )}

      {/* Loading placeholder */}
      {!isLoaded && !isError && (
        <div style={placeholderStyles}>
          {placeholder || (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '20px', marginBottom: '4px' }}>📐</div>
              <div>Loading...</div>
            </div>
          )}
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div style={errorStyles}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '20px', marginBottom: '4px' }}>⚠️</div>
            <div>Failed to load</div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Specialized LazyImage for video thumbnails
 * Pre-configured with gallery-optimized settings
 */
export const LazyVideoThumbnail: React.FC<Omit<LazyImageProps, 'placeholder'>> = (props) => {
  return (
    <LazyImage
      {...props}
      placeholder={
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>🎬</div>
          <div style={{ fontSize: '12px' }}>Loading video...</div>
        </div>
      }
    />
  );
};

/**
 * Specialized LazyImage for math/geometry content
 * Pre-configured with math-themed placeholder
 */
export const LazyMathImage: React.FC<Omit<LazyImageProps, 'placeholder'>> = (props) => {
  return (
    <LazyImage
      {...props}
      placeholder={
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>📐</div>
          <div style={{ fontSize: '12px' }}>Loading animation...</div>
        </div>
      }
    />
  );
};

export default LazyImage;