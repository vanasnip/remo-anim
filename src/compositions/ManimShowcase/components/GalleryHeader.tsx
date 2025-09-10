import React, { useState } from 'react';
import { spring, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { GalleryHeaderProps, ManimCategory } from '../types';
import { SearchBar } from './SearchBar';
import { FilterControls } from './FilterControls';

/**
 * GalleryHeader component - Organizes search, filters, and view controls
 * 
 * Features:
 * - Responsive layout with collapsible sections
 * - Search bar with real-time filtering
 * - Category and tag filter controls
 * - Grid/list view toggle
 * - Results count and sorting options
 * - Mobile-optimized with drawer-style filters
 */
export const GalleryHeader: React.FC<GalleryHeaderProps> = ({
  onSearch,
  onCategoryFilter,
  onViewModeChange,
  searchQuery,
  selectedCategory,
  viewMode,
  showSearch = true,
  showFilters = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Animation values
  const headerOpacity = spring({
    frame,
    fps,
    from: 0,
    to: 1,
    durationInFrames: 25,
  });

  const filtersHeight = spring({
    frame,
    fps,
    from: 0,
    to: isFiltersExpanded ? 200 : 0,
    durationInFrames: 20,
  });

  const filtersOpacity = spring({
    frame,
    fps,
    from: 0,
    to: isFiltersExpanded ? 1 : 0,
    durationInFrames: 15,
  });

  // Styles
  const headerStyles: React.CSSProperties = {
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e0e0e0',
    padding: '16px 24px',
    opacity: headerOpacity,
    position: 'sticky',
    top: 0,
    zIndex: 100,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
  };

  const topRowStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    marginBottom: '12px',
  };

  const searchSectionStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    flex: 1,
    maxWidth: '600px',
  };

  const controlsStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexShrink: 0,
  };

  const buttonStyles: React.CSSProperties = {
    padding: '8px 12px',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    backgroundColor: '#ffffff',
    color: '#666',
    fontSize: '14px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.2s ease',
  };

  const getViewButtonStyles = (mode: 'grid' | 'list'): React.CSSProperties => ({
    ...buttonStyles,
    backgroundColor: viewMode === mode ? '#1976d2' : '#ffffff',
    color: viewMode === mode ? '#ffffff' : '#666',
    borderColor: viewMode === mode ? '#1976d2' : '#e0e0e0',
  });

  const filtersContainerStyles: React.CSSProperties = {
    height: `${filtersHeight}px`,
    opacity: filtersOpacity,
    overflow: 'hidden',
    transition: 'all 0.3s ease',
  };

  const filtersSectionStyles: React.CSSProperties = {
    padding: '16px 0',
    borderTop: '1px solid #f0f0f0',
  };

  // Handle tag filtering
  const handleTagFilter = (tags: string[]) => {
    setSelectedTags(tags);
    // In a real implementation, this would trigger filtering
    // For now, we'll just store the tags
  };

  // Handle filter toggle
  const handleFiltersToggle = () => {
    setIsFiltersExpanded(!isFiltersExpanded);
  };

  // Get active filters count
  const getActiveFiltersCount = (): number => {
    let count = 0;
    if (selectedCategory) count++;
    if (selectedTags.length > 0) count += selectedTags.length;
    return count;
  };

  const activeFiltersCount = getActiveFiltersCount();

  return (
    <div style={headerStyles}>
      {/* Top Row */}
      <div style={topRowStyles}>
        {/* Search Section */}
        <div style={searchSectionStyles}>
          {showSearch && (
            <SearchBar
              onSearch={onSearch}
              searchQuery={searchQuery}
              placeholder="Search videos, categories, or tags..."
            />
          )}
        </div>

        {/* Controls Section */}
        <div style={controlsStyles}>
          {/* Filters Toggle */}
          {showFilters && (
            <button
              onClick={handleFiltersToggle}
              style={{
                ...buttonStyles,
                backgroundColor: isFiltersExpanded ? '#1976d2' : '#ffffff',
                color: isFiltersExpanded ? '#ffffff' : '#666',
                borderColor: isFiltersExpanded ? '#1976d2' : '#e0e0e0',
                position: 'relative',
              }}
              onMouseEnter={(e) => {
                if (!isFiltersExpanded) {
                  (e.target as HTMLElement).style.backgroundColor = '#f5f5f5';
                }
              }}
              onMouseLeave={(e) => {
                if (!isFiltersExpanded) {
                  (e.target as HTMLElement).style.backgroundColor = '#ffffff';
                }
              }}
            >
              <span>🔍</span>
              Filters
              {activeFiltersCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-6px',
                  right: '-6px',
                  backgroundColor: '#e74c3c',
                  color: 'white',
                  borderRadius: '50%',
                  width: '18px',
                  height: '18px',
                  fontSize: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                }}>
                  {activeFiltersCount}
                </span>
              )}
              <span style={{
                transform: `rotate(${isFiltersExpanded ? 180 : 0}deg)`,
                transition: 'transform 0.2s ease',
              }}>
                ▼
              </span>
            </button>
          )}

          {/* View Mode Toggle */}
          <div style={{
            display: 'flex',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            overflow: 'hidden',
          }}>
            <button
              onClick={() => onViewModeChange('grid')}
              style={getViewButtonStyles('grid')}
              title="Grid view"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M3 3H11V11H3V3ZM13 3H21V11H13V3ZM3 13H11V21H3V13ZM13 13H21V21H13V13Z"
                  stroke="currentColor"
                  strokeWidth="2"
                />
              </svg>
            </button>
            <button
              onClick={() => onViewModeChange('list')}
              style={getViewButtonStyles('list')}
              title="List view"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M8 6H21M8 12H21M8 18H21M3 6H3.01M3 12H3.01M3 18H3.01"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          {/* Sort Options */}
          <select
            style={{
              ...buttonStyles,
              paddingRight: '32px',
              appearance: 'none',
              backgroundImage: 'url("data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3e%3cpath stroke=\'%236b7280\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3e%3c/svg%3e")',
              backgroundPosition: 'right 8px center',
              backgroundRepeat: 'no-repeat',
              backgroundSize: '16px',
            }}
            defaultValue="recent"
          >
            <option value="recent">Most Recent</option>
            <option value="alphabetical">Alphabetical</option>
            <option value="duration">Duration</option>
            <option value="category">Category</option>
          </select>
        </div>
      </div>

      {/* Expandable Filters Section */}
      {showFilters && (
        <div style={filtersContainerStyles}>
          <div style={filtersSectionStyles}>
            <FilterControls
              onCategoryFilter={onCategoryFilter}
              onTagFilter={handleTagFilter}
              selectedCategory={selectedCategory}
              selectedTags={selectedTags}
              showExpanded={isFiltersExpanded}
            />
          </div>
        </div>
      )}

      {/* Results Summary */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: '8px',
        fontSize: '14px',
        color: '#666',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span>
            {searchQuery && `Results for "${searchQuery}"`}
            {selectedCategory && ` in ${selectedCategory}`}
            {selectedTags.length > 0 && ` with tags: ${selectedTags.join(', ')}`}
          </span>
        </div>
        
        {/* Quick Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px' }}>
          {(searchQuery || selectedCategory || selectedTags.length > 0) && (
            <button
              onClick={() => {
                onSearch('');
                onCategoryFilter(null);
                setSelectedTags([]);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#e74c3c',
                cursor: 'pointer',
                textDecoration: 'underline',
                fontSize: '12px',
              }}
            >
              Clear all filters
            </button>
          )}
          
          <span style={{ opacity: 0.7 }}>
            Press ESC to clear search
          </span>
        </div>
      </div>
    </div>
  );
};