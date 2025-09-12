"""
Tests for OptimizedManifestHandler with Multi-Tier Caching

Comprehensive test suite covering:
- Multi-tier caching functionality (L1, L2, L3)
- Async I/O operations with optimized buffers
- Write-behind caching performance
- Cache invalidation and consistency
- Performance benchmarks and validation
"""

import json
import threading
import time
import tempfile
import shutil
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from unittest.mock import patch, MagicMock
import os

import pytest

from manim_bridge.storage.optimized_manifest_handler import (
    OptimizedManifestHandler,
    LRUCache,
    MemoryMappedCache,
    CompressedDiskCache,
    WriteBehindCache
)
from manim_bridge.core.exceptions import ManifestError


class TestLRUCache:
    """Test LRU cache implementation"""

    def test_basic_operations(self):
        """Test basic LRU cache operations"""
        cache = LRUCache(max_size=3)

        # Test put and get
        cache.put("key1", {"data": "value1"})
        cache.put("key2", {"data": "value2"})
        cache.put("key3", {"data": "value3"})

        assert cache.get("key1") == {"data": "value1"}
        assert cache.get("key2") == {"data": "value2"}
        assert cache.get("key3") == {"data": "value3"}

        # Test LRU eviction
        cache.put("key4", {"data": "value4"})  # Should evict key1
        assert cache.get("key1") is None
        assert cache.get("key4") == {"data": "value4"}

    def test_lru_ordering(self):
        """Test LRU ordering with access patterns"""
        cache = LRUCache(max_size=2)

        cache.put("key1", "value1")
        cache.put("key2", "value2")

        # Access key1 to make it most recent
        cache.get("key1")

        # Add key3 - should evict key2 (least recent)
        cache.put("key3", "value3")

        assert cache.get("key1") == "value1"
        assert cache.get("key2") is None
        assert cache.get("key3") == "value3"

    def test_cache_stats(self):
        """Test cache statistics"""
        cache = LRUCache(max_size=2)

        # Initial stats
        stats = cache.get_stats()
        assert stats["hits"] == 0
        assert stats["misses"] == 0
        assert stats["hit_rate"] == 0

        # Add items and track stats
        cache.put("key1", "value1")
        cache.get("key1")  # Hit
        cache.get("key2")  # Miss

        stats = cache.get_stats()
        assert stats["hits"] == 1
        assert stats["misses"] == 1
        assert stats["hit_rate"] == 50.0

    def test_thread_safety(self):
        """Test LRU cache thread safety"""
        cache = LRUCache(max_size=100)
        errors = []

        def worker(thread_id):
            try:
                for i in range(50):
                    key = f"thread_{thread_id}_key_{i}"
                    cache.put(key, f"value_{i}")
                    retrieved = cache.get(key)
                    if retrieved != f"value_{i}":
                        errors.append(f"Data corruption in thread {thread_id}")
            except Exception as e:
                errors.append(f"Thread {thread_id} error: {e}")

        threads = []
        for i in range(10):
            thread = threading.Thread(target=worker, args=(i,))
            threads.append(thread)
            thread.start()

        for thread in threads:
            thread.join()

        assert len(errors) == 0, f"Thread safety errors: {errors}"


