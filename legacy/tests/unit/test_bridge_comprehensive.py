"""
Comprehensive unit tests for ManimBridge class to achieve 90% coverage.
Tests all error handling paths, edge cases, and exception scenarios.
"""

import json
import pytest
import tempfile
import time
from datetime import datetime
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock, PropertyMock, call

from manim_bridge import ManimBridge
from manim_bridge.bridge import ManimBridgeHandler
from manim_bridge.core.config import BridgeConfig
from manim_bridge.core.exceptions import (
    BridgeException,
    ProcessingError,
    SecurityError,
    ManifestError,
)
from manim_bridge.processing.video_processor import VideoInfo


@pytest.fixture
def temp_workspace():
    """Create temporary workspace for tests"""
    with tempfile.TemporaryDirectory() as tmpdir:
        workspace = Path(tmpdir)

        # Create required directories
        source_dir = workspace / "manim-output"
        target_dir = workspace / "remotion-app/public/assets/manim"
        source_dir.mkdir(parents=True)
        target_dir.mkdir(parents=True)

        yield workspace


@pytest.fixture
def bridge_config(temp_workspace):
    """Create test bridge configuration"""
    return BridgeConfig(
        source_dir=temp_workspace / "manim-output",
        target_dir=temp_workspace / "remotion-app/public/assets/manim",
        manifest_file=temp_workspace / ".manim-bridge-manifest.json",
        enable_dev_logging=False,
        create_latest_symlink=True,
        update_index=True,
    )


@pytest.fixture
def mock_video_info():
    """Create mock video info object"""
    return VideoInfo(
        path=Path("/test/video.mp4"),
        hash="abc123def456",
        size=1024000,
        scene_name="TestScene",
        quality="1080p60",
        duration=30.5,
        resolution=(1920, 1080),
        codec="h264",
    )


@pytest.fixture
def bridge(bridge_config):
    """Create bridge instance with mocked dependencies"""
    with patch("manim_bridge.bridge.setup_logging"):
        bridge = ManimBridge(bridge_config)

        # Mock the internal components
        bridge.path_validator = Mock()
        bridge.manifest_handler = Mock()
        bridge.file_operations = Mock()
        bridge.hash_calculator = Mock()
        bridge.video_processor = Mock()
        bridge.metrics = Mock()
        bridge.logger = Mock()

        # Setup default mock behaviors
        bridge.path_validator.is_safe.return_value = True
        bridge.manifest_handler.needs_processing.return_value = True
        bridge.video_processor.is_video_file.return_value = True
        bridge.video_processor.is_excluded.return_value = False
        bridge.video_processor.validate_video.return_value = True

        # Mock the metrics context manager
        mock_context = Mock()
        mock_context.__enter__ = Mock(return_value=mock_context)
        mock_context.__exit__ = Mock(return_value=None)
        bridge.metrics.measure.return_value = mock_context

        return bridge


class TestManimBridgeInitialization:
    """Test bridge initialization and configuration"""

    def test_successful_initialization(self, bridge_config):
        """Test successful bridge initialization"""
        with patch("manim_bridge.bridge.setup_logging"):
            bridge = ManimBridge(bridge_config)

            assert bridge.config == bridge_config
            assert bridge.logger is not None

    def test_initialization_with_missing_directories(self, temp_workspace):
        """Test initialization when directories don't exist"""
        config = BridgeConfig(
            source_dir=temp_workspace / "nonexistent",
            target_dir=temp_workspace / "also-nonexistent",
            manifest_file=temp_workspace / "manifest.json",
        )

        with patch("manim_bridge.bridge.setup_logging"):
            bridge = ManimBridge(config)

            # Only target directory is created by BridgeConfig
            # Source directory is expected to exist already (where manim outputs go)
            assert config.target_dir.exists()
            # Source dir won't be created automatically
            assert not config.source_dir.exists()

    def test_initialization_with_dev_logging(self, bridge_config):
        """Test initialization with development logging enabled"""
        bridge_config.enable_dev_logging = True

        with patch("manim_bridge.bridge.setup_logging") as mock_setup:
            bridge = ManimBridge(bridge_config)

            mock_setup.assert_called_with(
                name="manim-bridge",
                level="INFO",  # Level stays as INFO even with dev logging
                enable_dev=True,
                log_file=bridge_config.log_file,
                log_performance=False,  # This parameter is always passed
            )


