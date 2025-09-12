/**
 * Performance Benchmark for ManimShowcase Gallery
 * Measures key performance metrics for Week 3 optimization baseline
 */

export interface PerformanceMetrics {
  loadTime: number;
  fps: number[];
  memoryUsage: number;
  renderTime: number;
  scrollPerformance: number;
  videoLoadTime: number[];
}

export class PerformanceBenchmark {
  private startTime: number = 0;
  private metrics: PerformanceMetrics = {
    loadTime: 0,
    fps: [],
    memoryUsage: 0,
    renderTime: 0,
    scrollPerformance: 0,
    videoLoadTime: [],
  };

  /**
   * Start measuring load time
   */
  startLoadTimer(): void {
    this.startTime = performance.now();
  }

  /**
   * End load time measurement
   */
  endLoadTimer(): void {
    this.metrics.loadTime = performance.now() - this.startTime;
  }

  /**
   * Measure FPS during scroll
   */
  measureFPS(callback?: () => void): void {
    let lastTime = performance.now();
    let frames = 0;
    const fpsValues: number[] = [];
    
    const measureFrame = () => {
      frames++;
      const currentTime = performance.now();
      const delta = currentTime - lastTime;
      
      if (delta >= 1000) {
        const fps = Math.round((frames * 1000) / delta);
        fpsValues.push(fps);
        this.metrics.fps.push(fps);
        frames = 0;
        lastTime = currentTime;
        
        // Stop after 5 seconds
        if (fpsValues.length >= 5) {
          if (callback) callback();
          return;
        }
      }
      
      requestAnimationFrame(measureFrame);
    };
    
    requestAnimationFrame(measureFrame);
  }

  /**
   * Measure memory usage
   */
  measureMemory(): void {
    if ('memory' in performance) {
      const memInfo = (performance as any).memory;
      this.metrics.memoryUsage = Math.round(memInfo.usedJSHeapSize / 1048576); // Convert to MB
    }
  }

  /**
   * Measure video load time
   */
  measureVideoLoad(videoUrl: string): Promise<number> {
    return new Promise((resolve) => {
      const startTime = performance.now();
      const video = document.createElement('video');
      
      video.onloadeddata = () => {
        const loadTime = performance.now() - startTime;
        this.metrics.videoLoadTime.push(loadTime);
        resolve(loadTime);
      };
      
      video.onerror = () => {
        resolve(-1); // Error loading
      };
      
      video.src = videoUrl;
      video.load();
    });
  }

  /**
   * Measure scroll performance
   */
  measureScrollPerformance(): void {
    let scrollCount = 0;
    let totalTime = 0;
    const startTime = performance.now();
    
    const handleScroll = () => {
      scrollCount++;
      if (scrollCount >= 10) {
        totalTime = performance.now() - startTime;
        this.metrics.scrollPerformance = totalTime / scrollCount;
        window.removeEventListener('scroll', handleScroll);
      }
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // Simulate scrolling
    setTimeout(() => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollCount > 0) {
        totalTime = performance.now() - startTime;
        this.metrics.scrollPerformance = totalTime / scrollCount;
      }
    }, 5000);
  }

  /**
   * Get average FPS
   */
  getAverageFPS(): number {
    if (this.metrics.fps.length === 0) return 0;
    const sum = this.metrics.fps.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.metrics.fps.length);
  }

  /**
   * Get performance report
   */
  getReport(): string {
    const avgFPS = this.getAverageFPS();
    const avgVideoLoad = this.metrics.videoLoadTime.length > 0
      ? Math.round(this.metrics.videoLoadTime.reduce((a, b) => a + b, 0) / this.metrics.videoLoadTime.length)
      : 0;
    
    return `
=== Performance Benchmark Report ===

📊 BASELINE METRICS (Before Optimization):

⏱️  Load Time: ${Math.round(this.metrics.loadTime)}ms
🎯  Average FPS: ${avgFPS} fps
💾  Memory Usage: ${this.metrics.memoryUsage} MB
🎬  Avg Video Load: ${avgVideoLoad}ms
📜  Scroll Performance: ${Math.round(this.metrics.scrollPerformance)}ms/event

🎯 OPTIMIZATION TARGETS (Week 3):
- Load Time: < ${Math.round(this.metrics.loadTime * 0.4)}ms (60% improvement)
- FPS: 60 fps sustained
- Memory: < 100MB for 20+ videos
- Video Load: < ${Math.round(avgVideoLoad * 0.5)}ms (50% improvement)

${this.getPerformanceGrade(avgFPS, this.metrics.loadTime, this.metrics.memoryUsage)}
    `;
  }

  /**
   * Get performance grade
   */
  private getPerformanceGrade(fps: number, loadTime: number, memory: number): string {
    let grade = '';
    
    if (fps >= 60 && loadTime < 2000 && memory < 100) {
      grade = '✅ EXCELLENT - Already meets targets!';
    } else if (fps >= 30 && loadTime < 3000 && memory < 200) {
      grade = '⚠️ GOOD - Minor optimizations needed';
    } else {
      grade = '🔴 NEEDS IMPROVEMENT - Significant optimization required';
    }
    
    return `\n📈 Current Grade: ${grade}`;
  }

  /**
   * Export metrics as JSON
   */
  exportMetrics(): string {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      metrics: this.metrics,
      averageFPS: this.getAverageFPS(),
      report: this.getReport(),
    }, null, 2);
  }
}

// Usage example for ManimShowcase Gallery
export const runGalleryBenchmark = async (): Promise<void> => {
  const benchmark = new PerformanceBenchmark();
  
  console.log('🚀 Starting ManimShowcase Gallery Performance Benchmark...');
  
  // Measure initial load
  benchmark.startLoadTimer();
  
  // Wait for component to mount
  await new Promise(resolve => setTimeout(resolve, 1000));
  benchmark.endLoadTimer();
  
  // Measure memory
  benchmark.measureMemory();
  
  // Measure FPS during interaction
  console.log('📊 Measuring FPS...');
  await new Promise<void>(resolve => {
    benchmark.measureFPS(() => resolve());
  });
  
  // Measure video loading
  console.log('🎬 Measuring video load times...');
  const videos = [
    '/assets/manim/CircleAreaDemo.mp4',
    '/assets/manim/SineWaveAnimation.mp4',
    '/assets/manim/TestAnimation.mp4',
  ];
  
  for (const video of videos) {
    await benchmark.measureVideoLoad(video);
  }
  
  // Measure scroll performance
  console.log('📜 Measuring scroll performance...');
  benchmark.measureScrollPerformance();
  
  // Wait for scroll measurement to complete
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Generate report
  console.log(benchmark.getReport());
  
  // Save to localStorage for tracking
  localStorage.setItem('performanceBenchmark', benchmark.exportMetrics());
  console.log('💾 Benchmark saved to localStorage');
};