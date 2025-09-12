import { ManimVideo, ManimCategory } from '../types';

/**
 * Mock metadata for Manim videos based on existing assets
 * This simulates what would be loaded from /public/assets/manim/index.json
 * or generated from video analysis
 */
export const mockManimVideos: ManimVideo[] = [
  {
    id: 'sine-wave-animation',
    filename: 'SineWaveAnimation.mp4',
    title: 'Sine & Cosine Wave Transformation',
    description: 'Beautiful visualization of sine and cosine wave functions with smooth transformations. Shows the relationship between sin(2x) and cos(2x) with animated transitions. Perfect for understanding trigonometric functions and their periodic nature.',
    category: ManimCategory.TRIGONOMETRY,
    tags: ['sine', 'cosine', 'wave', 'trigonometry', 'periodic', 'function', 'transformation'],
    duration: 120, // ~4 seconds at 30fps (actual video duration)
    dimensions: {
      width: 854,
      height: 480,
    },
    createdAt: new Date('2025-09-02T22:03:41Z'),
    manimScript: 'sine_wave.py',
    parameters: {
      amplitude: 1,
      frequency: 2,
      phase: 0,
      color: '#FFFF00',
    },
  },
  {
    id: 'circle-area-demo',
    filename: 'CircleAreaDemo.mp4',
    title: 'Circle Area Formula Visualization',
    description: 'Interactive demonstration of the circle area formula A = πr². Shows a blue circle with radius visualization, formula derivation, and a 360° rotation to emphasize the circular nature. Includes calculated area value for r=2.',
    category: ManimCategory.GEOMETRY,
    tags: ['circle', 'area', 'geometry', 'radius', 'pi', 'formula', 'rotation'],
    duration: 180, // ~6 seconds at 30fps (actual video duration)
    dimensions: {
      width: 854,
      height: 480,
    },
    createdAt: new Date('2025-09-02T22:23:54Z'),
    manimScript: 'circle_area.py',
    parameters: {
      radius: 2,
      color: '#0000FF',
      showFormula: true,
      animationSpeed: 'normal',
    },
  },
  {
    id: 'test-animation',
    filename: 'TestAnimation.mp4',
    title: 'Basic Animation Test',
    description: 'Simple test animation showcasing basic Manim capabilities. Features fundamental shapes and transformations to verify the animation pipeline is working correctly.',
    category: ManimCategory.GENERAL,
    tags: ['test', 'basic', 'shapes', 'animation', 'demo'],
    duration: 90, // ~3 seconds at 30fps (actual video duration)
    dimensions: {
      width: 854,
      height: 480,
    },
    createdAt: new Date('2025-09-02T21:58:32Z'),
    manimScript: 'test_animation.py',
    parameters: {
      testMode: true,
      duration: 'short',
    },
  },
];

/**
 * Get mock videos by category
 */
export const getVideosByCategory = (category: ManimCategory): ManimVideo[] => {
  return mockManimVideos.filter(video => video.category === category);
};

/**
 * Search videos by title, description, or tags
 */
export const searchVideos = (query: string, videos: ManimVideo[] = mockManimVideos): ManimVideo[] => {
  if (!query.trim()) return videos;
  
  const lowercaseQuery = query.toLowerCase();
  return videos.filter(video => 
    video.title.toLowerCase().includes(lowercaseQuery) ||
    video.description.toLowerCase().includes(lowercaseQuery) ||
    video.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery))
  );
};

/**
 * Get all unique categories from videos
 */
export const getAvailableCategories = (): ManimCategory[] => {
  return Array.from(new Set(mockManimVideos.map(video => video.category)));
};

/**
 * Get all unique tags from videos
 */
export const getAvailableTags = (): string[] => {
  const allTags = mockManimVideos.flatMap(video => video.tags);
  return Array.from(new Set(allTags)).sort();
};