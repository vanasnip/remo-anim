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
  // Additional mock videos for performance testing
  {
    id: 'linear-algebra-vectors',
    filename: 'VectorOperations.mp4',
    title: 'Linear Algebra: Vector Operations',
    description: 'Comprehensive visualization of vector addition, subtraction, and scalar multiplication in 2D and 3D space. Demonstrates vector properties with interactive animations.',
    category: ManimCategory.ALGEBRA,
    tags: ['vector', 'linear-algebra', '3d', 'operations', 'mathematics'],
    duration: 240,
    dimensions: { width: 1920, height: 1080 },
    createdAt: new Date('2025-09-01T14:30:00Z'),
    manimScript: 'vector_operations.py',
    parameters: { dimension: '3d', showGrid: true },
  },
  {
    id: 'calculus-derivatives',
    filename: 'DerivativeVisualization.mp4',
    title: 'Calculus: Derivative Visualization',
    description: 'Interactive exploration of derivatives showing the relationship between functions and their rates of change. Features multiple examples with tangent lines.',
    category: ManimCategory.CALCULUS,
    tags: ['calculus', 'derivative', 'tangent', 'rate-of-change', 'function'],
    duration: 300,
    dimensions: { width: 1920, height: 1080 },
    createdAt: new Date('2025-09-03T10:15:00Z'),
    manimScript: 'derivatives.py',
    parameters: { showTangents: true, animationSpeed: 'medium' },
  },
  {
    id: 'physics-pendulum',
    filename: 'PendulumMotion.mp4',
    title: 'Physics: Simple Pendulum Motion',
    description: 'Detailed animation of simple harmonic motion using a pendulum. Shows energy transformations between potential and kinetic energy.',
    category: ManimCategory.PHYSICS,
    tags: ['physics', 'pendulum', 'harmonic-motion', 'energy', 'oscillation'],
    duration: 200,
    dimensions: { width: 854, height: 480 },
    createdAt: new Date('2025-09-04T16:45:00Z'),
    manimScript: 'pendulum.py',
    parameters: { length: 2, gravity: 9.8, angle: 30 },
  },
  {
    id: 'geometry-pythagorean',
    filename: 'PythagoreanTheorem.mp4',
    title: 'Geometry: Pythagorean Theorem Proof',
    description: 'Visual proof of the Pythagorean theorem using square animations. Multiple proof methods including rearrangement and algebraic approaches.',
    category: ManimCategory.GEOMETRY,
    tags: ['geometry', 'pythagorean', 'theorem', 'proof', 'triangle'],
    duration: 280,
    dimensions: { width: 1920, height: 1080 },
    createdAt: new Date('2025-09-05T09:20:00Z'),
    manimScript: 'pythagorean.py',
    parameters: { proofMethod: 'visual', showSteps: true },
  },
  {
    id: 'trigonometry-unit-circle',
    filename: 'UnitCircleAnimation.mp4',
    title: 'Unit Circle and Trigonometric Functions',
    description: 'Interactive unit circle showing how sine, cosine, and tangent functions are derived. Includes angle measurements in degrees and radians.',
    category: ManimCategory.TRIGONOMETRY,
    tags: ['trigonometry', 'unit-circle', 'sine', 'cosine', 'radians'],
    duration: 350,
    dimensions: { width: 1920, height: 1080 },
    createdAt: new Date('2025-09-06T11:30:00Z'),
    manimScript: 'unit_circle.py',
    parameters: { showRadians: true, speed: 'slow' },
  },
  {
    id: 'algebra-quadratic',
    filename: 'QuadraticFunctions.mp4',
    title: 'Quadratic Functions and Parabolas',
    description: 'Comprehensive exploration of quadratic functions, their graphs, and transformations. Shows vertex form, standard form, and factored form.',
    category: ManimCategory.ALGEBRA,
    tags: ['algebra', 'quadratic', 'parabola', 'vertex', 'transformation'],
    duration: 260,
    dimensions: { width: 854, height: 480 },
    createdAt: new Date('2025-09-07T13:15:00Z'),
    manimScript: 'quadratic.py',
    parameters: { showVertex: true, includeRoots: true },
  },
  {
    id: 'calculus-integration',
    filename: 'IntegrationMethods.mp4',
    title: 'Integration: Area Under Curves',
    description: 'Visual explanation of definite integrals as areas under curves. Shows Riemann sums and their convergence to exact integral values.',
    category: ManimCategory.CALCULUS,
    tags: ['calculus', 'integration', 'riemann-sums', 'area', 'definite-integral'],
    duration: 320,
    dimensions: { width: 1920, height: 1080 },
    createdAt: new Date('2025-09-08T15:45:00Z'),
    manimScript: 'integration.py',
    parameters: { showRiemannSums: true, subdivisions: 100 },
  },
  {
    id: 'physics-waves',
    filename: 'WaveInterference.mp4',
    title: 'Physics: Wave Interference Patterns',
    description: 'Simulation of wave interference showing constructive and destructive interference. Includes standing wave patterns and beat frequencies.',
    category: ManimCategory.PHYSICS,
    tags: ['physics', 'waves', 'interference', 'standing-waves', 'frequency'],
    duration: 180,
    dimensions: { width: 1920, height: 1080 },
    createdAt: new Date('2025-09-09T08:30:00Z'),
    manimScript: 'wave_interference.py',
    parameters: { frequency1: 440, frequency2: 445, amplitude: 1 },
  },
  {
    id: 'geometry-fractals',
    filename: 'FractalGeometry.mp4',
    title: 'Fractal Geometry: Mandelbrot Set',
    description: 'Exploration of fractal geometry through the Mandelbrot set. Shows zooming into the fractal with beautiful color patterns and self-similarity.',
    category: ManimCategory.GEOMETRY,
    tags: ['geometry', 'fractals', 'mandelbrot', 'complex-numbers', 'iteration'],
    duration: 400,
    dimensions: { width: 1920, height: 1080 },
    createdAt: new Date('2025-09-10T12:00:00Z'),
    manimScript: 'fractals.py',
    parameters: { maxIterations: 100, zoomLevel: 1000 },
  },
  {
    id: 'algebra-matrices',
    filename: 'MatrixTransformations.mp4',
    title: 'Linear Transformations with Matrices',
    description: 'Visual representation of linear transformations using matrices. Shows rotation, scaling, reflection, and shearing transformations in 2D.',
    category: ManimCategory.ALGEBRA,
    tags: ['algebra', 'matrices', 'linear-transformation', 'rotation', 'scaling'],
    duration: 290,
    dimensions: { width: 854, height: 480 },
    createdAt: new Date('2025-09-11T14:20:00Z'),
    manimScript: 'matrix_transformations.py',
    parameters: { showGrid: true, includeEigenvectors: true },
  },
  {
    id: 'trigonometry-identities',
    filename: 'TrigonometricIdentities.mp4',
    title: 'Trigonometric Identities Visualization',
    description: 'Interactive proof and visualization of key trigonometric identities. Includes Pythagorean, sum, and double angle identities.',
    category: ManimCategory.TRIGONOMETRY,
    tags: ['trigonometry', 'identities', 'pythagorean', 'double-angle', 'proof'],
    duration: 310,
    dimensions: { width: 1920, height: 1080 },
    createdAt: new Date('2025-09-12T10:10:00Z'),
    manimScript: 'trig_identities.py',
    parameters: { showProofs: true, animateSteps: true },
  },
  {
    id: 'calculus-limits',
    filename: 'LimitsConcept.mp4',
    title: 'Calculus: Understanding Limits',
    description: 'Conceptual introduction to limits in calculus. Shows graphical approaches to limits and their relationship to continuity.',
    category: ManimCategory.CALCULUS,
    tags: ['calculus', 'limits', 'continuity', 'graphical', 'approach'],
    duration: 220,
    dimensions: { width: 854, height: 480 },
    createdAt: new Date('2025-08-30T16:45:00Z'),
    manimScript: 'limits.py',
    parameters: { showTable: true, epsilon: 0.1 },
  },
  {
    id: 'physics-projectile',
    filename: 'ProjectileMotion.mp4',
    title: 'Physics: Projectile Motion Analysis',
    description: 'Complete analysis of projectile motion with velocity vectors, trajectory paths, and optimal launch angles for maximum range.',
    category: ManimCategory.PHYSICS,
    tags: ['physics', 'projectile', 'motion', 'trajectory', 'vectors'],
    duration: 270,
    dimensions: { width: 1920, height: 1080 },
    createdAt: new Date('2025-08-29T11:30:00Z'),
    manimScript: 'projectile.py',
    parameters: { angle: 45, velocity: 20, gravity: 9.8 },
  },
  {
    id: 'geometry-polyhedra',
    filename: 'PlatonicSolids.mp4',
    title: 'Platonic Solids in 3D Space',
    description: '3D visualization of all five Platonic solids with rotation animations. Explores their symmetries and mathematical properties.',
    category: ManimCategory.GEOMETRY,
    tags: ['geometry', '3d', 'platonic-solids', 'polyhedra', 'symmetry'],
    duration: 380,
    dimensions: { width: 1920, height: 1080 },
    createdAt: new Date('2025-08-28T09:15:00Z'),
    manimScript: 'platonic_solids.py',
    parameters: { rotationSpeed: 'medium', showWireframe: false },
  },
  {
    id: 'algebra-complex-numbers',
    filename: 'ComplexNumbers.mp4',
    title: 'Complex Numbers and the Complex Plane',
    description: 'Introduction to complex numbers with visualization in the complex plane. Shows arithmetic operations and geometric interpretations.',
    category: ManimCategory.ALGEBRA,
    tags: ['algebra', 'complex-numbers', 'complex-plane', 'arithmetic', 'geometry'],
    duration: 330,
    dimensions: { width: 854, height: 480 },
    createdAt: new Date('2025-08-27T13:45:00Z'),
    manimScript: 'complex_numbers.py',
    parameters: { showPolar: true, includeOperations: true },
  },
  {
    id: 'calculus-chain-rule',
    filename: 'ChainRuleVisualization.mp4',
    title: 'Chain Rule for Composite Functions',
    description: 'Step-by-step visualization of the chain rule in calculus. Shows how to differentiate composite functions with multiple examples.',
    category: ManimCategory.CALCULUS,
    tags: ['calculus', 'chain-rule', 'composite-functions', 'differentiation', 'examples'],
    duration: 250,
    dimensions: { width: 1920, height: 1080 },
    createdAt: new Date('2025-08-26T15:20:00Z'),
    manimScript: 'chain_rule.py',
    parameters: { showSteps: true, includeExamples: 3 },
  },
  {
    id: 'physics-electromagnetic',
    filename: 'ElectromagneticFields.mp4',
    title: 'Electromagnetic Field Visualization',
    description: 'Visualization of electric and magnetic fields around charged particles and current-carrying wires. Shows field line patterns.',
    category: ManimCategory.PHYSICS,
    tags: ['physics', 'electromagnetic', 'electric-field', 'magnetic-field', 'charges'],
    duration: 360,
    dimensions: { width: 1920, height: 1080 },
    createdAt: new Date('2025-08-25T12:00:00Z'),
    manimScript: 'electromagnetic.py',
    parameters: { showFieldLines: true, charge: 1, current: 2 },
  },
  {
    id: 'geometry-tessellations',
    filename: 'GeometricTessellations.mp4',
    title: 'Geometric Tessellations and Patterns',
    description: 'Exploration of geometric tessellations including regular, semi-regular, and irregular patterns. Shows how shapes tile the plane.',
    category: ManimCategory.GEOMETRY,
    tags: ['geometry', 'tessellations', 'patterns', 'tiling', 'regular'],
    duration: 340,
    dimensions: { width: 854, height: 480 },
    createdAt: new Date('2025-08-24T10:30:00Z'),
    manimScript: 'tessellations.py',
    parameters: { patternType: 'hexagonal', showConstruction: true },
  },
  {
    id: 'statistics-distributions',
    filename: 'ProbabilityDistributions.mp4',
    title: 'Probability Distributions Visualization',
    description: 'Interactive visualization of common probability distributions including normal, binomial, and Poisson distributions with parameter effects.',
    category: ManimCategory.GENERAL,
    tags: ['statistics', 'probability', 'distributions', 'normal', 'binomial'],
    duration: 300,
    dimensions: { width: 1920, height: 1080 },
    createdAt: new Date('2025-08-23T14:45:00Z'),
    manimScript: 'distributions.py',
    parameters: { showParameters: true, includeExamples: true },
  },
  {
    id: 'number-theory-primes',
    filename: 'PrimeNumberSpiral.mp4',
    title: 'Prime Numbers and Ulam Spiral',
    description: 'Visualization of prime numbers using the Ulam spiral. Shows interesting patterns and gaps in prime number distribution.',
    category: ManimCategory.GENERAL,
    tags: ['number-theory', 'primes', 'ulam-spiral', 'patterns', 'mathematics'],
    duration: 280,
    dimensions: { width: 854, height: 480 },
    createdAt: new Date('2025-08-22T11:15:00Z'),
    manimScript: 'prime_spiral.py',
    parameters: { spiralSize: 1000, highlightPrimes: true },
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