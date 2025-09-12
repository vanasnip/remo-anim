"""Performance tests for the Manim Bridge system."""

import concurrent.futures
import threading
import time
from statistics import mean

import pytest

from manim_bridge.bridge import ManimBridge
from manim_bridge.core.config import BridgeConfig
from manim_bridge.processing.hash_calculator import HashCalculator
from manim_bridge.processing.video_processor import VideoProcessor
from manim_bridge.storage.manifest_handler import ManifestHandler
from tests.conftest import TestVideoGenerator


@pytest.mark.performance
@pytest.mark.slow
class TestVideoProcessingPerformance:
    """Test performance of video processing operations."""

    def test_hash_calculation_performance(self, temp_workspace):
        """Test hash calculation performance with different file sizes."""
        calculator = HashCalculator(chunk_size=1024 * 1024)  # 1MB chunks

        # Test different file sizes
        test_sizes = [
            (1024, "1KB"),
            (1024 * 100, "100KB"),
            (1024 * 1024, "1MB"),
            (1024 * 1024 * 10, "10MB"),
        ]

        results = {}

        for size, label in test_sizes:
            test_file = temp_workspace / f"perf_{label.replace('KB', 'k').replace('MB', 'm')}.mp4"
            TestVideoGenerator.create_fake_video(test_file, size=size)

            # Measure hash calculation time
            times = []
            for _ in range(5):  # Multiple runs for average
                start_time = time.perf_counter()
                file_hash = calculator.calculate_hash(test_file)
                end_time = time.perf_counter()
                times.append(end_time - start_time)

                # Verify hash is consistent
                assert len(file_hash) == 64  # SHA256 hex digest

            avg_time = mean(times)
            throughput = size / avg_time if avg_time > 0 else 0  # bytes per second

            results[label] = {
                "avg_time": avg_time,
                "throughput": throughput,
                "times": times,
            }

            # Performance assertions
            assert avg_time < 5.0, f"Hash calculation too slow for {label}: {avg_time}s"
            if size >= 1024 * 1024:  # For 1MB+
                assert (
                    throughput > 1024 * 1024
                ), f"Hash throughput too low for {label}: {throughput} B/s"

        # Verify throughput scales reasonably
        kb_throughput = results["100KB"]["throughput"]
        mb_throughput = results["1MB"]["throughput"]

        # Large files should have better throughput (less overhead)
        assert mb_throughput >= kb_throughput * 0.5, "Throughput doesn't scale with file size"

    def test_video_metadata_extraction_performance(self, temp_workspace):
        """Test performance of video metadata extraction."""
        processor = VideoProcessor(enable_logging=False)  # Disable logging for performance

        # Create test videos
        test_videos = []
        for i in range(20):
            quality_dir = temp_workspace / f"720p30_{i}"
            quality_dir.mkdir()
            video_file = quality_dir / f"perftest_{i}.mp4"
            TestVideoGenerator.create_fake_video(video_file, size=1024 + i * 100)
            test_videos.append(video_file)

        # Measure metadata extraction
        times = []
        for video in test_videos:
            start_time = time.perf_counter()
            info = processor.extract_metadata(video)
            end_time = time.perf_counter()

            times.append(end_time - start_time)

            # Verify metadata was extracted
            assert info.scene_name is not None
            assert info.quality is not None
            assert info.hash is not None

        avg_time = mean(times)
        max_time = max(times)

        # Performance assertions
        assert avg_time < 0.1, f"Metadata extraction too slow: {avg_time}s average"
        assert max_time < 0.5, f"Slowest metadata extraction too slow: {max_time}s"

    def test_concurrent_video_processing_performance(self, temp_workspace):
        """Test performance under concurrent video processing load."""
        processor = VideoProcessor(enable_logging=False)

        # Create multiple videos for concurrent processing
        videos = []
        for i in range(50):
            quality_dir = temp_workspace / f"concurrent_{i % 5}"  # 5 different quality dirs
            quality_dir.mkdir(exist_ok=True)
            video_file = quality_dir / f"concurrent_{i}.mp4"
            TestVideoGenerator.create_fake_video(video_file, size=1024 + i * 50)
            videos.append(video_file)

        # Test sequential processing
        start_time = time.perf_counter()
        sequential_results = []
        for video in videos:
            info = processor.extract_metadata(video)
            sequential_results.append(info)
        sequential_time = time.perf_counter() - start_time

        # Test concurrent processing
        concurrent_results = []
        errors = []

        def process_video(video):
            try:
                return processor.extract_metadata(video)
            except Exception as e:
                errors.append(e)
                return None

        start_time = time.perf_counter()
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
            concurrent_results = list(executor.map(process_video, videos))
        concurrent_time = time.perf_counter() - start_time

        # Filter out None results from errors
        concurrent_results = [r for r in concurrent_results if r is not None]

        # Performance assertions
        assert len(errors) == 0, f"Concurrent processing had errors: {errors}"
        assert len(concurrent_results) == len(videos), "Not all videos processed"

        # Concurrent should be faster (or at least not much slower due to overhead)
        speedup = sequential_time / concurrent_time
        assert speedup > 0.5, f"Concurrent processing too slow: {speedup}x speedup"

        # Results should be consistent
        sequential_hashes = {r.path: r.hash for r in sequential_results}
        concurrent_hashes = {r.path: r.hash for r in concurrent_results}
        assert sequential_hashes == concurrent_hashes, "Concurrent results differ from sequential"

    @pytest.mark.requires_ffmpeg
    def test_ffprobe_performance(self, temp_workspace, mock_ffmpeg):
        """Test performance when ffprobe is available."""
        processor = VideoProcessor(enable_logging=False)

        # Create test videos
        videos = []
        for i in range(10):
            quality_dir = temp_workspace / "1080p60"
            quality_dir.mkdir(exist_ok=True)
            video_file = quality_dir / f"ffprobe_test_{i}.mp4"
            TestVideoGenerator.create_fake_video(video_file, size=2048 + i * 200)
            videos.append(video_file)

        # Measure metadata extraction with ffprobe
        times = []
        for video in videos:
            start_time = time.perf_counter()
            info = processor.extract_metadata(video)
            end_time = time.perf_counter()

            times.append(end_time - start_time)

            # Should have extended metadata from ffprobe mock
            assert info.duration is not None
            assert info.resolution is not None
            assert info.codec is not None

        avg_time = mean(times)

        # Even with ffprobe, should be reasonably fast
        assert avg_time < 1.0, f"Metadata extraction with ffprobe too slow: {avg_time}s"


