import { useEffect, useRef, useState } from 'react';

/**
 * useIntersectionObserver Hook
 * Week 3a - Lazy Loading Infrastructure
 * 
 * CRITICAL SAFETY FEATURES:
 * - Complete isolation from Remotion core components
 * - No DOM manipulation that could affect video rendering
 * - Conservative thresholds to prevent false triggers
 * - Automatic cleanup to prevent memory leaks
 */

export interface UseIntersectionObserverOptions {
  threshold?: number | number[];
  rootMargin?: string;
  triggerOnce?: boolean;
  disabled?: boolean;
}

export interface UseIntersectionObserverResult {
  isIntersecting: boolean;
  entry: IntersectionObserverEntry | null;
  ref: React.RefObject<HTMLElement>;
}

/**
 * Safe intersection observer hook for lazy loading
 * - Uses 50px buffer for smooth loading experience
 * - Supports single-trigger mode for performance
 * - Automatically handles cleanup
 * - Safe fallback when IntersectionObserver is not available
 */
export const useIntersectionObserver = ({
  threshold = 0,
  rootMargin = '50px', // 50px buffer as specified in requirements
  triggerOnce = true,
  disabled = false,
}: UseIntersectionObserverOptions = {}): UseIntersectionObserverResult => {
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null);
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [hasTriggered, setHasTriggered] = useState(false);
  const elementRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // Skip if disabled or already triggered (when triggerOnce is true)
    if (disabled || (triggerOnce && hasTriggered)) {
      return;
    }

    const element = elementRef.current;
    if (!element) return;

    // Fallback for browsers without IntersectionObserver support
    if (!window.IntersectionObserver) {
      // Conservative fallback - assume visible for compatibility
      setIsIntersecting(true);
      if (triggerOnce) setHasTriggered(true);
      return;
    }

    // Create observer with specified options
    const observer = new IntersectionObserver(
      (entries) => {
        const [observerEntry] = entries;
        setEntry(observerEntry);
        setIsIntersecting(observerEntry.isIntersecting);

        // Mark as triggered if using triggerOnce mode
        if (observerEntry.isIntersecting && triggerOnce) {
          setHasTriggered(true);
        }
      },
      {
        threshold,
        rootMargin,
        // Explicitly set root to null for viewport-based observation
        root: null,
      }
    );

    // Start observing
    observer.observe(element);

    // Cleanup function
    return () => {
      observer.unobserve(element);
      observer.disconnect();
    };
  }, [threshold, rootMargin, triggerOnce, disabled, hasTriggered]);

  // Reset trigger state when disabled changes
  useEffect(() => {
    if (!disabled && triggerOnce && hasTriggered) {
      // Reset if we're re-enabling after being disabled
      setHasTriggered(false);
    }
  }, [disabled, triggerOnce, hasTriggered]);

  return {
    isIntersecting,
    entry,
    ref: elementRef,
  };
};

/**
 * Specialized hook for video card lazy loading
 * Pre-configured with optimal settings for gallery performance
 */
export const useVideoCardLazyLoading = (
  disabled: boolean = false
): UseIntersectionObserverResult => {
  return useIntersectionObserver({
    threshold: 0.1, // Trigger when 10% visible
    rootMargin: '100px 0px', // Larger buffer for smoother video loading
    triggerOnce: true,
    disabled,
  });
};

/**
 * Specialized hook for image lazy loading
 * Pre-configured for thumbnail loading with smaller buffer
 */
export const useImageLazyLoading = (
  disabled: boolean = false
): UseIntersectionObserverResult => {
  return useIntersectionObserver({
    threshold: 0,
    rootMargin: '50px 0px', // Smaller buffer for images
    triggerOnce: true,
    disabled,
  });
};

/**
 * Hook for monitoring multiple elements with batch updates
 * Useful for performance monitoring of gallery items
 */
export const useBatchIntersectionObserver = <T extends HTMLElement>(
  elementsToObserve: T[],
  options: UseIntersectionObserverOptions = {}
): Map<T, boolean> => {
  const [visibilityMap, setVisibilityMap] = useState<Map<T, boolean>>(new Map());

  useEffect(() => {
    if (options.disabled || elementsToObserve.length === 0) {
      return;
    }

    if (!window.IntersectionObserver) {
      // Fallback - mark all as visible
      const fallbackMap = new Map<T, boolean>();
      elementsToObserve.forEach(el => fallbackMap.set(el, true));
      setVisibilityMap(fallbackMap);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        setVisibilityMap(prevMap => {
          const newMap = new Map(prevMap);
          entries.forEach(entry => {
            newMap.set(entry.target as T, entry.isIntersecting);
          });
          return newMap;
        });
      },
      {
        threshold: options.threshold || 0,
        rootMargin: options.rootMargin || '50px',
        root: null,
      }
    );

    // Observe all elements
    elementsToObserve.forEach(element => {
      if (element) observer.observe(element);
    });

    return () => {
      observer.disconnect();
    };
  }, [elementsToObserve, options.threshold, options.rootMargin, options.disabled]);

  return visibilityMap;
};

export default useIntersectionObserver;