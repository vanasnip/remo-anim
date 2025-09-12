"""Integration tests for component interactions within the Manim Bridge system."""

import threading
import time

import pytest

from manim_bridge.bridge import ManimBridge
from manim_bridge.core.config import BridgeConfig
from manim_bridge.monitoring.metrics import PerformanceMonitor
from manim_bridge.processing.video_processor import VideoProcessor
from manim_bridge.security.path_validator import PathValidator
from manim_bridge.storage.manifest_handler import ManifestHandler
from tests.conftest import TestVideoGenerator


@pytest.mark.integration
class TestConfigComponentIntegration:
    """Test integration between configuration and other components."""

    def test_config_path_validator_integration(self, temp_workspace):
        """Test that configuration properly sets up PathValidator."""
        config = BridgeConfig(
            source_dir=temp_workspace / "source",
            target_dir=temp_workspace / "target",
            manifest_file=temp_workspace / "manifest.json",
        )

        # Create bridge with config
        bridge = ManimBridge(config)

        # Verify PathValidator was configured with correct directories
        validator = bridge.path_validator
        assert len(validator.allowed_dirs) >= 2
        assert config.source_dir in validator.allowed_dirs
        assert config.target_dir in validator.allowed_dirs

    def test_config_manifest_integration(self, temp_workspace):
        """Test that configuration properly sets up ManifestHandler."""
        manifest_file = temp_workspace / "test_manifest.json"
        config = BridgeConfig(
            source_dir=temp_workspace / "source",
            target_dir=temp_workspace / "target",
            manifest_file=manifest_file,
        )

        bridge = ManimBridge(config)

        # Verify ManifestHandler was configured correctly
        assert bridge.manifest_handler.manifest_path == manifest_file
        assert manifest_file.exists()  # Should be created

    def test_config_logging_integration(self, temp_workspace):
        """Test that configuration properly sets up logging."""
        log_file = temp_workspace / "bridge.log"
        config = BridgeConfig(
            source_dir=temp_workspace / "source",
            target_dir=temp_workspace / "target",
            manifest_file=temp_workspace / "manifest.json",
            enable_dev_logging=True,
            log_file=log_file,
            log_performance=True,
        )

        bridge = ManimBridge(config)

        # Verify logging is configured
        assert bridge.logger is not None

        # Log a test message and verify it appears in file
        bridge.logger.info("Integration test message")
        if log_file.exists():
            content = log_file.read_text()
            assert "Integration test message" in content

    def test_config_performance_monitoring_integration(self, temp_workspace):
        """Test that configuration enables performance monitoring."""
        config = BridgeConfig(
            source_dir=temp_workspace / "source",
            target_dir=temp_workspace / "target",
            manifest_file=temp_workspace / "manifest.json",
            log_performance=True,
        )

        bridge = ManimBridge(config)

        # Verify performance monitoring is enabled
        assert bridge.metrics.enabled is True


@pytest.mark.integration
class TestSecurityStorageIntegration:
    """Test integration between security and storage components."""

    def test_path_validator_manifest_integration(self, temp_workspace):
        """Test PathValidator integration with ManifestHandler."""
        allowed_dirs = [temp_workspace / "allowed"]
        allowed_dirs[0].mkdir()

        validator = PathValidator(allowed_dirs, enable_logging=True)
        manifest_file = allowed_dirs[0] / "manifest.json"
        manifest_handler = ManifestHandler(manifest_file, enable_logging=True)

        # Test that manifest file is in allowed directory
        assert validator.is_safe(str(manifest_file)) is True

        # Test manifest operations with validated paths
        safe_video_path = allowed_dirs[0] / "video.mp4"
        entry_data = {"hash": "abc123", "size": 1024}

        # Should work with safe path
        manifest_handler.add_entry(str(safe_video_path), entry_data)
        entry = manifest_handler.get_entry(str(safe_video_path))
        assert entry == entry_data

    def test_path_validator_file_operations_integration(self, temp_workspace):
        """Test PathValidator integration with file operations."""
        from manim_bridge.storage.file_operations import AtomicFileOperations

        allowed_dir = temp_workspace / "allowed"
        allowed_dir.mkdir()
        outside_dir = temp_workspace / "outside"
        outside_dir.mkdir()

        validator = PathValidator([allowed_dir])
        file_ops = AtomicFileOperations()

        # Create source file in allowed directory
        source_file = allowed_dir / "source.mp4"
        source_file.write_bytes(b"test content")

        # Test safe copy within allowed directory
        target_file = allowed_dir / "target.mp4"
        assert validator.is_safe(str(target_file)) is True

        file_ops.atomic_copy(source_file, target_file)
        assert target_file.exists()

        # Test unsafe copy to outside directory
        unsafe_target = outside_dir / "unsafe.mp4"
        assert validator.is_safe(str(unsafe_target)) is False


