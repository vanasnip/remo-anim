import React from 'react';
import { interpolate, useCurrentFrame, spring, useVideoConfig } from 'remotion';
import { VideoGridProps } from '../types';
import { VideoCard } from './VideoCard';

/**
 * VideoGrid component - displays a responsive grid or list of Manim videos
 * 
 * Features:
 * - Responsive grid layout with auto-fit columns
 * - Smooth entrance animations
 * - List/grid view modes
 * - Configurable columns
 */
export const VideoGrid: React.FC<VideoGridProps> = ({
  videos,
  onVideoSelect,
  onVideoHover,
  selectedVideo,
  viewMode,
  columns = 3,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Staggered entrance animation for cards
  const getCardAnimation = (index: number) => {
    const delay = index * 3; // 3 frame delay between cards
    return {
      opacity: spring({
        frame: frame - delay,
        fps,
        from: 0,
        to: 1,
        durationInFrames: 20,
      }),
      translateY: spring({
        frame: frame - delay,
        fps,
        from: 20,
        to: 0,
        durationInFrames: 20,
      }),
    };
  };

  // Container styles based on view mode
  const containerStyles: React.CSSProperties = {
    padding: '24px',
    width: '100%',
    minHeight: '400px',
  };

  const gridStyles: React.CSSProperties = viewMode === 'grid' 
    ? {
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fit, minmax(300px, 1fr))`,
        gap: '24px',
        maxWidth: '1400px',
        margin: '0 auto',
      }
    : {
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        maxWidth: '800px',
        margin: '0 auto',
      };

  // Empty state
  if (videos.length === 0) {
    return (
      <div style={{
        ...containerStyles,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#666',
        textAlign: 'center',
      }}>
        <div style={{
          fontSize: '48px',
          marginBottom: '16px',
          opacity: 0.5,
        }}>
          🎬
        </div>
        <h3 style={{
          margin: '0 0 8px 0',
          fontSize: '24px',
          fontWeight: '600',
        }}>
          No videos found
        </h3>
        <p style={{
          margin: 0,
          fontSize: '16px',
          opacity: 0.7,
        }}>
          Try adjusting your search or filters
        </p>
      </div>
    );
  }

  return (
    <div style={containerStyles}>
      {/* Results header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        paddingBottom: '16px',
        borderBottom: '1px solid #e0e0e0',
      }}>
        <h2 style={{
          margin: 0,
          fontSize: '24px',
          fontWeight: '600',
          color: '#333',
        }}>
          Manim Videos
        </h2>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          fontSize: '14px',
          color: '#666',
        }}>
          <span>
            {videos.length} video{videos.length !== 1 ? 's' : ''} found
          </span>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 8px',
            backgroundColor: '#f5f5f5',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: '500',
          }}>
            <span>View:</span>
            <span style={{
              color: viewMode === 'grid' ? '#3498db' : '#666',
              fontWeight: viewMode === 'grid' ? '600' : '500',
            }}>
              Grid
            </span>
            <span>/</span>
            <span style={{
              color: viewMode === 'list' ? '#3498db' : '#666',
              fontWeight: viewMode === 'list' ? '600' : '500',
            }}>
              List
            </span>
          </div>
        </div>
      </div>

      {/* Videos grid/list */}
      <div style={gridStyles}>
        {videos.map((video, index) => {
          const animation = getCardAnimation(index);
          
          return (
            <div
              key={video.id}
              style={{
                opacity: animation.opacity,
                transform: `translateY(${animation.translateY}px)`,
              }}
            >
              <VideoCard
                video={video}
                onSelect={onVideoSelect}
                onHover={onVideoHover}
                viewMode={viewMode}
                isSelected={selectedVideo?.id === video.id}
              />
            </div>
          );
        })}
      </div>

      {/* Loading placeholder for future videos */}
      {videos.length > 0 && videos.length % columns === 0 && (
        <div style={{
          marginTop: '24px',
          padding: '16px',
          textAlign: 'center',
          color: '#999',
          fontSize: '14px',
          fontStyle: 'italic',
        }}>
          More videos coming soon...
        </div>
      )}
    </div>
  );
};