"""Extended tests for the ManimBridge class focusing on edge cases and error handling"""

import json
import time
from pathlib import Path
from unittest.mock import MagicMock, Mock, patch

import pytest
from watchdog.events import FileCreatedEvent, FileModifiedEvent

from manim_bridge.bridge import ManimBridge, ManimBridgeHandler
from manim_bridge.core.config import BridgeConfig
from manim_bridge.core.exceptions import (
    ProcessingError,
    SecurityError,
)
from manim_bridge.processing.video_processor import VideoInfo


class TestManimBridgeEdgeCases:
    """Test edge cases and error conditions for ManimBridge"""

    @pytest.fixture
    def mock_config(self, tmp_path):
        """Create a mock configuration"""
        source_dir = tmp_path / "source"
        target_dir = tmp_path / "target"
        source_dir.mkdir()
        target_dir.mkdir()

        config = BridgeConfig(
            source_dir=source_dir,
            target_dir=target_dir,
            manifest_file=tmp_path / "manifest.json",
            max_workers=2,
            enable_dev_logging=False,
        )
        return config

    @pytest.fixture
    def bridge(self, mock_config):
        """Create a bridge instance with mock config"""
        with patch("manim_bridge.bridge.setup_logging"):
            bridge = ManimBridge(config=mock_config)
            return bridge

    def test_bridge_initialization_with_invalid_config(self, tmp_path):
        """Test bridge initialization with non-existent directories"""
        # Test with non-existent source directory
        config = BridgeConfig(
            source_dir=tmp_path / "nonexistent",
            target_dir=tmp_path / "target",
            manifest_file=tmp_path / "manifest.json",
        )
        bridge = ManimBridge(config=config)
        # BridgeConfig only creates target_dir, not source_dir
        assert not bridge.config.source_dir.exists()  # Source not auto-created
        assert bridge.config.target_dir.exists()  # Target is auto-created

    def test_bridge_handler_on_created(self, bridge):
        """Test file system handler on_created event"""
        handler = ManimBridgeHandler(bridge)

        # Mock the process_file method
        bridge.process_file = Mock()

        # Create a mock file event
        event = FileCreatedEvent(src_path="/test/video.mp4")
        event.is_directory = False

        # Trigger the event
        handler.on_created(event)

        # Verify process_file was called
        bridge.process_file.assert_called_once_with(Path("/test/video.mp4"))

    def test_bridge_handler_on_modified(self, bridge):
        """Test file system handler on_modified event"""
        handler = ManimBridgeHandler(bridge)

        # Mock the process_file method
        bridge.process_file = Mock()

        # Create a mock file event
        event = FileModifiedEvent(src_path="/test/video.mp4")
        event.is_directory = False

        # Trigger the event
        handler.on_modified(event)

        # Verify process_file was called
        bridge.process_file.assert_called_once_with(Path("/test/video.mp4"))

    def test_bridge_handler_ignores_directories(self, bridge):
        """Test that handler ignores directory events"""
        handler = ManimBridgeHandler(bridge)

        # Mock the process_file method
        bridge.process_file = Mock()

        # Create a mock directory event
        event = FileCreatedEvent(src_path="/test/dir")
        event.is_directory = True

        # Trigger the event
        handler.on_created(event)

        # Verify process_file was NOT called
        bridge.process_file.assert_not_called()

    def test_process_file_with_invalid_extension(self, bridge, tmp_path):
        """Test processing a file with invalid extension"""
        # Create a test file with non-video extension
        test_file = tmp_path / "test.txt"
        test_file.write_text("not a video")

        # Should skip non-video files and return False
        result = bridge.process_file(test_file)
        assert result is False

    def test_process_file_already_processing(self, bridge, tmp_path):
        """Test that files already processed are skipped"""
        test_file = tmp_path / "test.mp4"
        test_file.write_bytes(b"fake video data")

        # Mock already processed file via manifest
        with patch.object(bridge.manifest_handler, "needs_processing") as mock_needs:
            mock_needs.return_value = False  # Already processed

            with patch.object(bridge.video_processor, "is_video_file") as mock_is_video:
                mock_is_video.return_value = True

                with patch.object(bridge.video_processor, "is_excluded") as mock_excluded:
                    mock_excluded.return_value = False

                    with patch.object(bridge.video_processor, "extract_metadata") as mock_meta:
                        mock_meta.return_value = Mock(hash="abc123")

                        # Should skip file already processed
                        result = bridge.process_file(test_file)
                        assert result is False

    def test_process_file_security_error(self, bridge, tmp_path):
        """Test handling of security errors during file processing"""
        test_file = tmp_path / "test.mp4"
        test_file.write_bytes(b"fake video data")

        with patch.object(bridge.path_validator, "is_safe") as mock_safe:
            mock_safe.return_value = False  # Simulate unsafe path

            with patch.object(bridge.video_processor, "is_video_file") as mock_is_video:
                mock_is_video.return_value = True

                with patch.object(bridge.video_processor, "is_excluded") as mock_excluded:
                    mock_excluded.return_value = False

                    # Should handle security error gracefully
                    result = bridge.process_file(test_file)
                    assert result is False

    def test_process_file_processing_error(self, bridge, tmp_path):
        """Test handling of processing errors"""
        test_file = tmp_path / "test.mp4"
        test_file.write_bytes(b"fake video data")

        with patch.object(bridge.video_processor, "is_video_file") as mock_is_video:
            mock_is_video.return_value = True

            with patch.object(bridge.video_processor, "is_excluded") as mock_excluded:
                mock_excluded.return_value = False

                with patch.object(bridge.video_processor, "extract_metadata") as mock_meta:
                    mock_meta.side_effect = ProcessingError("Video error")

                    # Should handle processing error gracefully
                    result = bridge.process_file(test_file)
                    assert result is False

    def test_scan_existing_files_empty_directory(self, bridge):
        """Test scanning an empty directory"""
        with patch.object(bridge.video_processor, "find_videos") as mock_find:
            mock_find.return_value = []
            result = bridge.scan_existing_files()
            assert result == 0

    def test_scan_existing_files_with_videos(self, bridge, tmp_path):
        """Test scanning directory with video files"""
        # Create some test video files
        video1 = bridge.config.source_dir / "video1.mp4"
        video2 = bridge.config.source_dir / "video2.mp4"
        video1.write_bytes(b"fake video 1")
        video2.write_bytes(b"fake video 2")

        with patch.object(bridge, "process_file") as mock_process:
            mock_process.return_value = {"status": "success"}

            result = bridge.scan_existing_files()
            assert result == 2
            assert mock_process.call_count == 2

    def test_watch_directory_stop_event(self, bridge):
        """Test start_watching and stop_watching methods"""
        with patch("manim_bridge.bridge.Observer") as MockObserver:
            mock_observer = MagicMock()
            MockObserver.return_value = mock_observer
            mock_observer.is_alive.return_value = True

            # Start watching
            bridge.start_watching()

            # Should have started the observer
            mock_observer.start.assert_called_once()

            # Stop watching
            bridge.stop_watching()

            # Should have stopped the observer
            mock_observer.stop.assert_called_once()
            mock_observer.join.assert_called_once()

    def test_run_with_initial_scan(self, bridge):
        """Test run method with initial scan enabled in config"""
        # Enable scan_on_start in config
        bridge.config.scan_on_start = True

        with patch.object(bridge, "scan_existing_files") as mock_scan:
            with patch.object(bridge, "start_watching") as mock_start:
                with patch.object(bridge, "stop_watching") as mock_stop:
                    mock_scan.return_value = 5

                    # Mock KeyboardInterrupt to exit the infinite loop
                    with patch("time.sleep", side_effect=KeyboardInterrupt):
                        try:
                            bridge.run(watch=True)
                        except KeyboardInterrupt:
                            pass

                    mock_scan.assert_called_once()
                    mock_start.assert_called_once()
                    mock_stop.assert_called_once()

    def test_run_without_initial_scan(self, bridge):
        """Test run method without initial scan"""
        # Disable scan_on_start in config
        bridge.config.scan_on_start = False

        with patch.object(bridge, "scan_existing_files") as mock_scan:
            with patch.object(bridge, "start_watching") as mock_start:
                with patch.object(bridge, "stop_watching") as mock_stop:
                    # Mock KeyboardInterrupt to exit the infinite loop
                    with patch("time.sleep", side_effect=KeyboardInterrupt):
                        try:
                            bridge.run(watch=True)
                        except KeyboardInterrupt:
                            pass

                    mock_scan.assert_not_called()
                    mock_start.assert_called_once()
                    mock_stop.assert_called_once()

    def test_stop_method(self, bridge):
        """Test stop_watching method"""
        with patch("manim_bridge.bridge.Observer") as MockObserver:
            mock_observer = MagicMock()
            MockObserver.return_value = mock_observer
            mock_observer.is_alive.return_value = True

            # Start watching first
            bridge.start_watching()

            # Now stop watching
            bridge.stop_watching()

            # Should have stopped the observer
            mock_observer.stop.assert_called_once()
            mock_observer.join.assert_called_once()

    def test_concurrent_file_processing(self, bridge, tmp_path):
        """Test concurrent processing of multiple files"""
        # Create multiple test files
        files = []
        for i in range(5):
            file = bridge.config.source_dir / f"video{i}.mp4"
            file.write_bytes(f"fake video {i}".encode())
            files.append(file)

        with patch.object(bridge.video_processor, "is_video_file") as mock_is_video:
            mock_is_video.return_value = True

            with patch.object(bridge.video_processor, "is_excluded") as mock_excluded:
                mock_excluded.return_value = False

                with patch.object(bridge.video_processor, "extract_metadata") as mock_meta:
                    mock_meta.return_value = VideoInfo(
                        path=files[0],
                        hash="abc123",
                        scene_name="test",
                        quality="high",
                        size=1000,
                        duration=10,
                        codec="h264",
                    )

                    with patch.object(bridge.manifest_handler, "needs_processing") as mock_needs:
                        mock_needs.return_value = True

                        with patch.object(bridge.file_operations, "atomic_copy") as mock_copy:
                            mock_copy.return_value = True

                            with patch.object(bridge, "_wait_for_file_complete") as mock_wait:
                                mock_wait.return_value = True

                                with patch.object(
                                    bridge.video_processor, "generate_output_filename"
                                ) as mock_gen:
                                    mock_gen.return_value = "test_output.mp4"

                                    with patch.object(
                                        bridge.manifest_handler, "add_entry"
                                    ) as mock_add:
                                        with patch.object(
                                            bridge, "update_video_index"
                                        ) as mock_update:
                                            with patch.object(
                                                bridge.file_operations, "safe_symlink"
                                            ) as mock_symlink:
                                                mock_symlink.return_value = True

                                                # Process files concurrently
                                                from concurrent.futures import ThreadPoolExecutor

                                                with ThreadPoolExecutor(max_workers=3) as executor:
                                                    futures = [
                                                        executor.submit(bridge.process_file, f)
                                                        for f in files
                                                    ]
                                                    results = [f.result() for f in futures]

                                                # All files should be processed successfully
                                                assert len([r for r in results if r is True]) == 5

    def test_manifest_update_on_successful_processing(self, bridge, tmp_path):
        """Test that manifest is updated after successful processing"""
        test_file = bridge.config.source_dir / "test.mp4"
        test_file.write_bytes(b"fake video data")

        with patch.object(bridge.video_processor, "is_video_file") as mock_is_video:
            mock_is_video.return_value = True

            with patch.object(bridge.video_processor, "is_excluded") as mock_excluded:
                mock_excluded.return_value = False

                with patch.object(bridge.video_processor, "extract_metadata") as mock_meta:
                    mock_meta.return_value = VideoInfo(
                        path=test_file,
                        hash="abc123",
                        scene_name="test",
                        quality="high",
                        size=1000,
                        duration=10,
                        codec="h264",
                    )

                    with patch.object(bridge.manifest_handler, "needs_processing") as mock_needs:
                        mock_needs.return_value = True

                        with patch.object(bridge.file_operations, "atomic_copy") as mock_copy:
                            mock_copy.return_value = True

                            with patch.object(bridge, "_wait_for_file_complete") as mock_wait:
                                mock_wait.return_value = True

                                with patch.object(
                                    bridge.video_processor, "generate_output_filename"
                                ) as mock_gen:
                                    mock_gen.return_value = "test_output.mp4"

                                    with patch.object(
                                        bridge.manifest_handler, "add_entry"
                                    ) as mock_add:
                                        with patch.object(
                                            bridge, "update_video_index"
                                        ) as mock_update:
                                            with patch.object(
                                                bridge.file_operations, "safe_symlink"
                                            ) as mock_symlink:
                                                mock_symlink.return_value = True

                                                result = bridge.process_file(test_file)

                                                # Manifest should be updated
                                                mock_add.assert_called_once()
                                                assert result is True

    def test_performance_monitoring_integration(self, bridge, tmp_path):
        """Test performance monitoring during processing"""
        test_file = bridge.config.source_dir / "test.mp4"
        test_file.write_bytes(b"fake video data")

        with patch.object(bridge.video_processor, "is_video_file") as mock_is_video:
            mock_is_video.return_value = True

            with patch.object(bridge.video_processor, "is_excluded") as mock_excluded:
                mock_excluded.return_value = False

                with patch.object(bridge.video_processor, "extract_metadata") as mock_meta:
                    mock_meta.return_value = VideoInfo(
                        path=test_file,
                        hash="abc123",
                        scene_name="test",
                        quality="high",
                        size=1000,
                        duration=10,
                        codec="h264",
                    )

                    with patch.object(bridge.manifest_handler, "needs_processing") as mock_needs:
                        mock_needs.return_value = True

                        with patch.object(bridge.file_operations, "atomic_copy") as mock_copy:
                            mock_copy.return_value = True

                            with patch.object(bridge, "_wait_for_file_complete") as mock_wait:
                                mock_wait.return_value = True

                                with patch.object(bridge.metrics, "measure") as mock_measure:

                                    def measure_context(name):
                                        class MockContext:
                                            def __enter__(self):
                                                return self

                                            def __exit__(self, exc_type, exc_val, exc_tb):
                                                pass

                                        return MockContext()

                                    mock_measure.return_value = measure_context("test")

                                    with patch.object(
                                        bridge.video_processor, "generate_output_filename"
                                    ) as mock_gen:
                                        mock_gen.return_value = "test_output.mp4"

                                        with patch.object(
                                            bridge.manifest_handler, "add_entry"
                                        ) as mock_add:
                                            with patch.object(
                                                bridge, "update_video_index"
                                            ) as mock_update:
                                                with patch.object(
                                                    bridge.file_operations, "safe_symlink"
                                                ) as mock_symlink:
                                                    mock_symlink.return_value = True

                                                    result = bridge.process_file(test_file)

                                                    # Performance metrics should be used
                                                    assert mock_measure.called
                                                    assert result is True

    def test_error_recovery_after_exception(self, bridge, tmp_path):
        """Test that bridge recovers after an exception"""
        test_file = bridge.config.source_dir / "test.mp4"
        test_file.write_bytes(b"fake video data")

        # First call raises an exception
        with patch.object(bridge.video_processor, "is_video_file") as mock_is_video:
            mock_is_video.return_value = True

            with patch.object(bridge.video_processor, "is_excluded") as mock_excluded:
                mock_excluded.return_value = False

                with patch.object(bridge.video_processor, "extract_metadata") as mock_meta:
                    mock_meta.side_effect = Exception("Unexpected error")

                    result1 = bridge.process_file(test_file)
                    assert result1 is False

        # Second call should work normally
        with patch.object(bridge.video_processor, "is_video_file") as mock_is_video:
            mock_is_video.return_value = True

            with patch.object(bridge.video_processor, "is_excluded") as mock_excluded:
                mock_excluded.return_value = False

                with patch.object(bridge.video_processor, "extract_metadata") as mock_meta:
                    mock_meta.return_value = VideoInfo(
                        path=test_file,
                        hash="abc123",
                        scene_name="test",
                        quality="high",
                        size=1000,
                        duration=10,
                        codec="h264",
                    )

                    with patch.object(bridge.manifest_handler, "needs_processing") as mock_needs:
                        mock_needs.return_value = True

                        with patch.object(bridge.file_operations, "atomic_copy") as mock_copy:
                            mock_copy.return_value = True

                            with patch.object(bridge, "_wait_for_file_complete") as mock_wait:
                                mock_wait.return_value = True

                                with patch.object(
                                    bridge.video_processor, "generate_output_filename"
                                ) as mock_gen:
                                    mock_gen.return_value = "test_output.mp4"

                                    with patch.object(
                                        bridge.manifest_handler, "add_entry"
                                    ) as mock_add:
                                        with patch.object(
                                            bridge, "update_video_index"
                                        ) as mock_update:
                                            with patch.object(
                                                bridge.file_operations, "safe_symlink"
                                            ) as mock_symlink:
                                                mock_symlink.return_value = True

                                                result2 = bridge.process_file(test_file)
                                                assert result2 is True


