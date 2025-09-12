"""Comprehensive benchmark suite for performance monitoring and regression detection"""

import json
import tempfile
import time
from pathlib import Path
from typing import Dict, List, Optional
from unittest import TestCase

import pytest

from manim_bridge.monitoring.performance_profiler import PerformanceProfiler
from manim_bridge.processing.hash_calculator import HashCalculator
from manim_bridge.processing.video_processor import VideoProcessor
from manim_bridge.storage.manifest_handler import ManifestHandler


class PerformanceBenchmarkSuite:
    """Comprehensive benchmark suite for all performance-critical operations"""

    def __init__(self, profiler: Optional[PerformanceProfiler] = None):
        self.profiler = profiler or PerformanceProfiler(
            enable_memory_monitoring=True,
            enable_cpu_monitoring=True,
            enable_regression_detection=True,
            regression_threshold=1.5,
            baseline_sample_size=10,  # Lower for benchmarks
            enable_logging=True,
        )

        # Test data sizes for benchmarks
        self.test_file_sizes = [
            1024,           # 1KB
            1024 * 10,      # 10KB
            1024 * 100,     # 100KB
            1024 * 1024,    # 1MB
            1024 * 1024 * 10,  # 10MB - only if available
        ]

        # Manifest entry counts for testing
        self.manifest_entry_counts = [1, 10, 50, 100, 500]

    def create_test_file(self, size: int, content_pattern: str = "A") -> Path:
        """Create a test file of specified size"""
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".test")
        content = (content_pattern * (size // len(content_pattern) + 1))[:size]
        temp_file.write(content.encode())
        temp_file.close()
        return Path(temp_file.name)

    def create_test_video_file(self, size: int) -> Path:
        """Create a mock video file for testing"""
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4")

        # Create a minimal MP4 header
        mp4_header = b'\x00\x00\x00\x18ftypmp42'
        padding = b'\x00' * (size - len(mp4_header))
        temp_file.write(mp4_header + padding)
        temp_file.close()
        return Path(temp_file.name)

    def benchmark_manifest_operations(self) -> Dict:
        """Benchmark manifest read/write operations"""
        results = {
            "operation": "manifest_operations",
            "read_benchmarks": [],
            "write_benchmarks": [],
            "batch_operations": []
        }

        with tempfile.TemporaryDirectory() as temp_dir:
            manifest_path = Path(temp_dir) / "benchmark_manifest.json"
            handler = ManifestHandler(manifest_path, enable_profiling=True)

            # Benchmark writes with different entry counts
            for entry_count in self.manifest_entry_counts:
                # Create test data
                test_data = {
                    f"entry_{i}": {
                        "hash": f"hash_{i:06d}",
                        "size": i * 1000,
                        "processed_at": "2025-01-01T00:00:00",
                        "quality": "high" if i % 2 == 0 else "medium",
                        "metadata": {"scene": f"scene_{i}", "duration": i * 0.1}
                    }
                    for i in range(entry_count)
                }

                # Benchmark write operation
                start_time = time.perf_counter()
                with self.profiler.profile_operation(
                    "manifest_write_benchmark",
                    entry_count=entry_count
                ):
                    handler.write(test_data)
                write_duration = time.perf_counter() - start_time

                # Benchmark read operation (cached)
                start_time = time.perf_counter()
                with self.profiler.profile_operation(
                    "manifest_read_cached_benchmark",
                    entry_count=entry_count
                ):
                    data = handler.read(use_cache=True)
                read_cached_duration = time.perf_counter() - start_time

                # Invalidate cache and benchmark direct read
                handler._cache_valid = False
                start_time = time.perf_counter()
                with self.profiler.profile_operation(
                    "manifest_read_direct_benchmark",
                    entry_count=entry_count
                ):
                    data = handler.read(use_cache=False)
                read_direct_duration = time.perf_counter() - start_time

                results["write_benchmarks"].append({
                    "entry_count": entry_count,
                    "duration": write_duration,
                    "entries_per_second": entry_count / write_duration,
                })

                results["read_benchmarks"].append({
                    "entry_count": entry_count,
                    "cached_duration": read_cached_duration,
                    "direct_duration": read_direct_duration,
                    "cached_entries_per_second": entry_count / read_cached_duration if read_cached_duration > 0 else float('inf'),
                    "direct_entries_per_second": entry_count / read_direct_duration,
                })

                # Benchmark batch operations
                batch_updates = {
                    f"new_entry_{i}": {"hash": f"new_hash_{i}", "size": i * 500}
                    for i in range(min(50, entry_count))
                }

                start_time = time.perf_counter()
                with self.profiler.profile_operation(
                    "manifest_batch_update_benchmark",
                    update_count=len(batch_updates)
                ):
                    handler.batch_update(batch_updates)
                batch_duration = time.perf_counter() - start_time

                results["batch_operations"].append({
                    "base_entry_count": entry_count,
                    "batch_update_count": len(batch_updates),
                    "duration": batch_duration,
                    "updates_per_second": len(batch_updates) / batch_duration,
                })

        return results

    def benchmark_hash_calculations(self) -> Dict:
        """Benchmark hash calculation operations"""
        results = {
            "operation": "hash_calculations",
            "sha256_benchmarks": [],
            "md5_benchmarks": [],
            "algorithm_comparison": []
        }

        calculator = HashCalculator(enable_profiling=True)
        test_files = []

        try:
            # Create test files of different sizes
            for size in self.test_file_sizes:
                if size <= 1024 * 1024 * 5:  # Limit to 5MB for benchmarks
                    test_files.append(self.create_test_file(size))

            for test_file in test_files:
                file_size = test_file.stat().st_size

                # Benchmark SHA256
                start_time = time.perf_counter()
                with self.profiler.profile_operation(
                    "hash_sha256_benchmark",
                    file_size=file_size
                ):
                    sha256_hash = calculator.calculate_hash(test_file, "sha256")
                sha256_duration = time.perf_counter() - start_time

                # Benchmark MD5
                start_time = time.perf_counter()
                with self.profiler.profile_operation(
                    "hash_md5_benchmark",
                    file_size=file_size
                ):
                    md5_hash = calculator.calculate_hash(test_file, "md5")
                md5_duration = time.perf_counter() - start_time

                mb_per_sec_sha256 = (file_size / 1024 / 1024) / sha256_duration if sha256_duration > 0 else 0
                mb_per_sec_md5 = (file_size / 1024 / 1024) / md5_duration if md5_duration > 0 else 0

                results["sha256_benchmarks"].append({
                    "file_size_bytes": file_size,
                    "file_size_mb": file_size / 1024 / 1024,
                    "duration": sha256_duration,
                    "mb_per_second": mb_per_sec_sha256,
                    "hash": sha256_hash[:16] + "..."
                })

                results["md5_benchmarks"].append({
                    "file_size_bytes": file_size,
                    "file_size_mb": file_size / 1024 / 1024,
                    "duration": md5_duration,
                    "mb_per_second": mb_per_sec_md5,
                    "hash": md5_hash[:16] + "..."
                })

                results["algorithm_comparison"].append({
                    "file_size_bytes": file_size,
                    "sha256_duration": sha256_duration,
                    "md5_duration": md5_duration,
                    "speed_ratio": sha256_duration / md5_duration if md5_duration > 0 else 0,
                })

        finally:
            # Clean up test files
            for test_file in test_files:
                try:
                    test_file.unlink()
                except FileNotFoundError:
                    pass

        return results

    def benchmark_video_processing(self) -> Dict:
        """Benchmark video processing operations"""
        results = {
            "operation": "video_processing",
            "metadata_extraction": [],
            "validation_benchmarks": [],
        }

        processor = VideoProcessor(enable_profiling=True)
        test_video_files = []

        try:
            # Create test video files of different sizes
            video_sizes = [size for size in self.test_file_sizes if size <= 1024 * 1024]  # Max 1MB for video tests

            for size in video_sizes:
                test_video_files.append(self.create_test_video_file(size))

            for test_video in test_video_files:
                file_size = test_video.stat().st_size

                # Benchmark video validation
                start_time = time.perf_counter()
                with self.profiler.profile_operation(
                    "video_validation_benchmark",
                    file_size=file_size
                ):
                    is_valid = processor.validate_video(test_video)
                validation_duration = time.perf_counter() - start_time

                results["validation_benchmarks"].append({
                    "file_size_bytes": file_size,
                    "duration": validation_duration,
                    "is_valid": is_valid,
                    "files_per_second": 1 / validation_duration if validation_duration > 0 else 0
                })

                if is_valid:
                    # Benchmark metadata extraction
                    start_time = time.perf_counter()
                    with self.profiler.profile_operation(
                        "video_metadata_benchmark",
                        file_size=file_size
                    ):
                        try:
                            metadata = processor.extract_metadata(test_video)
                            extraction_success = True
                        except Exception as e:
                            extraction_success = False
                            metadata = None

                    extraction_duration = time.perf_counter() - start_time

                    results["metadata_extraction"].append({
                        "file_size_bytes": file_size,
                        "duration": extraction_duration,
                        "success": extraction_success,
                        "files_per_second": 1 / extraction_duration if extraction_duration > 0 else 0,
                        "metadata": {
                            "scene_name": metadata.scene_name if metadata else None,
                            "quality": metadata.quality if metadata else None,
                            "size": metadata.size if metadata else None,
                        } if extraction_success else None
                    })

        finally:
            # Clean up test video files
            for test_video in test_video_files:
                try:
                    test_video.unlink()
                except FileNotFoundError:
                    pass

        return results

    def run_full_benchmark_suite(self) -> Dict:
        """Run complete benchmark suite and return comprehensive results"""
        print("🚀 Starting Performance Benchmark Suite...")
        start_time = time.perf_counter()

        # Clear previous baselines to start fresh
        self.profiler.reset_baselines()

        results = {
            "benchmark_suite": "manim_bridge_performance",
            "timestamp": time.time(),
            "system_info": self.profiler._get_system_info(),
            "benchmarks": {}
        }

        try:
            print("📊 Running manifest operations benchmarks...")
            results["benchmarks"]["manifest"] = self.benchmark_manifest_operations()

            print("🔐 Running hash calculation benchmarks...")
            results["benchmarks"]["hash"] = self.benchmark_hash_calculations()

            print("🎬 Running video processing benchmarks...")
            results["benchmarks"]["video"] = self.benchmark_video_processing()

            # Generate performance report from profiler
            print("📈 Generating performance report...")
            results["performance_report"] = self.profiler.get_performance_report()

            # Calculate benchmark summary
            total_duration = time.perf_counter() - start_time
            results["benchmark_summary"] = {
                "total_duration": total_duration,
                "total_operations": sum(
                    len(benchmark.get("read_benchmarks", [])) +
                    len(benchmark.get("write_benchmarks", [])) +
                    len(benchmark.get("sha256_benchmarks", [])) +
                    len(benchmark.get("md5_benchmarks", [])) +
                    len(benchmark.get("metadata_extraction", [])) +
                    len(benchmark.get("validation_benchmarks", []))
                    for benchmark in results["benchmarks"].values()
                ),
                "operations_per_second": 0  # Will be calculated
            }

            if results["benchmark_summary"]["total_duration"] > 0:
                results["benchmark_summary"]["operations_per_second"] = (
                    results["benchmark_summary"]["total_operations"] /
                    results["benchmark_summary"]["total_duration"]
                )

            print(f"✅ Benchmark suite completed in {total_duration:.2f}s")

        except Exception as e:
            print(f"❌ Benchmark suite failed: {e}")
            results["error"] = str(e)
            raise

        return results

    def save_baseline_results(self, results: Dict, output_path: Path) -> None:
        """Save benchmark results as baseline for regression detection"""
        output_path.parent.mkdir(parents=True, exist_ok=True)

        with open(output_path, 'w') as f:
            json.dump(results, f, indent=2, default=str)

        # Also export profiler baselines
        baseline_path = output_path.parent / "profiler_baselines.json"
        self.profiler.export_baseline_metrics(baseline_path)

        print(f"💾 Baseline results saved to {output_path}")
        print(f"💾 Profiler baselines saved to {baseline_path}")

    def compare_with_baseline(self, baseline_path: Path, threshold: float = 1.2) -> Dict:
        """Compare current performance with baseline and detect regressions"""
        if not baseline_path.exists():
            return {"error": f"Baseline file not found: {baseline_path}"}

        with open(baseline_path) as f:
            baseline = json.load(f)

        current_results = self.run_full_benchmark_suite()

        comparison = {
            "comparison_timestamp": time.time(),
            "baseline_timestamp": baseline.get("timestamp"),
            "threshold": threshold,
            "regressions": [],
            "improvements": [],
            "stable": []
        }

        # Compare manifest operations
        for operation_type in ["read_benchmarks", "write_benchmarks"]:
            if operation_type in baseline.get("benchmarks", {}).get("manifest", {}):
                baseline_ops = baseline["benchmarks"]["manifest"][operation_type]
                current_ops = current_results["benchmarks"]["manifest"][operation_type]

                for baseline_op, current_op in zip(baseline_ops, current_ops):
                    if baseline_op["entry_count"] == current_op["entry_count"]:
                        baseline_duration = baseline_op["duration"]
                        current_duration = current_op["duration"]

                        if current_duration > baseline_duration * threshold:
                            comparison["regressions"].append({
                                "operation": f"manifest_{operation_type}",
                                "entry_count": current_op["entry_count"],
                                "baseline_duration": baseline_duration,
                                "current_duration": current_duration,
                                "regression_factor": current_duration / baseline_duration
                            })
                        elif baseline_duration > current_duration * threshold:
                            comparison["improvements"].append({
                                "operation": f"manifest_{operation_type}",
                                "entry_count": current_op["entry_count"],
                                "baseline_duration": baseline_duration,
                                "current_duration": current_duration,
                                "improvement_factor": baseline_duration / current_duration
                            })
                        else:
                            comparison["stable"].append({
                                "operation": f"manifest_{operation_type}",
                                "entry_count": current_op["entry_count"]
                            })

        return comparison


class TestPerformanceBenchmarks(TestCase):
    """Test cases for performance benchmarks"""

    @classmethod
    def setUpClass(cls):
        cls.benchmark_suite = PerformanceBenchmarkSuite()

    def test_manifest_operations_benchmark(self):
        """Test manifest operations benchmark"""
        results = self.benchmark_suite.benchmark_manifest_operations()

        self.assertIn("read_benchmarks", results)
        self.assertIn("write_benchmarks", results)
        self.assertTrue(len(results["read_benchmarks"]) > 0)
        self.assertTrue(len(results["write_benchmarks"]) > 0)

        # Verify all benchmarks have reasonable performance
        for benchmark in results["write_benchmarks"]:
            self.assertGreater(benchmark["entries_per_second"], 10)  # At least 10 entries/sec

        for benchmark in results["read_benchmarks"]:
            self.assertGreater(benchmark["direct_entries_per_second"], 100)  # At least 100 entries/sec for reads

    def test_hash_calculations_benchmark(self):
        """Test hash calculation benchmark"""
        results = self.benchmark_suite.benchmark_hash_calculations()

        self.assertIn("sha256_benchmarks", results)
        self.assertIn("md5_benchmarks", results)
        self.assertTrue(len(results["sha256_benchmarks"]) > 0)
        self.assertTrue(len(results["md5_benchmarks"]) > 0)

        # Verify reasonable hash performance (at least 1 MB/s)
        for benchmark in results["sha256_benchmarks"]:
            if benchmark["file_size_mb"] > 0.1:  # Only check for files > 100KB
                self.assertGreater(benchmark["mb_per_second"], 1.0)

    def test_video_processing_benchmark(self):
        """Test video processing benchmark"""
        results = self.benchmark_suite.benchmark_video_processing()

        self.assertIn("validation_benchmarks", results)
        self.assertTrue(len(results["validation_benchmarks"]) > 0)

        # Verify reasonable validation performance
        for benchmark in results["validation_benchmarks"]:
            self.assertGreater(benchmark["files_per_second"], 10)  # At least 10 files/sec

    @pytest.mark.benchmark
    def test_full_benchmark_suite(self):
        """Test complete benchmark suite (tagged for optional execution)"""
        results = self.benchmark_suite.run_full_benchmark_suite()

        self.assertIn("benchmarks", results)
        self.assertIn("performance_report", results)
        self.assertIn("benchmark_summary", results)

        # Verify all benchmark categories completed
        self.assertIn("manifest", results["benchmarks"])
        self.assertIn("hash", results["benchmarks"])
        self.assertIn("video", results["benchmarks"])

        # Verify performance report has data
        self.assertGreater(results["performance_report"]["total_operations"], 0)


if __name__ == "__main__":
    # Command-line execution for benchmarking
    import argparse

    parser = argparse.ArgumentParser(description="Run performance benchmarks")
    parser.add_argument("--output", "-o", type=Path, help="Output file for results")
    parser.add_argument("--baseline", "-b", type=Path, help="Baseline file for comparison")
    parser.add_argument("--save-baseline", action="store_true", help="Save results as new baseline")

    args = parser.parse_args()

    suite = PerformanceBenchmarkSuite()

    if args.baseline:
        # Compare with baseline
        comparison = suite.compare_with_baseline(args.baseline)
        print(f"\n📊 Performance Comparison Results:")
        print(f"Regressions: {len(comparison['regressions'])}")
        print(f"Improvements: {len(comparison['improvements'])}")
        print(f"Stable: {len(comparison['stable'])}")

        if args.output:
            with open(args.output, 'w') as f:
                json.dump(comparison, f, indent=2, default=str)
    else:
        # Run full benchmark
        results = suite.run_full_benchmark_suite()

        if args.output:
            if args.save_baseline:
                suite.save_baseline_results(results, args.output)
            else:
                with open(args.output, 'w') as f:
                    json.dump(results, f, indent=2, default=str)
                print(f"💾 Results saved to {args.output}")
        else:
            # Print summary to console
            print(f"\n📊 Benchmark Summary:")
            summary = results["benchmark_summary"]
            print(f"Total operations: {summary['total_operations']}")
            print(f"Total duration: {summary['total_duration']:.2f}s")
            print(f"Operations per second: {summary['operations_per_second']:.1f}")
