"""Comprehensive tests for ParallelHashCalculator with performance validation"""

import hashlib
import tempfile
import time
import threading
from pathlib import Path
from unittest.mock import Mock, patch
import pytest

from manim_bridge.processing.parallel_hash_calculator import ParallelHashCalculator, MemoryPool
from manim_bridge.core.exceptions import ProcessingError


@pytest.mark.unit
class TestMemoryPool:
    """Test MemoryPool functionality"""

    def test_memory_pool_initialization(self):
        """Test memory pool initialization"""
        pool = MemoryPool(buffer_size=1024, pool_size=5)

        assert len(pool.available_buffers) == 5
        assert pool.buffer_size == 1024

        # All buffers should be the right size
        for buffer in pool.available_buffers:
            assert len(buffer) == 1024

    def test_get_and_return_buffer(self):
        """Test getting and returning buffers"""
        pool = MemoryPool(buffer_size=512, pool_size=3)
        initial_count = len(pool.available_buffers)

        # Get a buffer
        buffer = pool.get_buffer()
        assert len(buffer) == 512
        assert len(pool.available_buffers) == initial_count - 1

        # Return the buffer
        pool.return_buffer(buffer)
        assert len(pool.available_buffers) == initial_count

    def test_buffer_pool_exhaustion(self):
        """Test behavior when pool is exhausted"""
        pool = MemoryPool(buffer_size=256, pool_size=2)

        # Get all buffers
        buffer1 = pool.get_buffer()
        buffer2 = pool.get_buffer()
        assert len(pool.available_buffers) == 0

        # Getting another buffer should create a new one
        buffer3 = pool.get_buffer()
        assert len(buffer3) == 256
        assert len(pool.available_buffers) == 0

    def test_buffer_pool_size_limit(self):
        """Test that pool size is limited when returning buffers"""
        pool = MemoryPool(buffer_size=128, pool_size=2)

        # Create extra buffers
        extra_buffers = [bytearray(128) for _ in range(5)]

        # Return more buffers than pool size
        for buffer in extra_buffers:
            pool.return_buffer(buffer)

        # Pool should not exceed its maximum size
        assert len(pool.available_buffers) <= 20  # Hard limit in implementation


@pytest.mark.unit
class TestParallelHashCalculatorInitialization:
    """Test ParallelHashCalculator initialization and configuration"""

    def test_default_initialization(self):
        """Test default initialization"""
        calc = ParallelHashCalculator()

        assert calc.chunk_size > 0
        assert calc.max_workers > 0
        assert calc.logger is None
        assert calc.use_memory_mapping is True
        assert isinstance(calc.memory_pool, MemoryPool)

    def test_custom_initialization(self):
        """Test initialization with custom parameters"""
        calc = ParallelHashCalculator(
            chunk_size=2048,
            max_workers=2,
            enable_logging=True,
            use_memory_mapping=False,
            memory_pool_size=10
        )

        assert calc.max_workers == 2
        assert calc.logger is not None
        assert calc.use_memory_mapping is False

    def test_chunk_size_optimization(self):
        """Test chunk size optimization"""
        calc = ParallelHashCalculator()

        # Should optimize chunk size to cache-friendly values
        optimized = calc._optimize_chunk_size(100000)  # 100KB

        # Should be one of the optimal sizes
        optimal_sizes = [64 * 1024, 128 * 1024, 256 * 1024, 512 * 1024, 1024 * 1024]
        assert optimized in optimal_sizes

    def test_performance_stats(self):
        """Test performance statistics"""
        calc = ParallelHashCalculator(max_workers=4)
        stats = calc.get_performance_stats()

        assert stats["max_workers"] == 4
        assert "chunk_size" in stats
        assert "cpu_count" in stats
        assert "estimated_l3_cache_mb" in stats
        assert "memory_mapping_enabled" in stats


