"""Video processing and handling operations"""

import json
import os
import re
import subprocess
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from ..core.constants import EXCLUDED_PATHS, SUPPORTED_VIDEO_FORMATS
from ..core.exceptions import ProcessingError
from ..monitoring.logger import get_logger
from ..monitoring.performance_profiler import get_profiler
from .hash_calculator import HashCalculator


@dataclass
class VideoInfo:
    """Information about a video file"""

    path: Path
    hash: str
    size: int
    scene_name: str
    quality: str
    duration: Optional[float] = None
    resolution: Optional[Tuple[int, int]] = None
    codec: Optional[str] = None


class VideoProcessor:
    """Handles video file processing operations"""

    def __init__(
        self,
        hash_calculator: Optional[HashCalculator] = None,
        enable_logging: bool = False,
        enable_profiling: bool = True,
    ):
        self.hash_calculator = hash_calculator or HashCalculator()
        self.logger = get_logger() if enable_logging else None
        self.profiler = get_profiler() if enable_profiling else None

    def is_video_file(self, file_path: Path) -> bool:
        """Check if file is a supported video format"""
        return file_path.suffix.lower() in SUPPORTED_VIDEO_FORMATS

    def is_excluded(self, file_path: Path) -> bool:
        """Check if file should be excluded from processing"""
        path_str = str(file_path)

        for excluded in EXCLUDED_PATHS:
            if excluded in path_str:
                if self.logger:
                    self.logger.debug(f"File excluded: {file_path.name} (matched '{excluded}')")
                return True

        return False

    def extract_metadata(self, video_path: Path) -> VideoInfo:
        """Extract metadata from video file"""
        if self.profiler:
            with self.profiler.profile_operation(
                "video_metadata_extraction",
                file_path=str(video_path),
                file_size=video_path.stat().st_size if video_path.exists() else 0
            ):
                return self._extract_metadata_internal(video_path)
        else:
            return self._extract_metadata_internal(video_path)

    def _extract_metadata_internal(self, video_path: Path) -> VideoInfo:
        """Internal metadata extraction without profiling"""
        video_path = Path(video_path)

        if not video_path.exists():
            raise ProcessingError(f"Video file not found: {video_path}")

        # Validate video file first
        if not self.validate_video(video_path):
            raise ProcessingError(f"Invalid or corrupted video file: {video_path}")

        # Extract basic info from path
        parts = video_path.parts
        quality = parts[-2] if len(parts) > 1 else "unknown"
        scene_name = video_path.stem
        size = video_path.stat().st_size

        # Calculate hash
        file_hash = self.hash_calculator.calculate_hash(video_path, algorithm="sha256")

        info = VideoInfo(
            path=video_path,
            hash=file_hash,
            size=size,
            scene_name=scene_name,
            quality=quality,
        )

        # Try to get additional metadata using ffprobe
        try:
            extended_metadata = self._get_ffprobe_metadata(video_path)
            if extended_metadata:
                info.duration = extended_metadata.get("duration")
                info.resolution = extended_metadata.get("resolution")
                info.codec = extended_metadata.get("codec")
        except ProcessingError:
            # Re-raise ffprobe errors that should bubble up
            raise

        if self.logger:
            self.logger.debug(
                f"Extracted metadata for {video_path.name}: "
                f"scene={scene_name}, quality={quality}, size={size}"
            )

        return info

    def _get_ffprobe_metadata(self, video_path: Path) -> Optional[Dict[str, Any]]:
        """Get video metadata using ffprobe if available"""
        try:
            cmd = [
                "ffprobe",
                "-v",
                "quiet",
                "-print_format",
                "json",
                "-show_format",
                "-show_streams",
                str(video_path),
            ]

            result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)

            if result.returncode != 0:
                if self.logger:
                    self.logger.error(
                        f"ffprobe failed with return code {result.returncode}: {result.stderr}"
                    )
                raise ProcessingError(f"ffprobe failed: {result.stderr}")

            import json

            data = json.loads(result.stdout)

            # Extract relevant metadata
            metadata = {}

            # Get duration
            if "format" in data and "duration" in data["format"]:
                metadata["duration"] = float(data["format"]["duration"])

            # Get video stream info
            for stream in data.get("streams", []):
                if stream.get("codec_type") == "video":
                    metadata["resolution"] = (stream.get("width"), stream.get("height"))
                    metadata["codec"] = stream.get("codec_name")
                    break

            return metadata

        except subprocess.TimeoutExpired as e:
            if self.logger:
                self.logger.error(f"ffprobe timeout: {e}")
            raise ProcessingError(f"ffprobe timeout: {e}")
        except Exception as e:
            if self.logger:
                self.logger.debug(f"ffprobe not available or failed: {e}")
            return None

    def validate_video(self, video_path: Path) -> bool:
        """Validate that a video file is complete and valid"""
        video_path = Path(video_path)

        if not video_path.exists():
            return False

        # Check minimum size (at least 1KB)
        if video_path.stat().st_size < 1024:
            if self.logger:
                self.logger.warning(f"Video file too small: {video_path.name}")
            return False

        # Check file header for video signatures
        try:
            with open(video_path, "rb") as f:
                header = f.read(12)

                # Common video format signatures
                signatures = [
                    b"\x00\x00\x00\x18ftypmp42",  # MP4
                    b"\x00\x00\x00\x14ftypisom",  # MP4
                    b"\x00\x00\x00\x20ftypmp42",  # MP4
                    b"\x1a\x45\xdf\xa3",  # WebM/MKV
                    b"RIFF",  # AVI
                ]

                is_valid = any(header.startswith(sig) or sig in header for sig in signatures)

                if not is_valid and self.logger:
                    self.logger.warning(f"Invalid video signature for: {video_path.name}")

                return is_valid

        except Exception as e:
            if self.logger:
                self.logger.error(f"Failed to validate video {video_path.name}: {e}")
            return False

    def generate_output_filename(self, source_path: Path, include_timestamp: bool = True) -> str:
        """Generate output filename for processed video"""
        info = self.extract_metadata(source_path)

        if include_timestamp:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"{info.scene_name}_{info.quality}_{timestamp}{source_path.suffix}"
        else:
            filename = f"{info.scene_name}_{info.quality}{source_path.suffix}"

        return filename

    def find_videos(self, directory: Path, recursive: bool = True) -> list:
        """Find all video files in a directory"""
        directory = Path(directory)
        videos = []

        if not directory.exists():
            if self.logger:
                self.logger.warning(f"Directory not found: {directory}")
            return videos

        # Find videos based on extensions
        for ext in SUPPORTED_VIDEO_FORMATS:
            if recursive:
                pattern = f"**/*{ext}"
            else:
                pattern = f"*{ext}"

            for video_path in directory.glob(pattern):
                if not self.is_excluded(video_path):
                    videos.append(video_path)

        if self.logger:
            self.logger.info(f"Found {len(videos)} video files in {directory}")

        return videos

    def process_video(self, input_path: Path, output_path: Path) -> bool:
        """Process a video file (basic implementation for testing)"""
        try:
            # Extract metadata first (will raise ProcessingError if it fails)
            metadata = self.extract_metadata(input_path)

            # For testing purposes, just copy the file
            import shutil

            output_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(input_path, output_path)

            if self.logger:
                self.logger.info(f"Processed video: {input_path} -> {output_path}")

            return True

        except Exception as e:
            if self.logger:
                self.logger.error(f"Failed to process video {input_path}: {e}")
            raise ProcessingError(f"Failed to process video {input_path}: {e}")

    def _validate_video_path(self, video_path: str) -> bool:
        """Validate video path for security - prevent path traversal"""
        path = Path(video_path).resolve()

        # Check for path traversal attempts
        path_str = str(path)
        dangerous_patterns = [
            '..',
            '/etc/',
            '/root/',
            '/proc/',
            '/sys/',
            '/dev/',
            '~',
            '$',
        ]

        for pattern in dangerous_patterns:
            if pattern in path_str:
                if self.logger:
                    self.logger.error(f"Dangerous path detected: {path_str}")
                raise ProcessingError(f"Invalid path: contains dangerous pattern '{pattern}'")

        return True

    def _is_supported_format(self, filename: str) -> bool:
        """Check if filename has supported video format extension"""
        path = Path(filename)
        return path.suffix.lower() in SUPPORTED_VIDEO_FORMATS

    def _sanitize_command(self, command: List[str]) -> List[str]:
        """Sanitize command arguments to prevent injection"""
        if not isinstance(command, list):
            raise ProcessingError("Command must be a list, not a string")

        sanitized = []
        for arg in command:
            if not isinstance(arg, str):
                raise ProcessingError(f"Command argument must be string, got {type(arg)}")

            # Check for dangerous characters that could enable injection
            dangerous_chars = [';', '&', '|', '`', '$', '(', ')', '{', '}']
            if any(char in arg for char in dangerous_chars):
                raise ProcessingError(f"Unsafe command argument: {arg}")

            sanitized.append(arg)

        return sanitized

    def _run_command(self, command: List[str], timeout: int = 30) -> subprocess.CompletedProcess:
        """Run command safely with sanitization and timeout"""
        try:
            # Sanitize command first
            safe_command = self._sanitize_command(command)

            if self.logger:
                self.logger.debug(f"Running command: {safe_command[:2]}...")  # Log only first 2 args for security

            # Execute with safety measures
            result = subprocess.run(
                safe_command,
                capture_output=True,
                text=True,
                timeout=timeout,
                shell=False,  # Critical: never use shell=True
                check=False
            )

            if result.returncode != 0:
                error_msg = f"Command failed with code {result.returncode}: {result.stderr}"
                if self.logger:
                    self.logger.error(error_msg)
                raise ProcessingError(error_msg)

            return result

        except subprocess.TimeoutExpired as e:
            error_msg = f"Command timeout after {timeout}s: {e}"
            if self.logger:
                self.logger.error(error_msg)
            raise ProcessingError(error_msg)
        except Exception as e:
            error_msg = f"Command execution failed: {e}"
            if self.logger:
                self.logger.error(error_msg)
            raise ProcessingError(error_msg)

    def _extract_video_metadata(self, video_path: Path) -> Optional[Dict[str, Any]]:
        """Extract video metadata safely using ffprobe"""
        self._validate_video_path(str(video_path))

        command = [
            'ffprobe',
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_format',
            '-show_streams',
            str(video_path)
        ]

        try:
            result = self._run_command(command, timeout=30)
            metadata = json.loads(result.stdout)

            # Extract safe metadata
            safe_metadata = {}

            # Duration
            if 'format' in metadata and 'duration' in metadata['format']:
                try:
                    safe_metadata['duration'] = float(metadata['format']['duration'])
                except (ValueError, TypeError):
                    pass

            # Video stream info
            for stream in metadata.get('streams', []):
                if stream.get('codec_type') == 'video':
                    try:
                        width = int(stream.get('width', 0))
                        height = int(stream.get('height', 0))
                        if width > 0 and height > 0:
                            safe_metadata['resolution'] = (width, height)
                    except (ValueError, TypeError):
                        pass

                    codec = stream.get('codec_name')
                    if isinstance(codec, str) and codec.isalnum():
                        safe_metadata['codec'] = codec
                    break

            return safe_metadata

        except ProcessingError:
            raise  # Re-raise processing errors
        except Exception as e:
            if self.logger:
                self.logger.warning(f"Metadata extraction failed: {e}")
            return None

    def process_video_safe(self, video_path: Path) -> VideoInfo:
        """Process video with comprehensive error handling and logging"""
        try:
            # Validate path first
            self._validate_video_path(str(video_path))

            # Check format
            if not self._is_supported_format(str(video_path)):
                raise ProcessingError(f"Unsupported video format: {video_path.suffix}")

            # Extract metadata
            with self.profiler.profile_operation("video_processing", file_path=str(video_path)) if self.profiler else None:
                metadata = self.extract_metadata(video_path)

            if self.logger:
                self.logger.info(f"Successfully processed video: {video_path.name}")

            return metadata

        except ProcessingError:
            # Re-raise processing errors (these are expected)
            if self.profiler:
                self.profiler.record_error("video_processing_error", str(video_path))
            raise
        except Exception as e:
            # Log unexpected errors
            error_msg = f"Unexpected error processing {video_path}: {e}"
            if self.logger:
                self.logger.error(error_msg)
            if self.profiler:
                self.profiler.record_error("video_processing_unexpected", str(video_path))
            raise ProcessingError(error_msg)

    def _create_temp_file(self, suffix: str = '.tmp') -> Path:
        """Create temporary file for processing operations"""
        import tempfile
        fd, path = tempfile.mkstemp(suffix=suffix)
        os.close(fd)  # Close file descriptor, keep path
        return Path(path)

    def _process_with_temp_file(self, input_path: Path) -> None:
        """Simulate processing with temporary file (for testing)"""
        # This is a placeholder method for testing cleanup behavior
        raise ProcessingError("Simulated processing failure for testing")

    def _safe_process_with_cleanup(self, input_path: Path) -> None:
        """Process video with automatic cleanup of temporary resources"""
        temp_file = None
        try:
            temp_file = self._create_temp_file()
            self._process_with_temp_file(input_path)

        except Exception as e:
            # Ensure cleanup happens even on error
            if temp_file and temp_file.exists():
                temp_file.unlink()
            raise
        finally:
            # Final cleanup
            if temp_file and temp_file.exists():
                temp_file.unlink()
