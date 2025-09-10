import React from 'react';

/**
 * ResponsiveStyles component - Provides CSS for mobile responsiveness
 * 
 * Features:
 * - Mobile-first responsive design
 * - Touch-friendly interface elements
 * - Optimized typography scaling
 * - Grid breakpoints for different screen sizes
 */

export const ResponsiveStyles: React.FC = () => {
  return (
    <style>
      {`
        /* Global responsive utilities */
        @media (max-width: 768px) {
          /* Mobile optimizations for ManimShowcase */
          .manim-showcase-container {
            padding: 8px !important;
          }
          
          .manim-showcase-header {
            padding: 12px 16px !important;
          }
          
          .manim-showcase-title {
            font-size: 24px !important;
            margin-bottom: 4px !important;
          }
          
          .manim-showcase-subtitle {
            font-size: 14px !important;
          }
          
          .manim-showcase-stats {
            flex-direction: column !important;
            gap: 8px !important;
            font-size: 12px !important;
          }
          
          /* Gallery Header Mobile */
          .gallery-header-top-row {
            flex-direction: column !important;
            gap: 12px !important;
            align-items: stretch !important;
          }
          
          .gallery-header-search {
            max-width: none !important;
          }
          
          .gallery-header-controls {
            justify-content: space-between !important;
            flex-wrap: wrap !important;
          }
          
          /* Search Bar Mobile */
          .search-bar-container {
            max-width: none !important;
          }
          
          .search-bar-input {
            font-size: 16px !important; /* Prevents zoom on iOS */
          }
          
          /* Filter Controls Mobile */
          .filter-controls-container {
            padding: 12px 0 !important;
          }
          
          .filter-row {
            gap: 6px !important;
          }
          
          .filter-button {
            padding: 6px 12px !important;
            font-size: 11px !important;
          }
          
          .filter-tag-chip {
            padding: 4px 8px !important;
            font-size: 10px !important;
          }
          
          /* Video Grid Mobile */
          .video-grid {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
            padding: 12px !important;
          }
          
          .video-grid-list {
            gap: 8px !important;
          }
          
          /* Video Card Mobile */
          .video-card {
            min-height: 240px !important;
          }
          
          .video-card-list {
            min-height: 100px !important;
            flex-direction: column !important;
          }
          
          .video-card-thumbnail {
            height: 120px !important;
            width: 100% !important;
          }
          
          .video-card-thumbnail-list {
            height: 80px !important;
            width: 100% !important;
          }
          
          .video-card-content {
            padding: 12px !important;
          }
          
          /* Video Preview Modal Mobile */
          .video-preview-modal {
            margin: 10px !important;
            max-height: 95vh !important;
            border-radius: 12px !important;
          }
          
          .video-preview-header {
            padding: 16px !important;
          }
          
          .video-preview-content {
            padding: 0 16px 16px 16px !important;
          }
          
          .video-preview-player {
            height: 250px !important;
          }
          
          .video-preview-metadata {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }
          
          .video-preview-actions {
            flex-direction: column !important;
            gap: 8px !important;
          }
          
          .video-preview-integrate-btn {
            padding: 14px !important;
            font-size: 14px !important;
          }
          
          /* Hover Preview Mobile */
          .hover-preview {
            position: relative !important;
            bottom: auto !important;
            left: auto !important;
            right: auto !important;
            margin: 12px !important;
            border-radius: 8px !important;
          }
          
          .hover-preview-content {
            flex-direction: column !important;
            text-align: center !important;
          }
          
          .hover-preview-meta {
            margin-left: 0 !important;
            margin-top: 8px !important;
          }
        }
        
        @media (max-width: 480px) {
          /* Extra small mobile optimizations */
          .manim-showcase-container {
            padding: 4px !important;
          }
          
          .gallery-header-controls {
            flex-direction: column !important;
            align-items: stretch !important;
          }
          
          .view-mode-toggle {
            align-self: center !important;
          }
          
          .filter-controls-expanded {
            height: auto !important;
            max-height: 120px !important;
          }
          
          .video-card-tags {
            display: none !important; /* Hide tags on very small screens */
          }
        }
        
        @media (min-width: 769px) and (max-width: 1024px) {
          /* Tablet optimizations */
          .video-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          
          .gallery-header-search {
            max-width: 400px !important;
          }
        }
        
        @media (min-width: 1025px) {
          /* Desktop optimizations */
          .video-grid {
            grid-template-columns: repeat(var(--columns, 3), 1fr) !important;
          }
          
          .video-card:hover {
            transform: translateY(-2px) !important;
          }
        }
        
        /* Touch-friendly improvements */
        @media (hover: none) and (pointer: coarse) {
          .video-card {
            transform: none !important; /* Disable scale on touch devices */
          }
          
          .video-card-hover-overlay {
            display: none !important; /* Hide hover overlays on touch */
          }
          
          .filter-button:hover,
          .search-bar:hover {
            background-color: initial !important;
          }
          
          /* Increase touch targets */
          .filter-button,
          .video-card,
          .search-bar-clear {
            min-height: 44px !important;
          }
          
          .filter-tag-chip {
            min-height: 36px !important;
            padding: 8px 12px !important;
          }
        }
        
        /* High DPI display optimizations */
        @media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi) {
          .video-card-thumbnail img {
            image-rendering: -webkit-optimize-contrast !important;
          }
        }
        
        /* Dark mode support (future enhancement) */
        @media (prefers-color-scheme: dark) {
          .manim-showcase-container {
            background-color: #1a1a1a !important;
            color: #ffffff !important;
          }
          
          .gallery-header,
          .video-card,
          .search-bar {
            background-color: #2d2d2d !important;
            border-color: #404040 !important;
          }
          
          .video-preview-modal {
            background-color: #2d2d2d !important;
          }
        }
        
        /* Reduced motion preferences */
        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
        
        /* Print styles */
        @media print {
          .video-preview-modal,
          .hover-preview,
          .gallery-header {
            display: none !important;
          }
          
          .video-card {
            break-inside: avoid !important;
            box-shadow: none !important;
            border: 1px solid #000 !important;
          }
        }
      `}
    </style>
  );
};

export default ResponsiveStyles;