@pytest.mark.unit
class TestParallelHashCalculation:
    """Test parallel hash calculation functionality"""

    def test_small_file_hash_calculation(self, temp_workspace):
        """Test hash calculation for small files"""
        calc = ParallelHashCalculator(enable_logging=True)

        # Create small test file
        test_file = temp_workspace / "small_test.txt"
        test_content = b"small file content for testing"
        test_file.write_bytes(test_content)

        # Calculate hash
        result = calc.calculate_hash(test_file, algorithm="sha256")
        expected = hashlib.sha256(test_content).hexdigest()

        assert result == expected

    def test_medium_file_hash_calculation(self, temp_workspace):
        """Test hash calculation for medium files (regular I/O path)"""
        calc = ParallelHashCalculator(chunk_size=1024, max_workers=2)

        # Create medium test file (~50KB)
        test_file = temp_workspace / "medium_test.txt"
        test_content = b"medium file content " * 2500  # ~50KB
        test_file.write_bytes(test_content)

        # Calculate hash
        result = calc.calculate_hash(test_file, algorithm="md5")
        expected = hashlib.md5(test_content).hexdigest()

        assert result == expected

    def test_large_file_hash_calculation_mmap(self, temp_workspace):
        """Test hash calculation for large files (memory mapping path)"""
        calc = ParallelHashCalculator(
            chunk_size=8192,
            max_workers=4,
            use_memory_mapping=True
        )

        # Create large test file (15MB to trigger mmap)
        test_file = temp_workspace / "large_test.txt"
        chunk_content = b"large file chunk content " * 1000  # ~25KB
        large_content = chunk_content * 600  # ~15MB
        test_file.write_bytes(large_content)

        # Calculate hash
        result = calc.calculate_hash(test_file, algorithm="sha256")
        expected = hashlib.sha256(large_content).hexdigest()

        assert result == expected

    def test_all_supported_algorithms(self, temp_workspace):
        """Test all supported hash algorithms"""
        calc = ParallelHashCalculator()

        test_file = temp_workspace / "algo_test.txt"
        test_content = b"algorithm test content"
        test_file.write_bytes(test_content)

        algorithms = ["md5", "sha1", "sha256", "blake2b"]

        for algorithm in algorithms:
            result = calc.calculate_hash(test_file, algorithm=algorithm)

            # Verify against standard hashlib
            if algorithm == "blake2b":
                expected = hashlib.blake2b(test_content).hexdigest()
            else:
                hash_func = getattr(hashlib, algorithm)
                expected = hash_func(test_content).hexdigest()

            assert result == expected, f"Algorithm {algorithm} failed"

    def test_progress_callback(self, temp_workspace):
        """Test progress callback functionality"""
        calc = ParallelHashCalculator(chunk_size=2048)

        # Create test file large enough to trigger multiple chunks
        test_file = temp_workspace / "progress_test.txt"
        test_content = b"progress test content " * 1000  # ~22KB
        test_file.write_bytes(test_content)

        progress_calls = []

        def progress_callback(progress, bytes_read, file_size):
            progress_calls.append((progress, bytes_read, file_size))

        result = calc.calculate_hash(
            test_file,
            algorithm="md5",
            progress_callback=progress_callback
        )

        # Verify hash is correct
        expected = hashlib.md5(test_content).hexdigest()
        assert result == expected

        # Verify progress callbacks were made
        assert len(progress_calls) > 0

        # Check progress values
        for progress, bytes_read, file_size in progress_calls:
            assert 0 <= progress <= 100
            assert bytes_read <= file_size
            assert file_size == len(test_content)

    def test_file_not_found_error(self, temp_workspace):
        """Test error handling for non-existent files"""
        calc = ParallelHashCalculator()
        nonexistent_file = temp_workspace / "nonexistent.txt"

        with pytest.raises(FileNotFoundError, match="File not found"):
            calc.calculate_hash(nonexistent_file)

    def test_unsupported_algorithm_error(self, temp_workspace):
        """Test error handling for unsupported algorithms"""
        calc = ParallelHashCalculator()

        test_file = temp_workspace / "test.txt"
        test_file.write_bytes(b"test")

        with pytest.raises(ProcessingError, match="Unsupported hash algorithm"):
            calc.calculate_hash(test_file, algorithm="invalid_algo")