@pytest.mark.integration
class TestProcessingStorageIntegration:
    """Test integration between processing and storage components."""

    def test_video_processor_manifest_integration(self, temp_workspace):
        """Test VideoProcessor integration with ManifestHandler."""
        # Setup components
        manifest_file = temp_workspace / "processor_manifest.json"
        manifest_handler = ManifestHandler(manifest_file)
        video_processor = VideoProcessor(enable_logging=True)

        # Create test video
        quality_dir = temp_workspace / "720p30"
        quality_dir.mkdir()
        video_file = quality_dir / "ProcessorTest.mp4"
        TestVideoGenerator.create_fake_video(video_file, size=1536)

        # Extract metadata
        video_info = video_processor.extract_metadata(video_file)

        # Add to manifest
        manifest_entry = {
            "hash": video_info.hash,
            "size": video_info.size,
            "scene": video_info.scene_name,
            "quality": video_info.quality,
            "processed_at": "2024-01-01T12:00:00",
        }

        manifest_handler.add_entry(str(video_file), manifest_entry)

        # Test needs_processing logic
        assert manifest_handler.needs_processing(str(video_file), video_info.hash) is False
        assert manifest_handler.needs_processing(str(video_file), "different_hash") is True

    def test_hash_calculator_manifest_integration(self, temp_workspace):
        """Test HashCalculator integration with manifest storage."""
        from manim_bridge.processing.hash_calculator import HashCalculator

        hash_calc = HashCalculator(enable_logging=True)
        manifest_handler = ManifestHandler(temp_workspace / "hash_manifest.json")

        # Create test file
        test_file = temp_workspace / "hash_test.mp4"
        test_content = b"hash integration test content"
        test_file.write_bytes(test_content)

        # Calculate hash
        file_hash = hash_calc.calculate_hash(test_file)

        # Store in manifest
        manifest_handler.add_entry(str(test_file), {"hash": file_hash})

        # Verify hash verification works with stored data
        stored_entry = manifest_handler.get_entry(str(test_file))
        assert hash_calc.verify_hash(test_file, stored_entry["hash"]) is True

    def test_video_processor_file_operations_integration(self, temp_workspace):
        """Test VideoProcessor integration with file operations."""
        from manim_bridge.storage.file_operations import AtomicFileOperations

        video_processor = VideoProcessor(enable_logging=True)
        file_ops = AtomicFileOperations()

        # Create source video
        source_dir = temp_workspace / "source"
        quality_dir = source_dir / "1080p60"
        quality_dir.mkdir(parents=True)
        source_video = quality_dir / "Integration.mp4"
        TestVideoGenerator.create_fake_video(source_video, size=2048)

        # Process and copy
        video_info = video_processor.extract_metadata(source_video)
        output_filename = video_processor.generate_output_filename(
            source_video, include_timestamp=False
        )

        target_dir = temp_workspace / "target"
        target_dir.mkdir()
        target_video = target_dir / output_filename

        file_ops.atomic_copy(source_video, target_video)

        # Verify copied file has same metadata
        copied_info = video_processor.extract_metadata(target_video)
        assert copied_info.hash == video_info.hash
        assert copied_info.size == video_info.size