class TestMemoryMappedCache:
    """Test memory-mapped cache implementation"""

    @pytest.fixture
    def temp_cache_dir(self):
        """Create temporary cache directory"""
        temp_dir = Path(tempfile.mkdtemp())
        yield temp_dir
        shutil.rmtree(temp_dir, ignore_errors=True)

    def test_basic_operations(self, temp_cache_dir):
        """Test basic memory-mapped cache operations"""
        cache = MemoryMappedCache(cache_dir=temp_cache_dir, max_files=5)

        # Test put and get
        test_data = b'{"test": "data", "number": 42}'
        cache.put("test_key", test_data)

        retrieved = cache.get("test_key")
        assert retrieved == test_data

    def test_file_eviction(self, temp_cache_dir):
        """Test file eviction when max_files is exceeded"""
        cache = MemoryMappedCache(cache_dir=temp_cache_dir, max_files=2)

        # Add files up to limit
        cache.put("key1", b"data1")
        cache.put("key2", b"data2")

        # Both should be accessible
        assert cache.get("key1") == b"data1"
        assert cache.get("key2") == b"data2"

        # Add third file - should trigger eviction
        time.sleep(0.01)  # Small delay to ensure different timestamps
        cache.put("key3", b"data3")

        # One of the earlier entries should be evicted
        available_keys = sum([
            cache.get("key1") is not None,
            cache.get("key2") is not None,
            cache.get("key3") is not None
        ])
        assert available_keys == 2
        assert cache.get("key3") == b"data3"  # Latest should always be available

    def test_corruption_recovery(self, temp_cache_dir):
        """Test recovery from corrupted cache files"""
        cache = MemoryMappedCache(cache_dir=temp_cache_dir, max_files=5)

        # Create a valid entry
        cache.put("valid_key", b"valid_data")

        # Corrupt the cache file directly
        cache_files = list(temp_cache_dir.glob("mmap_*.cache"))
        if cache_files:
            cache_files[0].write_bytes(b"corrupted_data")

        # Should return None for corrupted data and clean up
        result = cache.get("valid_key")
        assert result is None

    def test_large_data_handling(self, temp_cache_dir):
        """Test handling of large data chunks"""
        cache = MemoryMappedCache(cache_dir=temp_cache_dir, max_files=5)

        # Create large test data (1MB)
        large_data = b"x" * (1024 * 1024)
        cache.put("large_key", large_data)

        retrieved = cache.get("large_key")
        assert len(retrieved) == len(large_data)
        assert retrieved == large_data


class TestCompressedDiskCache:
    """Test compressed disk cache implementation"""

    @pytest.fixture
    def temp_cache_dir(self):
        """Create temporary cache directory"""
        temp_dir = Path(tempfile.mkdtemp())
        yield temp_dir
        shutil.rmtree(temp_dir, ignore_errors=True)

    def test_compression_storage(self, temp_cache_dir):
        """Test data compression and storage"""
        cache = CompressedDiskCache(cache_dir=temp_cache_dir, max_size_mb=10)

        # Test data that should compress well
        test_data = b'{"repeated": "data"} ' * 1000
        cache.put("compress_key", test_data)

        retrieved = cache.get("compress_key")
        assert retrieved == test_data

        # Check that compression actually happened
        cache_files = list(temp_cache_dir.glob("compressed_*.gz"))
        assert len(cache_files) == 1

        compressed_size = cache_files[0].stat().st_size
        assert compressed_size < len(test_data)  # Should be compressed

    def test_size_limit_eviction(self, temp_cache_dir):
        """Test eviction based on size limits"""
        # Set very small cache size
        cache = CompressedDiskCache(cache_dir=temp_cache_dir, max_size_mb=1)

        # Add data that exceeds the size limit
        large_data = b"x" * (512 * 1024)  # 512KB each

        cache.put("file1", large_data)
        cache.put("file2", large_data)
        time.sleep(0.01)  # Ensure different timestamps
        cache.put("file3", large_data)  # Should trigger eviction

        # Check that oldest files were evicted
        stats = cache.get_stats()
        assert stats["total_size_bytes"] <= 1024 * 1024  # Within 1MB limit

    def test_corruption_handling(self, temp_cache_dir):
        """Test handling of corrupted compressed files"""
        cache = CompressedDiskCache(cache_dir=temp_cache_dir, max_size_mb=10)

        # Create valid entry
        cache.put("valid_key", b"valid_data")

        # Corrupt the compressed file
        cache_files = list(temp_cache_dir.glob("compressed_*.gz"))
        if cache_files:
            cache_files[0].write_bytes(b"not_gzip_data")

        # Should handle corruption gracefully
        result = cache.get("valid_key")
        assert result is None


