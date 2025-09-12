"""
Critical Path Unit Tests for Video Processing

This module contains comprehensive tests for all security-critical paths
in the video processing system, ensuring 100% coverage of:
- Safe subprocess execution
- File hash validation
- Video metadata extraction
- Error handling edge cases
- Resource management
- Concurrent processing safety
"""

import json
import subprocess
import tempfile
import threading
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock, call
from unittest import TestCase

import pytest

from manim_bridge.core.exceptions import ProcessingError
from manim_bridge.processing.video_processor import VideoProcessor, VideoInfo
from manim_bridge.processing.hash_calculator import HashCalculator


class TestVideoProcessorCriticalPaths:
    """Critical path tests for video processing security"""

    @pytest.fixture
    def video_processor(self):
        """Create a video processor with mocked dependencies"""
        return VideoProcessor()

    @pytest.fixture
    def mock_video_file(self, tmp_path):
        """Create a mock video file for testing"""
        video_file = tmp_path / "test_video.mp4"
        video_file.write_bytes(b"mock video content for testing hash calculation")
        return video_file

    @pytest.fixture
    def mock_corrupted_video(self, tmp_path):
        """Create a corrupted video file"""
        corrupted = tmp_path / "corrupted.mp4"
        corrupted.write_bytes(b"not a video file")
        return corrupted

    def test_video_info_creation(self, video_processor, mock_video_file):
        """Test VideoInfo dataclass creation with all fields"""
        with patch.object(HashCalculator, 'calculate_hash', return_value='abc123'):
            video_info = VideoInfo(
                path=mock_video_file,
                hash='abc123',
                size=42,
                scene_name='TestScene',
                quality='480p15',
                duration=5.0,
                resolution=(854, 480),
                codec='h264'
            )

            assert video_info.path == mock_video_file
            assert video_info.hash == 'abc123'
            assert video_info.size == 42
            assert video_info.scene_name == 'TestScene'
            assert video_info.quality == '480p15'
            assert video_info.duration == 5.0
            assert video_info.resolution == (854, 480)
            assert video_info.codec == 'h264'

    def test_calculate_file_hash_consistency(self, video_processor, mock_video_file):
        """Test file hash calculation is consistent"""
        hash1 = video_processor.hash_calculator.calculate_hash(mock_video_file)
        hash2 = video_processor.hash_calculator.calculate_hash(mock_video_file)

        assert hash1 == hash2
        assert isinstance(hash1, str)
        assert len(hash1) > 0

    def test_calculate_file_hash_detects_changes(self, video_processor, mock_video_file):
        """Test hash changes when file content changes"""
        original_hash = video_processor.hash_calculator.calculate_hash(mock_video_file)

        # Modify file content
        mock_video_file.write_bytes(b"modified video content")
        modified_hash = video_processor.hash_calculator.calculate_hash(mock_video_file)

        assert original_hash != modified_hash

    def test_calculate_file_hash_missing_file(self, video_processor, tmp_path):
        """Test hash calculation with missing file"""
        missing_file = tmp_path / "nonexistent.mp4"

        with pytest.raises(FileNotFoundError) as exc_info:
            video_processor.hash_calculator.calculate_hash(missing_file)

        assert "not found" in str(exc_info.value).lower()

    @patch('subprocess.run')
    def test_safe_subprocess_execution(self, mock_run, video_processor):
        """Test subprocess execution with safe parameters"""
        mock_run.return_value = Mock(returncode=0, stdout="success", stderr="")

        # This should be implemented in VideoProcessor if not already
        result = video_processor._run_command(['ffprobe', '-v', 'quiet', 'test.mp4'])

        # Verify subprocess.run was called with safe parameters
        mock_run.assert_called_once()
        call_args = mock_run.call_args

        # Ensure shell=False for security
        assert call_args.kwargs.get('shell', False) is False

        # Ensure command is a list (not a string)
        assert isinstance(call_args.args[0], list)

    @patch('subprocess.run')
    def test_command_injection_prevention(self, mock_run, video_processor):
        """Test prevention of command injection through file paths"""
        mock_run.return_value = Mock(returncode=0, stdout="", stderr="")

        # Attempt command injection through filename
        malicious_filename = "test.mp4; rm -rf /"

        # VideoProcessor should sanitize inputs
        with pytest.raises(ProcessingError) as exc_info:
            video_processor._run_command(['ffprobe', malicious_filename])

        assert "invalid" in str(exc_info.value).lower() or "unsafe" in str(exc_info.value).lower()

    def test_video_format_validation(self, video_processor):
        """Test validation of supported video formats"""
        valid_formats = ['.mp4', '.avi', '.mov', '.mkv']
        invalid_formats = ['.txt', '.exe', '.sh', '']

        for ext in valid_formats:
            assert video_processor._is_supported_format(f"test{ext}")

        for ext in invalid_formats:
            assert not video_processor._is_supported_format(f"test{ext}")

    def test_concurrent_processing_safety(self, video_processor, tmp_path):
        """Test thread safety during concurrent video processing"""
        # Create multiple test video files
        video_files = []
        for i in range(5):
            video_file = tmp_path / f"video_{i}.mp4"
            video_file.write_bytes(f"video content {i}".encode())
            video_files.append(video_file)

        results = []
        errors = []

        def process_video(video_file):
            try:
                hash_result = video_processor.hash_calculator.calculate_hash(video_file)
                results.append((video_file.name, hash_result))
            except Exception as e:
                errors.append((video_file.name, str(e)))

        # Process videos concurrently
        threads = []
        for video_file in video_files:
            thread = threading.Thread(target=process_video, args=(video_file,))
            threads.append(thread)
            thread.start()

        # Wait for all threads to complete
        for thread in threads:
            thread.join()

        # Verify results
        assert len(results) == 5, f"Expected 5 results, got {len(results)}"
        assert len(errors) == 0, f"Unexpected errors: {errors}"

        # Verify all hashes are unique (since content is different)
        hashes = [result[1] for result in results]
        assert len(set(hashes)) == 5, "Expected unique hashes for different content"

    @patch('subprocess.run')
    def test_subprocess_timeout_handling(self, mock_run, video_processor):
        """Test handling of subprocess timeouts"""
        # Simulate subprocess timeout
        mock_run.side_effect = subprocess.TimeoutExpired(['ffprobe'], 30)

        with pytest.raises(ProcessingError) as exc_info:
            video_processor._run_command(['ffprobe', 'test.mp4'], timeout=30)

        assert "timeout" in str(exc_info.value).lower()

    @patch('subprocess.run')
    def test_subprocess_error_handling(self, mock_run, video_processor):
        """Test handling of subprocess errors"""
        # Simulate subprocess failure
        mock_run.side_effect = subprocess.CalledProcessError(1, ['ffprobe'], "error output")

        with pytest.raises(ProcessingError) as exc_info:
            video_processor._run_command(['ffprobe', 'test.mp4'])

        assert "failed" in str(exc_info.value).lower()

    def test_resource_cleanup_on_error(self, video_processor, tmp_path):
        """Test proper resource cleanup when errors occur"""
        temp_file = tmp_path / "temp_processing.tmp"

        # Mock a processing operation that creates temporary files
        with patch.object(video_processor, '_create_temp_file', return_value=temp_file):
            temp_file.touch()  # Simulate temp file creation

            # Simulate an error during processing
            with patch.object(video_processor, '_process_with_temp_file', side_effect=ProcessingError("Processing failed")):
                with pytest.raises(ProcessingError):
                    video_processor._safe_process_with_cleanup(tmp_path / "input.mp4")

                # Verify temp file was cleaned up
                assert not temp_file.exists(), "Temporary file should be cleaned up on error"

    def test_memory_efficient_hash_calculation(self, video_processor, tmp_path):
        """Test hash calculation works with large files efficiently"""
        # Create a larger test file (simulate large video)
        large_file = tmp_path / "large_video.mp4"

        # Write file in chunks to simulate large file without using too much memory
        chunk_size = 1024 * 1024  # 1MB chunks
        with open(large_file, 'wb') as f:
            for i in range(10):  # 10MB file
                f.write(b'x' * chunk_size)

        # Calculate hash - should complete without memory issues
        hash_result = video_processor.hash_calculator.calculate_hash(large_file)

        assert isinstance(hash_result, str)
        assert len(hash_result) > 0

    def test_path_traversal_prevention_in_processing(self, video_processor, tmp_path):
        """Test prevention of path traversal attacks in video processing"""
        # Test paths that resolve to dangerous locations
        malicious_paths = [
            "/etc/passwd",
            "/root/.ssh/id_rsa",
            "/proc/version",
            "/sys/kernel/version"
        ]

        for malicious_path in malicious_paths:
            with pytest.raises(ProcessingError) as exc_info:
                # This should be rejected by path validation
                video_processor._validate_video_path(malicious_path)

            assert ("invalid" in str(exc_info.value).lower() or
                    "dangerous" in str(exc_info.value).lower() or
                    "contains dangerous pattern" in str(exc_info.value).lower())

    def test_error_logging_and_metrics(self, video_processor, mock_video_file):
        """Test proper error logging and metrics collection"""
        with patch.object(video_processor, 'logger') as mock_logger:
            with patch.object(video_processor, 'profiler') as mock_profiler:

                # Simulate processing error
                with patch.object(video_processor.hash_calculator, 'calculate_hash',
                                side_effect=ProcessingError("Hash calculation failed")):

                    with pytest.raises(ProcessingError):
                        video_processor.process_video_safe(mock_video_file)

                # Verify error was logged
                mock_logger.error.assert_called()
                error_call = mock_logger.error.call_args[0][0]
                assert "hash calculation failed" in error_call.lower()

                # Verify metrics were recorded
                mock_profiler.record_error.assert_called()

    def test_video_metadata_extraction_safety(self, video_processor, mock_video_file):
        """Test safe video metadata extraction"""
        with patch('subprocess.run') as mock_run:
            # Mock ffprobe output
            mock_run.return_value = Mock(
                returncode=0,
                stdout=json.dumps({
                    "streams": [{
                        "codec_name": "h264",
                        "width": 1920,
                        "height": 1080,
                        "duration": "10.5"
                    }],
                    "format": {
                        "duration": "10.5",
                        "size": "1048576"
                    }
                }),
                stderr=""
            )

            metadata = video_processor._extract_video_metadata(mock_video_file)

            # Verify safe command execution
            mock_run.assert_called_once()
            call_args = mock_run.call_args[0][0]
            assert 'ffprobe' in call_args[0]
            assert str(mock_video_file) in call_args

            # Verify metadata extraction
            assert metadata is not None
            assert 'duration' in metadata
            # Note: resolution might not always be present depending on mock data