@pytest.mark.integration
class TestMonitoringIntegration:
    """Test integration of monitoring with other components."""

    def test_performance_monitor_video_processing_integration(self, temp_workspace):
        """Test PerformanceMonitor integration with video processing."""
        monitor = PerformanceMonitor(enabled=True)
        video_processor = VideoProcessor(enable_logging=True)

        # Create test video
        quality_dir = temp_workspace / "720p30"
        quality_dir.mkdir()
        video_file = quality_dir / "MonitorTest.mp4"
        TestVideoGenerator.create_fake_video(video_file, size=1024)

        # Measure video processing operations
        with monitor.measure("extract_metadata"):
            video_info = video_processor.extract_metadata(video_file)

        with monitor.measure("validate_video"):
            is_valid = video_processor.validate_video(video_file)

        with monitor.measure("generate_filename"):
            filename = video_processor.generate_output_filename(video_file)

        # Verify monitoring recorded all operations
        stats = monitor.get_stats()
        assert stats["count"] == 3
        assert stats["successful"] == 3

        # Check individual operation stats
        assert "extract_metadata" in monitor.metrics
        assert "validate_video" in monitor.metrics
        assert "generate_filename" in monitor.metrics

    def test_logging_manifest_integration(self, temp_workspace):
        """Test logging integration with manifest operations."""
        from manim_bridge.monitoring.logger import setup_logging

        log_file = temp_workspace / "manifest_integration.log"
        logger = setup_logging(
            "manifest_integration", level="DEBUG", log_file=log_file, enable_dev=True
        )

        manifest_handler = ManifestHandler(
            temp_workspace / "logged_manifest.json", enable_logging=True
        )

        # Perform manifest operations
        test_data = {"hash": "test123", "size": 1024}
        manifest_handler.add_entry("test.mp4", test_data)
        manifest_handler.update_entry("test.mp4", {"size": 2048})
        manifest_handler.remove_entry("test.mp4")

        # Verify operations were logged
        if log_file.exists():
            content = log_file.read_text()
            # Should contain log entries (exact format depends on logger setup)
            assert len(content) > 0

    def test_performance_monitor_concurrent_operations(self, temp_workspace):
        """Test performance monitoring with concurrent operations."""
        monitor = PerformanceMonitor(enabled=True)
        video_processor = VideoProcessor(enable_logging=True)

        # Create multiple test videos
        videos = []
        for i in range(5):
            quality_dir = temp_workspace / f"720p30_{i}"
            quality_dir.mkdir()
            video_file = quality_dir / f"Concurrent_{i}.mp4"
            TestVideoGenerator.create_fake_video(video_file, size=1024 + i * 100)
            videos.append(video_file)

        results = []
        errors = []

        def worker(worker_id, video_files):
            try:
                for video in video_files:
                    with monitor.measure(f"worker_{worker_id}_process"):
                        info = video_processor.extract_metadata(video)
                        results.append(info)
            except Exception as e:
                errors.append(e)

        # Run concurrent workers
        threads = []
        videos_per_worker = len(videos) // 2
        for worker_id in range(2):
            start_idx = worker_id * videos_per_worker
            end_idx = start_idx + videos_per_worker if worker_id == 0 else len(videos)
            worker_videos = videos[start_idx:end_idx]

            t = threading.Thread(target=worker, args=(worker_id, worker_videos))
            threads.append(t)
            t.start()

        for t in threads:
            t.join()

        # Verify concurrent monitoring worked
        assert len(errors) == 0
        assert len(results) == len(videos)

        # Check monitoring stats
        stats = monitor.get_stats()
        assert stats["count"] == len(videos)