class TestWriteBehindCache:
    """Test write-behind caching implementation"""

    def test_write_scheduling(self):
        """Test write scheduling and deferred execution"""
        executed_writes = {}

        def mock_write_callback(key, data):
            executed_writes[key] = data.copy()

        cache = WriteBehindCache(flush_interval=0.1, max_pending=10)
        cache.start(mock_write_callback)

        try:
            # Schedule writes
            cache.schedule_write("key1", {"data": "value1"})
            cache.schedule_write("key2", {"data": "value2"})

            # Should not be executed immediately
            assert len(executed_writes) == 0

            # Wait for flush interval
            time.sleep(0.2)

            # Should be executed by now
            assert "key1" in executed_writes
            assert "key2" in executed_writes
            assert executed_writes["key1"] == {"data": "value1"}

        finally:
            cache.stop()

    def test_immediate_flush(self):
        """Test immediate flush functionality"""
        executed_writes = {}

        def mock_write_callback(key, data):
            executed_writes[key] = data.copy()

        cache = WriteBehindCache(flush_interval=10.0, max_pending=10)  # Long interval
        cache.start(mock_write_callback)

        try:
            cache.schedule_write("immediate_key", {"data": "immediate_value"})

            # Flush immediately
            cache.flush_key("immediate_key")

            # Should be executed immediately
            assert "immediate_key" in executed_writes
            assert executed_writes["immediate_key"] == {"data": "immediate_value"}

        finally:
            cache.stop()

    def test_max_pending_limit(self):
        """Test maximum pending writes limit"""
        executed_writes = {}

        def mock_write_callback(key, data):
            executed_writes[key] = data.copy()

        cache = WriteBehindCache(flush_interval=10.0, max_pending=2)
        cache.start(mock_write_callback)

        try:
            # Schedule more writes than max_pending
            cache.schedule_write("key1", {"data": "value1"})
            cache.schedule_write("key2", {"data": "value2"})
            cache.schedule_write("key3", {"data": "value3"})  # Should trigger flush

            # Give some time for flush to happen
            time.sleep(0.1)

            # Some writes should have been executed due to max_pending limit
            assert len(executed_writes) > 0

        finally:
            cache.stop()


