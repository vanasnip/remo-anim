"""Integration tests for async video processing pipeline performance"""

import asyncio
import tempfile
import time
from pathlib import Path
from unittest.mock import Mock, patch

import pytest

from manim_bridge.processing import (
    AsyncVideoProcessor,
    PerformancePipeline,
    PipelineConfig,
)


class TestAsyncVideoPipelinePerformance:
    """Test suite for async video processing pipeline performance validation"""

    def create_mock_video_file(self, tmp_dir: Path, name: str, size_mb: int = 1) -> Path:
        """Create a mock video file for testing"""
        video_path = tmp_dir / f"{name}.mp4"

        # Create mock MP4 header
        mp4_header = b"\x00\x00\x00\x18ftypmp42"  # Minimal MP4 signature
        content = mp4_header + b"0" * (size_mb * 1024 * 1024 - len(mp4_header))

        video_path.write_bytes(content)
        return video_path

    @pytest.fixture
    def temp_video_files(self):
        """Create temporary video files for testing"""
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)

            # Create test video files of different sizes
            videos = []
            for i in range(5):
                video = self.create_mock_video_file(tmp_path, f"test_video_{i}", size_mb=1)
                videos.append(video)

            yield videos

    @pytest.fixture
    def async_processor(self):
        """Create AsyncVideoProcessor for testing"""
        processor = AsyncVideoProcessor(
            max_workers=4,
            ffprobe_timeout=1.0,
            enable_monitoring=True,
            enable_logging=False
        )
        yield processor
        processor.shutdown()

    @pytest.fixture
    def performance_pipeline(self):
        """Create PerformancePipeline for testing"""
        config = PipelineConfig(
            max_concurrent_videos=4,
            max_metadata_workers=4,
            ffprobe_timeout=1.0,
            enable_metadata_caching=True
        )
        pipeline = PerformancePipeline(config)
        yield pipeline
        pipeline.shutdown()

    def test_async_processor_initialization(self, async_processor):
        """Test AsyncVideoProcessor initializes correctly"""
        assert async_processor.max_workers == 4
        assert async_processor.ffprobe_timeout == 1.0
        assert async_processor.enable_monitoring is True
        assert async_processor.hash_calculator is not None
        assert async_processor.sync_processor is not None

    def test_quick_video_validation(self, async_processor, temp_video_files):
        """Test quick video validation works correctly"""
        valid_video = temp_video_files[0]

        # Test valid video
        assert async_processor._quick_validate_video(valid_video) is True

        # Test non-existent video
        fake_path = valid_video.parent / "nonexistent.mp4"
        assert async_processor._quick_validate_video(fake_path) is False

    def test_basic_info_extraction(self, async_processor, temp_video_files):
        """Test basic video information extraction"""
        video_path = temp_video_files[0]

        info = async_processor._extract_basic_info(video_path)

        assert info['scene_name'] == video_path.stem
        assert info['size'] > 0
        assert info['quality'] in ['unknown', video_path.parent.name]

    @patch('subprocess.run')
    def test_ffprobe_metadata_extraction(self, mock_run, async_processor, temp_video_files):
        """Test ffprobe metadata extraction with mocked subprocess"""
        video_path = temp_video_files[0]

        # Mock successful ffprobe response
        mock_run.return_value = Mock(
            returncode=0,
            stdout='{"streams": [{"codec_type": "video", "width": 1920, "height": 1080, "codec_name": "h264"}], "format": {"duration": "10.0"}}',
            stderr=""
        )

        metadata = async_processor._extract_ffprobe_metadata_safe(video_path)

        assert metadata['duration'] == 10.0
        assert metadata['resolution'] == (1920, 1080)
        assert metadata['codec'] == 'h264'

    @patch('subprocess.run')
    def test_ffprobe_timeout_handling(self, mock_run, async_processor, temp_video_files):
        """Test ffprobe timeout handling"""
        from subprocess import TimeoutExpired

        video_path = temp_video_files[0]

        # Mock timeout
        mock_run.side_effect = TimeoutExpired("ffprobe", 2.0)

        metadata = async_processor._extract_ffprobe_metadata_safe(video_path)
        assert metadata == {}  # Should return empty dict on timeout

    def test_hash_calculation_selection(self, async_processor, temp_video_files):
        """Test intelligent hash calculator selection"""
        video_path = temp_video_files[0]

        # Mock stat method on Path class
        with patch('pathlib.Path.stat') as mock_stat:
            # Create a mock stat result for small file
            mock_stat_result = Mock()
            mock_stat_result.st_size = 512 * 1024  # 512KB
            mock_stat.return_value = mock_stat_result

            with patch.object(async_processor.fallback_hash_calculator, 'calculate_hash') as mock_fallback:
                mock_fallback.return_value = "test_hash_fallback"

                result = async_processor._calculate_hash_safe(video_path)
                assert result == "test_hash_fallback"
                mock_fallback.assert_called_once()

    @pytest.mark.asyncio
    async def test_single_video_processing(self, async_processor, temp_video_files):
        """Test processing of a single video"""
        video_path = temp_video_files[0]

        with patch.object(async_processor, '_extract_ffprobe_metadata_safe') as mock_metadata:
            mock_metadata.return_value = {
                'duration': 5.0,
                'resolution': (1280, 720),
                'codec': 'h264'
            }

            result = await async_processor._process_single_video_async(video_path, True)

            assert result.success is True
            assert result.video_info.path == video_path
            assert result.video_info.hash != ""
            assert result.video_info.duration == 5.0
            assert result.video_info.resolution == (1280, 720)
            assert result.processing_time > 0

    @pytest.mark.asyncio
    async def test_batch_video_processing(self, async_processor, temp_video_files):
        """Test concurrent batch processing of multiple videos"""
        # Use only first 3 videos for faster test
        test_videos = temp_video_files[:3]

        with patch.object(async_processor, '_extract_ffprobe_metadata_safe') as mock_metadata:
            mock_metadata.return_value = {
                'duration': 5.0,
                'resolution': (1280, 720),
                'codec': 'h264'
            }

            results = await async_processor.process_videos_async(test_videos, True)

            assert len(results) == len(test_videos)
            successful_results = [r for r in results if r.success]
            assert len(successful_results) == len(test_videos)

            # Verify all videos were processed
            processed_paths = {r.video_info.path for r in results}
            expected_paths = set(test_videos)
            assert processed_paths == expected_paths

    @pytest.mark.asyncio
    async def test_performance_pipeline_batch_processing(self, performance_pipeline, temp_video_files):
        """Test the performance pipeline with batch processing"""
        test_videos = temp_video_files[:3]

        with patch('manim_bridge.processing.async_video_processor.subprocess.run') as mock_run:
            mock_run.return_value = Mock(
                returncode=0,
                stdout='{"streams": [{"codec_type": "video", "width": 1920, "height": 1080, "codec_name": "h264"}], "format": {"duration": "5.0"}}',
                stderr=""
            )

            results, stats = await performance_pipeline.process_video_batch_async(test_videos)

            assert len(results) == len(test_videos)
            assert stats.total_videos_processed >= len(test_videos)
            assert stats.successful_videos >= len(test_videos)
            assert stats.throughput_videos_per_minute > 0

    @pytest.mark.asyncio
    async def test_pipeline_caching(self, performance_pipeline, temp_video_files):
        """Test pipeline caching functionality"""
        test_video = temp_video_files[0]

        with patch('manim_bridge.processing.async_video_processor.subprocess.run') as mock_run:
            mock_run.return_value = Mock(
                returncode=0,
                stdout='{"streams": [{"codec_type": "video", "width": 1920, "height": 1080, "codec_name": "h264"}], "format": {"duration": "5.0"}}',
                stderr=""
            )

            # First processing - should cache results
            results1, stats1 = await performance_pipeline.process_video_batch_async([test_video])
            assert len(results1) == 1
            assert stats1.cache_hit_rate == 0.0  # No cache hits on first run

            # Second processing - should use cache
            results2, stats2 = await performance_pipeline.process_video_batch_async([test_video])
            assert len(results2) == 1
            assert stats2.cache_hit_rate == 100.0  # Should be cache hit

    def test_pipeline_performance_stats(self, performance_pipeline):
        """Test pipeline performance statistics collection"""
        stats = performance_pipeline.stats

        # Test initial state
        assert stats.total_videos_processed == 0
        assert stats.successful_videos == 0
        assert stats.failed_videos == 0
        assert stats.cache_hit_rate == 0.0

    def test_performance_report_generation(self, performance_pipeline):
        """Test comprehensive performance report generation"""
        report = performance_pipeline.get_performance_report()

        assert 'pipeline_stats' in report
        assert 'processor_stats' in report
        assert 'monitor_stats' in report
        assert 'config' in report
        assert 'cache_status' in report

        # Check pipeline stats structure
        pipeline_stats = report['pipeline_stats']
        assert 'total_videos_processed' in pipeline_stats
        assert 'throughput_videos_per_minute' in pipeline_stats
        assert 'performance_improvement_factor' in pipeline_stats

    def test_pipeline_config_customization(self):
        """Test custom pipeline configuration"""
        config = PipelineConfig(
            max_concurrent_videos=16,
            max_metadata_workers=16,
            ffprobe_timeout=5.0,
            enable_parallel_hashing=False,
            enable_metadata_caching=False
        )

        pipeline = PerformancePipeline(config)

        assert pipeline.config.max_concurrent_videos == 16
        assert pipeline.config.max_metadata_workers == 16
        assert pipeline.config.ffprobe_timeout == 5.0
        assert pipeline.config.enable_parallel_hashing is False
        assert pipeline.config.enable_metadata_caching is False

        pipeline.shutdown()

    @pytest.mark.asyncio
    async def test_error_handling_in_batch_processing(self, async_processor, temp_video_files):
        """Test error handling during batch processing"""
        # Create a mix of valid and invalid video paths
        valid_videos = temp_video_files[:2]
        invalid_video = temp_video_files[0].parent / "nonexistent.mp4"
        mixed_videos = valid_videos + [invalid_video]

        with patch.object(async_processor, '_extract_ffprobe_metadata_safe') as mock_metadata:
            mock_metadata.return_value = {'duration': 5.0}

            results = await async_processor.process_videos_async(mixed_videos, True)

            # Should get results for all videos (success or failure)
            assert len(results) == len(mixed_videos)

            # Check that we have both successful and failed results
            successful = [r for r in results if r.success]
            failed = [r for r in results if not r.success]

            assert len(successful) >= len(valid_videos)
            assert len(failed) >= 1  # At least the nonexistent file should fail

    def test_concurrent_metadata_extractor(self, temp_video_files):
        """Test standalone concurrent metadata extractor"""
        from manim_bridge.processing.async_video_processor import ConcurrentMetadataExtractor

        extractor = ConcurrentMetadataExtractor(max_workers=2, timeout=1.0)

        try:
            with patch('subprocess.run') as mock_run:
                mock_run.return_value = Mock(
                    returncode=0,
                    stdout='{"streams": [{"codec_type": "video", "width": 1920, "height": 1080, "codec_name": "h264"}], "format": {"duration": "10.0"}}',
                    stderr=""
                )

                results = extractor.extract_metadata_batch(temp_video_files[:2])

                assert len(results) == 2
                for path, metadata in results.items():
                    assert 'duration' in metadata
                    assert metadata['duration'] == 10.0
        finally:
            extractor.shutdown()

    def test_context_manager_usage(self):
        """Test using components as context managers"""
        with AsyncVideoProcessor(max_workers=2, enable_logging=False) as processor:
            assert processor.max_workers == 2
        # Processor should be automatically shut down

        with PerformancePipeline() as pipeline:
            assert pipeline.config is not None
        # Pipeline should be automatically shut down

    def test_performance_monitoring_integration(self, async_processor):
        """Test integration with performance monitoring system"""
        # Get initial stats
        initial_stats = async_processor.get_performance_stats()
        assert 'processor_config' in initial_stats

        # Reset stats
        async_processor.reset_performance_stats()

        # Check stats were reset
        reset_stats = async_processor.get_performance_stats()
        assert reset_stats['enabled'] == initial_stats['enabled']