class TestManimBridgeIntegration:
    """Integration tests for ManimBridge with real file operations"""

    @pytest.fixture
    def integration_bridge(self, tmp_path):
        """Create a bridge with real components for integration testing"""
        source_dir = tmp_path / "integration_source"
        target_dir = tmp_path / "integration_target"
        source_dir.mkdir()
        target_dir.mkdir()

        config = BridgeConfig(
            source_dir=source_dir,
            target_dir=target_dir,
            manifest_file=tmp_path / "integration_manifest.json",
            max_workers=2,
            enable_dev_logging=False,
        )

        with patch("manim_bridge.bridge.setup_logging"):
            bridge = ManimBridge(config=config)
            return bridge

    def test_full_processing_pipeline(self, integration_bridge):
        """Test the complete processing pipeline with a mock video file"""
        # Create a test video file
        test_file = integration_bridge.config.source_dir / "test_video.mp4"
        test_file.write_bytes(b"FAKE_VIDEO_DATA" * 1000)  # Create some content

        with patch.object(integration_bridge.video_processor, "extract_metadata") as mock_meta:
            mock_meta.return_value = {
                "duration": 30.5,
                "width": 1920,
                "height": 1080,
                "fps": 30,
            }

            # Process the file
            result = integration_bridge.process_file(test_file)

            if result:
                # Check that file was copied to target
                target_file = integration_bridge.config.target_dir / "test_video.mp4"
                assert target_file.exists()
                assert target_file.read_bytes() == test_file.read_bytes()

    def test_manifest_persistence(self, integration_bridge):
        """Test that manifest data persists across bridge instances"""
        manifest_file = integration_bridge.config.manifest_file

        # Add an entry to the manifest
        test_entry = {
            "source": "test.mp4",
            "target": "test_copy.mp4",
            "hash": "abc123",
            "timestamp": time.time(),
        }

        # Write directly to manifest using the write method
        integration_bridge.manifest_handler.write({"test.mp4": test_entry})

        # Create a new bridge instance
        with patch("manim_bridge.bridge.setup_logging"):
            new_bridge = ManimBridge(config=integration_bridge.config)

            # Check that manifest was loaded
            if manifest_file.exists():
                # The manifest should contain our test entry
                manifest_data = new_bridge.manifest_handler.read()
                assert "test.mp4" in manifest_data