@pytest.mark.integration
class TestFullComponentIntegration:
    """Test integration of multiple components working together."""

    def test_bridge_component_initialization(self, temp_workspace):
        """Test that ManimBridge properly initializes all components."""
        config = BridgeConfig(
            source_dir=temp_workspace / "source",
            target_dir=temp_workspace / "target",
            manifest_file=temp_workspace / "full_manifest.json",
            enable_dev_logging=True,
            log_performance=True,
        )

        bridge = ManimBridge(config)

        # Verify all components are initialized
        assert bridge.config is not None
        assert bridge.logger is not None
        assert bridge.path_validator is not None
        assert bridge.manifest_handler is not None
        assert bridge.file_operations is not None
        assert bridge.hash_calculator is not None
        assert bridge.video_processor is not None
        assert bridge.metrics is not None

    def test_video_processing_pipeline(self, temp_workspace):
        """Test complete video processing pipeline integration."""
        config = BridgeConfig(
            source_dir=temp_workspace / "source",
            target_dir=temp_workspace / "target",
            manifest_file=temp_workspace / "pipeline_manifest.json",
            enable_dev_logging=True,
            log_performance=True,
        )

        bridge = ManimBridge(config)

        # Create test video in source directory
        quality_dir = config.source_dir / "1080p60"
        quality_dir.mkdir(parents=True)
        source_video = quality_dir / "PipelineTest.mp4"
        TestVideoGenerator.create_fake_video(source_video, size=2048)

        # Process the video through the complete pipeline
        success = bridge.process_file(source_video)

        assert success is True

        # Verify all pipeline steps completed
        # 1. File should be copied to target
        target_files = list(config.target_dir.glob("*.mp4"))
        assert len(target_files) > 0

        # 2. Manifest should be updated
        manifest_data = bridge.manifest_handler.read()
        assert str(source_video) in manifest_data

        # 3. Performance metrics should be recorded
        if bridge.metrics.enabled:
            stats = bridge.metrics.get_stats()
            assert stats.get("count", 0) > 0

    def test_multiple_video_processing(self, temp_workspace, multiple_bridge_videos):
        """Test processing multiple videos through the pipeline."""
        config = BridgeConfig(
            source_dir=multiple_bridge_videos[0].parent.parent,  # Source dir
            target_dir=temp_workspace / "multi_target",
            manifest_file=temp_workspace / "multi_manifest.json",
            enable_dev_logging=True,
            log_performance=True,
        )

        bridge = ManimBridge(config)

        # Process all videos
        processed_count = 0
        for video in multiple_bridge_videos:
            if bridge.process_file(video):
                processed_count += 1

        assert processed_count > 0

        # Verify results
        target_files = list(config.target_dir.glob("*.mp4"))
        assert len(target_files) == processed_count

        manifest_data = bridge.manifest_handler.read()
        assert len(manifest_data) == processed_count

        # Verify all processed files are in manifest
        for video in multiple_bridge_videos:
            if str(video) in manifest_data:
                entry = manifest_data[str(video)]
                assert "hash" in entry
                assert "target" in entry
                assert "processed_at" in entry

    def test_error_handling_integration(self, temp_workspace):
        """Test error handling across component boundaries."""
        config = BridgeConfig(
            source_dir=temp_workspace / "source",
            target_dir=temp_workspace / "target",
            manifest_file=temp_workspace / "error_manifest.json",
            enable_dev_logging=True,
        )

        bridge = ManimBridge(config)

        # Test with non-existent file
        nonexistent = config.source_dir / "nonexistent.mp4"
        result = bridge.process_file(nonexistent)
        assert result is False

        # Test with invalid video file
        invalid_video = config.source_dir / "720p30" / "invalid.mp4"
        invalid_video.parent.mkdir(parents=True)
        invalid_video.write_bytes(b"not a video")

        result = bridge.process_file(invalid_video)
        # Should handle invalid video gracefully
        assert isinstance(result, bool)

    def test_concurrent_bridge_operations(self, temp_workspace):
        """Test concurrent operations on the bridge."""
        config = BridgeConfig(
            source_dir=temp_workspace / "concurrent_source",
            target_dir=temp_workspace / "concurrent_target",
            manifest_file=temp_workspace / "concurrent_manifest.json",
            enable_dev_logging=True,
            log_performance=True,
        )

        bridge = ManimBridge(config)

        # Create multiple videos
        videos = []
        for i in range(5):
            quality_dir = config.source_dir / "720p30"
            quality_dir.mkdir(parents=True, exist_ok=True)
            video = quality_dir / f"concurrent_{i}.mp4"
            TestVideoGenerator.create_fake_video(video, size=1024 + i * 200)
            videos.append(video)

        results = []
        errors = []

        def worker(video_list):
            try:
                for video in video_list:
                    result = bridge.process_file(video)
                    results.append(result)
                    time.sleep(0.01)  # Small delay to encourage concurrency
            except Exception as e:
                errors.append(e)

        # Run concurrent processing
        threads = []
        videos_per_thread = len(videos) // 2
        for i in range(2):
            start_idx = i * videos_per_thread
            end_idx = start_idx + videos_per_thread if i == 0 else len(videos)
            thread_videos = videos[start_idx:end_idx]

            t = threading.Thread(target=worker, args=(thread_videos,))
            threads.append(t)
            t.start()

        for t in threads:
            t.join()

        # Verify concurrent processing completed successfully
        assert len(errors) == 0
        successful_results = [r for r in results if r is True]
        assert len(successful_results) > 0

        # Verify final state is consistent
        manifest_data = bridge.manifest_handler.read(use_cache=False)
        target_files = list(config.target_dir.glob("*.mp4"))

        # Should have processed files
        assert len(target_files) > 0
        assert len(manifest_data) > 0

    def test_configuration_change_integration(self, temp_workspace):
        """Test component behavior when configuration changes."""
        # Create initial configuration
        config1 = BridgeConfig(
            source_dir=temp_workspace / "source1",
            target_dir=temp_workspace / "target1",
            manifest_file=temp_workspace / "manifest1.json",
            log_performance=False,
        )

        bridge1 = ManimBridge(config1)
        assert bridge1.metrics.enabled is False

        # Create new configuration with performance enabled
        config2 = BridgeConfig(
            source_dir=temp_workspace / "source2",
            target_dir=temp_workspace / "target2",
            manifest_file=temp_workspace / "manifest2.json",
            log_performance=True,
        )

        bridge2 = ManimBridge(config2)
        assert bridge2.metrics.enabled is True

        # Verify configurations are independent
        assert bridge1.config.target_dir != bridge2.config.target_dir
        assert bridge1.metrics.enabled != bridge2.metrics.enabled
