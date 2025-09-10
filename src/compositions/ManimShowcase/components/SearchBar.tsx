import React, { useState, useEffect } from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';

interface SearchBarProps {
  onSearch: (query: string) => void;
  searchQuery: string;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * SearchBar component - Real-time search with smooth animations
 * 
 * Features:
 * - Real-time search with debouncing
 * - Smooth focus animations with spring physics
 * - Clear button with hover effects
 * - Responsive design
 * - Keyboard navigation support
 */
export const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  searchQuery,
  placeholder = "Search videos, categories, or tags...",
  disabled = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const [isFocused, setIsFocused] = useState(false);
  const [localQuery, setLocalQuery] = useState(searchQuery);

  // Debounce search to avoid excessive calls
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      onSearch(localQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [localQuery, onSearch]);

  // Sync with external searchQuery changes
  useEffect(() => {
    setLocalQuery(searchQuery);
  }, [searchQuery]);

  // Animation values
  const borderWidth = spring({
    frame,
    fps,
    from: 1,
    to: isFocused ? 2 : 1,
    durationInFrames: 15,
  });

  const borderColor = spring({
    frame,
    fps,
    from: 0,
    to: isFocused ? 1 : 0,
    durationInFrames: 15,
  });

  const iconScale = spring({
    frame,
    fps,
    from: 1,
    to: isFocused ? 1.1 : 1,
    durationInFrames: 12,
  });

  // Interpolate border color
  const getBorderColor = () => {
    const focused = `rgba(25, 118, 210, ${borderColor})`;
    const unfocused = `rgba(224, 224, 224, ${1 - borderColor})`;
    return isFocused ? focused : unfocused;
  };

  const containerStyles: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    maxWidth: '500px',
  };

  const inputContainerStyles: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: '24px',
    border: `${borderWidth}px solid ${getBorderColor()}`,
    padding: '8px 16px',
    transition: 'all 0.2s ease',
    boxShadow: isFocused 
      ? '0 4px 12px rgba(25, 118, 210, 0.15)' 
      : '0 2px 8px rgba(0, 0, 0, 0.1)',
  };

  const searchIconStyles: React.CSSProperties = {
    width: '20px',
    height: '20px',
    color: isFocused ? '#1976d2' : '#666',
    marginRight: '12px',
    transform: `scale(${iconScale})`,
    transition: 'color 0.2s ease',
    flexShrink: 0,
  };

  const inputStyles: React.CSSProperties = {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: '16px',
    color: '#333',
    backgroundColor: 'transparent',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  };

  const clearButtonStyles: React.CSSProperties = {
    position: 'absolute',
    right: '12px',
    width: '20px',
    height: '20px',
    border: 'none',
    background: 'none',
    color: '#666',
    cursor: 'pointer',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    opacity: localQuery.length > 0 ? 1 : 0,
    transform: localQuery.length > 0 ? 'scale(1)' : 'scale(0.8)',
    transition: 'all 0.2s ease',
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalQuery(e.target.value);
  };

  const handleClear = () => {
    setLocalQuery('');
    onSearch('');
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClear();
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div style={containerStyles}>
      <div style={inputContainerStyles}>
        {/* Search Icon */}
        <svg
          style={searchIconStyles}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M21 21L16.514 16.506L21 21ZM19 10.5C19 15.194 15.194 19 10.5 19C5.806 19 2 15.194 2 10.5C2 5.806 5.806 2 10.5 2C15.194 2 19 5.806 19 10.5Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        {/* Input Field */}
        <input
          type="text"
          value={localQuery}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          style={inputStyles}
          aria-label="Search videos"
        />

        {/* Clear Button */}
        <button
          type="button"
          onClick={handleClear}
          style={clearButtonStyles}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.backgroundColor = '#f5f5f5';
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.backgroundColor = 'transparent';
          }}
          aria-label="Clear search"
        >
          ×
        </button>
      </div>

      {/* Search suggestions could go here in the future */}
      {localQuery.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: '0',
          right: '0',
          marginTop: '4px',
          fontSize: '12px',
          color: '#666',
          textAlign: 'center',
          opacity: 0.8,
        }}>
          Searching for "{localQuery}"...
        </div>
      )}
    </div>
  );
};