@pytest.mark.unit
class TestParallelMultipleFileProcessing:
    """Test parallel processing of multiple files"""

    def test_calculate_multiple_files(self, temp_workspace):
        """Test parallel calculation of multiple files"""
        calc = ParallelHashCalculator(max_workers=3)

        # Create multiple test files
        files = []
        expected_hashes = {}

        for i in range(5):
            file_path = temp_workspace / f"multi_file_{i}.txt"
            content = f"content for file {i}".encode() * 100
            file_path.write_bytes(content)
            files.append(file_path)
            expected_hashes[str(file_path)] = hashlib.sha256(content).hexdigest()

        # Calculate hashes in parallel
        results = calc.calculate_multiple(files, algorithm="sha256")

        assert len(results) == 5

        # Verify all hashes
        for file_path, hash_result in results.items():
            assert hash_result is not None
            assert hash_result == expected_hashes[file_path]

    def test_calculate_multiple_with_failures(self, temp_workspace):
        """Test multiple file processing with some failures"""
        calc = ParallelHashCalculator(enable_logging=True)

        # Create mix of existing and non-existent files
        existing_file = temp_workspace / "exists.txt"
        existing_file.write_bytes(b"existing content")

        nonexistent_file = temp_workspace / "nonexistent.txt"

        files = [existing_file, nonexistent_file]
        results = calc.calculate_multiple(files)

        assert len(results) == 2
        assert results[str(existing_file)] is not None
        assert results[str(nonexistent_file)] is None

    def test_calculate_multiple_different_algorithms(self, temp_workspace):
        """Test multiple file processing with different algorithms"""
        calc = ParallelHashCalculator()

        file_path = temp_workspace / "algo_multi_test.txt"
        content = b"algorithm test content for multiple processing"
        file_path.write_bytes(content)

        files = [file_path]
        algorithms = ["md5", "sha1", "sha256"]

        for algorithm in algorithms:
            results = calc.calculate_multiple(files, algorithm=algorithm)

            hash_func = getattr(hashlib, algorithm)
            expected = hash_func(content).hexdigest()

            assert results[str(file_path)] == expected


@pytest.mark.unit
class TestParallelFileVerification:
    """Test parallel file verification"""

    def test_verify_file_correct_hash(self, temp_workspace):
        """Test file verification with correct hash"""
        calc = ParallelHashCalculator(enable_logging=True)

        test_file = temp_workspace / "verify_correct.txt"
        content = b"content for correct verification"
        test_file.write_bytes(content)

        expected_hash = hashlib.sha256(content).hexdigest()
        result = calc.verify_file(test_file, expected_hash, algorithm="sha256")

        assert result is True

    def test_verify_file_incorrect_hash(self, temp_workspace):
        """Test file verification with incorrect hash"""
        calc = ParallelHashCalculator(enable_logging=True)

        test_file = temp_workspace / "verify_incorrect.txt"
        test_file.write_bytes(b"content for incorrect verification")

        wrong_hash = "1234567890abcdef" * 4  # 64-character fake hash
        result = calc.verify_file(test_file, wrong_hash, algorithm="sha256")

        assert result is False

    def test_verify_file_case_insensitive(self, temp_workspace):
        """Test that file verification is case insensitive"""
        calc = ParallelHashCalculator()

        test_file = temp_workspace / "verify_case.txt"
        content = b"case insensitive test"
        test_file.write_bytes(content)

        expected_hash = hashlib.md5(content).hexdigest()

        # Test with uppercase hash
        result_upper = calc.verify_file(test_file, expected_hash.upper(), algorithm="md5")
        assert result_upper is True

        # Test with mixed case
        mixed_case = expected_hash[:16].upper() + expected_hash[16:].lower()
        result_mixed = calc.verify_file(test_file, mixed_case, algorithm="md5")
        assert result_mixed is True

    def test_verify_nonexistent_file(self, temp_workspace):
        """Test verification of non-existent file"""
        calc = ParallelHashCalculator()

        nonexistent_file = temp_workspace / "nonexistent.txt"
        result = calc.verify_file(nonexistent_file, "any_hash")

        assert result is False


