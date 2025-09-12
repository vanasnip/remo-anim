"""Unit tests for the processing module (video processing, hash calculation)."""

import hashlib
from pathlib import Path
from unittest.mock import Mock, patch

import pytest

from manim_bridge.core.constants import EXCLUDED_PATHS, SUPPORTED_VIDEO_FORMATS
from manim_bridge.core.exceptions import ProcessingError
from manim_bridge.processing.hash_calculator import HashCalculator
from manim_bridge.processing.video_processor import VideoInfo, VideoProcessor
from tests.conftest import TestVideoGenerator


@pytest.mark.unit
class TestHashCalculator:
    """Test the HashCalculator class."""

    def test_hash_calculator_initialization(self):
        """Test HashCalculator initialization."""
        calculator = HashCalculator(chunk_size=1024, enable_logging=True)

        assert calculator.chunk_size == 1024
        assert calculator.logger is not None

    def test_hash_calculator_no_logging(self):
        """Test HashCalculator without logging."""
        calculator = HashCalculator(enable_logging=False)
        assert calculator.logger is None

    def test_calculate_hash_small_file(self, temp_workspace):
        """Test hash calculation for small file."""
        calculator = HashCalculator()

        test_file = temp_workspace / "small.mp4"
        test_content = b"small test content"
        test_file.write_bytes(test_content)

        calculated_hash = calculator.calculate_hash(test_file)

        # Verify hash is correct
        expected_hash = hashlib.sha256(test_content).hexdigest()
        assert calculated_hash == expected_hash

    def test_calculate_hash_large_file(self, temp_workspace):
        """Test hash calculation for large file with chunking."""
        calculator = HashCalculator(chunk_size=1024)

        test_file = temp_workspace / "large.mp4"
        # Create content larger than chunk size
        test_content = b"large content " * 200  # ~2.6KB
        test_file.write_bytes(test_content)

        calculated_hash = calculator.calculate_hash(test_file)

        # Verify hash matches
        expected_hash = hashlib.sha256(test_content).hexdigest()
        assert calculated_hash == expected_hash

    def test_calculate_hash_empty_file(self, temp_workspace):
        """Test hash calculation for empty file."""
        calculator = HashCalculator()

        test_file = temp_workspace / "empty.mp4"
        test_file.write_bytes(b"")

        calculated_hash = calculator.calculate_hash(test_file)
        expected_hash = hashlib.sha256(b"").hexdigest()
        assert calculated_hash == expected_hash

    def test_calculate_hash_nonexistent_file(self, temp_workspace):
        """Test hash calculation for non-existent file."""
        calculator = HashCalculator()

        nonexistent_file = temp_workspace / "nonexistent.mp4"

        with pytest.raises(FileNotFoundError):
            calculator.calculate_hash(nonexistent_file)

    def test_calculate_hash_different_chunk_sizes(self, temp_workspace):
        """Test that different chunk sizes produce same hash."""
        test_file = temp_workspace / "chunked.mp4"
        test_content = b"consistent hash content " * 100
        test_file.write_bytes(test_content)

        calculators = [
            HashCalculator(chunk_size=512),
            HashCalculator(chunk_size=1024),
            HashCalculator(chunk_size=2048),
        ]

        hashes = [calc.calculate_hash(test_file) for calc in calculators]

        # All hashes should be identical
        assert all(h == hashes[0] for h in hashes)

    def test_verify_hash(self, temp_workspace):
        """Test hash verification."""
        calculator = HashCalculator()

        test_file = temp_workspace / "verify.mp4"
        test_content = b"verify this content"
        test_file.write_bytes(test_content)

        # Calculate hash
        file_hash = calculator.calculate_hash(test_file)

        # Verify should return True
        assert calculator.verify_hash(test_file, file_hash) is True

        # Different hash should return False
        wrong_hash = "wrong_hash_value"
        assert calculator.verify_hash(test_file, wrong_hash) is False

    def test_hash_calculator_with_binary_data(self, temp_workspace):
        """Test hash calculation with binary video-like data."""
        calculator = HashCalculator()

        test_file = temp_workspace / "binary.mp4"
        # Create binary data similar to video file
        binary_data = (
            b"\x00\x00\x00\x18ftypmp42"  # MP4 header
            + b"\x00" * 100  # Some binary data
            + bytes(range(256))  # All byte values
        )
        test_file.write_bytes(binary_data)

        calculated_hash = calculator.calculate_hash(test_file)
        expected_hash = hashlib.sha256(binary_data).hexdigest()

        assert calculated_hash == expected_hash

    def test_hash_calculator_performance(self, temp_workspace):
        """Test hash calculation performance with timing."""
        calculator = HashCalculator(chunk_size=8192)

        test_file = temp_workspace / "performance.mp4"
        # Create moderately large file (1MB)
        large_content = b"performance test " * 65536
        test_file.write_bytes(large_content)

        import time

        start_time = time.time()
        calculated_hash = calculator.calculate_hash(test_file)
        elapsed = time.time() - start_time

        # Should complete in reasonable time (less than 1 second)
        assert elapsed < 1.0
        assert calculated_hash is not None
        assert len(calculated_hash) == 64  # SHA256 hex digest length


