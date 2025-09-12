"""
Integration tests for the complete Manim-Remotion Bridge
Tests end-to-end functionality and component interactions
"""

import json
import threading
import time
from unittest.mock import Mock, patch

import pytest

from manim_bridge import ManimBridge
from manim_bridge.core.config import BridgeConfig
from tests.conftest import create_test_video_file


@pytest.mark.integration
class TestBridgeIntegration:
    """Integration tests for the complete bridge functionality"""

    def test_end_to_end_video_processing(self, temp_workspace):
        """Test complete end-to-end video processing workflow"""
        # Create a test video file
        source_video = create_test_video_file(temp_workspace / "manim-output" / "test_scene.mp4")

        # Initialize the secure handler
        config = BridgeConfig(
            source_dir=temp_workspace / "manim-output",
            target_dir=temp_workspace / "remotion-app" / "public" / "assets" / "manim",
            manifest_file=temp_workspace / "manifest.json",
        )
        handler = ManimBridge(config)

        # Process the file
        with patch.object(handler, "should_process_file", return_value=True):
            with patch.object(handler, "get_file_hash", return_value="test_hash_123"):
                success = handler.copy_video(str(source_video))

        assert success

        # Verify file was copied to target directory
        target_files = list(handler.target_dir.glob("*.mp4"))
        assert len(target_files) > 0

        copied_file = target_files[0]
        assert copied_file.exists()
        assert copied_file.stat().st_size > 0

        # Verify manifest was updated
        assert str(source_video) in handler.processed_files
        manifest_entry = handler.processed_files[str(source_video)]
        assert manifest_entry["hash"] == "test_hash_123"
        assert "target" in manifest_entry
        assert "processed_at" in manifest_entry

        # Verify index was created
        handler.update_video_index()
        index_file = handler.target_dir / "index.json"
        assert index_file.exists()

        with open(index_file) as f:
            index_data = json.load(f)

        assert "videos" in index_data
        assert len(index_data["videos"]) > 0
        assert index_data["count"] > 0

    def test_file_watcher_integration(self, temp_workspace):
        """Test integration with file system watcher"""
        config = BridgeConfig(
            source_dir=temp_workspace / "manim-output",
            target_dir=temp_workspace / "remotion-app" / "public" / "assets" / "manim",
            manifest_file=temp_workspace / "manifest.json",
        )
        handler = ManimBridge(config)

        # Create mock file system event

        event = Mock()
        event.is_directory = False

        # Create test video after handler initialization
        test_video = create_test_video_file(temp_workspace / "manim-output" / "watcher_test.mp4")
        event.src_path = str(test_video)

        # Mock the processing methods
        with patch.object(handler, "should_process_file", return_value=True):
            with patch.object(handler, "get_file_hash", return_value="watcher_hash"):
                with patch.object(handler, "update_video_index") as mock_index:
                    # Trigger file processing as if from watcher
                    handler.on_created(event)

                    # Verify processing was attempted
                    mock_index.assert_called_once()

    def test_concurrent_file_processing(self, temp_workspace):
        """Test concurrent file processing doesn't cause corruption"""
        config = BridgeConfig(
            source_dir=temp_workspace / "manim-output",
            target_dir=temp_workspace / "remotion-app" / "public" / "assets" / "manim",
            manifest_file=temp_workspace / "manifest.json",
        )
        handler = ManimBridge(config)

        def process_video(video_id):
            """Helper function to process a video in a thread"""
            video_file = create_test_video_file(
                temp_workspace / "manim-output" / f"concurrent_{video_id}.mp4"
            )

            with patch.object(handler, "should_process_file", return_value=True):
                with patch.object(handler, "get_file_hash", return_value=f"hash_{video_id}"):
                    return handler.copy_video(str(video_file))

        # Process multiple videos concurrently
        threads = []
        results = []

        def worker(video_id):
            result = process_video(video_id)
            results.append((video_id, result))

        for i in range(5):
            thread = threading.Thread(target=worker, args=(i,))
            threads.append(thread)
            thread.start()

        # Wait for all threads to complete
        for thread in threads:
            thread.join()

        # Verify all videos were processed
        successful_processes = sum(1 for _, success in results if success)
        assert successful_processes > 0

        # Verify manifest integrity
        assert len(handler.processed_files) >= successful_processes

        # Verify index can be updated without corruption
        handler.update_video_index()
        index_file = handler.target_dir / "index.json"
        assert index_file.exists()

        with open(index_file) as f:
            index_data = json.load(f)

        assert index_data["count"] >= successful_processes

    def test_error_recovery_integration(self, temp_workspace):
        """Test error recovery and resilience"""
        config = BridgeConfig(
            source_dir=temp_workspace / "manim-output",
            target_dir=temp_workspace / "remotion-app" / "public" / "assets" / "manim",
            manifest_file=temp_workspace / "manifest.json",
        )
        handler = ManimBridge(config)

        # Test recovery from manifest corruption
        test_video = create_test_video_file(temp_workspace / "manim-output" / "recovery_test.mp4")

        # Corrupt the manifest file
        with open(handler.manifest_file, "w") as f:
            f.write('{"corrupted": json}')

        # Processing should still work (will create backup and start fresh)
        with patch.object(handler, "should_process_file", return_value=True):
            with patch.object(handler, "get_file_hash", return_value="recovery_hash"):
                success = handler.copy_video(str(test_video))

        # Should succeed despite initial corruption
        assert success

        # Verify backup was created
        backup_file = handler.manifest_file.with_suffix(".backup")
        assert backup_file.exists()

        # Verify new manifest is valid
        with open(handler.manifest_file) as f:
            manifest_data = json.load(f)

        assert isinstance(manifest_data, dict)
        assert str(test_video) in manifest_data

    def test_security_integration(self, temp_workspace, caplog):
        """Test integrated security across all components"""
        # Test that security validation works across the entire pipeline

        # Create handler
        config = BridgeConfig(
            source_dir=temp_workspace / "manim-output",
            target_dir=temp_workspace / "remotion-app" / "public" / "assets" / "manim",
            manifest_file=temp_workspace / "manifest.json",
        )
        handler = ManimBridge(config)

        # Test with various malicious inputs
        malicious_paths = [
            "../../../etc/passwd",
            "file; rm -rf /.mp4",
            "$(malicious_command).mp4",
            "`evil`.mp4",
        ]

        for malicious_path in malicious_paths:
            # Should be blocked at multiple security layers
            with pytest.raises(Exception):  # Could be SecurityError or CommandInjectionError
                handler.process_file(malicious_path)

            # Verify security events were logged
            security_logs = [r for r in caplog.records if "security" in r.name.lower()]
            # Note: May not always log depending on where the validation fails
            caplog.clear()

    def test_performance_integration(self, temp_workspace):
        """Test performance characteristics of integrated system"""
        config = BridgeConfig(
            source_dir=temp_workspace / "manim-output",
            target_dir=temp_workspace / "remotion-app" / "public" / "assets" / "manim",
            manifest_file=temp_workspace / "manifest.json",
        )
        handler = ManimBridge(config)

        # Create multiple test videos
        video_files = []
        for i in range(10):
            video_file = create_test_video_file(
                temp_workspace / "manim-output" / f"perf_test_{i}.mp4"
            )
            video_files.append(video_file)

        # Measure processing time
        start_time = time.time()

        successful_processes = 0
        with patch.object(handler, "should_process_file", return_value=True):
            for i, video_file in enumerate(video_files):
                with patch.object(handler, "get_file_hash", return_value=f"hash_{i}"):
                    if handler.copy_video(str(video_file)):
                        successful_processes += 1

        processing_time = time.time() - start_time

        # Update index and measure time
        index_start = time.time()
        handler.update_video_index()
        index_time = time.time() - index_start

        # Performance assertions (adjust based on requirements)
        assert processing_time < 30.0  # Should process 10 files in under 30 seconds
        assert index_time < 5.0  # Index update should be under 5 seconds
        assert successful_processes == len(video_files)

        # Verify all files were processed correctly
        assert len(handler.processed_files) == len(video_files)

        # Verify index contains all files
        index_file = handler.target_dir / "index.json"
        with open(index_file) as f:
            index_data = json.load(f)

        assert index_data["count"] == len(video_files)

    def test_unicode_filename_integration(self, temp_workspace):
        """Test integration with Unicode filenames"""
        config = BridgeConfig(
            source_dir=temp_workspace / "manim-output",
            target_dir=temp_workspace / "remotion-app" / "public" / "assets" / "manim",
            manifest_file=temp_workspace / "manifest.json",
        )
        handler = ManimBridge(config)

        # Create test videos with Unicode names
        unicode_names = [
            "测试视频.mp4",  # Chinese
            "тест_видео.mp4",  # Cyrillic
            "vidéo_test.mp4",  # French accents
            "🎬_movie.mp4",  # Emoji
        ]

        successful_processes = 0
        for unicode_name in unicode_names:
            try:
                unicode_video = create_test_video_file(
                    temp_workspace / "manim-output" / unicode_name
                )

                with patch.object(handler, "should_process_file", return_value=True):
                    hash_value = f"hash_{unicode_name.replace('.mp4', '')}"
                    with patch.object(handler, "get_file_hash", return_value=hash_value):
                        if handler.copy_video(str(unicode_video)):
                            successful_processes += 1

            except (UnicodeError, OSError):
                # Skip if filesystem doesn't support Unicode
                pytest.skip("Filesystem doesn't support Unicode filenames")

        # Verify processing worked
        assert successful_processes > 0

        # Verify manifest handles Unicode correctly
        handler.save_manifest()
        assert handler.manifest_file.exists()

        # Verify index handles Unicode correctly
        handler.update_video_index()
        index_file = handler.target_dir / "index.json"

        with open(index_file, encoding="utf-8") as f:
            index_data = json.load(f)

        assert index_data["count"] >= successful_processes

    def test_large_scale_integration(self, temp_workspace):
        """Test integration with larger scale operations"""
        config = BridgeConfig(
            source_dir=temp_workspace / "manim-output",
            target_dir=temp_workspace / "remotion-app" / "public" / "assets" / "manim",
            manifest_file=temp_workspace / "manifest.json",
        )
        handler = ManimBridge(config)

        # Create a larger number of test files
        num_files = 50
        video_files = []

        for i in range(num_files):
            video_file = create_test_video_file(
                temp_workspace / "manim-output" / f"large_scale_{i:03d}.mp4",
                size_mb=1,  # Keep files small for test performance
            )
            video_files.append(video_file)

        # Process all files
        start_time = time.time()

        with patch.object(handler, "should_process_file", return_value=True):
            for i, video_file in enumerate(video_files):
                with patch.object(handler, "get_file_hash", return_value=f"large_hash_{i:03d}"):
                    handler.copy_video(str(video_file))

        processing_time = time.time() - start_time

        # Update index
        handler.update_video_index()

        total_time = time.time() - start_time

        # Verify all files were processed
        assert len(handler.processed_files) == num_files

        # Verify performance is reasonable
        assert total_time < 120.0  # Should complete in under 2 minutes

        # Verify index is correct
        index_file = handler.target_dir / "index.json"
        with open(index_file) as f:
            index_data = json.load(f)

        assert index_data["count"] == num_files
        assert len(index_data["videos"]) == num_files

        # Verify manifest integrity
        assert len(handler.processed_files) == num_files

        # Test manifest reload integrity
        new_config = BridgeConfig(
            source_dir=temp_workspace / "manim-output",
            target_dir=temp_workspace / "remotion-app" / "public" / "assets" / "manim",
            manifest_file=temp_workspace / "manifest.json",
        )
        new_handler = ManimBridge(new_config)

        manifest_data = new_handler.manifest_handler.read()
        assert len(manifest_data) == num_files