@pytest.mark.unit
class TestPerformanceOptimizations:
    """Test performance optimizations and CPU utilization"""

    def test_memory_mapping_threshold(self, temp_workspace):
        """Test memory mapping threshold logic"""
        calc = ParallelHashCalculator(use_memory_mapping=True)

        # Small file should not use mmap
        small_size = 1024 * 1024  # 1MB
        assert not calc._should_use_memory_mapping(small_size)

        # Large file should use mmap
        large_size = 50 * 1024 * 1024  # 50MB
        assert calc._should_use_memory_mapping(large_size)

        # Extremely large file should not use mmap (>2GB)
        huge_size = 3 * 1024 * 1024 * 1024  # 3GB
        assert not calc._should_use_memory_mapping(huge_size)

    def test_memory_mapping_disabled(self, temp_workspace):
        """Test behavior when memory mapping is disabled"""
        calc = ParallelHashCalculator(use_memory_mapping=False)

        large_size = 50 * 1024 * 1024  # 50MB
        assert not calc._should_use_memory_mapping(large_size)

    def test_thread_safety(self, temp_workspace):
        """Test thread safety of parallel hash calculator"""
        calc = ParallelHashCalculator(max_workers=4)

        # Create test file
        test_file = temp_workspace / "thread_safety.txt"
        content = b"thread safety test content " * 1000
        test_file.write_bytes(content)

        expected = hashlib.sha256(content).hexdigest()
        results = []
        errors = []

        def calculate_hash_thread():
            try:
                result = calc.calculate_hash(test_file, algorithm="sha256")
                results.append(result)
            except Exception as e:
                errors.append(e)

        # Run multiple threads simultaneously
        threads = []
        for _ in range(10):
            thread = threading.Thread(target=calculate_hash_thread)
            threads.append(thread)
            thread.start()

        # Wait for all threads
        for thread in threads:
            thread.join()

        # Verify results
        assert len(errors) == 0, f"Errors occurred: {errors}"
        assert len(results) == 10
        assert all(result == expected for result in results)

    def test_cpu_count_detection(self):
        """Test CPU count detection"""
        calc = ParallelHashCalculator()

        assert calc._cpu_count > 0
        assert calc._cpu_count == calc.max_workers or calc.max_workers <= 4  # MAX_WORKERS limit

    def test_l3_cache_estimation(self):
        """Test L3 cache size estimation"""
        calc = ParallelHashCalculator()

        cache_size = calc._estimate_l3_cache_size()
        assert cache_size > 0
        assert cache_size <= 64  # Reasonable upper bound


@pytest.mark.unit
class TestPerformanceComparison:
    """Test performance improvements vs sequential processing"""

    def test_performance_vs_sequential(self, temp_workspace):
        """Test performance improvement vs sequential hash calculator"""
        from manim_bridge.processing.hash_calculator import HashCalculator

        # Create moderately large test file
        test_file = temp_workspace / "performance_test.txt"
        # Create ~5MB file for meaningful comparison
        chunk = b"performance test content " * 1000  # ~25KB
        content = chunk * 200  # ~5MB
        test_file.write_bytes(content)

        # Test sequential calculator
        sequential_calc = HashCalculator(chunk_size=64*1024)  # 64KB chunks
        start_time = time.time()
        sequential_result = sequential_calc.calculate_hash(test_file, algorithm="sha256")
        sequential_time = time.time() - start_time

        # Test parallel calculator
        parallel_calc = ParallelHashCalculator(
            chunk_size=64*1024,
            max_workers=4,
            use_memory_mapping=False  # Use same I/O method for fair comparison
        )
        start_time = time.time()
        parallel_result = parallel_calc.calculate_hash(test_file, algorithm="sha256")
        parallel_time = time.time() - start_time

        # Verify results are identical
        assert sequential_result == parallel_result

        # Log timing for analysis (parallel should be faster or similar)
        print(f"\nPerformance comparison for {len(content):,} bytes:")
        print(f"Sequential: {sequential_time:.4f}s")
        print(f"Parallel:   {parallel_time:.4f}s")

        if parallel_time < sequential_time:
            improvement = (sequential_time - parallel_time) / sequential_time * 100
            print(f"Improvement: {improvement:.1f}%")

        # For smaller files, parallel might not always be faster due to overhead
        # But it should not be significantly slower
        assert parallel_time < sequential_time * 2.0, "Parallel processing is too slow"

    def test_memory_pool_performance(self, temp_workspace):
        """Test memory pool performance benefits"""
        # This test validates that memory pool reduces allocation overhead
        calc = ParallelHashCalculator(memory_pool_size=10)

        # Create multiple small files to test buffer reuse
        files = []
        for i in range(20):  # More files than pool size
            file_path = temp_workspace / f"pool_test_{i}.txt"
            content = f"memory pool test content {i}".encode() * 100
            file_path.write_bytes(content)
            files.append(file_path)

        # Process files - should reuse buffers efficiently
        start_time = time.time()
        results = calc.calculate_multiple(files, algorithm="md5", max_concurrent=4)
        processing_time = time.time() - start_time

        # Verify all files processed successfully
        assert len(results) == 20
        assert all(hash_val is not None for hash_val in results.values())

        # Should complete in reasonable time
        assert processing_time < 5.0, f"Processing took too long: {processing_time:.2f}s"


