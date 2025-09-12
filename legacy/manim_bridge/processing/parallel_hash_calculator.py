"""Parallel hash calculation with multi-threading and CPU optimization"""

import hashlib
import multiprocessing
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Optional, Dict, List, Callable, Tuple, Any
import mmap
import os

from ..core.constants import DEFAULT_CHUNK_SIZE, MAX_WORKERS
from ..core.exceptions import ProcessingError
from ..monitoring.logger import get_logger


class MemoryPool:
    """Memory pool for reusing byte buffers to reduce allocation overhead"""

    def __init__(self, buffer_size: int = DEFAULT_CHUNK_SIZE, pool_size: int = 20):
        self.buffer_size = buffer_size
        self.available_buffers = []
        self.lock = threading.Lock()

        # Pre-allocate buffers
        for _ in range(pool_size):
            self.available_buffers.append(bytearray(buffer_size))

    def get_buffer(self) -> bytearray:
        """Get a buffer from the pool or create a new one"""
        with self.lock:
            if self.available_buffers:
                return self.available_buffers.pop()
            else:
                return bytearray(self.buffer_size)

    def return_buffer(self, buffer: bytearray) -> None:
        """Return a buffer to the pool"""
        with self.lock:
            if len(self.available_buffers) < 20:  # Limit pool size
                # Clear buffer and return to pool
                buffer[:] = b'\x00' * len(buffer)
                self.available_buffers.append(buffer)