@pytest.mark.performance
@pytest.mark.slow
class TestManifestPerformance:
    """Test performance of manifest operations."""

    def test_manifest_read_write_performance(self, temp_workspace):
        """Test manifest read/write performance with large datasets."""
        manifest_file = temp_workspace / "large_manifest.json"
        handler = ManifestHandler(manifest_file, enable_logging=False)

        # Create large dataset
        large_dataset = {}
        for i in range(1000):
            large_dataset[f"video_{i}.mp4"] = {
                "hash": f"hash_{i:064d}",  # 64 character hash
                "size": 1024 * (i + 1),
                "processed_at": f"2024-01-01T{i % 24:02d}:00:00",
                "scene": f"Scene_{i}",
                "quality": ["480p15", "720p30", "1080p60"][i % 3],
                "duration": 10.0 + (i % 60),
                "codec": "h264",
            }

        # Test write performance
        start_time = time.perf_counter()
        handler.write(large_dataset)
        write_time = time.perf_counter() - start_time

        # Test read performance
        start_time = time.perf_counter()
        read_data = handler.read(use_cache=False)
        read_time = time.perf_counter() - start_time

        # Test cached read performance
        start_time = time.perf_counter()
        cached_data = handler.read(use_cache=True)
        cached_read_time = time.perf_counter() - start_time

        # Performance assertions
        assert write_time < 1.0, f"Writing large manifest too slow: {write_time}s"
        assert read_time < 1.0, f"Reading large manifest too slow: {read_time}s"
        assert cached_read_time < 0.1, f"Cached read too slow: {cached_read_time}s"

        # Cached read should be significantly faster
        assert cached_read_time < read_time * 0.5, "Cached read not much faster than disk read"

        # Verify data integrity
        assert read_data == large_dataset
        assert cached_data == large_dataset

    def test_manifest_concurrent_access_performance(self, temp_workspace):
        """Test manifest performance under concurrent access."""
        manifest_file = temp_workspace / "concurrent_manifest.json"
        handler = ManifestHandler(manifest_file, enable_logging=False)

        results = []
        errors = []

        def worker(worker_id, operations=100):
            """Worker function for concurrent manifest operations."""
            try:
                worker_times = []
                for i in range(operations):
                    start_time = time.perf_counter()

                    entry_key = f"worker_{worker_id}_video_{i}.mp4"
                    entry_data = {
                        "hash": f"hash_{worker_id}_{i}",
                        "size": 1024 * (i + 1),
                        "worker": worker_id,
                    }

                    handler.add_entry(entry_key, entry_data)

                    # Occasionally read to test mixed operations
                    if i % 10 == 0:
                        handler.read(use_cache=False)

                    end_time = time.perf_counter()
                    worker_times.append(end_time - start_time)

                results.append(
                    {
                        "worker_id": worker_id,
                        "times": worker_times,
                        "avg_time": mean(worker_times),
                    }
                )

            except Exception as e:
                errors.append(e)

        # Run concurrent workers
        num_workers = 5
        threads = []

        start_time = time.perf_counter()
        for worker_id in range(num_workers):
            t = threading.Thread(target=worker, args=(worker_id, 50))  # 50 ops per worker
            threads.append(t)
            t.start()

        for t in threads:
            t.join()

        total_time = time.perf_counter() - start_time

        # Performance assertions
        assert len(errors) == 0, f"Concurrent access errors: {errors}"
        assert len(results) == num_workers, "Not all workers completed"

        total_operations = sum(len(r["times"]) for r in results)
        avg_ops_per_second = total_operations / total_time

        # Should handle reasonable throughput
        assert avg_ops_per_second > 50, f"Concurrent throughput too low: {avg_ops_per_second} ops/s"

        # Verify final state is consistent
        final_data = handler.read(use_cache=False)
        assert len(final_data) == total_operations, "Final manifest size incorrect"

    def test_manifest_batch_operations_performance(self, temp_workspace):
        """Test performance of batch manifest operations."""
        manifest_file = temp_workspace / "batch_manifest.json"
        handler = ManifestHandler(manifest_file, enable_logging=False)

        # Prepare batch data
        batch_sizes = [10, 100, 500, 1000]

        for batch_size in batch_sizes:
            batch_data = {}
            for i in range(batch_size):
                batch_data[f"batch_{batch_size}_{i}.mp4"] = {
                    "hash": f"batch_hash_{i}",
                    "size": 1024 * (i + 1),
                    "batch_size": batch_size,
                }

            # Test batch update performance
            start_time = time.perf_counter()
            handler.batch_update(batch_data)
            batch_time = time.perf_counter() - start_time

            # Compare with individual updates
            individual_data = {}
            for i in range(min(batch_size, 50)):  # Limit individual test size
                individual_data[f"individual_{batch_size}_{i}.mp4"] = {
                    "hash": f"individual_hash_{i}",
                    "size": 1024 * (i + 1),
                }

            start_time = time.perf_counter()
            for key, value in individual_data.items():
                handler.add_entry(key, value)
            individual_time = time.perf_counter() - start_time

            # Batch operations should be more efficient for larger datasets
            if batch_size >= 100:
                ops_per_second_batch = batch_size / batch_time
                ops_per_second_individual = len(individual_data) / individual_time

                # Batch should be faster (or at least not much slower)
                assert (
                    ops_per_second_batch >= ops_per_second_individual * 0.8
                ), f"Batch operations not efficient for size {batch_size}"