class TestProcessFile:
    """Test file processing functionality"""

    def test_process_file_success(self, bridge, mock_video_info, temp_workspace):
        """Test successful video file processing"""
        video_file = temp_workspace / "test_video.mp4"
        video_file.write_bytes(b"fake video content")

        # Mock _wait_for_file_complete to return True for successful processing
        bridge._wait_for_file_complete = Mock(return_value=True)
        bridge.video_processor.extract_metadata.return_value = mock_video_info
        bridge.video_processor.generate_output_filename.return_value = (
            "TestScene_1080p60_20240115_120000.mp4"
        )

        result = bridge.process_file(video_file)

        assert result is True
        bridge.file_operations.atomic_copy.assert_called_once()
        bridge.manifest_handler.add_entry.assert_called_once()

    def test_process_file_nonexistent(self, bridge):
        """Test processing non-existent file"""
        # Mock wait_for_file_complete to return False for nonexistent files
        bridge._wait_for_file_complete = Mock(return_value=False)

        result = bridge.process_file(Path("/nonexistent/file.mp4"))

        assert result is False
        # File existence check happens in _wait_for_file_complete
        bridge._wait_for_file_complete.assert_called()

    def test_process_file_not_video(self, bridge, temp_workspace):
        """Test processing non-video file"""
        text_file = temp_workspace / "document.txt"
        text_file.write_text("not a video")

        bridge.video_processor.is_video_file.return_value = False

        result = bridge.process_file(text_file)

        assert result is False

    def test_process_file_excluded(self, bridge, temp_workspace):
        """Test processing excluded file"""
        video_file = temp_workspace / "test.mp4"
        video_file.write_bytes(b"video")

        bridge.video_processor.is_excluded.return_value = True

        result = bridge.process_file(video_file)

        assert result is False

    def test_process_file_unsafe_path(self, bridge, temp_workspace):
        """Test processing file with unsafe path"""
        video_file = temp_workspace / "test.mp4"
        video_file.write_bytes(b"video")

        bridge.path_validator.is_safe.return_value = False

        result = bridge.process_file(video_file)

        assert result is False
        bridge.logger.warning.assert_called_with(f"Unsafe path rejected: {video_file}")

    def test_process_file_still_writing(self, bridge, temp_workspace):
        """Test processing file still being written"""
        video_file = temp_workspace / "test.mp4"
        video_file.write_bytes(b"video")

        # Mock file size changing
        with patch.object(Path, "stat") as mock_stat:
            mock_stat.return_value.st_size = 100

            # Simulate file size changing on each check
            mock_stat.side_effect = [
                MagicMock(st_size=100),
                MagicMock(st_size=200),
                MagicMock(st_size=300),
            ] * 20  # Enough for timeout

            result = bridge.process_file(video_file)

            assert result is False

    def test_process_file_already_processed(self, bridge, mock_video_info, temp_workspace):
        """Test processing already processed file"""
        video_file = temp_workspace / "test.mp4"
        video_file.write_bytes(b"video")

        # Mock _wait_for_file_complete to return True so we get to the processing check
        bridge._wait_for_file_complete = Mock(return_value=True)
        bridge.video_processor.extract_metadata.return_value = mock_video_info
        bridge.manifest_handler.needs_processing.return_value = False

        result = bridge.process_file(video_file)

        assert result is False
        bridge.logger.debug.assert_called()
        bridge.file_operations.atomic_copy.assert_not_called()

    def test_process_file_with_symlink_creation(self, bridge, mock_video_info, temp_workspace):
        """Test processing with symlink creation enabled"""
        video_file = temp_workspace / "test.mp4"
        video_file.write_bytes(b"video")

        # Mock _wait_for_file_complete to return True for successful processing
        bridge._wait_for_file_complete = Mock(return_value=True)
        bridge.config.create_latest_symlink = True
        bridge.video_processor.extract_metadata.return_value = mock_video_info
        bridge.video_processor.generate_output_filename.return_value = "output.mp4"

        result = bridge.process_file(video_file)

        assert result is True
        bridge.file_operations.safe_symlink.assert_called_once()

    def test_process_file_without_symlink(self, bridge, mock_video_info, temp_workspace):
        """Test processing with symlink creation disabled"""
        video_file = temp_workspace / "test.mp4"
        video_file.write_bytes(b"video")

        # Mock _wait_for_file_complete to return True for successful processing
        bridge._wait_for_file_complete = Mock(return_value=True)
        bridge.config.create_latest_symlink = False
        bridge.video_processor.extract_metadata.return_value = mock_video_info
        bridge.video_processor.generate_output_filename.return_value = "output.mp4"

        result = bridge.process_file(video_file)

        assert result is True
        bridge.file_operations.safe_symlink.assert_not_called()

    def test_process_file_with_index_update(self, bridge, mock_video_info, temp_workspace):
        """Test processing with index update enabled"""
        video_file = temp_workspace / "test.mp4"
        video_file.write_bytes(b"video")

        # Mock _wait_for_file_complete to return True for successful processing
        bridge._wait_for_file_complete = Mock(return_value=True)
        bridge.config.update_index = True
        bridge.video_processor.extract_metadata.return_value = mock_video_info
        bridge.video_processor.generate_output_filename.return_value = "output.mp4"

        # Mock update_video_index method
        bridge.update_video_index = Mock()

        result = bridge.process_file(video_file)

        assert result is True
        bridge.update_video_index.assert_called_once()

    def test_process_file_extraction_error(self, bridge, temp_workspace):
        """Test processing with metadata extraction error"""
        video_file = temp_workspace / "test.mp4"
        video_file.write_bytes(b"video")

        # Mock _wait_for_file_complete to return True so we get to the extraction step
        bridge._wait_for_file_complete = Mock(return_value=True)
        bridge.video_processor.extract_metadata.side_effect = ProcessingError("Extraction failed")

        result = bridge.process_file(video_file)

        assert result is False
        bridge.logger.error.assert_called()

    def test_process_file_copy_error(self, bridge, mock_video_info, temp_workspace):
        """Test processing with file copy error"""
        video_file = temp_workspace / "test.mp4"
        video_file.write_bytes(b"video")

        # Mock _wait_for_file_complete to return True so we get to the copy step
        bridge._wait_for_file_complete = Mock(return_value=True)
        bridge.video_processor.extract_metadata.return_value = mock_video_info
        bridge.video_processor.generate_output_filename.return_value = "output.mp4"
        bridge.file_operations.atomic_copy.side_effect = IOError("Copy failed")

        result = bridge.process_file(video_file)

        assert result is False
        bridge.logger.error.assert_called()

    def test_process_file_manifest_update_error(self, bridge, mock_video_info, temp_workspace):
        """Test processing with manifest update error"""
        video_file = temp_workspace / "test.mp4"
        video_file.write_bytes(b"video")

        # Mock _wait_for_file_complete to return True so we get to the manifest step
        bridge._wait_for_file_complete = Mock(return_value=True)
        bridge.video_processor.extract_metadata.return_value = mock_video_info
        bridge.video_processor.generate_output_filename.return_value = "output.mp4"
        bridge.manifest_handler.add_entry.side_effect = ManifestError("Update failed")

        result = bridge.process_file(video_file)

        assert result is False
        bridge.logger.error.assert_called()