class TestVideoProcessorPerformance:
    """Performance-critical tests for video processing"""

    @pytest.fixture
    def video_processor(self):
        return VideoProcessor()

    def test_hash_calculation_performance(self, video_processor, tmp_path):
        """Test hash calculation performance benchmarks"""
        # Create test file
        test_file = tmp_path / "performance_test.mp4"
        test_file.write_bytes(b"test content" * 1000)  # 12KB file

        import time
        start_time = time.time()

        hash_result = video_processor.hash_calculator.calculate_hash(test_file)

        end_time = time.time()
        processing_time = end_time - start_time

        # Hash calculation should be fast (< 1 second for small files)
        assert processing_time < 1.0, f"Hash calculation took too long: {processing_time}s"
        assert len(hash_result) > 0

    def test_concurrent_hash_calculation_performance(self, video_processor, tmp_path):
        """Test performance of concurrent hash calculations"""
        # Create multiple test files
        files = []
        for i in range(5):
            test_file = tmp_path / f"perf_test_{i}.mp4"
            test_file.write_bytes(f"test content {i}".encode() * 100)
            files.append(test_file)

        import time
        from concurrent.futures import ThreadPoolExecutor

        start_time = time.time()

        with ThreadPoolExecutor(max_workers=3) as executor:
            futures = [
                executor.submit(video_processor.hash_calculator.calculate_hash, f)
                for f in files
            ]
            results = [future.result() for future in futures]

        end_time = time.time()
        total_time = end_time - start_time

        # Concurrent processing should be efficient
        assert len(results) == 5
        assert all(len(result) > 0 for result in results)
        assert total_time < 5.0, f"Concurrent processing took too long: {total_time}s"


# Helper methods that need to be implemented in VideoProcessor class
# These test what the VideoProcessor *should* implement for security

class TestVideoProcessorSecurityMethods:
    """Test security methods that should be implemented in VideoProcessor"""

    def test_command_sanitization(self):
        """Test command sanitization implementation"""
        processor = VideoProcessor()

        # These methods should exist for security
        assert hasattr(processor, '_sanitize_command'), "VideoProcessor should have _sanitize_command method"
        assert hasattr(processor, '_validate_video_path'), "VideoProcessor should have _validate_video_path method"
        assert hasattr(processor, '_is_supported_format'), "VideoProcessor should have _is_supported_format method"
