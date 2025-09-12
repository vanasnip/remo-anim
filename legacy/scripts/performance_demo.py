#!/usr/bin/env python3
"""
Performance monitoring demonstration script.

This script demonstrates the performance monitoring capabilities of the
Manim-Remotion bridge project.
"""

import json
import tempfile
import time
from pathlib import Path

# Add the parent directory to the path so we can import from manim_bridge
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from manim_bridge.monitoring.performance_profiler import PerformanceProfiler, setup_profiler
from manim_bridge.storage.manifest_handler import ManifestHandler
from manim_bridge.processing.hash_calculator import HashCalculator
from manim_bridge.processing.video_processor import VideoProcessor


def demo_manifest_operations():
    """Demonstrate manifest operation performance monitoring"""
    print("📁 Demonstrating Manifest Operations Performance Monitoring...")

    with tempfile.TemporaryDirectory() as temp_dir:
        manifest_path = Path(temp_dir) / "demo_manifest.json"
        handler = ManifestHandler(manifest_path, enable_logging=True, enable_profiling=True)

        # Create some test data
        test_entries = {
            f"video_{i}.mp4": {
                "hash": f"hash_{i:08d}",
                "size": i * 1000 + 1024,
                "processed_at": "2025-01-01T00:00:00",
                "quality": "high" if i % 2 == 0 else "medium",
                "scene": f"Scene{i}",
                "duration": i * 0.5 + 1.0
            }
            for i in range(100)
        }

        # Write test data (monitored)
        handler.write(test_entries)
        print(f"✅ Wrote {len(test_entries)} entries to manifest")

        # Read data multiple times (monitored)
        for i in range(5):
            data = handler.read(use_cache=True)  # Cached reads
            data = handler.read(use_cache=False)  # Direct reads

        print("✅ Performed multiple read operations")

        # Batch update (monitored)
        updates = {f"new_video_{i}.mp4": {"hash": f"new_hash_{i}", "size": i * 500} for i in range(20)}
        handler.batch_update(updates)
        print(f"✅ Batch updated {len(updates)} entries")


def demo_hash_operations():
    """Demonstrate hash calculation performance monitoring"""
    print("🔐 Demonstrating Hash Calculation Performance Monitoring...")

    calculator = HashCalculator(enable_logging=True, enable_profiling=True)

    # Create test files of different sizes
    test_files = []
    sizes = [1024, 10*1024, 100*1024, 1024*1024]  # 1KB, 10KB, 100KB, 1MB

    for size in sizes:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".test") as tf:
            tf.write(b"A" * size)
            test_files.append(Path(tf.name))

    try:
        for test_file in test_files:
            file_size = test_file.stat().st_size
            print(f"🔍 Calculating hash for {file_size:,} byte file...")

            # Calculate SHA256 hash (monitored)
            sha256_hash = calculator.calculate_hash(test_file, "sha256")

            # Calculate MD5 hash (monitored)
            md5_hash = calculator.calculate_hash(test_file, "md5")

            print(f"  SHA256: {sha256_hash[:16]}...")
            print(f"  MD5:    {md5_hash[:16]}...")

    finally:
        # Clean up test files
        for test_file in test_files:
            try:
                test_file.unlink()
            except FileNotFoundError:
                pass

    print("✅ Hash calculations completed")


def demo_video_operations():
    """Demonstrate video processing performance monitoring"""
    print("🎬 Demonstrating Video Processing Performance Monitoring...")

    processor = VideoProcessor(enable_logging=True, enable_profiling=True)

    # Create mock video files
    test_videos = []
    sizes = [10*1024, 50*1024, 100*1024]  # 10KB, 50KB, 100KB

    for i, size in enumerate(sizes):
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tf:
            # Create minimal MP4 header
            mp4_header = b'\x00\x00\x00\x18ftypmp42'
            padding = b'\x00' * (size - len(mp4_header))
            tf.write(mp4_header + padding)
            test_videos.append(Path(tf.name))

    try:
        for i, test_video in enumerate(test_videos):
            file_size = test_video.stat().st_size
            print(f"🎥 Processing {file_size:,} byte video file...")

            # Validate video (monitored)
            is_valid = processor.validate_video(test_video)
            print(f"  Valid: {is_valid}")

            if is_valid:
                # Extract metadata (monitored)
                try:
                    metadata = processor.extract_metadata(test_video)
                    print(f"  Scene: {metadata.scene_name}")
                    print(f"  Quality: {metadata.quality}")
                    print(f"  Hash: {metadata.hash[:16]}...")
                except Exception as e:
                    print(f"  Metadata extraction failed: {e}")

    finally:
        # Clean up test videos
        for test_video in test_videos:
            try:
                test_video.unlink()
            except FileNotFoundError:
                pass

    print("✅ Video processing completed")


