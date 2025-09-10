import React, { useState } from 'react';
import { spring, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { ManimCategory } from '../types';
import { getAvailableCategories, getAvailableTags } from '../utils/mockData';

interface FilterControlsProps {
  onCategoryFilter: (category: ManimCategory | null) => void;
  onTagFilter: (tags: string[]) => void;
  selectedCategory: ManimCategory | null;
  selectedTags: string[];
  showExpanded?: boolean;
}

/**
 * FilterControls component - Category and tag filtering with smooth animations
 * 
 * Features:
 * - Category filter buttons with color coding
 * - Tag filter chips with multi-select
 * - Smooth animations and hover effects
 * - Clear filters functionality
 * - Responsive design with collapsible tag section
 */
export const FilterControls: React.FC<FilterControlsProps> = ({
  onCategoryFilter,
  onTagFilter,
  selectedCategory,
  selectedTags,
  showExpanded = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const [isTagsExpanded, setIsTagsExpanded] = useState(showExpanded);
  const availableCategories = getAvailableCategories();
  const availableTags = getAvailableTags();

  // Animation values
  const tagsHeight = spring({
    frame,
    fps,
    from: 0,
    to: isTagsExpanded ? 80 : 0,
    durationInFrames: 20,
  });

  const tagsOpacity = spring({
    frame,
    fps,
    from: 0,
    to: isTagsExpanded ? 1 : 0,
    durationInFrames: 15,
  });

  // Category colors matching VideoCard
  const categoryColors: Record<ManimCategory, string> = {
    [ManimCategory.GEOMETRY]: '#3498db',
    [ManimCategory.ALGEBRA]: '#e74c3c', 
    [ManimCategory.CALCULUS]: '#2ecc71',
    [ManimCategory.TRIGONOMETRY]: '#9b59b6',
    [ManimCategory.PHYSICS]: '#f39c12',
    [ManimCategory.GENERAL]: '#95a5a6',
  };

  const containerStyles: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    width: '100%',
  };

  const sectionStyles: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  };

  const labelStyles: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: '600',
    color: '#333',
    marginBottom: '4px',
  };

  const filterRowStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  };

  // Category filter button
  const getCategoryButtonStyles = (category: ManimCategory): React.CSSProperties => {
    const isSelected = selectedCategory === category;
    const color = categoryColors[category];
    
    return {
      padding: '8px 16px',
      borderRadius: '20px',
      border: `2px solid ${color}`,
      backgroundColor: isSelected ? color : 'transparent',
      color: isSelected ? 'white' : color,
      fontSize: '13px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      textTransform: 'capitalize',
      whiteSpace: 'nowrap',
    };
  };

  // Tag filter chip
  const getTagChipStyles = (tag: string): React.CSSProperties => {
    const isSelected = selectedTags.includes(tag);
    
    return {
      padding: '6px 12px',
      borderRadius: '16px',
      border: '1px solid #ddd',
      backgroundColor: isSelected ? '#1976d2' : '#f8f9fa',
      color: isSelected ? 'white' : '#666',
      fontSize: '12px',
      fontWeight: '500',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      whiteSpace: 'nowrap',
    };
  };

  const handleCategoryClick = (category: ManimCategory) => {
    // Toggle category - if already selected, clear it
    onCategoryFilter(selectedCategory === category ? null : category);
  };

  const handleTagClick = (tag: string) => {
    const newTags = selectedTags.includes(tag)
      ? selectedTags.filter(t => t !== tag)
      : [...selectedTags, tag];
    onTagFilter(newTags);
  };

  const handleClearFilters = () => {
    onCategoryFilter(null);
    onTagFilter([]);
  };

  const hasActiveFilters = selectedCategory !== null || selectedTags.length > 0;

  return (
    <div style={containerStyles}>
      {/* Categories Section */}
      <div style={sectionStyles}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <label style={labelStyles}>Categories</label>
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              style={{
                background: 'none',
                border: 'none',
                color: '#e74c3c',
                fontSize: '12px',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Clear all
            </button>
          )}
        </div>
        
        <div style={filterRowStyles}>
          {/* All Categories button */}
          <button
            onClick={() => onCategoryFilter(null)}
            style={{
              padding: '8px 16px',
              borderRadius: '20px',
              border: '2px solid #666',
              backgroundColor: selectedCategory === null ? '#666' : 'transparent',
              color: selectedCategory === null ? 'white' : '#666',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              if (selectedCategory !== null) {
                (e.target as HTMLElement).style.backgroundColor = '#f5f5f5';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedCategory !== null) {
                (e.target as HTMLElement).style.backgroundColor = 'transparent';
              }
            }}
          >
            All
          </button>

          {availableCategories.map(category => (
            <button
              key={category}
              onClick={() => handleCategoryClick(category)}
              style={getCategoryButtonStyles(category)}
              onMouseEnter={(e) => {
                if (selectedCategory !== category) {
                  (e.target as HTMLElement).style.backgroundColor = `${categoryColors[category]}20`;
                }
              }}
              onMouseLeave={(e) => {
                if (selectedCategory !== category) {
                  (e.target as HTMLElement).style.backgroundColor = 'transparent';
                }
              }}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Tags Section */}
      <div style={sectionStyles}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <label style={labelStyles}>
            Tags {selectedTags.length > 0 && (
              <span style={{ color: '#1976d2', fontSize: '12px' }}>
                ({selectedTags.length} selected)
              </span>
            )}
          </label>
          <button
            onClick={() => setIsTagsExpanded(!isTagsExpanded)}
            style={{
              background: 'none',
              border: 'none',
              color: '#1976d2',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            {isTagsExpanded ? 'Show less' : 'Show more'}
            <span style={{
              transform: `rotate(${isTagsExpanded ? 180 : 0}deg)`,
              transition: 'transform 0.2s ease',
            }}>
              ▼
            </span>
          </button>
        </div>

        {/* Tag pills - always show popular ones */}
        <div style={filterRowStyles}>
          {availableTags.slice(0, 6).map(tag => (
            <button
              key={tag}
              onClick={() => handleTagClick(tag)}
              style={getTagChipStyles(tag)}
              onMouseEnter={(e) => {
                if (!selectedTags.includes(tag)) {
                  (e.target as HTMLElement).style.backgroundColor = '#e3f2fd';
                }
              }}
              onMouseLeave={(e) => {
                if (!selectedTags.includes(tag)) {
                  (e.target as HTMLElement).style.backgroundColor = '#f8f9fa';
                }
              }}
            >
              #{tag}
            </button>
          ))}
        </div>

        {/* Expanded tags section */}
        <div style={{
          height: `${tagsHeight}px`,
          opacity: tagsOpacity,
          overflow: 'hidden',
          transition: 'all 0.3s ease',
        }}>
          <div style={{
            ...filterRowStyles,
            paddingTop: '8px',
            borderTop: '1px solid #eee',
          }}>
            {availableTags.slice(6).map(tag => (
              <button
                key={tag}
                onClick={() => handleTagClick(tag)}
                style={getTagChipStyles(tag)}
                onMouseEnter={(e) => {
                  if (!selectedTags.includes(tag)) {
                    (e.target as HTMLElement).style.backgroundColor = '#e3f2fd';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!selectedTags.includes(tag)) {
                    (e.target as HTMLElement).style.backgroundColor = '#f8f9fa';
                  }
                }}
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Active filters summary */}
      {hasActiveFilters && (
        <div style={{
          padding: '12px',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          fontSize: '12px',
          color: '#666',
          border: '1px solid #e0e0e0',
        }}>
          <div style={{ fontWeight: '600', marginBottom: '4px' }}>
            Active Filters:
          </div>
          {selectedCategory && (
            <div>Category: <span style={{ color: categoryColors[selectedCategory] }}>{selectedCategory}</span></div>
          )}
          {selectedTags.length > 0 && (
            <div>Tags: {selectedTags.map(tag => `#${tag}`).join(', ')}</div>
          )}
        </div>
      )}
    </div>
  );
};