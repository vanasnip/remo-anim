"""Optimized hash calculator focusing on I/O parallelism and CPU efficiency"""

import hashlib
import mmap
import os
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Optional, Callable
import time

from ..core.constants import DEFAULT_CHUNK_SIZE
from ..core.exceptions import ProcessingError
from ..monitoring.logger import get_logger


class OptimizedHashCalculator:
    """
    Highly optimized hash calculator that focuses on:
    1. Minimizing thread overhead
    2. Optimizing I/O operations
    3. CPU cache-friendly processing
    """

    def __init__(
        self,
        chunk_size: int = DEFAULT_CHUNK_SIZE,
        enable_logging: bool = False,
        use_memory_mapping: bool = True
    ):
        self.chunk_size = self._optimize_chunk_size(chunk_size)
        self.logger = get_logger() if enable_logging else None
        self.use_memory_mapping = use_memory_mapping
        self.mmap_threshold = 1024 * 1024  # 1MB threshold for mmap

        if self.logger:
            self.logger.debug(f"OptimizedHashCalculator initialized with chunk_size={self.chunk_size}")

    def _optimize_chunk_size(self, requested_size: int) -> int:
        """Optimize chunk size for CPU cache efficiency"""
        # Use power-of-2 sizes that align well with memory hierarchy
        optimal_sizes = [64*1024, 128*1024, 256*1024, 512*1024, 1024*1024, 2*1024*1024]
        return min(optimal_sizes, key=lambda x: abs(x - requested_size))

    def _create_hash_object(self, algorithm: str):
        """Create hash object for specified algorithm"""
        algorithm = algorithm.lower()
        if algorithm == "md5":
            return hashlib.md5()
        elif algorithm == "sha256":
            return hashlib.sha256()
        elif algorithm == "sha1":
            return hashlib.sha1()
        elif algorithm == "blake2b":
            return hashlib.blake2b()
        else:
            raise ProcessingError(f"Unsupported hash algorithm: {algorithm}")

    def _calculate_hash_mmap(
        self,
        file_path: Path,
        algorithm: str,
        progress_callback: Optional[Callable] = None
    ) -> str:
        """Calculate hash using memory mapping for large files"""
        file_size = file_path.stat().st_size
        hash_obj = self._create_hash_object(algorithm)

        with open(file_path, 'rb') as f:
            with mmap.mmap(f.fileno(), 0, access=mmap.ACCESS_READ) as mm:
                bytes_processed = 0

                # Process in optimized chunks
                for i in range(0, file_size, self.chunk_size):
                    chunk_end = min(i + self.chunk_size, file_size)
                    chunk = mm[i:chunk_end]
                    hash_obj.update(chunk)

                    bytes_processed = chunk_end
                    if progress_callback:
                        progress = (bytes_processed / file_size) * 100
                        progress_callback(progress, bytes_processed, file_size)

        return hash_obj.hexdigest()

    def _calculate_hash_regular(
        self,
        file_path: Path,
        algorithm: str,
        progress_callback: Optional[Callable] = None
    ) -> str:
        """Calculate hash using regular I/O with optimized buffering"""
        file_size = file_path.stat().st_size
        hash_obj = self._create_hash_object(algorithm)
        bytes_processed = 0

        # Use a larger buffer for better I/O efficiency
        buffer_size = min(self.chunk_size, 8 * 1024 * 1024)  # Max 8MB buffer

        with open(file_path, 'rb', buffering=buffer_size) as f:
            while True:
                chunk = f.read(self.chunk_size)
                if not chunk:
                    break

                hash_obj.update(chunk)
                bytes_processed += len(chunk)

                if progress_callback:
                    progress = (bytes_processed / file_size) * 100
                    progress_callback(progress, bytes_processed, file_size)

        return hash_obj.hexdigest()

    def calculate_hash(
        self,
        file_path: Path,
        algorithm: str = "sha256",
        progress_callback: Optional[Callable] = None
    ) -> str:
        """Calculate file hash with optimized I/O"""
        file_path = Path(file_path)

        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        file_size = file_path.stat().st_size

        if self.logger:
            self.logger.debug(f"Calculating {algorithm} hash for {file_path.name} ({file_size:,} bytes)")

        start_time = time.perf_counter()

        try:
            # Choose method based on file size and availability
            if self.use_memory_mapping and file_size > self.mmap_threshold:
                result = self._calculate_hash_mmap(file_path, algorithm, progress_callback)
            else:
                result = self._calculate_hash_regular(file_path, algorithm, progress_callback)

            elapsed = time.perf_counter() - start_time

            if self.logger:
                throughput = file_size / elapsed / 1024 / 1024  # MB/s
                self.logger.debug(
                    f"Hash calculated in {elapsed:.4f}s ({throughput:.1f} MB/s): {result[:16]}..."
                )

            return result

        except Exception as e:
            raise ProcessingError(f"Hash calculation failed: {e}")

    def verify_file(self, file_path: Path, expected_hash: str, algorithm: str = "sha256") -> bool:
        """Verify file hash matches expected value"""
        try:
            actual_hash = self.calculate_hash(file_path, algorithm)
            return actual_hash.lower() == expected_hash.lower()
        except (ProcessingError, FileNotFoundError):
            return False

    def calculate_multiple(self, file_paths: list, algorithm: str = "sha256", max_workers: int = 2) -> dict:
        """Calculate hashes for multiple files with limited parallelism"""
        results = {}

        def process_single_file(file_path):
            try:
                hash_result = self.calculate_hash(file_path, algorithm)
                return str(file_path), hash_result
            except Exception as e:
                if self.logger:
                    self.logger.error(f"Hash calculation failed for {file_path}: {e}")
                return str(file_path), None

        # Use limited parallelism only for multiple file processing
        if len(file_paths) > 1 and max_workers > 1:
            with ThreadPoolExecutor(max_workers=min(max_workers, len(file_paths))) as executor:
                futures = [executor.submit(process_single_file, fp) for fp in file_paths]
                for future in futures:
                    file_path_str, hash_result = future.result()
                    results[file_path_str] = hash_result
        else:
            # Sequential processing for single files or when parallelism disabled
            for file_path in file_paths:
                file_path_str, hash_result = process_single_file(file_path)
                results[file_path_str] = hash_result

        return results