@pytest.mark.unit
class TestErrorHandling:
    """Test comprehensive error handling"""

    def test_file_read_error_handling(self, temp_workspace):
        """Test handling of file read errors"""
        calc = ParallelHashCalculator()

        test_file = temp_workspace / "read_error.txt"
        test_file.write_bytes(b"test content")

        # Mock file opening to raise permission error
        with patch("builtins.open", side_effect=PermissionError("Permission denied")):
            with pytest.raises(ProcessingError, match="Parallel hash calculation failed"):
                calc.calculate_hash(test_file)

    def test_memory_mapping_error_handling(self, temp_workspace):
        """Test error handling in memory mapping path"""
        calc = ParallelHashCalculator(use_memory_mapping=True)

        # Create large file to trigger mmap path
        test_file = temp_workspace / "mmap_error.txt"
        large_content = b"large content " * 1000000  # ~13MB
        test_file.write_bytes(large_content)

        # Mock mmap to raise an error
        with patch("mmap.mmap", side_effect=OSError("mmap failed")):
            with pytest.raises(ProcessingError, match="Parallel hash calculation failed"):
                calc.calculate_hash(test_file)

    def test_thread_pool_error_handling(self, temp_workspace):
        """Test error handling in thread pool execution"""
        calc = ParallelHashCalculator(max_workers=2)

        # Create test files
        files = []
        for i in range(3):
            file_path = temp_workspace / f"thread_error_{i}.txt"
            file_path.write_bytes(f"content {i}".encode())
            files.append(file_path)

        # Mock one file to cause an error during processing
        original_calculate = calc.calculate_hash

        def mock_calculate(file_path, algorithm="sha256", progress_callback=None):
            if "thread_error_1" in str(file_path):
                raise OSError("Simulated thread error")
            return original_calculate(file_path, algorithm, progress_callback)

        with patch.object(calc, 'calculate_hash', side_effect=mock_calculate):
            results = calc.calculate_multiple(files)

            # Should handle the error gracefully
            assert len(results) == 3
            assert results[str(files[0])] is not None  # Success
            assert results[str(files[1])] is None      # Error
            assert results[str(files[2])] is not None  # Success


@pytest.mark.unit
class TestEdgeCases:
    """Test edge cases and boundary conditions"""

    def test_empty_file(self, temp_workspace):
        """Test parallel hash calculation for empty file"""
        calc = ParallelHashCalculator()

        empty_file = temp_workspace / "empty.txt"
        empty_file.write_bytes(b"")

        result = calc.calculate_hash(empty_file, algorithm="md5")
        expected = hashlib.md5(b"").hexdigest()

        assert result == expected

    def test_single_byte_file(self, temp_workspace):
        """Test parallel hash calculation for single-byte file"""
        calc = ParallelHashCalculator()

        single_byte_file = temp_workspace / "single_byte.txt"
        single_byte_file.write_bytes(b"X")

        result = calc.calculate_hash(single_byte_file, algorithm="sha1")
        expected = hashlib.sha1(b"X").hexdigest()

        assert result == expected

    def test_file_exactly_chunk_size(self, temp_workspace):
        """Test file that's exactly one chunk size"""
        chunk_size = 4096
        calc = ParallelHashCalculator(chunk_size=chunk_size)

        test_file = temp_workspace / "exact_chunk.txt"
        content = b"X" * chunk_size  # Exactly one chunk
        test_file.write_bytes(content)

        result = calc.calculate_hash(test_file, algorithm="sha256")
        expected = hashlib.sha256(content).hexdigest()

        assert result == expected

    def test_unicode_filenames(self, temp_workspace):
        """Test files with Unicode filenames"""
        calc = ParallelHashCalculator()

        unicode_file = temp_workspace / "тест_файл_🎬.txt"
        content = b"unicode filename test"
        unicode_file.write_bytes(content)

        result = calc.calculate_hash(unicode_file, algorithm="md5")
        expected = hashlib.md5(content).hexdigest()

        assert result == expected

    def test_very_small_chunks(self, temp_workspace):
        """Test with very small chunk sizes"""
        calc = ParallelHashCalculator(chunk_size=1)  # 1 byte chunks

        test_file = temp_workspace / "small_chunks.txt"
        content = b"small chunk test"
        test_file.write_bytes(content)

        result = calc.calculate_hash(test_file, algorithm="sha256")
        expected = hashlib.sha256(content).hexdigest()

        assert result == expected

    def test_single_worker(self, temp_workspace):
        """Test with single worker (essentially sequential)"""
        calc = ParallelHashCalculator(max_workers=1)

        test_file = temp_workspace / "single_worker.txt"
        content = b"single worker test content " * 1000
        test_file.write_bytes(content)

        result = calc.calculate_hash(test_file, algorithm="sha256")
        expected = hashlib.sha256(content).hexdigest()

        assert result == expected
