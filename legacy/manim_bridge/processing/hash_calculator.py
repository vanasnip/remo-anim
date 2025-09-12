"""File hashing utilities with chunked processing"""

import hashlib
from pathlib import Path
from typing import Optional

from ..core.constants import DEFAULT_CHUNK_SIZE
from ..core.exceptions import ProcessingError
from ..monitoring.logger import get_logger
from ..monitoring.performance_profiler import get_profiler


class HashCalculator:
    """Calculate file hashes efficiently"""

    def __init__(self, chunk_size: int = DEFAULT_CHUNK_SIZE, enable_logging: bool = False, enable_profiling: bool = True):
        self.chunk_size = chunk_size
        self.logger = get_logger() if enable_logging else None
        self.profiler = get_profiler() if enable_profiling else None

    def calculate_hash(self, file_path: Path, algorithm: str = "sha256") -> str:
        """Calculate file hash using specified algorithm"""
        if self.profiler:
            with self.profiler.profile_operation(
                f"hash_calculation_{algorithm}",
                file_path=str(file_path),
                algorithm=algorithm,
                chunk_size=self.chunk_size,
                expected_duration=self._estimate_hash_time(file_path)
            ):
                return self._calculate_hash_internal(file_path, algorithm)
        else:
            return self._calculate_hash_internal(file_path, algorithm)

    def _calculate_hash_internal(self, file_path: Path, algorithm: str = "sha256") -> str:
        """Internal hash calculation without profiling"""
        file_path = Path(file_path)

        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        # Create hash object
        if algorithm == "md5":
            hash_obj = hashlib.md5()
        elif algorithm == "sha256":
            hash_obj = hashlib.sha256()
        elif algorithm == "sha1":
            hash_obj = hashlib.sha1()
        else:
            raise ProcessingError(f"Unsupported hash algorithm: {algorithm}")

        try:
            with open(file_path, "rb") as f:
                # Read in chunks to handle large files
                while chunk := f.read(self.chunk_size):
                    hash_obj.update(chunk)

            hash_value = hash_obj.hexdigest()

            if self.logger:
                self.logger.debug(
                    f"Calculated {algorithm} hash for {file_path.name}: {hash_value[:8]}..."
                )

            return hash_value

        except Exception as e:
            raise ProcessingError("hash calculation failed")

    def _estimate_hash_time(self, file_path: Path) -> Optional[float]:
        """Estimate hash calculation time based on file size"""
        try:
            file_size = file_path.stat().st_size
            # Rough estimate: ~50MB/s for hash calculation
            estimated_seconds = file_size / (50 * 1024 * 1024)
            return max(0.001, estimated_seconds)  # Minimum 1ms
        except Exception:
            return None

    def calculate_multiple(self, file_paths: list, algorithm: str = "sha256") -> dict:
        """Calculate hashes for multiple files"""
        results = {}

        for file_path in file_paths:
            try:
                results[str(file_path)] = self.calculate_hash(file_path, algorithm)
            except ProcessingError as e:
                if self.logger:
                    self.logger.error(f"Hash calculation failed for {file_path}: {e}")
                results[str(file_path)] = None

        return results

    def verify_file(self, file_path: Path, expected_hash: str, algorithm: str = "sha256") -> bool:
        """Verify file integrity using hash"""
        try:
            actual_hash = self.calculate_hash(file_path, algorithm)
            is_valid = actual_hash == expected_hash

            if self.logger:
                if is_valid:
                    self.logger.debug(f"Hash verification passed for {file_path.name}")
                else:
                    self.logger.warning(f"Hash mismatch for {file_path.name}")

            return is_valid

        except ProcessingError:
            return False

    def calculate_with_progress(
        self,
        file_path: Path,
        progress_callback: Optional[callable] = None,
        algorithm: str = "sha256",
    ) -> str:
        """Calculate hash with progress reporting"""
        file_path = Path(file_path)

        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        file_size = file_path.stat().st_size
        bytes_read = 0

        # Create hash object
        if algorithm == "md5":
            hash_obj = hashlib.md5()
        elif algorithm == "sha256":
            hash_obj = hashlib.sha256()
        else:
            raise ProcessingError(f"Unsupported hash algorithm: {algorithm}")

        try:
            with open(file_path, "rb") as f:
                while chunk := f.read(self.chunk_size):
                    hash_obj.update(chunk)
                    bytes_read += len(chunk)

                    if progress_callback:
                        progress = (bytes_read / file_size) * 100
                        progress_callback(progress, bytes_read, file_size)

            return hash_obj.hexdigest()

        except Exception as e:
            raise ProcessingError(f"Failed to calculate hash: {e}")

    def verify_hash(self, file_path: Path, expected_hash: str, algorithm: str = "sha256") -> bool:
        """Verify file hash matches expected value"""
        try:
            actual_hash = self.calculate_hash(file_path, algorithm)
            return actual_hash == expected_hash
        except (ProcessingError, FileNotFoundError):
            return False