@pytest.mark.performance
@pytest.mark.slow
class TestFullPipelinePerformance:
    """Test performance of the complete processing pipeline."""

    def test_end_to_end_processing_performance(self, temp_workspace):
        """Test performance of complete video processing pipeline."""
        config = BridgeConfig(
            source_dir=temp_workspace / "source",
            target_dir=temp_workspace / "target",
            manifest_file=temp_workspace / "performance_manifest.json",
            enable_dev_logging=False,  # Disable logging for performance
            log_performance=True,
        )

        bridge = ManimBridge(config)

        # Create test videos of varying sizes
        test_videos = []
        for i in range(20):
            quality = ["480p15", "720p30", "1080p60"][i % 3]
            quality_dir = config.source_dir / quality
            quality_dir.mkdir(parents=True, exist_ok=True)

            video_file = quality_dir / f"pipeline_test_{i}.mp4"
            size = 1024 + i * 200  # Varying sizes
            TestVideoGenerator.create_fake_video(video_file, size=size)
            test_videos.append(video_file)

        # Measure processing performance
        processing_times = []

        for video in test_videos:
            start_time = time.perf_counter()
            success = bridge.process_file(video)
            end_time = time.perf_counter()

            processing_times.append(end_time - start_time)
            assert success is True, f"Failed to process {video.name}"

        # Analyze performance
        avg_time = mean(processing_times)
        max_time = max(processing_times)
        throughput = len(test_videos) / sum(processing_times)

        # Performance assertions
        assert avg_time < 1.0, f"Average processing time too slow: {avg_time}s"
        assert max_time < 2.0, f"Slowest processing too slow: {max_time}s"
        assert throughput > 5, f"Processing throughput too low: {throughput} videos/s"

        # Verify performance metrics were collected
        if bridge.metrics.enabled:
            stats = bridge.metrics.get_stats()
            assert stats.get("count", 0) > 0, "No performance metrics collected"

    def test_bulk_processing_performance(self, temp_workspace, large_bridge_video_set):
        """Test performance with bulk video processing."""
        config = BridgeConfig(
            source_dir=large_bridge_video_set[0].parent.parent,  # Get source dir
            target_dir=temp_workspace / "bulk_target",
            manifest_file=temp_workspace / "bulk_manifest.json",
            enable_dev_logging=False,
            log_performance=True,
        )

        bridge = ManimBridge(config)

        # Process all videos in bulk
        start_time = time.perf_counter()
        processed_count = bridge.scan_existing_files()
        total_time = time.perf_counter() - start_time

        # Performance metrics
        if processed_count > 0:
            avg_time_per_video = total_time / processed_count
            throughput = processed_count / total_time

            # Performance assertions
            assert (
                avg_time_per_video < 0.5
            ), f"Bulk processing too slow: {avg_time_per_video}s per video"
            assert throughput > 10, f"Bulk throughput too low: {throughput} videos/s"

        # Verify results
        target_files = list(config.target_dir.glob("*.mp4"))
        manifest_data = bridge.manifest_handler.read()

        assert len(target_files) == processed_count
        assert len(manifest_data) == processed_count

    def test_memory_usage_performance(self, temp_workspace):
        """Test memory usage during processing."""
        import os

        import psutil

        config = BridgeConfig(
            source_dir=temp_workspace / "source",
            target_dir=temp_workspace / "target",
            manifest_file=temp_workspace / "memory_manifest.json",
            enable_dev_logging=False,
        )

        bridge = ManimBridge(config)
        process = psutil.Process(os.getpid())

        # Baseline memory usage
        baseline_memory = process.memory_info().rss

        # Create and process many videos
        for i in range(100):
            quality_dir = config.source_dir / "720p30"
            quality_dir.mkdir(parents=True, exist_ok=True)

            video_file = quality_dir / f"memory_test_{i}.mp4"
            TestVideoGenerator.create_fake_video(video_file, size=1024 + i * 50)

            bridge.process_file(video_file)

            # Check memory usage periodically
            if i % 20 == 19:
                current_memory = process.memory_info().rss
                memory_increase = current_memory - baseline_memory

                # Memory shouldn't increase dramatically (check for leaks)
                memory_increase_mb = memory_increase / (1024 * 1024)
                assert (
                    memory_increase_mb < 100
                ), f"Memory usage too high: {memory_increase_mb}MB increase"

    def test_disk_io_performance(self, temp_workspace):
        """Test disk I/O performance during processing."""
        config = BridgeConfig(
            source_dir=temp_workspace / "source",
            target_dir=temp_workspace / "target",
            manifest_file=temp_workspace / "io_manifest.json",
            enable_dev_logging=False,
        )

        bridge = ManimBridge(config)

        # Create videos with significant size for I/O testing
        io_test_videos = []
        for i in range(10):
            quality_dir = config.source_dir / "1080p60"
            quality_dir.mkdir(parents=True, exist_ok=True)

            video_file = quality_dir / f"io_test_{i}.mp4"
            size = 1024 * 1024 * 2  # 2MB files
            TestVideoGenerator.create_fake_video(video_file, size=size)
            io_test_videos.append(video_file)

        # Measure I/O performance
        start_time = time.perf_counter()
        total_bytes_processed = 0

        for video in io_test_videos:
            file_size = video.stat().st_size
            success = bridge.process_file(video)
            if success:
                total_bytes_processed += file_size

        total_time = time.perf_counter() - start_time

        # Calculate I/O throughput
        if total_bytes_processed > 0:
            io_throughput = total_bytes_processed / total_time  # bytes per second
            io_throughput_mb = io_throughput / (1024 * 1024)  # MB per second

            # Should achieve reasonable I/O throughput
            assert io_throughput_mb > 5, f"I/O throughput too low: {io_throughput_mb} MB/s"

    def test_performance_monitoring_overhead(self, temp_workspace):
        """Test performance impact of monitoring itself."""
        config_no_monitor = BridgeConfig(
            source_dir=temp_workspace / "source",
            target_dir=temp_workspace / "target_no_monitor",
            manifest_file=temp_workspace / "manifest_no_monitor.json",
            enable_dev_logging=False,
            log_performance=False,  # Disable monitoring
        )

        config_with_monitor = BridgeConfig(
            source_dir=temp_workspace / "source",
            target_dir=temp_workspace / "target_with_monitor",
            manifest_file=temp_workspace / "manifest_with_monitor.json",
            enable_dev_logging=False,
            log_performance=True,  # Enable monitoring
        )

        # Create test videos
        test_videos = []
        for i in range(10):
            quality_dir = config_no_monitor.source_dir / "720p30"
            quality_dir.mkdir(parents=True, exist_ok=True)

            video_file = quality_dir / f"monitor_test_{i}.mp4"
            TestVideoGenerator.create_fake_video(video_file, size=1024 + i * 100)
            test_videos.append(video_file)

        # Test without monitoring
        bridge_no_monitor = ManimBridge(config_no_monitor)
        start_time = time.perf_counter()
        for video in test_videos:
            bridge_no_monitor.process_file(video)
        time_no_monitor = time.perf_counter() - start_time

        # Test with monitoring
        bridge_with_monitor = ManimBridge(config_with_monitor)
        start_time = time.perf_counter()
        for video in test_videos:
            bridge_with_monitor.process_file(video)
        time_with_monitor = time.perf_counter() - start_time

        # Calculate monitoring overhead
        overhead = (time_with_monitor - time_no_monitor) / time_no_monitor * 100

        # Monitoring overhead should be reasonable (less than 20%)
        assert overhead < 20, f"Performance monitoring overhead too high: {overhead}%"
