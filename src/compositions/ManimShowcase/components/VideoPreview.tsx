import React, { useState, useEffect } from 'react';
import { spring, useCurrentFrame, useVideoConfig, interpolate, OffthreadVideo, staticFile } from 'remotion';
import { VideoPreviewProps, ManimCategory } from '../types';

/**
 * VideoPreview component - Full modal preview with video playback
 * 
 * Features:
 * - Modal overlay with smooth animations
 * - Video player with controls
 * - Detailed metadata display
 * - Integration button with code preview
 * - Responsive design with mobile support
 * - Keyboard navigation (ESC to close)
 */
export const VideoPreview: React.FC<VideoPreviewProps> = ({
  video,
  onClose,
  onIntegrate,
  showCode = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [showCodePreview, setShowCodePreview] = useState(showCode);
  const [isIntegrating, setIsIntegrating] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [showFallback, setShowFallback] = useState(false);

  // Handle escape key to close modal
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [onClose]);

  // Animation values
  const overlayOpacity = spring({
    frame,
    fps,
    from: 0,
    to: 1,
    durationInFrames: 20,
  });

  const modalScale = spring({
    frame,
    fps,
    from: 0.8,
    to: 1,
    durationInFrames: 25,
  });

  const contentOpacity = spring({
    frame: frame - 10,
    fps,
    from: 0,
    to: 1,
    durationInFrames: 20,
  });

  // Category colors
  const categoryColors: Record<ManimCategory, string> = {
    [ManimCategory.GEOMETRY]: '#3498db',
    [ManimCategory.ALGEBRA]: '#e74c3c', 
    [ManimCategory.CALCULUS]: '#2ecc71',
    [ManimCategory.TRIGONOMETRY]: '#9b59b6',
    [ManimCategory.PHYSICS]: '#f39c12',
    [ManimCategory.GENERAL]: '#95a5a6',
  };

  const categoryColor = categoryColors[video.category];

  // Styles
  const overlayStyles: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: `rgba(0, 0, 0, ${overlayOpacity * 0.8})`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px',
  };

  const modalStyles: React.CSSProperties = {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    maxWidth: '900px',
    width: '100%',
    maxHeight: '90vh',
    overflowY: 'auto',
    transform: `scale(${modalScale})`,
    opacity: contentOpacity,
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
  };

  const headerStyles: React.CSSProperties = {
    padding: '20px 24px',
    borderBottom: '1px solid #e0e0e0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
  };

  const closeButtonStyles: React.CSSProperties = {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    color: '#666',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '50%',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  };

  const videoContainerStyles: React.CSSProperties = {
    padding: '0 24px 20px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  };

  const videoPlayerStyles: React.CSSProperties = {
    width: '100%',
    height: '400px',
    backgroundColor: '#f5f5f5',
    borderRadius: '12px',
    border: '1px solid #e0e0e0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  };

  const metadataStyles: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
    padding: '20px',
    backgroundColor: '#f8f9fa',
    borderRadius: '12px',
  };

  const formatDuration = (frames: number): string => {
    const seconds = Math.round(frames / 30);
    return `${seconds}s`;
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleIntegrate = async () => {
    setIsIntegrating(true);
    try {
      await onIntegrate(video);
    } catch (error) {
      console.error('Integration failed:', error);
    } finally {
      setIsIntegrating(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div style={overlayStyles} onClick={handleBackdropClick}>
      <div style={modalStyles} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <header style={headerStyles}>
          <div style={{ flex: 1 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '8px',
            }}>
              <div style={{
                backgroundColor: categoryColor,
                color: 'white',
                padding: '4px 12px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: 'bold',
                textTransform: 'uppercase',
              }}>
                {video.category}
              </div>
              <span style={{
                fontSize: '14px',
                color: '#666',
              }}>
                {formatDate(video.createdAt)}
              </span>
            </div>
            
            <h1 style={{
              margin: '0 0 8px 0',
              fontSize: '24px',
              fontWeight: '700',
              color: '#333',
              lineHeight: '1.3',
            }}>
              {video.title}
            </h1>
            
            <p style={{
              margin: 0,
              fontSize: '16px',
              color: '#666',
              lineHeight: '1.5',
            }}>
              {video.description}
            </p>
          </div>
          
          <button
            onClick={onClose}
            style={closeButtonStyles}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.backgroundColor = '#f5f5f5';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.backgroundColor = 'transparent';
            }}
            aria-label="Close preview"
          >
            ×
          </button>
        </header>

        {/* Video Player */}
        <div style={videoContainerStyles}>
          <div style={videoPlayerStyles}>
            {isVideoLoaded && !showFallback ? (
              <OffthreadVideo
                src={staticFile(`assets/manim/${video.filename}`)}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                }}
                loop
                muted
                onError={(error) => {
                  console.error('Video loading error:', error);
                  setVideoError(`Failed to load video: ${error.message || 'Unknown error'}`);
                  setShowFallback(true);
                }}
              />
            ) : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#666',
                gap: '16px',
              }}>
                {videoError ? (
                  // Error fallback
                  <>
                    <div style={{
                      width: '80px',
                      height: '80px',
                      borderRadius: '50%',
                      backgroundColor: '#e74c3c',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: '32px',
                    }}>
                      ⚠
                    </div>
                    <div>
                      <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px', color: '#e74c3c' }}>
                        Video Load Error
                      </div>
                      <div style={{ fontSize: '14px', opacity: 0.8, textAlign: 'center', maxWidth: '300px' }}>
                        {videoError}
                      </div>
                      <div style={{ fontSize: '12px', opacity: 0.6, marginTop: '8px', fontFamily: 'monospace' }}>
                        File: {video.filename}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => {
                          setVideoError(null);
                          setShowFallback(false);
                          setIsVideoLoaded(true);
                        }}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: categoryColor,
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer',
                        }}
                      >
                        Retry
                      </button>
                      <button
                        onClick={() => {
                          const videoPath = staticFile(`assets/manim/${video.filename}`);
                          window.open(videoPath, '_blank');
                        }}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: '#666',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer',
                        }}
                      >
                        Open Direct
                      </button>
                    </div>
                  </>
                ) : (
                  // Normal load state
                  <>
                    <div style={{
                      width: '80px',
                      height: '80px',
                      borderRadius: '50%',
                      backgroundColor: categoryColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: '32px',
                    }}>
                      ▶
                    </div>
                    <div>
                      <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>
                        {video.title}
                      </div>
                      <div style={{ fontSize: '14px', opacity: 0.8 }}>
                        Click to load video preview
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setIsVideoLoaded(true);
                        setVideoError(null);
                        setShowFallback(false);
                      }}
                      style={{
                        padding: '12px 24px',
                        backgroundColor: categoryColor,
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: 'pointer',
                      }}
                    >
                      Load Video
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Video Status Info */}
          {videoError && (
            <div style={{
              padding: '16px',
              backgroundColor: '#fff5f5',
              border: '1px solid #fed7d7',
              borderRadius: '8px',
              marginBottom: '16px',
            }}>
              <div style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#e53e3e',
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <span>⚠️</span>
                Video Loading Issue
              </div>
              <div style={{
                fontSize: '13px',
                color: '#742a2a',
                lineHeight: '1.4',
                marginBottom: '12px',
              }}>
                {videoError}
              </div>
              <div style={{
                fontSize: '12px',
                color: '#742a2a',
                backgroundColor: '#fed7d7',
                padding: '8px',
                borderRadius: '4px',
                fontFamily: 'monospace',
              }}>
                <strong>Troubleshooting Tips:</strong><br />
                • Check if the video file exists at: /public/assets/manim/{video.filename}<br />
                • Verify video format is supported (MP4 recommended)<br />
                • Try the "Open Direct" button to test the file URL<br />
                • Check browser console for additional error details
              </div>
            </div>
          )}

          {/* Metadata Grid */}
          <div style={metadataStyles}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '600', color: '#666', textTransform: 'uppercase' }}>
                Dimensions
              </label>
              <div style={{ fontSize: '16px', fontWeight: '600', color: '#333', marginTop: '4px' }}>
                {video.dimensions.width} × {video.dimensions.height}
              </div>
            </div>
            
            <div>
              <label style={{ fontSize: '12px', fontWeight: '600', color: '#666', textTransform: 'uppercase' }}>
                Duration
              </label>
              <div style={{ fontSize: '16px', fontWeight: '600', color: '#333', marginTop: '4px' }}>
                {formatDuration(video.duration)}
              </div>
            </div>
            
            <div>
              <label style={{ fontSize: '12px', fontWeight: '600', color: '#666', textTransform: 'uppercase' }}>
                File
              </label>
              <div style={{ 
                fontSize: '14px', 
                color: '#333', 
                marginTop: '4px', 
                fontFamily: 'monospace',
                wordBreak: 'break-all'
              }}>
                {video.filename}
              </div>
              <div style={{
                fontSize: '11px',
                color: '#666',
                marginTop: '4px',
                fontFamily: 'monospace'
              }}>
                Path: /public/assets/manim/{video.filename}
              </div>
            </div>
            
            <div>
              <label style={{ fontSize: '12px', fontWeight: '600', color: '#666', textTransform: 'uppercase' }}>
                Script
              </label>
              <div style={{ fontSize: '14px', color: '#333', marginTop: '4px', fontFamily: 'monospace' }}>
                {video.manimScript || 'N/A'}
              </div>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label style={{ fontSize: '14px', fontWeight: '600', color: '#333', marginBottom: '8px', display: 'block' }}>
              Tags
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {video.tags.map(tag => (
                <span
                  key={tag}
                  style={{
                    backgroundColor: '#e3f2fd',
                    color: '#1976d2',
                    padding: '6px 12px',
                    borderRadius: '16px',
                    fontSize: '12px',
                    fontWeight: '500',
                  }}
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>

          {/* Code Preview Toggle */}
          {video.manimScript && (
            <div>
              <button
                onClick={() => setShowCodePreview(!showCodePreview)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'transparent',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  fontSize: '14px',
                  color: '#666',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span>💻</span>
                {showCodePreview ? 'Hide' : 'Show'} Manim Code
                <span style={{
                  transform: `rotate(${showCodePreview ? 180 : 0}deg)`,
                  transition: 'transform 0.2s ease',
                }}>
                  ▼
                </span>
              </button>
              
              {showCodePreview && (
                <div style={{
                  marginTop: '12px',
                  padding: '16px',
                  backgroundColor: '#2d3748',
                  color: '#e2e8f0',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontFamily: 'monaco, "Fira Code", monospace',
                  lineHeight: '1.5',
                  overflow: 'auto',
                }}>
                  <div style={{ marginBottom: '8px', color: '#a0aec0', fontSize: '12px' }}>
                    {video.manimScript}
                  </div>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
{`# Example Manim script for ${video.title}
from manim import *

class ${video.title.replace(/\s+/g, '')} extends Scene:
    def construct(self):
        # Animation logic here
        title = Text("${video.title}")
        self.play(Write(title))
        self.wait(2)`}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div style={{
            display: 'flex',
            gap: '12px',
            paddingTop: '20px',
            borderTop: '1px solid #e0e0e0',
          }}>
            <button
              onClick={handleIntegrate}
              disabled={isIntegrating}
              style={{
                flex: 1,
                padding: '16px',
                backgroundColor: categoryColor,
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: isIntegrating ? 'not-allowed' : 'pointer',
                opacity: isIntegrating ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              {isIntegrating ? (
                <>
                  <span style={{ animation: 'spin 1s linear infinite' }}>⚙️</span>
                  Integrating...
                </>
              ) : (
                <>
                  <span>📐</span>
                  Integrate into Project
                </>
              )}
            </button>
            
            <button
              onClick={onClose}
              style={{
                padding: '16px 24px',
                backgroundColor: 'transparent',
                color: '#666',
                border: '2px solid #e0e0e0',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.backgroundColor = '#f5f5f5';
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.backgroundColor = 'transparent';
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};