def demo_performance_report():
    """Generate and display performance report"""
    print("📊 Generating Performance Report...")

    profiler = setup_profiler(
        enable_memory_monitoring=True,
        enable_cpu_monitoring=True,
        enable_regression_detection=True
    )

    # Get performance report
    report = profiler.get_performance_report()

    print(f"\n📈 PERFORMANCE REPORT")
    print(f"{'='*50}")
    print(f"Total operations monitored: {report['total_operations']}")
    print(f"Active operations: {report['active_operations']}")
    print(f"Total alerts: {report['total_alerts']}")

    if report['operations']:
        print(f"\n🔍 OPERATION STATISTICS:")
        for operation, stats in report['operations'].items():
            if stats.get('sample_count', 0) > 0:
                duration_stats = stats.get('duration_stats', {})
                print(f"\n  {operation}:")
                print(f"    Samples: {stats['sample_count']}")
                print(f"    Success rate: {stats['success_rate']:.1f}%")
                if duration_stats:
                    print(f"    Mean: {duration_stats.get('mean', 0):.3f}s")
                    print(f"    Median: {duration_stats.get('median', 0):.3f}s")
                    print(f"    P95: {duration_stats.get('p95', 0):.3f}s")

                # Show baseline if available
                baseline = stats.get('baseline')
                if baseline:
                    print(f"    Baseline mean: {baseline.get('mean_duration', 0):.3f}s")
                    print(f"    Baseline samples: {baseline.get('sample_count', 0)}")

                # Show memory stats if available
                memory_stats = stats.get('memory_stats')
                if memory_stats:
                    print(f"    Avg memory delta: {memory_stats.get('mean_delta_mb', 0):.1f}MB")

                # Show CPU stats if available
                cpu_stats = stats.get('cpu_stats')
                if cpu_stats:
                    print(f"    Avg CPU usage: {cpu_stats.get('mean_percent', 0):.1f}%")

    # Show recent alerts
    if report.get('recent_alerts'):
        print(f"\n🚨 RECENT ALERTS:")
        for alert in report['recent_alerts'][:5]:  # Show last 5 alerts
            print(f"  • {alert['operation']}: {alert['regression_factor']:.1f}x slower than {alert['threshold_type']} baseline")

    print(f"\n{'='*50}")

    return report


def main():
    """Run the complete performance monitoring demonstration"""
    print("🚀 Performance Monitoring Demonstration")
    print("=" * 60)

    # Setup profiler with comprehensive monitoring
    profiler = setup_profiler(
        enable_memory_monitoring=True,
        enable_cpu_monitoring=True,
        enable_regression_detection=True,
        regression_threshold=1.3,  # 30% slower = regression
        baseline_sample_size=5,    # Small for demo
        enable_logging=True
    )

    # Clear any existing data
    profiler.reset_baselines()

    start_time = time.time()

    try:
        # Run demonstrations
        demo_manifest_operations()
        print()

        demo_hash_operations()
        print()

        demo_video_operations()
        print()

        # Generate final report
        report = demo_performance_report()

        total_time = time.time() - start_time
        print(f"\n✅ Demo completed in {total_time:.2f} seconds")

        # Save report to file
        demo_output = Path("performance_demo_report.json")
        with open(demo_output, 'w') as f:
            json.dump(report, f, indent=2, default=str)

        print(f"💾 Performance report saved to {demo_output}")

        # Export baseline metrics
        baseline_output = Path("performance_demo_baselines.json")
        profiler.export_baseline_metrics(baseline_output)
        print(f"💾 Baseline metrics saved to {baseline_output}")

    except Exception as e:
        print(f"❌ Demo failed: {e}")
        import traceback
        traceback.print_exc()
        return 1

    return 0


if __name__ == "__main__":
    exit(main())