class ParallelHashCalculator:
    """High-performance parallel hash calculator with CPU optimization"""

    def __init__(
        self,
        chunk_size: int = DEFAULT_CHUNK_SIZE,
        max_workers: Optional[int] = None,
        enable_logging: bool = False,
        use_memory_mapping: bool = True,
        memory_pool_size: int = 20
    ):
        """
        Initialize parallel hash calculator

        Args:
            chunk_size: Size of chunks to process (optimized for L3 cache)
            max_workers: Maximum worker threads (defaults to CPU count)
            enable_logging: Enable performance logging
            use_memory_mapping: Use mmap for large files (>10MB)
            memory_pool_size: Size of memory buffer pool
        """
        self.chunk_size = self._optimize_chunk_size(chunk_size)
        self.max_workers = max_workers or min(MAX_WORKERS, multiprocessing.cpu_count())
        self.logger = get_logger() if enable_logging else None
        self.use_memory_mapping = use_memory_mapping
        self.memory_mapping_threshold = 10 * 1024 * 1024  # 10MB

        # Initialize memory pool for buffer reuse
        self.memory_pool = MemoryPool(self.chunk_size, memory_pool_size)

        # Cache CPU info for optimization
        self._cpu_count = multiprocessing.cpu_count()
        self._l3_cache_size = self._estimate_l3_cache_size()

        if self.logger:
            self.logger.debug(
                f"ParallelHashCalculator initialized: {self.max_workers} workers, "
                f"chunk_size={self.chunk_size}, L3_cache~{self._l3_cache_size}MB"
            )

    def _optimize_chunk_size(self, requested_chunk_size: int) -> int:
        """Optimize chunk size based on CPU cache hierarchy"""
        # Aim for L3 cache efficiency (typically 8-32MB on modern CPUs)
        # Use smaller chunks that fit in L2 cache (256KB-2MB) for better performance
        optimal_sizes = [64 * 1024, 128 * 1024, 256 * 1024, 512 * 1024, 1024 * 1024]

        # Find closest optimal size
        return min(optimal_sizes, key=lambda x: abs(x - requested_chunk_size))

    def _estimate_l3_cache_size(self) -> int:
        """Estimate L3 cache size in MB (rough heuristic)"""
        try:
            # Rough estimate based on CPU count
            if self._cpu_count <= 4:
                return 8  # 8MB typical for 4-core
            elif self._cpu_count <= 8:
                return 16  # 16MB typical for 8-core
            else:
                return 32  # 32MB+ for high-end CPUs
        except:
            return 16  # Safe default

    def _should_use_memory_mapping(self, file_size: int) -> bool:
        """Determine if memory mapping should be used based on file size"""
        return (
            self.use_memory_mapping and
            file_size > self.memory_mapping_threshold and
            file_size < 2 * 1024 * 1024 * 1024  # Don't mmap files > 2GB
        )

    def _create_hash_object(self, algorithm: str) -> hashlib.sha256:
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

    def _process_chunk_range(
        self,
        file_data: bytes,
        start: int,
        end: int,
        algorithm: str,
        chunk_id: int
    ) -> Tuple[int, str]:
        """Process a range of file data and return partial hash"""
        try:
            hash_obj = self._create_hash_object(algorithm)
            chunk_data = file_data[start:end]
            hash_obj.update(chunk_data)

            return chunk_id, hash_obj.hexdigest()

        except Exception as e:
            raise ProcessingError(f"Chunk processing failed for chunk {chunk_id}: {e}")

    def _process_file_chunks_mmap(
        self,
        file_path: Path,
        algorithm: str,
        progress_callback: Optional[Callable] = None
    ) -> str:
        """Process file using memory mapping for large files"""
        file_size = file_path.stat().st_size

        # Calculate optimal number of chunks based on CPU cores and file size
        optimal_chunk_count = min(
            self.max_workers * 2,  # 2x workers for better pipeline
            max(1, file_size // self.chunk_size)
        )

        chunk_size = max(self.chunk_size, file_size // optimal_chunk_count)

        with open(file_path, 'rb') as f:
            with mmap.mmap(f.fileno(), 0, access=mmap.ACCESS_READ) as mmapped_file:

                def read_chunk(chunk_info: Tuple[int, int, int]) -> Tuple[int, bytes]:
                    """Read a chunk and return (chunk_id, chunk_data)"""
                    chunk_id, start_pos, chunk_len = chunk_info

                    # Process chunk data
                    end_pos = min(start_pos + chunk_len, file_size)
                    chunk_data = mmapped_file[start_pos:end_pos]

                    return chunk_id, chunk_data

                # Generate chunk information
                chunks = []
                for i in range(optimal_chunk_count):
                    start_pos = i * chunk_size
                    if start_pos >= file_size:
                        break
                    chunks.append((i, start_pos, chunk_size))

                # Read chunks in parallel, then hash sequentially
                chunk_data_list = []
                bytes_processed = 0

                with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
                    future_to_chunk = {
                        executor.submit(read_chunk, chunk_info): chunk_info[0]
                        for chunk_info in chunks
                    }

                    for future in as_completed(future_to_chunk):
                        chunk_id, chunk_data = future.result()
                        chunk_data_list.append((chunk_id, chunk_data))

                        bytes_processed += len(chunk_data)
                        if progress_callback:
                            progress = min(100.0, (bytes_processed / file_size) * 100)
                            progress_callback(progress, bytes_processed, file_size)

                # Sort chunks by ID and hash sequentially
                chunk_data_list.sort(key=lambda x: x[0])

                # Create final hash by processing chunks in order
                final_hash = self._create_hash_object(algorithm)
                for _, chunk_data in chunk_data_list:
                    final_hash.update(chunk_data)

                return final_hash.hexdigest()

    def _process_file_chunks_regular(
        self,
        file_path: Path,
        algorithm: str,
        progress_callback: Optional[Callable] = None
    ) -> str:
        """Process file using regular I/O with parallel chunk reading"""
        file_size = file_path.stat().st_size

        # For smaller files, use simpler parallel approach
        optimal_chunks = min(self.max_workers, max(1, file_size // self.chunk_size))
        chunk_size = max(self.chunk_size, file_size // optimal_chunks)

        def read_file_chunk(chunk_info: Tuple[int, int, int]) -> Tuple[int, bytes]:
            """Read a specific chunk of the file"""
            chunk_id, start_pos, chunk_len = chunk_info

            buffer = self.memory_pool.get_buffer()
            try:
                chunk_data = b''
                with open(file_path, 'rb') as f:
                    f.seek(start_pos)
                    remaining = chunk_len

                    while remaining > 0:
                        read_size = min(len(buffer), remaining)
                        data = f.read(read_size)
                        if not data:
                            break

                        chunk_data += data
                        remaining -= len(data)

                return chunk_id, chunk_data

            finally:
                self.memory_pool.return_buffer(buffer)

        # Generate chunks
        chunks = []
        for i in range(optimal_chunks):
            start_pos = i * chunk_size
            if start_pos >= file_size:
                break
            actual_chunk_size = min(chunk_size, file_size - start_pos)
            chunks.append((i, start_pos, actual_chunk_size))

        # Read chunks in parallel
        chunk_data_list = []
        bytes_processed = 0

        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            future_to_chunk = {
                executor.submit(read_file_chunk, chunk_info): chunk_info[0]
                for chunk_info in chunks
            }

            for future in as_completed(future_to_chunk):
                chunk_id, chunk_data = future.result()
                chunk_data_list.append((chunk_id, chunk_data))

                bytes_processed += len(chunk_data)
                if progress_callback:
                    progress = min(100.0, (bytes_processed / file_size) * 100)
                    progress_callback(progress, bytes_processed, file_size)

        # Sort by chunk ID and hash sequentially
        chunk_data_list.sort(key=lambda x: x[0])

        # Create final hash by processing chunks in order
        final_hash = self._create_hash_object(algorithm)
        for _, chunk_data in chunk_data_list:
            final_hash.update(chunk_data)

        return final_hash.hexdigest()

    def calculate_hash(
        self,
        file_path: Path,
        algorithm: str = "sha256",
        progress_callback: Optional[Callable] = None
    ) -> str:
        """
        Calculate file hash using parallel processing

        Args:
            file_path: Path to file
            algorithm: Hash algorithm (md5, sha1, sha256, blake2b)
            progress_callback: Optional progress callback function

        Returns:
            Hexadecimal hash string
        """
        file_path = Path(file_path)

        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        file_size = file_path.stat().st_size

        # Log performance info
        if self.logger:
            self.logger.debug(
                f"Starting parallel hash calculation: {file_path.name} "
                f"({file_size:,} bytes) using {algorithm.upper()}"
            )

        try:
            # Choose processing method based on file size
            if self._should_use_memory_mapping(file_size):
                if self.logger:
                    self.logger.debug("Using memory mapping for large file")
                result = self._process_file_chunks_mmap(file_path, algorithm, progress_callback)
            else:
                if self.logger:
                    self.logger.debug("Using regular I/O with parallel chunks")
                result = self._process_file_chunks_regular(file_path, algorithm, progress_callback)

            if self.logger:
                self.logger.debug(
                    f"Parallel hash calculation completed: {algorithm} hash for {file_path.name}: {result[:16]}..."
                )

            return result

        except Exception as e:
            raise ProcessingError(f"Parallel hash calculation failed: {e}")

    def calculate_multiple(
        self,
        file_paths: List[Path],
        algorithm: str = "sha256",
        max_concurrent: Optional[int] = None
    ) -> Dict[str, Optional[str]]:
        """
        Calculate hashes for multiple files concurrently

        Args:
            file_paths: List of file paths
            algorithm: Hash algorithm
            max_concurrent: Maximum concurrent file processing

        Returns:
            Dictionary mapping file paths to hash values (or None on error)
        """
        max_concurrent = max_concurrent or self.max_workers
        results = {}

        def process_single_file(file_path: Path) -> Tuple[str, Optional[str]]:
            """Process single file and return (path, hash_or_None)"""
            try:
                hash_result = self.calculate_hash(file_path, algorithm)
                return str(file_path), hash_result
            except Exception as e:
                if self.logger:
                    self.logger.error(f"Hash calculation failed for {file_path}: {e}")
                return str(file_path), None

        with ThreadPoolExecutor(max_workers=max_concurrent) as executor:
            future_to_path = {
                executor.submit(process_single_file, path): path
                for path in file_paths
            }

            for future in as_completed(future_to_path):
                file_path_str, hash_result = future.result()
                results[file_path_str] = hash_result

        return results

    def verify_file(
        self,
        file_path: Path,
        expected_hash: str,
        algorithm: str = "sha256"
    ) -> bool:
        """
        Verify file integrity using parallel hash calculation

        Args:
            file_path: Path to file
            expected_hash: Expected hash value
            algorithm: Hash algorithm

        Returns:
            True if hash matches, False otherwise
        """
        try:
            actual_hash = self.calculate_hash(file_path, algorithm)
            is_valid = actual_hash.lower() == expected_hash.lower()

            if self.logger:
                if is_valid:
                    self.logger.debug(f"Parallel hash verification passed for {file_path.name}")
                else:
                    self.logger.warning(f"Parallel hash mismatch for {file_path.name}")

            return is_valid

        except (ProcessingError, FileNotFoundError):
            return False

    def get_performance_stats(self) -> Dict[str, Any]:
        """Get performance statistics and configuration"""
        return {
            "max_workers": self.max_workers,
            "chunk_size": self.chunk_size,
            "cpu_count": self._cpu_count,
            "estimated_l3_cache_mb": self._l3_cache_size,
            "memory_mapping_enabled": self.use_memory_mapping,
            "memory_mapping_threshold": self.memory_mapping_threshold,
            "memory_pool_size": len(self.memory_pool.available_buffers)
        }
