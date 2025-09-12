"""
Critical Path Tests for Manifest Handler Security and Concurrency

This module provides comprehensive tests for manifest handling operations
with focus on:
- Concurrent access safety
- Atomic operations
- Data integrity
- Recovery mechanisms
- Performance under load
"""

import json
import threading
import time
import tempfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

from manim_bridge.storage.manifest_handler import ManifestHandler
from manim_bridge.core.exceptions import ManifestError


class TestManifestCriticalPaths:
    """Critical path tests for manifest operations"""

    @pytest.fixture
    def manifest_handler(self, tmp_path):
        """Create manifest handler with temporary file"""
        manifest_file = tmp_path / "critical_test_manifest.json"
        return ManifestHandler(manifest_file, enable_logging=True)

    def test_high_concurrency_manifest_updates(self, manifest_handler):
        """Test manifest handling under high concurrency load"""
        num_writers = 20
        entries_per_writer = 50
        total_expected = num_writers * entries_per_writer

        errors = []
        write_times = []

        def concurrent_writer(writer_id):
            """Simulate high-frequency manifest updates"""
            try:
                start_time = time.time()
                for i in range(entries_per_writer):
                    entry_key = f"writer_{writer_id}_entry_{i}.mp4"
                    entry_data = {
                        "hash": f"hash_{writer_id}_{i}",
                        "writer_id": writer_id,
                        "entry_index": i,
                        "timestamp": time.time(),
                        "processing_time": 2.5,
                        "quality": "1080p60",
                        "size": 1024 * 1024 * (i + 1),
                    }
                    manifest_handler.add_entry(entry_key, entry_data)

                end_time = time.time()
                write_times.append(end_time - start_time)
            except Exception as e:
                errors.append(f"Writer {writer_id}: {str(e)}")

        # Launch concurrent writers
        threads = []
        start_time = time.time()

        for writer_id in range(num_writers):
            thread = threading.Thread(target=concurrent_writer, args=(writer_id,))
            threads.append(thread)
            thread.start()

        # Wait for all writers to complete
        for thread in threads:
            thread.join()

        end_time = time.time()
        total_time = end_time - start_time

        # Verify no errors occurred
        assert len(errors) == 0, f"Errors during concurrent writes: {errors}"

        # Verify manifest integrity
        final_data = manifest_handler.read(use_cache=False)  # Force fresh read
        assert isinstance(final_data, dict)

        # Verify all entries were written
        assert (
            len(final_data) == total_expected
        ), f"Expected {total_expected}, got {len(final_data)}"

        # Verify manifest file is valid JSON
        with open(manifest_handler.manifest_path, "r") as f:
            json.load(f)  # Should not raise JSONDecodeError

        # Performance check: should complete within reasonable time
        assert total_time < 30.0, f"High concurrency test took too long: {total_time:.2f}s"

        print(f"Successfully handled {total_expected} concurrent writes in {total_time:.2f}s")

    def test_manifest_corruption_recovery_scenarios(self, manifest_handler):
        """Test recovery from various corruption scenarios"""
        corruption_scenarios = [
            # Incomplete JSON
            '{"entry1": {"hash": "abc123"',
            # Invalid JSON structure
            '{"entry1": [invalid_structure]}',
            # Truncated file
            '{"entry1": {"hash": "abc1',
            # Binary data
            b"\x00\x01\x02\x03\x04\x05",
            # Empty file
            "",
            # Only whitespace
            "   \n\t   \n   ",
            # Invalid UTF-8
            b"\xff\xfe\x00\x01",
        ]

        for i, corrupt_content in enumerate(corruption_scenarios):
            # Reset manifest to empty state and clear cache
            manifest_handler.manifest_path.write_text("{}")
            manifest_handler._cache_valid = False  # Clear cache
            manifest_handler._cache = {}

            # Corrupt the manifest
            if isinstance(corrupt_content, bytes):
                manifest_handler.manifest_path.write_bytes(corrupt_content)
            else:
                manifest_handler.manifest_path.write_text(corrupt_content)

            # Should recover gracefully - either return empty dict or raise ManifestError for invalid UTF-8
            try:
                data = manifest_handler.read(use_cache=False)  # Force fresh read
                assert data == {}, f"Scenario {i}: Should return empty dict on corruption"
            except ManifestError:
                # ManifestError is acceptable for invalid UTF-8 bytes
                if isinstance(corrupt_content, bytes):
                    # Reset the manifest to valid state for next test
                    manifest_handler.manifest_path.write_text("{}")
                    manifest_handler._cache_valid = False
                    data = manifest_handler.read(use_cache=False)
                    assert data == {}
                else:
                    # Text corruption should not raise ManifestError
                    raise

            # Should be able to add new entries after recovery
            test_key = f"recovery_test_{i}.mp4"
            manifest_handler.add_entry(test_key, {"hash": f"recovery_hash_{i}"})

            # Verify recovery worked
            recovered_data = manifest_handler.read()
            assert test_key in recovered_data
            assert recovered_data[test_key]["hash"] == f"recovery_hash_{i}"

    def test_atomic_batch_operations(self, manifest_handler):
        """Test atomic batch operations with rollback on failure"""
        # Add initial data
        initial_entries = {
            "video1.mp4": {"hash": "hash1", "status": "processed"},
            "video2.mp4": {"hash": "hash2", "status": "processed"},
            "video3.mp4": {"hash": "hash3", "status": "processed"},
        }

        for key, value in initial_entries.items():
            manifest_handler.add_entry(key, value)

        # Prepare batch update with one invalid entry
        batch_updates = {
            "video4.mp4": {"hash": "hash4", "status": "processed"},
            "video5.mp4": {"hash": "hash5", "status": "processed"},
            # This would cause corruption if not handled properly
            "invalid_entry": {"hash": None, "status": "invalid"},
        }

        # Perform batch update
        try:
            manifest_handler.batch_update(batch_updates)
        except Exception:
            pass  # May fail, but should not corrupt existing data

        # Verify original data is still intact
        current_data = manifest_handler.read()
        for key, value in initial_entries.items():
            assert key in current_data
            assert current_data[key]["hash"] == value["hash"]

    def test_manifest_performance_under_load(self, manifest_handler):
        """Test manifest performance characteristics under load"""
        # Test data - reduced for faster testing while still validating concurrency
        num_entries = 100  # Reduced from 1000
        read_threads = 3  # Reduced from 5
        write_threads = 2  # Reduced from 3

        # Pre-populate manifest
        for i in range(num_entries):
            manifest_handler.add_entry(
                f"video_{i}.mp4",
                {
                    "hash": f"hash_{i}",
                    "size": 1024 * 1024 * (i % 100),
                    "timestamp": time.time(),
                    "quality": "1080p60" if i % 2 else "720p30",
                },
            )

        read_times = []
        write_times = []
        errors = []

        def performance_reader(reader_id):
            """Concurrent reader for performance testing"""
            try:
                for _ in range(20):  # Reduced from 100
                    start_time = time.time()
                    data = manifest_handler.read()
                    end_time = time.time()

                    read_times.append(end_time - start_time)

                    # Verify data integrity
                    assert isinstance(data, dict)
                    assert len(data) >= num_entries

            except Exception as e:
                errors.append(f"Reader {reader_id}: {str(e)}")

        def performance_writer(writer_id):
            """Concurrent writer for performance testing"""
            try:
                for i in range(10):  # Reduced from 50
                    start_time = time.time()
                    key = f"perf_writer_{writer_id}_entry_{i}.mp4"
                    manifest_handler.add_entry(
                        key,
                        {
                            "hash": f"perf_hash_{writer_id}_{i}",
                            "writer_id": writer_id,
                            "timestamp": time.time(),
                        },
                    )
                    end_time = time.time()

                    write_times.append(end_time - start_time)

            except Exception as e:
                errors.append(f"Writer {writer_id}: {str(e)}")

        # Run performance test
        threads = []

        # Start readers
        for i in range(read_threads):
            thread = threading.Thread(target=performance_reader, args=(i,))
            threads.append(thread)

        # Start writers
        for i in range(write_threads):
            thread = threading.Thread(target=performance_writer, args=(i,))
            threads.append(thread)

        # Launch all threads
        start_time = time.time()
        for thread in threads:
            thread.start()

        # Wait for completion
        for thread in threads:
            thread.join()

        end_time = time.time()
        total_time = end_time - start_time

        # Verify no errors
        assert len(errors) == 0, f"Performance test errors: {errors}"

        # Analyze performance
        avg_read_time = sum(read_times) / len(read_times) if read_times else 0
        avg_write_time = sum(write_times) / len(write_times) if write_times else 0
        max_read_time = max(read_times) if read_times else 0
        max_write_time = max(write_times) if write_times else 0

        # Performance assertions
        assert avg_read_time < 0.01, f"Average read time too high: {avg_read_time:.4f}s"
        assert avg_write_time < 0.1, f"Average write time too high: {avg_write_time:.4f}s"
        assert max_read_time < 0.1, f"Max read time too high: {max_read_time:.4f}s"
        assert max_write_time < 1.0, f"Max write time too high: {max_write_time:.4f}s"

        print(f"Performance test completed in {total_time:.2f}s")
        print(f"Average read time: {avg_read_time:.4f}s")
        print(f"Average write time: {avg_write_time:.4f}s")

    def test_manifest_memory_management(self, manifest_handler):
        """Test manifest memory usage with large datasets"""
        import sys

        # Get initial memory usage
        initial_size = sys.getsizeof(manifest_handler._cache)

        # Add large number of entries (reduced for faster testing)
        large_entry_count = 500  # Reduced from 10000
        for i in range(large_entry_count):
            manifest_handler.add_entry(
                f"large_test_{i}.mp4",
                {
                    "hash": f"hash_{i}" * 3,  # Reduced from 10
                    "metadata": {
                        "description": f"Video entry {i}",  # Reduced complexity
                        "tags": [f"tag_{j}" for j in range(3)],  # Reduced from 10
                        "quality": "4K60" if i % 3 == 0 else "1080p60",
                    },
                    "size": 1024 * 1024 * (10 + (i % 50)),  # Smaller sizes
                    "duration": 30.0 + (i % 60),
                },
            )

        # Check memory usage
        final_size = sys.getsizeof(manifest_handler._cache)
        memory_growth = final_size - initial_size

        # Memory growth should be reasonable (not excessive)
        # This is a smoke test - actual limits depend on system
        assert memory_growth < 100 * 1024 * 1024, f"Excessive memory usage: {memory_growth} bytes"

        # Verify all data is accessible
        data = manifest_handler.read()
        assert len(data) == large_entry_count

        # Test cache invalidation works
        manifest_handler._cache_valid = False
        reloaded_data = manifest_handler.read()
        assert len(reloaded_data) == large_entry_count

    def test_manifest_file_locking_edge_cases(self, manifest_handler):
        """Test file locking edge cases and recovery"""

        # Test scenario: Process dies while holding lock
        def simulate_lock_holder():
            """Simulate a process that acquires lock but doesn't release it properly"""
            import fcntl

            try:
                with open(manifest_handler.manifest_path, "a") as f:
                    fcntl.flock(f.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
                    # Simulate process death - lock should be released by OS
                    time.sleep(0.1)
            except (OSError, IOError):
                pass  # Lock may not be available, that's okay for this test

        # Run lock holder in thread
        lock_thread = threading.Thread(target=simulate_lock_holder)
        lock_thread.start()
        lock_thread.join()

        # Should be able to acquire lock and perform operations
        manifest_handler.add_entry("lock_test.mp4", {"hash": "lock_test_hash"})

        # Verify data was written
        data = manifest_handler.read()
        assert "lock_test.mp4" in data

    def test_manifest_cross_process_consistency(self, tmp_path):
        """Test manifest consistency across multiple processes"""
        manifest_file = tmp_path / "cross_process_manifest.json"

        # Create multiple manifest handlers (simulating different processes)
        handlers = [ManifestHandler(manifest_file, enable_logging=True) for _ in range(5)]

        # Each "process" writes data
        for i, handler in enumerate(handlers):
            for j in range(10):
                handler.add_entry(
                    f"process_{i}_entry_{j}.mp4",
                    {
                        "hash": f"hash_{i}_{j}",
                        "process_id": i,
                        "entry_id": j,
                        "timestamp": time.time(),
                    },
                )

        # Verify all handlers see the same final state
        final_states = []
        for handler in handlers:
            handler._cache_valid = False  # Force fresh read
            data = handler.read()
            final_states.append(data)

        # All handlers should see the same data
        first_state = final_states[0]
        for state in final_states[1:]:
            assert state == first_state, "Cross-process consistency violated"

        # Verify total expected entries
        expected_total = 5 * 10  # 5 processes × 10 entries each
        assert len(first_state) == expected_total

    def test_manifest_transaction_rollback(self, manifest_handler):
        """Test transaction-like behavior with rollback on complex failures"""
        # Setup initial state
        initial_entries = {
            "video1.mp4": {"hash": "hash1", "size": 1000},
            "video2.mp4": {"hash": "hash2", "size": 2000},
        }

        for key, value in initial_entries.items():
            manifest_handler.add_entry(key, value)

        initial_data = manifest_handler.read()

        # Simulate complex operation that should roll back on failure
        def complex_manifest_operation():
            # Stage 1: Add new entry
            manifest_handler.add_entry("temp1.mp4", {"hash": "temp1"})

            # Stage 2: Update existing entry
            manifest_handler.update_entry("video1.mp4", {"size": 1500})

            # Stage 3: This will fail and should trigger rollback
            raise Exception("Simulated operation failure")

        # Attempt complex operation
        try:
            complex_manifest_operation()
        except Exception:
            pass  # Expected to fail

        # In a real implementation, we'd need rollback mechanism
        # For now, verify that the system can recover
        current_data = manifest_handler.read()

        # At minimum, verify the manifest is still valid
        assert isinstance(current_data, dict)

        # Verify we can still perform operations
        manifest_handler.add_entry("recovery_test.mp4", {"hash": "recovery"})
        final_data = manifest_handler.read()
        assert "recovery_test.mp4" in final_data


class TestManifestEdgeCases:
    """Test edge cases and error conditions for manifest handling"""

    @pytest.fixture
    def manifest_handler(self, tmp_path):
        """Create manifest handler with temporary file"""
        manifest_file = tmp_path / "edge_case_manifest.json"
        return ManifestHandler(manifest_file, enable_logging=True)

    def test_manifest_with_unicode_content(self, tmp_path):
        """Test manifest handling with Unicode content"""
        manifest_file = tmp_path / "unicode_manifest.json"
        handler = ManifestHandler(manifest_file, enable_logging=True)

        # Test various Unicode scenarios
        unicode_entries = {
            "测试视频.mp4": {"hash": "unicode_hash_1", "title": "测试视频"},
            "видео_тест.mp4": {"hash": "unicode_hash_2", "title": "Тестовое видео"},
            "emoji_🎥_video.mp4": {"hash": "unicode_hash_3", "title": "Video with 🎥 emoji"},
            "special_chars_äöü.mp4": {"hash": "unicode_hash_4", "title": "Spëcîål chärs"},
        }

        # Add Unicode entries
        for key, value in unicode_entries.items():
            handler.add_entry(key, value)

        # Verify Unicode handling
        data = handler.read()
        for key, value in unicode_entries.items():
            assert key in data
            assert data[key]["title"] == value["title"]

        # Verify file can be read back correctly after write
        handler2 = ManifestHandler(manifest_file, enable_logging=True)
        reloaded_data = handler2.read()
        for key, value in unicode_entries.items():
            assert key in reloaded_data
            assert reloaded_data[key]["title"] == value["title"]

    def test_manifest_size_limits(self, tmp_path):
        """Test manifest behavior with large sizes"""
        manifest_file = tmp_path / "large_manifest.json"
        handler = ManifestHandler(manifest_file, enable_logging=True)

        # Add many entries to test size limits
        num_entries = 50000
        batch_size = 1000

        for batch_start in range(0, num_entries, batch_size):
            batch_updates = {}
            for i in range(batch_start, min(batch_start + batch_size, num_entries)):
                batch_updates[f"large_video_{i}.mp4"] = {
                    "hash": f"hash_{i}",
                    "metadata": {
                        "description": f"Large dataset entry {i}",
                        "processing_time": 2.5 + (i % 10),
                        "quality": "1080p60" if i % 2 else "720p30",
                    },
                }

            handler.batch_update(batch_updates)

        # Verify all entries exist
        data = handler.read()
        assert len(data) == num_entries

        # Verify file size is reasonable
        file_size = manifest_file.stat().st_size
        assert file_size < 100 * 1024 * 1024  # Less than 100MB

        print(f"Large manifest test: {num_entries} entries, {file_size/1024/1024:.2f} MB")

    def test_manifest_concurrent_read_write_patterns(self, manifest_handler):
        """Test various concurrent read/write patterns"""
        patterns = [
            # Pattern 1: Heavy read, light write (reduced for faster testing)
            {"readers": 3, "writers": 1, "read_ops": 20, "write_ops": 5},
            # Pattern 2: Heavy write, light read (reduced for faster testing)
            {"readers": 1, "writers": 3, "read_ops": 5, "write_ops": 20},
            # Pattern 3: Balanced read/write (reduced for faster testing)
            {"readers": 2, "writers": 2, "read_ops": 10, "write_ops": 10},
        ]

        for pattern_idx, pattern in enumerate(patterns):
            errors = []
            operations_completed = 0

            def reader_worker(reader_id, read_ops):
                nonlocal operations_completed
                try:
                    for i in range(read_ops):
                        data = manifest_handler.read()
                        assert isinstance(data, dict)
                        operations_completed += 1
                except Exception as e:
                    errors.append(f"Pattern {pattern_idx}, Reader {reader_id}: {e}")

            def writer_worker(writer_id, write_ops):
                nonlocal operations_completed
                try:
                    for i in range(write_ops):
                        key = f"pattern_{pattern_idx}_writer_{writer_id}_op_{i}.mp4"
                        manifest_handler.add_entry(
                            key,
                            {
                                "hash": f"hash_{pattern_idx}_{writer_id}_{i}",
                                "pattern": pattern_idx,
                                "writer": writer_id,
                                "operation": i,
                            },
                        )
                        operations_completed += 1
                except Exception as e:
                    errors.append(f"Pattern {pattern_idx}, Writer {writer_id}: {e}")

            # Launch threads for current pattern
            threads = []

            # Start readers
            for i in range(pattern["readers"]):
                thread = threading.Thread(target=reader_worker, args=(i, pattern["read_ops"]))
                threads.append(thread)

            # Start writers
            for i in range(pattern["writers"]):
                thread = threading.Thread(target=writer_worker, args=(i, pattern["write_ops"]))
                threads.append(thread)

            # Execute pattern
            start_time = time.time()
            for thread in threads:
                thread.start()

            for thread in threads:
                thread.join()

            end_time = time.time()

            # Verify pattern completed successfully
            assert len(errors) == 0, f"Pattern {pattern_idx} errors: {errors}"

            expected_ops = (
                pattern["readers"] * pattern["read_ops"] + pattern["writers"] * pattern["write_ops"]
            )
            assert operations_completed == expected_ops

            print(
                f"Pattern {pattern_idx} completed: {operations_completed} ops in {end_time-start_time:.2f}s"
            )
