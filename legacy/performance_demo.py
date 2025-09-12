#!/usr/bin/env python3
"""Performance demonstration script for async video processing pipeline"""

import asyncio
import tempfile
import time
from pathlib import Path

from manim_bridge.processing import (
    PerformancePipeline,
    PipelineConfig,
    VideoProcessor
)


def create_demo_video_file(tmp_dir: Path, name: str, size_mb: int = 1) -> Path:
    """Create a demo video file for testing"""
    video_path = tmp_dir / f"{name}.mp4"

    # Create mock MP4 header + content
    mp4_header = b"\x00\x00\x00\x18ftypmp42"
    content = mp4_header + b"0" * (size_mb * 1024 * 1024 - len(mp4_header))

    video_path.write_bytes(content)
    return video_path


def create_demo_videos(count: int = 10) -> list:
    """Create demo video files for performance testing"""
    tmp_dir = Path(tempfile.mkdtemp(prefix="performance_demo_"))
    print(f"Creating {count} demo video files in {tmp_dir}")

    videos = []
    for i in range(count):
        video = create_demo_video_file(tmp_dir, f"demo_video_{i:02d}", size_mb=1)
        videos.append(video)

    return videos, tmp_dir


async def benchmark_async_pipeline():
    """Benchmark the async performance pipeline"""
    print("=" * 60)
    print("ASYNC VIDEO PROCESSING PIPELINE PERFORMANCE DEMO")
    print("=" * 60)

    # Create demo videos
    video_files, tmp_dir = create_demo_videos(10)
    print(f"Created {len(video_files)} demo video files")

    try:
        # Configure high-performance pipeline
        config = PipelineConfig(
            max_concurrent_videos=8,
            max_metadata_workers=8,
            ffprobe_timeout=1.0,
            enable_parallel_hashing=True,
            enable_metadata_caching=True,
            enable_monitoring=True
        )

        # Test with performance pipeline
        print("\n--- Performance Pipeline (Optimized) ---")
        with PerformancePipeline(config) as pipeline:
            start_time = time.perf_counter()

            results, stats = await pipeline.process_video_batch_async(video_files)

            end_time = time.perf_counter()
            processing_time = end_time - start_time

            successful = sum(1 for r in results if r.success)
            throughput = len(video_files) / (processing_time / 60)  # videos per minute

            print(f"Processed {successful}/{len(video_files)} videos")
            print(f"Total time: {processing_time:.2f} seconds")
            print(f"Throughput: {throughput:.1f} videos/minute")
            print(f"Average time per video: {processing_time/len(video_files):.3f}s")

            # Show performance stats
            report = pipeline.get_performance_report()
            print(f"Cache hit rate: {stats.cache_hit_rate:.1f}%")
            print(f"Performance improvement factor: {stats.performance_improvement_factor:.1f}x")

        # Test with traditional synchronous processing for comparison
        print("\n--- Traditional Processing (Baseline) ---")
        processor = VideoProcessor(enable_logging=False)

        start_time = time.perf_counter()

        sync_results = []
        for video_path in video_files:
            try:
                metadata = processor.extract_metadata(video_path)
                sync_results.append(True)
            except Exception as e:
                sync_results.append(False)
                print(f"Error processing {video_path.name}: {e}")

        sync_end_time = time.perf_counter()
        sync_processing_time = sync_end_time - start_time

        sync_successful = sum(sync_results)
        sync_throughput = len(video_files) / (sync_processing_time / 60)

        print(f"Processed {sync_successful}/{len(video_files)} videos")
        print(f"Total time: {sync_processing_time:.2f} seconds")
        print(f"Throughput: {sync_throughput:.1f} videos/minute")
        print(f"Average time per video: {sync_processing_time/len(video_files):.3f}s")

        # Calculate improvement
        if sync_processing_time > 0:
            improvement_factor = sync_processing_time / processing_time
            throughput_improvement = throughput / sync_throughput

            print("\n--- Performance Comparison ---")
            print(f"Processing time improvement: {improvement_factor:.1f}x faster")
            print(f"Throughput improvement: {throughput_improvement:.1f}x higher")

            if improvement_factor >= 1.8:  # Close to 2x target
                print("✅ TARGET ACHIEVED: ~2x performance improvement!")
            elif improvement_factor >= 1.5:
                print("🟡 GOOD IMPROVEMENT: 1.5x+ performance gain")
            else:
                print("🔴 Improvement below target, needs optimization")

        # Run benchmark for more detailed analysis
        print("\n--- Running Performance Benchmark ---")
        with PerformancePipeline(config) as pipeline:
            benchmark_results = await pipeline.benchmark_performance_async(
                video_files[:5],  # Use subset for benchmark
                iterations=3
            )

            print(f"Average benchmark throughput: {benchmark_results['average_throughput']:.1f} videos/min")
            print(f"Estimated improvement over baseline: {benchmark_results['estimated_improvement_factor']:.1f}x")

    finally:
        # Cleanup
        import shutil
        try:
            shutil.rmtree(tmp_dir)
            print(f"\nCleaned up demo files from {tmp_dir}")
        except Exception as e:
            print(f"Warning: Could not clean up {tmp_dir}: {e}")


def main():
    """Main demo function"""
    print("Starting Async Video Processing Performance Demo")
    print("This demonstrates the 2x performance improvement target for Workstream 4")

    try:
        asyncio.run(benchmark_async_pipeline())
    except KeyboardInterrupt:
        print("\nDemo interrupted by user")
    except Exception as e:
        print(f"Demo error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
