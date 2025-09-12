"""Asynchronous video processing with concurrent operations for 2x performance improvement"""

import asyncio
import json
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from ..core.constants import EXCLUDED_PATHS, SUPPORTED_VIDEO_FORMATS
from ..core.exceptions import ProcessingError
from ..monitoring.logger import get_logger
from ..monitoring.metrics import PerformanceMonitor
from .hash_calculator import HashCalculator
from .parallel_hash_calculator import ParallelHashCalculator
from .video_processor import VideoInfo, VideoProcessor


@dataclass
class AsyncProcessingResult:
    """Result of async video processing operation"""
    video_info: VideoInfo
    processing_time: float
    success: bool
    error: Optional[str] = None


class AsyncVideoProcessor:
    """High-performance async video processor with concurrent metadata extraction"""

    def __init__(
        self,
        max_workers: Optional[int] = None,
        ffprobe_timeout: float = 2.0,
        enable_monitoring: bool = True,
        enable_logging: bool = True,
    ):
        """Initialize async video processor

        Args:
            max_workers: Maximum number of concurrent workers (defaults to CPU count)
            ffprobe_timeout: Timeout for ffprobe operations in seconds
            enable_monitoring: Enable performance monitoring
            enable_logging: Enable logging
        """
        import os

        self.max_workers = max_workers or min(32, (os.cpu_count() or 1) + 4)
        self.ffprobe_timeout = ffprobe_timeout
        self.enable_monitoring = enable_monitoring
        self.enable_logging = enable_logging

        # Initialize components - use parallel hash calculator for better performance
        self.hash_calculator = ParallelHashCalculator(
            max_workers=min(4, self.max_workers),  # Limit hash workers
            enable_logging=enable_logging
        )
        self.fallback_hash_calculator = HashCalculator()  # Fallback for small files
        self.sync_processor = VideoProcessor(self.fallback_hash_calculator, enable_logging)
        self.logger = get_logger() if enable_logging else None
        self.monitor = PerformanceMonitor(enabled=enable_monitoring)

        # Thread pools for different types of operations
        self.metadata_executor = ThreadPoolExecutor(
            max_workers=self.max_workers,
            thread_name_prefix="metadata-worker"
        )
        self.hash_executor = ThreadPoolExecutor(
            max_workers=min(4, self.max_workers),  # Hash calculation is CPU-intensive
            thread_name_prefix="hash-worker"
        )

        if self.logger:
            self.logger.info(
                f"AsyncVideoProcessor initialized with {self.max_workers} workers, "
                f"ffprobe timeout: {ffprobe_timeout}s"
            )

    async def process_videos_async(
        self,
        video_paths: List[Path],
        include_detailed_metadata: bool = True
    ) -> List[AsyncProcessingResult]:
        """Process multiple videos concurrently

        Args:
            video_paths: List of video file paths to process
            include_detailed_metadata: Whether to extract detailed metadata with ffprobe

        Returns:
            List of processing results
        """
        if not video_paths:
            return []

        with self.monitor.measure("process_videos_batch", count=len(video_paths)):
            if self.logger:
                self.logger.info(f"Processing {len(video_paths)} videos concurrently")

            # Create async tasks for each video
            tasks = [
                self._process_single_video_async(path, include_detailed_metadata)
                for path in video_paths
            ]

            # Execute all tasks concurrently
            results = await asyncio.gather(*tasks, return_exceptions=True)

            # Process results and handle exceptions
            processed_results = []
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    error_result = AsyncProcessingResult(
                        video_info=VideoInfo(
                            path=video_paths[i],
                            hash="",
                            size=0,
                            scene_name=video_paths[i].stem,
                            quality="unknown"
                        ),
                        processing_time=0.0,
                        success=False,
                        error=str(result)
                    )
                    processed_results.append(error_result)
                    if self.logger:
                        self.logger.error(f"Failed to process {video_paths[i]}: {result}")
                else:
                    processed_results.append(result)

            # Log summary
            successful = sum(1 for r in processed_results if r.success)
            if self.logger:
                self.logger.info(
                    f"Processed {len(video_paths)} videos: {successful} successful, "
                    f"{len(video_paths) - successful} failed"
                )

            return processed_results

    async def _process_single_video_async(
        self,
        video_path: Path,
        include_detailed_metadata: bool = True
    ) -> AsyncProcessingResult:
        """Process a single video file asynchronously"""
        start_time = time.perf_counter()

        try:
            # Quick validation first
            if not self._quick_validate_video(video_path):
                raise ProcessingError(f"Invalid video file: {video_path}")

            # Extract basic metadata synchronously (fast operations)
            basic_info = self._extract_basic_info(video_path)

            # Concurrent operations for expensive tasks
            if include_detailed_metadata:
                # Run hash calculation and ffprobe metadata extraction concurrently
                hash_future = asyncio.get_event_loop().run_in_executor(
                    self.hash_executor,
                    self._calculate_hash_safe,
                    video_path
                )

                metadata_future = asyncio.get_event_loop().run_in_executor(
                    self.metadata_executor,
                    self._extract_ffprobe_metadata_safe,
                    video_path
                )

                # Wait for both operations to complete
                file_hash, extended_metadata = await asyncio.gather(
                    hash_future, metadata_future
                )
            else:
                # Quick mode - just hash calculation
                file_hash = await asyncio.get_event_loop().run_in_executor(
                    self.hash_executor,
                    self._calculate_hash_safe,
                    video_path
                )
                extended_metadata = {}

            # Combine all information
            video_info = VideoInfo(
                path=video_path,
                hash=file_hash,
                size=basic_info['size'],
                scene_name=basic_info['scene_name'],
                quality=basic_info['quality'],
                duration=extended_metadata.get('duration'),
                resolution=extended_metadata.get('resolution'),
                codec=extended_metadata.get('codec')
            )

            processing_time = time.perf_counter() - start_time

            if self.logger:
                self.logger.debug(
                    f"Processed {video_path.name} in {processing_time:.2f}s "
                    f"(hash: {file_hash[:8]}..., size: {basic_info['size']})"
                )

            return AsyncProcessingResult(
                video_info=video_info,
                processing_time=processing_time,
                success=True
            )

        except Exception as e:
            processing_time = time.perf_counter() - start_time
            error_msg = str(e)

            if self.logger:
                self.logger.error(f"Error processing {video_path}: {error_msg}")

            # Return minimal info even on error
            try:
                basic_info = self._extract_basic_info(video_path)
            except:
                basic_info = {
                    'size': 0,
                    'scene_name': video_path.stem,
                    'quality': 'unknown'
                }

            error_video_info = VideoInfo(
                path=video_path,
                hash="",
                size=basic_info['size'],
                scene_name=basic_info['scene_name'],
                quality=basic_info['quality']
            )

            return AsyncProcessingResult(
                video_info=error_video_info,
                processing_time=processing_time,
                success=False,
                error=error_msg
            )

    def _quick_validate_video(self, video_path: Path) -> bool:
        """Quick validation without expensive operations"""
        try:
            if not video_path.exists():
                return False

            # Check if it's a supported video format
            if not self.sync_processor.is_video_file(video_path):
                return False

            # Check if it should be excluded
            if self.sync_processor.is_excluded(video_path):
                return False

            # Quick size check
            if video_path.stat().st_size < 1024:  # Less than 1KB
                return False

            return True

        except Exception:
            return False

    def _extract_basic_info(self, video_path: Path) -> Dict[str, Any]:
        """Extract basic file information (fast operations)"""
        parts = video_path.parts
        quality = parts[-2] if len(parts) > 1 else "unknown"
        scene_name = video_path.stem
        size = video_path.stat().st_size

        return {
            'size': size,
            'scene_name': scene_name,
            'quality': quality
        }

    def _calculate_hash_safe(self, video_path: Path) -> str:
        """Thread-safe hash calculation with intelligent selection"""
        file_size = video_path.stat().st_size

        with self.monitor.measure("hash_calculation", file_size=file_size):
            # Use parallel hash calculator for larger files (>1MB), fallback for small files
            if file_size > 1024 * 1024:  # 1MB threshold
                return self.hash_calculator.calculate_hash(video_path, algorithm="sha256")
            else:
                return self.fallback_hash_calculator.calculate_hash(video_path, algorithm="sha256")

    def _extract_ffprobe_metadata_safe(self, video_path: Path) -> Dict[str, Any]:
        """Thread-safe ffprobe metadata extraction with optimized timeout"""
        with self.monitor.measure("ffprobe_metadata"):
            try:
                cmd = [
                    "ffprobe",
                    "-v", "quiet",
                    "-print_format", "json",
                    "-show_format",
                    "-show_streams",
                    "-select_streams", "v:0",  # Only first video stream for speed
                    str(video_path),
                ]

                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=self.ffprobe_timeout
                )

                if result.returncode != 0:
                    if self.logger:
                        self.logger.debug(
                            f"ffprobe failed for {video_path.name}: {result.stderr}"
                        )
                    return {}

                data = json.loads(result.stdout)

                # Extract relevant metadata efficiently
                metadata = {}

                # Get duration from format
                if "format" in data and "duration" in data["format"]:
                    try:
                        metadata["duration"] = float(data["format"]["duration"])
                    except (ValueError, TypeError):
                        pass

                # Get video stream info (only first video stream)
                streams = data.get("streams", [])
                if streams:
                    stream = streams[0]  # We selected only the first video stream
                    if stream.get("codec_type") == "video":
                        try:
                            width = stream.get("width")
                            height = stream.get("height")
                            if width and height:
                                metadata["resolution"] = (int(width), int(height))
                        except (ValueError, TypeError):
                            pass

                        codec = stream.get("codec_name")
                        if codec:
                            metadata["codec"] = codec

                return metadata

            except subprocess.TimeoutExpired:
                if self.logger:
                    self.logger.debug(f"ffprobe timeout for {video_path.name}")
                return {}
            except json.JSONDecodeError as e:
                if self.logger:
                    self.logger.debug(f"ffprobe JSON decode error for {video_path.name}: {e}")
                return {}
            except Exception as e:
                if self.logger:
                    self.logger.debug(f"ffprobe error for {video_path.name}: {e}")
                return {}

    def process_videos_sync(
        self,
        video_paths: List[Path],
        include_detailed_metadata: bool = True
    ) -> List[AsyncProcessingResult]:
        """Synchronous wrapper for async processing"""
        return asyncio.run(self.process_videos_async(video_paths, include_detailed_metadata))

    async def find_videos_async(self, directory: Path, recursive: bool = True) -> List[Path]:
        """Asynchronously find all video files in a directory"""
        with self.monitor.measure("find_videos"):
            return await asyncio.get_event_loop().run_in_executor(
                None,
                self.sync_processor.find_videos,
                directory,
                recursive
            )

    def get_performance_stats(self) -> Dict[str, Any]:
        """Get performance monitoring statistics"""
        stats = self.monitor.get_report()

        # Add processor-specific stats
        stats["processor_config"] = {
            "max_workers": self.max_workers,
            "ffprobe_timeout": self.ffprobe_timeout,
            "monitoring_enabled": self.enable_monitoring,
            "logging_enabled": self.enable_logging
        }

        return stats

    def reset_performance_stats(self):
        """Reset performance monitoring statistics"""
        self.monitor.reset()

    def __enter__(self):
        """Context manager entry"""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit - cleanup resources"""
        self.shutdown()

    def shutdown(self):
        """Clean shutdown of thread pools"""
        if hasattr(self, 'metadata_executor'):
            self.metadata_executor.shutdown(wait=True)
        if hasattr(self, 'hash_executor'):
            self.hash_executor.shutdown(wait=True)

        if self.logger:
            self.logger.info("AsyncVideoProcessor shutdown complete")


class ConcurrentMetadataExtractor:
    """Specialized concurrent metadata extractor for batch operations"""

    def __init__(self, max_workers: int = 8, timeout: float = 2.0):
        self.max_workers = max_workers
        self.timeout = timeout
        self.executor = ThreadPoolExecutor(max_workers=max_workers)

    def extract_metadata_batch(self, video_paths: List[Path]) -> Dict[Path, Dict[str, Any]]:
        """Extract metadata from multiple videos concurrently"""
        results = {}

        # Submit all ffprobe tasks
        future_to_path = {
            self.executor.submit(self._extract_single_metadata, path): path
            for path in video_paths
        }

        # Collect results as they complete
        for future in as_completed(future_to_path, timeout=self.timeout * len(video_paths)):
            path = future_to_path[future]
            try:
                metadata = future.result()
                results[path] = metadata
            except Exception as e:
                results[path] = {"error": str(e)}

        return results

    def _extract_single_metadata(self, video_path: Path) -> Dict[str, Any]:
        """Extract metadata from a single video (thread-safe)"""
        try:
            cmd = [
                "ffprobe",
                "-v", "quiet",
                "-print_format", "json",
                "-show_format",
                "-show_streams",
                "-select_streams", "v:0",
                str(video_path),
            ]

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=self.timeout
            )

            if result.returncode != 0:
                return {"error": f"ffprobe failed: {result.stderr}"}

            data = json.loads(result.stdout)

            metadata = {}

            # Extract duration
            if "format" in data and "duration" in data["format"]:
                try:
                    metadata["duration"] = float(data["format"]["duration"])
                except (ValueError, TypeError):
                    pass

            # Extract video info
            for stream in data.get("streams", []):
                if stream.get("codec_type") == "video":
                    try:
                        width = stream.get("width")
                        height = stream.get("height")
                        if width and height:
                            metadata["resolution"] = (int(width), int(height))
                    except (ValueError, TypeError):
                        pass

                    codec = stream.get("codec_name")
                    if codec:
                        metadata["codec"] = codec
                    break

            return metadata

        except Exception as e:
            return {"error": str(e)}

    def shutdown(self):
        """Shutdown the thread pool"""
        self.executor.shutdown(wait=True)
