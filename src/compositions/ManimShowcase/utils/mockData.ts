import { ManimVideo, ManimCategory } from '../types';

/**
 * Mock metadata for Manim videos based on existing assets
 * This simulates what would be loaded from /public/assets/manim/index.json
 * or generated from video analysis
 */
export const mockManimVideos: ManimVideo[] = [
  {
    id: 'sine-wave-animation',
    filename: 'SineWaveAnimation_480p15_20250902_220341.mp4',
    title: 'Sine Wave Animation',
    description: 'A beautiful visualization of sine wave functions showing periodic motion and amplitude variations. Perfect for trigonometry lessons and wave physics demonstrations.',
    category: ManimCategory.TRIGONOMETRY,
    tags: ['sine', 'wave', 'trigonometry', 'periodic', 'function', 'animation'],
    duration: 450, // 15 seconds at 30fps
    dimensions: {
      width: 480,
      height: 270,
    },
    createdAt: new Date('2025-09-02T22:03:41Z'),
    manimScript: 'sine_wave_demo.py',
    parameters: {
      amplitude: 1,
      frequency: 1,
      phase: 0,
      color: '#3498db',
    },
  },
  {
    id: 'circle-area-demo',
    filename: 'CircleAreaDemo_480p15_20250902_222354.mp4',
    title: 'Circle Area Calculation',
    description: 'Interactive demonstration of how circle area is calculated using the formula πr². Shows the relationship between radius and area with dynamic visualization.',
    category: ManimCategory.GEOMETRY,
    tags: ['circle', 'area', 'geometry', 'radius', 'pi', 'formula'],
    duration: 600, // 20 seconds at 30fps  
    dimensions: {
      width: 480,
      height: 270,
    },
    createdAt: new Date('2025-09-02T22:23:54Z'),
    manimScript: 'circle_area_animation.py',
    parameters: {
      radius: 2,
      color: '#e74c3c',
      showFormula: true,
      animationSpeed: 'normal',
    },
  },
  {
    id: 'test-animation',
    filename: 'TestAnimation.mp4',
    title: 'Basic Geometric Shapes',
    description: 'Introduction to fundamental geometric shapes and their properties. Features squares, circles, triangles with smooth transformations and color transitions.',
    category: ManimCategory.GEOMETRY,
    tags: ['shapes', 'geometry', 'basic', 'introduction', 'transformations'],
    duration: 360, // 12 seconds at 30fps
    dimensions: {
      width: 480,
      height: 270,
    },
    createdAt: new Date('2025-09-02T22:02:32Z'),
    manimScript: 'basic_shapes.py',
    parameters: {
      shapeCount: 3,
      transitionSpeed: 'medium',
      colors: ['#3498db', '#e74c3c', '#2ecc71'],
    },
  },
  {
    id: 'test-animation-alt',
    filename: 'TestAnimation_480p15_20250902_220232.mp4',
    title: 'Advanced Shape Morphing',
    description: 'Advanced demonstration of shape morphing and geometric transformations. Shows complex animations between different polygon types with mathematical precision.',
    category: ManimCategory.ALGEBRA,
    tags: ['morphing', 'transformations', 'advanced', 'polygons', 'algebra'],
    duration: 360, // 12 seconds at 30fps
    dimensions: {
      width: 480,
      height: 270,
    },
    createdAt: new Date('2025-09-02T22:02:32Z'),
    manimScript: 'advanced_morphing.py',
    parameters: {
      morphSteps: 10,
      interpolationMethod: 'smooth',
      symmetry: true,
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