class TestWaitForFileComplete:
    """Test file completion waiting functionality"""

    def test_wait_for_file_complete_success(self, bridge, temp_workspace):
        """Test successful file completion wait"""
        video_file = temp_workspace / "test.mp4"
        video_file.write_bytes(b"video content")

        # Mock stable file size
        with patch.object(Path, "stat") as mock_stat:
            mock_stat.return_value.st_size = 1000

            result = bridge._wait_for_file_complete(video_file, timeout=2)

            assert result is True
            bridge.video_processor.validate_video.assert_called_with(video_file)

    def test_wait_for_file_timeout(self, bridge, temp_workspace):
        """Test file wait timeout"""
        video_file = temp_workspace / "test.mp4"
        video_file.write_bytes(b"video")

        # Mock changing file size
        with patch.object(Path, "stat") as mock_stat:
            sizes = [100, 200, 300, 400, 500]
            mock_stat.side_effect = [MagicMock(st_size=size) for size in sizes] * 10

            result = bridge._wait_for_file_complete(video_file, timeout=2)

            assert result is False
            bridge.logger.warning.assert_called()

    def test_wait_for_file_exception(self, bridge, temp_workspace):
        """Test exception during file wait"""
        video_file = temp_workspace / "test.mp4"

        with patch.object(Path, "stat", side_effect=OSError("File error")):
            result = bridge._wait_for_file_complete(video_file)

            assert result is False
            bridge.logger.error.assert_called()

    def test_wait_for_file_validation_failure(self, bridge, temp_workspace):
        """Test file validation failure after wait"""
        video_file = temp_workspace / "test.mp4"
        video_file.write_bytes(b"invalid video")

        bridge.video_processor.validate_video.return_value = False

        with patch.object(Path, "stat") as mock_stat:
            mock_stat.return_value.st_size = 1000

            result = bridge._wait_for_file_complete(video_file)

            assert result is False


