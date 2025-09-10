import React from 'react';
import { render, screen } from '@testing-library/react';
import { VideoEffects } from './VideoEffects';
import '@testing-library/jest-dom';

// Mock Remotion hooks and components
jest.mock('remotion', () => ({
  AbsoluteFill: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="absolute-fill">{children}</div>
  ),
  useCurrentFrame: jest.fn(),
  useVideoConfig: jest.fn(),
  interpolate: jest.fn((frame, input, output) => {
    // Simple linear interpolation for testing
    const ratio = (frame - input[0]) / (input[1] - input[0]);
    return output[0] + ratio * (output[1] - output[0]);
  }),
  spring: jest.fn(),
  Video: ({ src, style }: { src: string; style?: React.CSSProperties }) => (
    <div data-testid="video" data-src={src} style={style}>
      Mock Video
    </div>
  ),
  staticFile: (path: string) => path,
  Easing: {},
}));

// Mock Material-UI components
jest.mock('@mui/material', () => ({
  Box: ({ children, sx, ...props }: any) => (
    <div data-testid="mui-box" data-sx={JSON.stringify(sx)} {...props}>
      {children}
    </div>
  ),
  Typography: ({ children, variant, sx, ...props }: any) => (
    <div data-testid={`typography-${variant || 'default'}`} data-sx={JSON.stringify(sx)} {...props}>
      {children}
    </div>
  ),
}));

jest.mock('@mui/material/styles', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="theme-provider">{children}</div>
  ),
  createTheme: jest.fn(() => ({})),
}));

describe('VideoEffects', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup default mock returns
    const mockUseCurrentFrame = require('remotion').useCurrentFrame;
    const mockUseVideoConfig = require('remotion').useVideoConfig;
    
    mockUseCurrentFrame.mockReturnValue(45); // Middle of first effect
    mockUseVideoConfig.mockReturnValue({ fps: 30 });
  });

  test('renders with default props', () => {
    render(<VideoEffects />);
    
    expect(screen.getByTestId('absolute-fill')).toBeInTheDocument();
    expect(screen.getByTestId('theme-provider')).toBeInTheDocument();
    expect(screen.getByTestId('video')).toBeInTheDocument();
  });

  test('displays default source video', () => {
    render(<VideoEffects />);
    
    const video = screen.getByTestId('video');
    expect(video).toHaveAttribute('data-src', '/assets/manim/CircleAreaDemo_480p15_20250902_222354.mp4');
  });

  test('shows effect name when showEffectName is true', () => {
    render(<VideoEffects showEffectName={true} />);
    
    // Should show blur effect at frame 45
    expect(screen.getByText('blur Effect')).toBeInTheDocument();
  });

  test('hides effect name when showEffectName is false', () => {
    render(<VideoEffects showEffectName={false} />);
    
    // Should not show effect name
    expect(screen.queryByText('blur Effect')).not.toBeInTheDocument();
  });

  test('renders with custom source video', () => {
    const customVideo = '/custom/video.mp4';
    render(<VideoEffects sourceVideo={customVideo} />);
    
    const video = screen.getByTestId('video');
    expect(video).toHaveAttribute('data-src', customVideo);
  });

  test('renders with custom effects', () => {
    const mockUseCurrentFrame = require('remotion').useCurrentFrame;
    mockUseCurrentFrame.mockReturnValue(150); // Middle of custom effect
    
    const customEffects = [
      { type: 'neon' as const, intensity: 0.8, startFrame: 100, endFrame: 200 }
    ];
    
    render(<VideoEffects effects={customEffects} showEffectName={true} />);
    
    expect(screen.getByText('neon Effect')).toBeInTheDocument();
  });

  test('handles frame outside effect range', () => {
    const mockUseCurrentFrame = require('remotion').useCurrentFrame;
    mockUseCurrentFrame.mockReturnValue(1000); // Outside all effect ranges
    
    render(<VideoEffects showEffectName={true} />);
    
    // Should not show any effect name when outside range
    expect(screen.queryByText(/Effect$/)).not.toBeInTheDocument();
  });

  test('renders progress indicator', () => {
    render(<VideoEffects />);
    
    // Should have progress bar elements
    const boxes = screen.getAllByTestId('mui-box');
    const progressElements = boxes.filter(box => {
      const sx = JSON.parse(box.getAttribute('data-sx') || '{}');
      return sx.background && sx.background.includes('linear-gradient');
    });
    
    expect(progressElements.length).toBeGreaterThan(0);
  });

  test('applies different effects based on frame', () => {
    const mockUseCurrentFrame = require('remotion').useCurrentFrame;
    
    // Test blur effect (0-90)
    mockUseCurrentFrame.mockReturnValue(45);
    const { rerender } = render(<VideoEffects showEffectName={true} />);
    expect(screen.getByText('blur Effect')).toBeInTheDocument();
    
    // Test chromatic effect (90-180)
    mockUseCurrentFrame.mockReturnValue(135);
    rerender(<VideoEffects showEffectName={true} />);
    expect(screen.getByText('chromatic Effect')).toBeInTheDocument();
    
    // Test VHS effect (180-270)
    mockUseCurrentFrame.mockReturnValue(225);
    rerender(<VideoEffects showEffectName={true} />);
    expect(screen.getByText('vhs Effect')).toBeInTheDocument();
  });

  test('shows intensity percentage', () => {
    render(<VideoEffects showEffectName={true} />);
    
    // Default blur effect has 0.5 intensity (50%)
    expect(screen.getByText('Intensity: 50%')).toBeInTheDocument();
  });

  test('renders matrix rain effect', () => {
    const mockUseCurrentFrame = require('remotion').useCurrentFrame;
    mockUseCurrentFrame.mockReturnValue(405); // Matrix effect frame (360-450)
    
    render(<VideoEffects showEffectName={true} />);
    
    expect(screen.getByText('matrix Effect')).toBeInTheDocument();
    // Matrix effect should render characters
    expect(screen.getByText('matrix Effect')).toBeInTheDocument();
  });

  test('handles split screen effect', () => {
    const mockUseCurrentFrame = require('remotion').useCurrentFrame;
    mockUseCurrentFrame.mockReturnValue(495); // Split effect frame (450-540)
    
    render(<VideoEffects showEffectName={true} />);
    
    expect(screen.getByText('split Effect')).toBeInTheDocument();
  });

  test('component structure is correct', () => {
    render(<VideoEffects />);
    
    // Should have theme provider wrapping everything
    expect(screen.getByTestId('theme-provider')).toBeInTheDocument();
    
    // Should have absolute fill as main container
    expect(screen.getByTestId('absolute-fill')).toBeInTheDocument();
    
    // Should have video element
    expect(screen.getByTestId('video')).toBeInTheDocument();
    
    // Should have multiple Box components for layout and effects
    const boxes = screen.getAllByTestId('mui-box');
    expect(boxes.length).toBeGreaterThan(2);
  });
});