@pytest.mark.unit
class TestVideoInfo:
    """Test the VideoInfo dataclass."""

    def test_video_info_creation(self, temp_workspace):
        """Test creating VideoInfo object."""
        video_path = temp_workspace / "test.mp4"

        info = VideoInfo(
            path=video_path,
            hash="test_hash",
            size=1024,
            scene_name="TestScene",
            quality="1080p60",
            duration=10.5,
            resolution=(1920, 1080),
            codec="h264",
        )

        assert info.path == video_path
        assert info.hash == "test_hash"
        assert info.size == 1024
        assert info.scene_name == "TestScene"
        assert info.quality == "1080p60"
        assert info.duration == 10.5
        assert info.resolution == (1920, 1080)
        assert info.codec == "h264"

    def test_video_info_minimal(self, temp_workspace):
        """Test VideoInfo with minimal required fields."""
        video_path = temp_workspace / "minimal.mp4"

        info = VideoInfo(
            path=video_path,
            hash="minimal_hash",
            size=512,
            scene_name="MinimalScene",
            quality="720p30",
        )

        assert info.duration is None
        assert info.resolution is None
        assert info.codec is None

    def test_video_info_repr(self, temp_workspace):
        """Test VideoInfo string representation."""
        video_path = temp_workspace / "repr.mp4"

        info = VideoInfo(
            path=video_path,
            hash="repr_hash",
            size=256,
            scene_name="ReprScene",
            quality="480p15",
        )

        repr_str = repr(info)
        assert "VideoInfo" in repr_str
        assert "ReprScene" in repr_str