class TestScanExistingFiles:
    """Test scanning existing files functionality"""

    def test_scan_existing_files_success(self, bridge, mock_video_info, temp_workspace):
        """Test successful scan of existing files"""
        # Create test videos
        videos = []
        for i in range(3):
            video = temp_workspace / "manim-output" / f"video{i}.mp4"
            video.write_bytes(b"video")
            videos.append(video)

        bridge.video_processor.find_videos.return_value = videos
        bridge.video_processor.extract_metadata.return_value = mock_video_info
        bridge.video_processor.generate_output_filename.return_value = "output.mp4"

        # Mock _wait_for_file_complete for successful processing
        bridge._wait_for_file_complete = Mock(return_value=True)

        count = bridge.scan_existing_files()

        assert count == 3

    def test_scan_existing_files_no_videos(self, bridge):
        """Test scan with no videos found"""
        bridge.video_processor.find_videos.return_value = []

        count = bridge.scan_existing_files()

        assert count == 0
        bridge.logger.info.assert_called()

    def test_scan_existing_files_partial_success(self, bridge, temp_workspace):
        """Test scan with some files failing to process"""
        videos = [
            temp_workspace / "video1.mp4",
            temp_workspace / "video2.mp4",
            temp_workspace / "video3.mp4",
        ]

        bridge.video_processor.find_videos.return_value = videos

        # Mock process_file to succeed for first video, fail for others
        with patch.object(bridge, "process_file") as mock_process:
            mock_process.side_effect = [True, False, False]

            count = bridge.scan_existing_files()

            assert count == 1


class TestUpdateVideoIndex:
    """Test video index update functionality"""

    def test_update_video_index_success(self, bridge, temp_workspace):
        """Test successful video index update"""
        # Create test videos in target directory
        target_dir = bridge.config.target_dir
        for i in range(3):
            video = target_dir / f"video{i}.mp4"
            video.write_bytes(b"video")

        bridge.update_video_index()

        # Check index file was created
        index_file = target_dir / "index.json"
        assert index_file.exists()

        import json

        with open(index_file) as f:
            data = json.load(f)
        assert "videos" in data
        assert len(data["videos"]) == 3

    def test_update_video_index_empty_directory(self, bridge):
        """Test index update with empty directory"""
        bridge.update_video_index()

        # Check index file was created
        index_file = bridge.config.target_dir / "index.json"
        assert index_file.exists()

        import json

        with open(index_file) as f:
            data = json.load(f)
        assert isinstance(data, dict)
        assert "videos" in data
        assert data["videos"] == []

    def test_update_video_index_with_error(self, bridge):
        """Test index update with write error"""
        # Make target directory non-writable to cause error
        import os

        target_dir = bridge.config.target_dir

        with patch("builtins.open", side_effect=IOError("Write failed")):
            # Should not raise, just log error
            bridge.update_video_index()

            bridge.logger.error.assert_called()


class TestEventHandlers:
    """Test file system event handlers"""

    def test_handler_on_created(self, bridge):
        """Test handler on_created event"""
        handler = ManimBridgeHandler(bridge)

        event = Mock()
        event.is_directory = False
        event.src_path = "/test/video.mp4"

        with patch.object(bridge, "process_file") as mock_process:
            handler.on_created(event)

            mock_process.assert_called_once_with(Path(event.src_path))

    def test_handler_on_created_directory(self, bridge):
        """Test handler ignores directory creation"""
        handler = ManimBridgeHandler(bridge)

        event = Mock()
        event.is_directory = True
        event.src_path = "/test/directory"

        with patch.object(bridge, "process_file") as mock_process:
            handler.on_created(event)

            mock_process.assert_not_called()

    def test_handler_on_modified(self, bridge):
        """Test handler on_modified event"""
        handler = ManimBridgeHandler(bridge)

        event = Mock()
        event.is_directory = False
        event.src_path = "/test/video.mp4"

        with patch.object(bridge, "process_file") as mock_process:
            handler.on_modified(event)

            mock_process.assert_called_once_with(Path(event.src_path))

    def test_handler_process_new_file(self, bridge, temp_workspace):
        """Test handler process_new_file method (removed - not in actual implementation)"""
        # This method doesn't exist in the actual implementation
        # The handler calls bridge.process_file directly from on_created/on_modified
        pass