class TestOptimizedManifestHandler:
    """Test the complete optimized manifest handler"""

    @pytest.fixture
    def temp_manifest_path(self):
        """Create temporary manifest file path"""
        temp_dir = Path(tempfile.mkdtemp())
        manifest_path = temp_dir / "test_manifest.json"
        yield manifest_path
        shutil.rmtree(temp_dir, ignore_errors=True)

    @pytest.fixture
    def optimized_handler(self, temp_manifest_path):
        """Create optimized manifest handler"""
        handler = OptimizedManifestHandler(
            manifest_path=temp_manifest_path,
            enable_logging=True,
            l1_cache_size=100,
            l2_cache_files=50,
            l3_cache_size_mb=10,
            buffer_size=64 * 1024,  # 64KB for testing
            write_behind=True,
            write_behind_interval=0.1
        )
        yield handler
        # Cleanup
        handler.flush_write_behind()
        handler._cleanup_resources()

    def test_basic_functionality(self, optimized_handler):
        """Test basic read/write operations"""
        # Test write and read
        test_data = {
            "video1.mp4": {"hash": "hash1", "size": 1000},
            "video2.mp4": {"hash": "hash2", "size": 2000}
        }

        optimized_handler.write(test_data)
        time.sleep(0.2)  # Allow write-behind to complete

        read_data = optimized_handler.read()
        assert read_data == test_data

    def test_multi_tier_caching(self, optimized_handler):
        """Test multi-tier cache functionality"""
        # Add initial data
        optimized_handler.add_entry("test.mp4", {"hash": "test_hash", "size": 1000})
        time.sleep(0.2)  # Allow write-behind to complete

        # Clear L1 cache to test L2/L3 fallback
        optimized_handler.l1_cache.clear()

        # Should still be readable from L2/L3 cache
        data = optimized_handler.read()
        assert "test.mp4" in data
        assert data["test.mp4"]["hash"] == "test_hash"

        # Check cache statistics
        stats = optimized_handler.get_performance_stats()
        cache_stats = stats["cache_performance"]

        # Should have some cache hits/misses
        total_requests = (cache_stats["l1_hits"] + cache_stats["l1_misses"] +
                         cache_stats["l2_hits"] + cache_stats["l2_misses"] +
                         cache_stats["l3_hits"] + cache_stats["l3_misses"])
        assert total_requests > 0

    def test_cache_consistency(self, optimized_handler):
        """Test cache consistency across operations"""
        # Add entry
        optimized_handler.add_entry("consistency_test.mp4", {"hash": "original"})
        time.sleep(0.2)

        # Read from cache
        data1 = optimized_handler.read()
        assert data1["consistency_test.mp4"]["hash"] == "original"

        # Update entry (should invalidate caches)
        optimized_handler.update_entry("consistency_test.mp4", {"hash": "updated"})
        time.sleep(0.2)

        # Read again - should see updated data
        data2 = optimized_handler.read()
        assert data2["consistency_test.mp4"]["hash"] == "updated"

    def test_batch_operations_performance(self, optimized_handler):
        """Test batch operations performance"""
        # Prepare batch data
        batch_size = 100
        batch_updates = {}
        for i in range(batch_size):
            batch_updates[f"batch_video_{i}.mp4"] = {
                "hash": f"hash_{i}",
                "size": 1000 + i,
                "quality": "1080p60"
            }

        # Measure batch update performance
        start_time = time.time()
        optimized_handler.batch_update(batch_updates)
        batch_time = time.time() - start_time

        # Flush write-behind operations
        optimized_handler.flush_write_behind()
        time.sleep(0.1)

        # Verify all entries
        data = optimized_handler.read()
        assert len(data) == batch_size
        for i in range(batch_size):
            key = f"batch_video_{i}.mp4"
            assert key in data
            assert data[key]["hash"] == f"hash_{i}"

        # Batch operation should be fast
        assert batch_time < 1.0, f"Batch update too slow: {batch_time:.3f}s"

    def test_concurrent_access(self, optimized_handler):
        """Test concurrent access with optimized handler"""
        num_threads = 10
        operations_per_thread = 20
        errors = []

        def worker(thread_id):
            try:
                for i in range(operations_per_thread):
                    key = f"thread_{thread_id}_entry_{i}.mp4"
                    data = {
                        "hash": f"hash_{thread_id}_{i}",
                        "thread_id": thread_id,
                        "entry_id": i,
                        "timestamp": time.time()
                    }

                    # Mix of operations
                    if i % 3 == 0:
                        optimized_handler.add_entry(key, data)
                    elif i % 3 == 1:
                        optimized_handler.read()
                    else:
                        optimized_handler.update_entry(key, {"last_updated": time.time()})

            except Exception as e:
                errors.append(f"Thread {thread_id}: {str(e)}")

        # Launch concurrent workers
        threads = []
        start_time = time.time()

        for i in range(num_threads):
            thread = threading.Thread(target=worker, args=(i,))
            threads.append(thread)
            thread.start()

        # Wait for completion
        for thread in threads:
            thread.join()

        end_time = time.time()
        total_time = end_time - start_time

        # Flush any pending operations
        optimized_handler.flush_write_behind()
        time.sleep(0.2)

        # Verify no errors
        assert len(errors) == 0, f"Concurrent access errors: {errors}"

        # Verify performance
        assert total_time < 10.0, f"Concurrent test took too long: {total_time:.2f}s"

        print(f"Concurrent test: {num_threads} threads, {total_time:.2f}s")

    def test_performance_benchmarks(self, optimized_handler):
        """Test performance benchmarks and validate improvements"""
        # Prepare test data
        num_entries = 500
        test_data = {}
        for i in range(num_entries):
            test_data[f"benchmark_{i}.mp4"] = {
                "hash": f"hash_{i}",
                "size": 1024 * 1024 * (i % 100),
                "quality": "1080p60" if i % 2 else "720p30",
                "metadata": {
                    "description": f"Benchmark video {i}",
                    "tags": [f"tag_{j}" for j in range(3)]
                }
            }

        # Benchmark write operations
        write_start = time.time()
        optimized_handler.write(test_data)
        optimized_handler.flush_write_behind()  # Ensure write completion
        write_end = time.time()
        write_time = write_end - write_start

        # Benchmark read operations (multiple reads to test caching)
        read_times = []
        for _ in range(10):
            read_start = time.time()
            data = optimized_handler.read()
            read_end = time.time()
            read_times.append(read_end - read_start)

            # Verify data integrity
            assert len(data) == num_entries

        avg_read_time = sum(read_times) / len(read_times)

        # Performance assertions (should be significantly faster than baseline)
        assert write_time < 2.0, f"Write time too high: {write_time:.3f}s"
        assert avg_read_time < 0.001, f"Average read time too high: {avg_read_time:.6f}s"

        # Get performance statistics
        perf_stats = optimized_handler.get_performance_stats()
        cache_hit_rate = (
            perf_stats["cache_performance"]["l1_hits"] /
            max(1, perf_stats["cache_performance"]["l1_hits"] + perf_stats["cache_performance"]["l1_misses"])
            * 100
        )

        print(f"Performance Results:")
        print(f"  Write time: {write_time:.3f}s for {num_entries} entries")
        print(f"  Average read time: {avg_read_time:.6f}s")
        print(f"  L1 cache hit rate: {cache_hit_rate:.1f}%")
        print(f"  Buffer size: {optimized_handler.buffer_size // 1024}KB")

        # Cache should show good performance
        assert cache_hit_rate > 50.0, f"L1 cache hit rate too low: {cache_hit_rate:.1f}%"

    def test_cache_warming(self, optimized_handler):
        """Test cache warming functionality"""
        # Add some initial data
        initial_data = {
            "warm_test1.mp4": {"hash": "warm_hash1"},
            "warm_test2.mp4": {"hash": "warm_hash2"}
        }

        optimized_handler.write(initial_data)
        optimized_handler.flush_write_behind()
        time.sleep(0.1)

        # Clear all caches
        optimized_handler.clear_caches()

        # Warm caches
        optimized_handler.warm_cache()
        time.sleep(0.1)  # Allow async cache population

        # Reading should now be fast (cached)
        start_time = time.time()
        data = optimized_handler.read()
        read_time = time.time() - start_time

        assert data == initial_data
        assert read_time < 0.001, f"Cache warming didn't improve read time: {read_time:.6f}s"

    def test_error_recovery(self, optimized_handler):
        """Test error recovery and resilience"""
        # Add valid data
        optimized_handler.add_entry("valid.mp4", {"hash": "valid_hash"})
        optimized_handler.flush_write_behind()
        time.sleep(0.1)

        # Corrupt the manifest file
        with open(optimized_handler.manifest_path, 'w') as f:
            f.write('{"corrupted": json}')  # Invalid JSON

        # Should recover gracefully
        optimized_handler.clear_caches()  # Force cache miss
        data = optimized_handler.read(use_cache=False)  # Force disk read
        assert data == {}  # Should return empty dict for corrupted file

        # Should be able to write new data
        optimized_handler.add_entry("recovery.mp4", {"hash": "recovery_hash"})
        optimized_handler.flush_write_behind()
        time.sleep(0.1)

        # Verify recovery
        data = optimized_handler.read()
        assert "recovery.mp4" in data

    def test_memory_efficiency(self, optimized_handler):
        """Test memory efficiency with large datasets"""
        import sys

        # Get initial memory usage
        initial_cache_size = sys.getsizeof(optimized_handler.l1_cache.cache)

        # Add large dataset
        large_dataset = {}
        for i in range(1000):  # Reduced for faster testing
            large_dataset[f"memory_test_{i}.mp4"] = {
                "hash": f"hash_{i}",
                "size": 1024 * 1024 * (i % 50),
                "metadata": {
                    "description": f"Memory test entry {i}",
                    "tags": [f"tag_{j}" for j in range(5)]
                }
            }

        optimized_handler.batch_update(large_dataset)
        optimized_handler.flush_write_behind()
        time.sleep(0.2)

        # Check memory usage
        final_cache_size = sys.getsizeof(optimized_handler.l1_cache.cache)
        memory_growth = final_cache_size - initial_cache_size

        # Memory growth should be reasonable
        assert memory_growth < 50 * 1024 * 1024, f"Excessive memory usage: {memory_growth} bytes"

        # Verify data integrity
        data = optimized_handler.read()
        assert len(data) == 1000

        # Test cache eviction works properly
        l1_stats = optimized_handler.l1_cache.get_stats()
        assert l1_stats["size"] <= l1_stats["max_size"], "L1 cache exceeded max size"