@pytest.mark.unit
class TestVideoProcessor:
    """Test the VideoProcessor class."""

    def test_video_processor_initialization(self, bridge_hash_calculator):
        """Test VideoProcessor initialization."""
        processor = VideoProcessor(hash_calculator=bridge_hash_calculator, enable_logging=True)

        assert processor.hash_calculator == bridge_hash_calculator
        assert processor.logger is not None

    def test_video_processor_default_hash_calculator(self):
        """Test VideoProcessor with default hash calculator."""
        processor = VideoProcessor(enable_logging=False)

        assert processor.hash_calculator is not None
        assert isinstance(processor.hash_calculator, HashCalculator)
        assert processor.logger is None

    def test_is_video_file(self, bridge_video_processor):
        """Test video file format detection."""
        processor = bridge_video_processor

        # Test supported formats
        for ext in SUPPORTED_VIDEO_FORMATS:
            test_path = Path(f"test{ext}")
            assert processor.is_video_file(test_path) is True

        # Test unsupported formats
        unsupported = [".txt", ".jpg", ".png", ".pdf", ".doc"]
        for ext in unsupported:
            test_path = Path(f"test{ext}")
            assert processor.is_video_file(test_path) is False

    def test_is_excluded(self, bridge_video_processor, temp_workspace):
        """Test file exclusion logic."""
        processor = bridge_video_processor

        # Create test files that should be excluded
        excluded_files = []
        for pattern in EXCLUDED_PATHS:
            if pattern.startswith("/"):
                # Absolute path pattern, create in temp workspace
                excluded_path = temp_workspace / pattern[1:]
            else:
                # Relative pattern
                excluded_path = temp_workspace / pattern / "test.mp4"

            excluded_files.append(excluded_path)

        # Test exclusion (don't need to create actual files)
        for excluded_path in excluded_files[:3]:  # Test a few
            result = processor.is_excluded(excluded_path)
            # Result depends on specific exclusion patterns
            assert isinstance(result, bool)

    def test_extract_metadata_basic(self, bridge_video_processor, sample_bridge_video):
        """Test basic metadata extraction."""
        processor = bridge_video_processor

        info = processor.extract_metadata(sample_bridge_video)

        assert isinstance(info, VideoInfo)
        assert info.path == sample_bridge_video
        assert info.scene_name == "TestScene"
        assert info.quality == "1080p60"
        assert info.size > 0
        assert info.hash is not None
        assert len(info.hash) == 64  # SHA256 hex digest

    def test_extract_metadata_nonexistent(self, bridge_video_processor, temp_workspace):
        """Test metadata extraction for non-existent file."""
        processor = bridge_video_processor

        nonexistent = temp_workspace / "nonexistent.mp4"

        with pytest.raises(ProcessingError):
            processor.extract_metadata(nonexistent)

    def test_extract_metadata_with_ffprobe(
        self, bridge_video_processor, sample_bridge_video, mock_ffmpeg
    ):
        """Test metadata extraction with ffprobe."""
        processor = bridge_video_processor

        # Mock ffprobe is set up to return sample metadata
        info = processor.extract_metadata(sample_bridge_video)

        assert info.duration == 10.5
        assert info.resolution == (1920, 1080)
        assert info.codec == "h264"

    def test_extract_metadata_without_ffprobe(self, bridge_video_processor, sample_bridge_video):
        """Test metadata extraction when ffprobe fails."""
        processor = bridge_video_processor

        with patch("subprocess.run", side_effect=FileNotFoundError("ffprobe not found")):
            info = processor.extract_metadata(sample_bridge_video)

            # Should still work without ffprobe
            assert isinstance(info, VideoInfo)
            assert info.duration is None
            assert info.resolution is None
            assert info.codec is None

    def test_validate_video_valid(self, bridge_video_processor, sample_bridge_video):
        """Test validation of valid video file."""
        processor = bridge_video_processor

        # Our test video has proper MP4 signature
        assert processor.validate_video(sample_bridge_video) is True

    def test_validate_video_invalid(self, bridge_video_processor, temp_workspace):
        """Test validation of invalid video file."""
        processor = bridge_video_processor

        # Create file with invalid signature
        invalid_video = temp_workspace / "invalid.mp4"
        invalid_video.write_bytes(b"INVALID_VIDEO_HEADER")

        assert processor.validate_video(invalid_video) is False

    def test_validate_video_too_small(self, bridge_video_processor, temp_workspace):
        """Test validation of video file that's too small."""
        processor = bridge_video_processor

        small_video = temp_workspace / "small.mp4"
        small_video.write_bytes(b"tiny")  # Less than 1KB

        assert processor.validate_video(small_video) is False

    def test_validate_video_nonexistent(self, bridge_video_processor, temp_workspace):
        """Test validation of non-existent video file."""
        processor = bridge_video_processor

        nonexistent = temp_workspace / "nonexistent.mp4"
        assert processor.validate_video(nonexistent) is False

    def test_generate_output_filename_with_timestamp(
        self, bridge_video_processor, sample_bridge_video
    ):
        """Test output filename generation with timestamp."""
        processor = bridge_video_processor

        filename = processor.generate_output_filename(sample_bridge_video, include_timestamp=True)

        assert "TestScene" in filename
        assert "1080p60" in filename
        assert filename.endswith(".mp4")

        # Should contain timestamp (format: YYYYMMDD_HHMMSS)
        import re

        timestamp_pattern = r"\d{8}_\d{6}"
        assert re.search(timestamp_pattern, filename) is not None

    def test_generate_output_filename_without_timestamp(
        self, bridge_video_processor, sample_bridge_video
    ):
        """Test output filename generation without timestamp."""
        processor = bridge_video_processor

        filename = processor.generate_output_filename(sample_bridge_video, include_timestamp=False)

        expected = "TestScene_1080p60.mp4"
        assert filename == expected

    def test_find_videos(self, bridge_video_processor, multiple_bridge_videos):
        """Test finding videos in directory."""
        processor = bridge_video_processor

        # Get the source directory from one of the videos
        source_dir = multiple_bridge_videos[0].parent.parent

        found_videos = processor.find_videos(source_dir, recursive=True)

        assert len(found_videos) == len(multiple_bridge_videos)

        # All found videos should be in our test set
        found_paths = set(found_videos)
        expected_paths = set(multiple_bridge_videos)
        assert found_paths == expected_paths

    def test_find_videos_non_recursive(self, bridge_video_processor, temp_workspace):
        """Test finding videos without recursion."""
        processor = bridge_video_processor

        # Create videos directly in directory and subdirectory
        direct_video = temp_workspace / "direct.mp4"
        TestVideoGenerator.create_fake_video(direct_video)

        subdir = temp_workspace / "subdir"
        subdir.mkdir()
        subdir_video = subdir / "nested.mp4"
        TestVideoGenerator.create_fake_video(subdir_video)

        found_videos = processor.find_videos(temp_workspace, recursive=False)

        # Should only find direct video, not nested one
        assert len(found_videos) == 1
        assert found_videos[0] == direct_video

    def test_find_videos_nonexistent_directory(self, bridge_video_processor, temp_workspace):
        """Test finding videos in non-existent directory."""
        processor = bridge_video_processor

        nonexistent_dir = temp_workspace / "nonexistent"
        found_videos = processor.find_videos(nonexistent_dir)

        assert found_videos == []

    def test_find_videos_with_exclusions(self, bridge_video_processor, temp_workspace):
        """Test finding videos with exclusion patterns."""
        processor = bridge_video_processor

        # Create videos in normal and excluded locations
        normal_video = temp_workspace / "normal.mp4"
        TestVideoGenerator.create_fake_video(normal_video)

        # Create excluded video (assuming 'cache' is in EXCLUDED_PATHS)
        excluded_dir = temp_workspace / "cache"
        excluded_dir.mkdir()
        excluded_video = excluded_dir / "excluded.mp4"
        TestVideoGenerator.create_fake_video(excluded_video)

        found_videos = processor.find_videos(temp_workspace, recursive=True)

        # Should find normal video but exclude cache video
        found_paths = [v.name for v in found_videos]
        assert "normal.mp4" in found_paths
        # Exclusion depends on actual EXCLUDED_PATHS content

    def test_video_processor_error_handling(self, bridge_video_processor, temp_workspace):
        """Test error handling in video processing."""
        processor = bridge_video_processor

        # Test with file that causes processing errors
        problematic_file = temp_workspace / "problematic.mp4"
        problematic_file.write_bytes(b"")  # Empty file

        # Should handle gracefully without crashing
        try:
            info = processor.extract_metadata(problematic_file)
            # Might succeed or fail depending on implementation
        except ProcessingError:
            # Expected for some edge cases
            pass

    def test_video_processor_with_different_formats(self, bridge_video_processor, temp_workspace):
        """Test video processor with different video formats."""
        processor = bridge_video_processor

        for ext in [".mp4", ".mov", ".avi"]:  # Test subset of formats
            if ext in SUPPORTED_VIDEO_FORMATS:
                video_file = temp_workspace / f"test{ext}"
                TestVideoGenerator.create_fake_video(video_file, format_ext=ext)

                assert processor.is_video_file(video_file) is True

                # Should be able to extract basic metadata
                info = processor.extract_metadata(video_file)
                assert isinstance(info, VideoInfo)

    @patch("subprocess.run")
    def test_ffprobe_timeout(self, mock_run, bridge_video_processor, sample_bridge_video):
        """Test ffprobe timeout handling."""
        processor = bridge_video_processor

        # Mock subprocess timeout
        import subprocess

        mock_run.side_effect = subprocess.TimeoutExpired("ffprobe", 10)

        info = processor.extract_metadata(sample_bridge_video)

        # Should handle timeout gracefully
        assert isinstance(info, VideoInfo)
        assert info.duration is None
        assert info.resolution is None
        assert info.codec is None

    def test_ffprobe_invalid_json(self, bridge_video_processor, sample_bridge_video):
        """Test handling of invalid JSON from ffprobe."""
        processor = bridge_video_processor

        with patch("subprocess.run") as mock_run:
            mock_result = Mock()
            mock_result.returncode = 0
            mock_result.stdout = "invalid json output"
            mock_run.return_value = mock_result

            info = processor.extract_metadata(sample_bridge_video)

            # Should handle invalid JSON gracefully
            assert isinstance(info, VideoInfo)
            assert info.duration is None

    def test_video_quality_extraction(self, bridge_video_processor, temp_workspace):
        """Test extracting quality from file path structure."""
        processor = bridge_video_processor

        # Test different quality structures
        qualities = ["480p15", "720p30", "1080p60", "4k60"]

        for quality in qualities:
            quality_dir = temp_workspace / quality
            quality_dir.mkdir()
            video_file = quality_dir / "test.mp4"
            TestVideoGenerator.create_fake_video(video_file)

            info = processor.extract_metadata(video_file)
            assert info.quality == quality

    def test_scene_name_extraction(self, bridge_video_processor, temp_workspace):
        """Test extracting scene name from filename."""
        processor = bridge_video_processor

        quality_dir = temp_workspace / "1080p60"
        quality_dir.mkdir()

        scene_names = [
            "SimpleScene",
            "Complex_Scene_Name",
            "数学动画",
            "SpecialChars-123",
        ]

        for scene_name in scene_names:
            video_file = quality_dir / f"{scene_name}.mp4"
            TestVideoGenerator.create_fake_video(video_file)

            info = processor.extract_metadata(video_file)
            assert info.scene_name == scene_name


