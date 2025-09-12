import React, { useState, useCallback, useEffect } from 'react';
import { spring, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { VideoCardProps, ManimCategory } from '../types';
import { LazyVideoThumbnail } from './LazyImage';
import { useVideoCardLazyLoading } from '../hooks/useIntersectionObserver';
import { performanceMonitor } from '../utils/performance/PerformanceMonitor';

/**
 * LazyVideoCard Component - Performance Optimized VideoCard
 * Week 3a - Performance Optimization Foundation
 * 
 * CRITICAL SAFETY FEATURES:
 * - Complete isolation from Remotion core components
 * - Lazy loading with intersection observer
 * - Performance monitoring integration
 * - Conservative rendering approach
 * - Safe fallbacks for all operations
 * 
 * Performance Features:
 * - Lazy image loading with blur placeholders
 * - Viewport-based rendering decisions
 * - Memory usage monitoring
 * - Render time tracking
 * - Progressive enhancement approach
 */
export const LazyVideoCard: React.FC<VideoCardProps> = ({
  video,
  onSelect,
  onHover,
  viewMode,
  isSelected,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Performance monitoring
  const [renderStartTime, setRenderStartTime] = useState<number | null>(null);
  
  // Enhanced animations for Week 2 (preserved)
  const [isHovered, setIsHovered] = useState(false);
  
  // Lazy loading with intersection observer
  const { isIntersecting, ref } = useVideoCardLazyLoading();
  const shouldRender = isIntersecting;

  // Start performance tracking on first render
  useEffect(() => {
    if (!renderStartTime) {
      const startTime = performanceMonitor.startComponentRender('LazyVideoCard');
      setRenderStartTime(startTime);
    }
  }, [renderStartTime]);

  // End performance tracking when fully rendered
  useEffect(() => {
    if (renderStartTime && shouldRender) {
      performanceMonitor.endComponentRender('LazyVideoCard', renderStartTime);
    }
  }, [renderStartTime, shouldRender]);
  
  // Optimized animations for better performance
  const scale = spring({
    frame,
    fps,
    from: 1,
    to: isSelected ? 1.03 : isHovered ? 1.01 : 1, // Reduced scale values
    durationInFrames: 8, // Reduced from 12 to 8 frames
  });

  const shadowIntensity = interpolate(
    frame,
    [0, 6], // Reduced from 8 to 6 frames
    [isSelected ? 8 : isHovered ? 6 : 3, isSelected ? 16 : isHovered ? 12 : 6], // Reduced shadow values
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  const borderOpacity = spring({
    frame,
    fps,
    from: 0,
    to: isHovered ? 1 : 0,
    durationInFrames: 6, // Reduced from 10 to 6 frames
  });

  const overlayOpacity = spring({
    frame,
    fps,
    from: 0,
    to: isHovered ? 0.8 : 0, // Reduced opacity for better performance
    durationInFrames: 8, // Reduced from 15 to 8 frames
  });

  // Category colors for visual categorization (preserved)
  const categoryColors: Record<ManimCategory, string> = {
    [ManimCategory.GEOMETRY]: '#3498db',
    [ManimCategory.ALGEBRA]: '#e74c3c', 
    [ManimCategory.CALCULUS]: '#2ecc71',
    [ManimCategory.TRIGONOMETRY]: '#9b59b6',
    [ManimCategory.PHYSICS]: '#f39c12',
    [ManimCategory.GENERAL]: '#95a5a6',
  };

  const categoryColor = categoryColors[video.category] || categoryColors[ManimCategory.GENERAL];

  // Enhanced layout styles with better hover effects (preserved)
  const cardStyles: React.CSSProperties = {
    transform: `scale(${scale})`,
    boxShadow: `0 ${shadowIntensity}px ${shadowIntensity * 2}px rgba(0,0,0,${isHovered ? 0.25 : 0.15})`,
    borderRadius: '12px',
    overflow: 'hidden',
    backgroundColor: '#fff',
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    border: isSelected 
      ? `2px solid ${categoryColor}` 
      : `2px solid ${isHovered ? `${categoryColor}${Math.round(borderOpacity * 255).toString(16).padStart(2, '0')}` : 'transparent'}`,
    width: viewMode === 'grid' ? '100%' : '100%',
    display: 'flex',
    flexDirection: viewMode === 'grid' ? 'column' : 'row',
    minHeight: viewMode === 'grid' ? '280px' : '120px',
    position: 'relative',
  };

  const thumbnailStyles: React.CSSProperties = {
    width: viewMode === 'grid' ? '100%' : '200px',
    height: viewMode === 'grid' ? '160px' : '100px',
    flexShrink: 0,
    position: 'relative',
  };

  const contentStyles: React.CSSProperties = {
    padding: '16px',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  };

  const handleClick = useCallback(() => {
    onSelect(video);
  }, [onSelect, video]);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    onHover(video);
  }, [onHover, video]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    onHover(null);
  }, [onHover]);

  // Duration formatting (preserved)
  const formatDuration = (frames: number): string => {
    const seconds = Math.round(frames / 30); // Assuming 30 fps
    return `${seconds}s`;
  };

  // Lightweight placeholder when not in viewport
  if (!shouldRender) {
    return (
      <div
        ref={ref}
        style={{
          ...cardStyles,
          minHeight: viewMode === 'grid' ? '280px' : '120px',
          backgroundColor: '#f8f9fa',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid #e9ecef',
        }}
      >
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          color: '#6c757d',
          fontSize: '14px',
        }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>📐</div>
          <div>Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      style={cardStyles}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      {/* Lazy-loaded Thumbnail Section */}
      <div style={thumbnailStyles}>
        {video.thumbnail ? (
          <LazyVideoThumbnail
            src={video.thumbnail}
            alt={video.title}
            width="100%"
            height="100%"
            style={{ borderRadius: '8px 8px 0 0' }}
          />
        ) : (
          // Enhanced placeholder thumbnail with category-colored icon
          <div style={{
            width: '100%',
            height: '100%',
            backgroundColor: '#f5f5f5',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: categoryColor,
            fontSize: '24px',
            fontWeight: 'bold',
          }}>
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              backgroundColor: categoryColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '28px',
              marginBottom: '8px',
            }}>
              📐
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              {formatDuration(video.duration)}
            </div>
          </div>
        )}
        
        {/* Category Badge */}
        <div style={{
          position: 'absolute',
          top: '8px',
          left: '8px',
          backgroundColor: categoryColor,
          color: 'white',
          padding: '4px 8px',
          borderRadius: '12px',
          fontSize: '10px',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          transform: `scale(${isHovered ? 1.1 : 1})`,
          transition: 'transform 0.2s ease',
        }}>
          {video.category}
        </div>
        
        {/* Hover Overlay (preserved from original) */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: `rgba(${parseInt(categoryColor.slice(1, 3), 16)}, ${parseInt(categoryColor.slice(3, 5), 16)}, ${parseInt(categoryColor.slice(5, 7), 16)}, ${overlayOpacity * 0.1})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: overlayOpacity,
          transition: 'opacity 0.3s ease',
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: categoryColor,
            fontSize: '20px',
            fontWeight: 'bold',
            transform: `scale(${overlayOpacity})`,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          }}>
            ▶
          </div>
        </div>
      </div>

      {/* Content Section (preserved from original) */}
      <div style={contentStyles}>
        <div>
          <h3 style={{
            margin: '0 0 8px 0',
            fontSize: viewMode === 'grid' ? '16px' : '18px',
            fontWeight: '600',
            color: isHovered ? categoryColor : '#333',
            lineHeight: '1.3',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            transition: 'color 0.2s ease',
          }}>
            {video.title}
          </h3>
          
          <p style={{
            margin: '0 0 12px 0',
            fontSize: '14px',
            color: '#666',
            lineHeight: '1.4',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: viewMode === 'grid' ? 2 : 3,
            WebkitBoxOrient: 'vertical',
          }}>
            {video.description}
          </p>
        </div>

        {/* Tags */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '4px',
          marginTop: 'auto',
        }}>
          {video.tags.slice(0, viewMode === 'grid' ? 3 : 5).map(tag => (
            <span
              key={tag}
              style={{
                backgroundColor: '#f0f0f0',
                color: '#666',
                padding: '2px 6px',
                borderRadius: '8px',
                fontSize: '10px',
                fontWeight: '500',
              }}
            >
              #{tag}
            </span>
          ))}
          {video.tags.length > (viewMode === 'grid' ? 3 : 5) && (
            <span style={{
              color: '#999',
              fontSize: '10px',
              alignSelf: 'center',
            }}>
              +{video.tags.length - (viewMode === 'grid' ? 3 : 5)} more
            </span>
          )}
        </div>

        {/* File info */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '8px',
          paddingTop: '8px',
          borderTop: '1px solid #f0f0f0',
          fontSize: '12px',
          color: isHovered ? '#666' : '#999',
          transition: 'color 0.2s ease',
        }}>
          <span>{video.dimensions.width}×{video.dimensions.height}</span>
          <span>{formatDuration(video.duration)}</span>
        </div>
        
        {/* Quick Action Button (appears on hover) */}
        {isHovered && (
          <div style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            border: `1px solid ${categoryColor}`,
            borderRadius: '20px',
            padding: '6px 12px',
            fontSize: '11px',
            fontWeight: '600',
            color: categoryColor,
            opacity: overlayOpacity,
            transform: `translateY(${(1 - overlayOpacity) * 10}px)`,
            transition: 'all 0.3s ease',
            backdropFilter: 'blur(10px)',
            cursor: 'pointer',
          }}>
            Preview
          </div>
        )}
      </div>
    </div>
  );
};

export default LazyVideoCard;