class TestPerformanceComparison:
    """Compare performance between original and optimized handlers"""

    @pytest.fixture
    def temp_paths(self):
        """Create temporary paths for both handlers"""
        temp_dir = Path(tempfile.mkdtemp())
        original_path = temp_dir / "original_manifest.json"
        optimized_path = temp_dir / "optimized_manifest.json"

        yield original_path, optimized_path

        shutil.rmtree(temp_dir, ignore_errors=True)

    def test_performance_comparison(self, temp_paths):
        """Compare performance between original and optimized handlers"""
        from manim_bridge.storage.manifest_handler import ManifestHandler

        original_path, optimized_path = temp_paths

        # Create handlers
        original_handler = ManifestHandler(original_path, enable_logging=False)
        optimized_handler = OptimizedManifestHandler(
            optimized_path,
            enable_logging=False,
            write_behind=False  # Disable for fair comparison
        )

        try:
            # Test data
            test_data = {}
            num_entries = 200  # Reduced for faster testing
            for i in range(num_entries):
                test_data[f"perf_test_{i}.mp4"] = {
                    "hash": f"hash_{i}",
                    "size": 1024 * 1024 * (i % 20),
                    "quality": "1080p60" if i % 2 else "720p30"
                }

            # Benchmark original handler
            original_write_start = time.time()
            original_handler.write(test_data)
            original_write_time = time.time() - original_write_start

            # Multiple reads to average
            original_read_times = []
            for _ in range(10):
                read_start = time.time()
                original_handler.read()
                original_read_times.append(time.time() - read_start)

            original_avg_read = sum(original_read_times) / len(original_read_times)

            # Benchmark optimized handler
            optimized_write_start = time.time()
            optimized_handler.write(test_data)
            optimized_write_time = time.time() - optimized_write_start

            # Multiple reads (should benefit from caching)
            optimized_read_times = []
            for _ in range(10):
                read_start = time.time()
                optimized_handler.read()
                optimized_read_times.append(time.time() - read_start)

            optimized_avg_read = sum(optimized_read_times) / len(optimized_read_times)

            # Calculate performance improvements
            write_improvement = (original_write_time - optimized_write_time) / original_write_time * 100
            read_improvement = (original_avg_read - optimized_avg_read) / original_avg_read * 100

            print(f"Performance Comparison Results:")
            print(f"  Original write time: {original_write_time:.4f}s")
            print(f"  Optimized write time: {optimized_write_time:.4f}s")
            print(f"  Write improvement: {write_improvement:.1f}%")
            print(f"  Original read time: {original_avg_read:.6f}s")
            print(f"  Optimized read time: {optimized_avg_read:.6f}s")
            print(f"  Read improvement: {read_improvement:.1f}%")

            # Validate target improvements
            # Note: Without write-behind, write improvements may be minimal
            # but read improvements should be significant due to caching
            assert read_improvement > 30.0, f"Read improvement insufficient: {read_improvement:.1f}%"

            # Overall improvement should meet the 50% target when combining read/write
            overall_improvement = (read_improvement + max(0, write_improvement)) / 2
            print(f"  Overall improvement: {overall_improvement:.1f}%")

        finally:
            optimized_handler._cleanup_resources()


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