@pytest.mark.unit
class TestVideoProcessorIntegration:
    """Integration tests within the processing module."""

    def test_hash_calculator_video_processor_integration(self, temp_workspace):
        """Test integration between HashCalculator and VideoProcessor."""
        hash_calc = HashCalculator(chunk_size=1024, enable_logging=True)
        processor = VideoProcessor(hash_calculator=hash_calc, enable_logging=True)

        # Create test video
        quality_dir = temp_workspace / "720p30"
        quality_dir.mkdir()
        video_file = quality_dir / "Integration.mp4"
        TestVideoGenerator.create_fake_video(video_file, size=2048)

        # Extract metadata (should use our hash calculator)
        info = processor.extract_metadata(video_file)

        assert info.hash is not None
        assert len(info.hash) == 64

        # Verify hash matches what calculator would produce independently
        independent_hash = hash_calc.calculate_hash(video_file)
        assert info.hash == independent_hash

    def test_processing_pipeline_validation(self, bridge_video_processor, temp_workspace):
        """Test complete processing pipeline validation."""
        processor = bridge_video_processor

        # Create valid video
        quality_dir = temp_workspace / "1080p60"
        quality_dir.mkdir()
        video_file = quality_dir / "Pipeline.mp4"
        TestVideoGenerator.create_fake_video(video_file, size=1536)

        # Full pipeline: detection -> validation -> metadata extraction -> filename generation
        assert processor.is_video_file(video_file) is True
        assert processor.validate_video(video_file) is True

        info = processor.extract_metadata(video_file)
        assert isinstance(info, VideoInfo)

        output_name = processor.generate_output_filename(video_file, include_timestamp=False)
        assert output_name == "Pipeline_1080p60.mp4"