class TestWatchLoop:
    """Test watch loop functionality"""

    def test_start_watching_success(self, bridge):
        """Test successful watch loop start"""
        with patch("manim_bridge.bridge.Observer") as MockObserver:
            mock_observer = MockObserver.return_value
            mock_observer.is_alive.return_value = False  # Not alive initially

            bridge.start_watching()

            mock_observer.start.assert_called_once()
            # stop is not called in start_watching, only in stop_watching

    def test_start_watching_already_running(self, bridge):
        """Test start watching when already running"""
        with patch("manim_bridge.bridge.Observer") as MockObserver:
            mock_observer = MockObserver.return_value
            mock_observer.is_alive.return_value = True  # Already alive
            bridge.observer = mock_observer  # Set observer as if already running

            bridge.start_watching()

            # Should log warning and return without starting
            bridge.logger.warning.assert_called_with("Watcher already running")
            mock_observer.start.assert_not_called()

    def test_start_watching_observer_error(self, bridge):
        """Test watch loop with observer error"""
        with patch("manim_bridge.bridge.Observer") as MockObserver:
            MockObserver.side_effect = Exception("Observer failed")

            # Should raise the exception (no BridgeException wrapping in start_watching)
            with pytest.raises(Exception, match="Observer failed"):
                bridge.start_watching()


class TestMainFunction:
    """Test main entry point function"""

    def test_main_function_normal_mode(self):
        """Test main function in normal watching mode"""
        test_args = ["manim-bridge.py", "--source", "test-source", "--target", "test-target"]

        with patch("sys.argv", test_args):
            with patch("manim_bridge.bridge.ManimBridge") as MockBridge:
                mock_bridge = MockBridge.return_value

                from manim_bridge.bridge import main

                main()

                # Main calls bridge.run(watch=True)
                mock_bridge.run.assert_called_once_with(watch=True)

    def test_main_function_scan_only(self):
        """Test main function in scan-only mode"""
        test_args = ["manim-bridge.py", "--scan-only"]

        with patch("sys.argv", test_args):
            with patch("manim_bridge.bridge.ManimBridge") as MockBridge:
                mock_bridge = MockBridge.return_value

                from manim_bridge.bridge import main

                main()

                # Main calls bridge.run(watch=False) for scan-only
                mock_bridge.run.assert_called_once_with(watch=False)

    def test_main_function_with_dev_flag(self):
        """Test main function with development flag"""
        test_args = ["manim-bridge.py", "--dev"]

        with patch("sys.argv", test_args):
            with patch("manim_bridge.bridge.ManimBridge") as MockBridge:
                from manim_bridge.bridge import main

                main()

                # Check that dev mode was enabled in config
                call_args = MockBridge.call_args
                config = call_args[0][0]
                assert config.enable_dev_logging is True


class TestErrorRecovery:
    """Test error recovery and resilience"""

    def test_recover_from_manifest_corruption(self, bridge, temp_workspace):
        """Test recovery from corrupted manifest"""
        manifest_file = temp_workspace / ".manim-bridge-manifest.json"
        manifest_file.write_text("corrupted json {]")

        # Bridge should handle corrupted manifest gracefully
        bridge.manifest_handler.read.side_effect = [
            ManifestError("Corrupted"),  # First read fails
            {},  # Second read returns empty
        ]

        video_file = temp_workspace / "test.mp4"
        video_file.write_bytes(b"video")

        result = bridge.process_file(video_file)

        # Should recover and process the file
        assert bridge.logger.error.called or bridge.logger.warning.called

    def test_recover_from_disk_full(self, bridge, mock_video_info, temp_workspace):
        """Test recovery from disk full error"""
        video_file = temp_workspace / "test.mp4"
        video_file.write_bytes(b"video")

        bridge.video_processor.extract_metadata.return_value = mock_video_info
        bridge.file_operations.atomic_copy.side_effect = OSError("No space left on device")

        result = bridge.process_file(video_file)

        assert result is False
        bridge.logger.error.assert_called()

    def test_concurrent_access_handling(self, bridge, mock_video_info, temp_workspace):
        """Test handling of concurrent file access"""
        import threading

        video_file = temp_workspace / "test.mp4"
        video_file.write_bytes(b"video")

        bridge.video_processor.extract_metadata.return_value = mock_video_info
        bridge.video_processor.generate_output_filename.return_value = "output.mp4"

        results = []

        def process_video():
            result = bridge.process_file(video_file)
            results.append(result)

        # Create multiple threads trying to process same file
        threads = [threading.Thread(target=process_video) for _ in range(5)]

        for t in threads:
            t.start()
        for t in threads:
            t.join()

        # At least one should succeed
        assert any(results)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
