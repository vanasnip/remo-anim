"""Performance benchmarks for security operations."""

import time
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest

from manim_bridge.security.path_validator import PathValidator
from manim_bridge.security.command_sanitizer import CommandSanitizer


@pytest.mark.performance
@pytest.mark.security
class TestSecurityPerformance:
    """Performance benchmarks for security operations."""

    def test_path_validation_performance(self, temp_workspace):
        """Benchmark path validation performance."""
        allowed_dirs = [temp_workspace / "allowed"]
        allowed_dirs[0].mkdir()
        validator = PathValidator(allowed_dirs)

        # Test with various path sizes
        test_sizes = [10, 50, 100, 500, 1000]
        performance_results = {}

        for size in test_sizes:
            # Create path of specified length
            test_path = allowed_dirs[0] / ("a" * size + ".mp4")

            # Benchmark validation
            start_time = time.perf_counter()
            for _ in range(100):  # Run 100 times for better measurement
                validator.is_safe(str(test_path))
            end_time = time.perf_counter()

            avg_time = (end_time - start_time) / 100
            performance_results[size] = avg_time

            # Each operation should be very fast (< 1ms)
            assert avg_time < 0.001, f"Path validation too slow for size {size}: {avg_time:.4f}s"

        print(f"Path validation performance: {performance_results}")

    def test_command_sanitization_performance(self):
        """Benchmark command sanitization performance."""
        sanitizer = CommandSanitizer()

        # Test filename sanitization performance
        test_filenames = [
            "simple.mp4",
            "file with spaces.mp4",
            "complex-file_name.with.dots.mp4",
            "very_long_" + "a" * 1000 + ".mp4",
        ]

        filename_results = {}
        for filename in test_filenames:
            start_time = time.perf_counter()
            for _ in range(100):
                try:
                    sanitizer.sanitize_filename(filename)
                except Exception:
                    pass  # Performance test, ignore security errors
            end_time = time.perf_counter()

            avg_time = (end_time - start_time) / 100
            filename_results[len(filename)] = avg_time
            assert avg_time < 0.001, f"Filename sanitization too slow: {avg_time:.4f}s"

        # Test command validation performance
        test_commands = [
            ["python", "script.py"],
            ["ffmpeg", "-i", "input.mp4", "-o", "output.mp4"],
            ["python"] + [f"arg_{i}" for i in range(100)],  # Large command
        ]

        command_results = {}
        for cmd in test_commands:
            start_time = time.perf_counter()
            for _ in range(100):
                sanitizer.validate_command(cmd)
            end_time = time.perf_counter()

            avg_time = (end_time - start_time) / 100
            command_results[len(cmd)] = avg_time
            assert avg_time < 0.001, f"Command validation too slow: {avg_time:.4f}s"

        print(f"Sanitization performance - Filenames: {filename_results}, Commands: {command_results}")

    def test_concurrent_security_operations(self, temp_workspace):
        """Test security operations under concurrent load."""
        allowed_dirs = [temp_workspace / "allowed"]
        allowed_dirs[0].mkdir()
        validator = PathValidator(allowed_dirs, enable_logging=True)
        sanitizer = CommandSanitizer(enable_logging=True)

        results = []
        errors = []

        def security_worker(worker_id):
            """Worker function for concurrent security operations."""
            try:
                for i in range(50):
                    # Mix of operations
                    test_path = allowed_dirs[0] / f"worker_{worker_id}_file_{i}.mp4"

                    # Path validation
                    is_safe = validator.is_safe(str(test_path))
                    results.append(("path_safe", is_safe))

                    # Filename sanitization
                    safe_filename = sanitizer.sanitize_filename(f"file_{worker_id}_{i}.mp4")
                    results.append(("filename", len(safe_filename)))

                    # Command validation
                    cmd_valid = sanitizer.validate_command(["python", f"script_{i}.py"])
                    results.append(("command", cmd_valid))

            except Exception as e:
                errors.append((worker_id, e))

        # Run concurrent workers
        start_time = time.perf_counter()
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(security_worker, i) for i in range(10)]
            for future in futures:
                future.result()  # Wait for completion
        end_time = time.perf_counter()

        # Verify results
        assert len(errors) == 0, f"Errors in concurrent operations: {errors}"
        assert len(results) == 1500, f"Expected 1500 results, got {len(results)}"  # 10 workers * 50 ops * 3 results

        total_time = end_time - start_time
        throughput = len(results) / total_time
        print(f"Concurrent security operations: {len(results)} ops in {total_time:.2f}s = {throughput:.0f} ops/sec")

        # Should achieve reasonable throughput (adjust threshold as needed)
        assert throughput > 100, f"Security throughput too low: {throughput:.0f} ops/sec"

    def test_memory_usage_under_load(self, temp_workspace):
        """Test memory usage during intensive security operations."""
        import gc
        import psutil
        import os

        # Get initial memory usage
        process = psutil.Process(os.getpid())
        initial_memory = process.memory_info().rss

        allowed_dirs = [temp_workspace / "allowed"]
        allowed_dirs[0].mkdir()
        validator = PathValidator(allowed_dirs)
        sanitizer = CommandSanitizer()

        # Perform many operations
        for i in range(1000):
            # Path validation
            test_path = allowed_dirs[0] / f"memory_test_{i}.mp4"
            validator.is_safe(str(test_path))

            # Filename sanitization
            sanitizer.sanitize_filename(f"memory_test_file_{i}.mp4")

            # Command validation
            sanitizer.validate_command(["python", f"script_{i}.py", f"arg_{i}"])

            # Periodic garbage collection
            if i % 100 == 0:
                gc.collect()

        # Final memory check
        gc.collect()
        final_memory = process.memory_info().rss
        memory_increase = final_memory - initial_memory

        # Memory increase should be reasonable (< 50MB for this test)
        max_memory_increase = 50 * 1024 * 1024  # 50MB
        print(f"Memory usage increase: {memory_increase / 1024 / 1024:.2f} MB")
        assert memory_increase < max_memory_increase, f"Memory leak detected: {memory_increase / 1024 / 1024:.2f} MB increase"

    def test_scalability_with_large_allowed_dirs(self, temp_workspace):
        """Test performance with large number of allowed directories."""
        # Create many allowed directories
        allowed_dirs = []
        for i in range(100):
            dir_path = temp_workspace / f"allowed_{i}"
            dir_path.mkdir()
            allowed_dirs.append(dir_path)

        validator = PathValidator(allowed_dirs)

        # Test path validation with many allowed dirs
        test_path = allowed_dirs[50] / "test_file.mp4"  # Path in middle of list

        start_time = time.perf_counter()
        for _ in range(100):
            validator.is_safe(str(test_path))
        end_time = time.perf_counter()

        avg_time = (end_time - start_time) / 100
        print(f"Path validation with 100 allowed dirs: {avg_time:.6f}s avg")

        # Should still be reasonably fast even with many directories
        assert avg_time < 0.01, f"Path validation too slow with many dirs: {avg_time:.6f}s"

    def test_worst_case_attack_scenarios(self):
        """Test performance under worst-case attack scenarios."""
        sanitizer = CommandSanitizer()

        # Worst case: maximum dangerous characters
        attack_filename = "evil" + "".join(CommandSanitizer.DANGEROUS_CHARS) + ".mp4"

        start_time = time.perf_counter()
        for _ in range(100):
            try:
                sanitizer.sanitize_filename(attack_filename)
            except Exception:
                pass  # Expected to fail, just measuring time
        end_time = time.perf_counter()

        avg_time = (end_time - start_time) / 100
        print(f"Worst-case filename attack handling: {avg_time:.6f}s avg")

        # Even worst-case should be handled quickly
        assert avg_time < 0.001, f"Attack handling too slow: {avg_time:.6f}s"

        # Worst case: deeply nested path traversal
        deep_traversal = "../" * 1000 + "etc/passwd"

        start_time = time.perf_counter()
        for _ in range(100):
            try:
                sanitizer.sanitize_path(deep_traversal)
            except Exception:
                pass
        end_time = time.perf_counter()

        avg_time = (end_time - start_time) / 100
        print(f"Deep path traversal attack handling: {avg_time:.6f}s avg")
        assert avg_time < 0.01, f"Deep traversal handling too slow: {avg_time:.6f}s"


@pytest.mark.performance
@pytest.mark.security
class TestSecurityScalability:
    """Test security system scalability under various loads."""

    def test_batch_file_processing_simulation(self, temp_workspace):
        """Simulate batch processing of many files."""
        allowed_dirs = [temp_workspace / "batch_test"]
        allowed_dirs[0].mkdir()
        validator = PathValidator(allowed_dirs)
        sanitizer = CommandSanitizer()

        # Simulate processing 1000 files
        file_count = 1000
        file_paths = []

        for i in range(file_count):
            file_path = allowed_dirs[0] / f"batch_file_{i:04d}.mp4"
            file_paths.append(file_path)

        # Time the batch processing
        start_time = time.perf_counter()

        processed_count = 0
        for file_path in file_paths:
            # Validation step
            if validator.is_safe(str(file_path)):
                # Sanitization step
                safe_filename = sanitizer.sanitize_filename(file_path.name)
                if safe_filename:
                    processed_count += 1

        end_time = time.perf_counter()

        processing_time = end_time - start_time
        throughput = processed_count / processing_time

        print(f"Batch processing: {processed_count} files in {processing_time:.2f}s = {throughput:.0f} files/sec")

        # Should process files efficiently
        assert throughput > 500, f"Batch processing too slow: {throughput:.0f} files/sec"
        assert processed_count == file_count, f"Lost files during processing: {processed_count}/{file_count}"

    def test_sustained_load_over_time(self, temp_workspace):
        """Test sustained security operations over extended time."""
        allowed_dirs = [temp_workspace / "sustained_test"]
        allowed_dirs[0].mkdir()
        validator = PathValidator(allowed_dirs, enable_logging=False)  # Disable logging for performance
        sanitizer = CommandSanitizer(enable_logging=False)

        operations_count = 0
        errors_count = 0
        start_time = time.perf_counter()

        # Run for a sustained period
        target_duration = 5.0  # 5 seconds
        while (time.perf_counter() - start_time) < target_duration:
            try:
                # Mix of operations
                test_path = allowed_dirs[0] / f"sustained_{operations_count % 100}.mp4"
                validator.is_safe(str(test_path))

                sanitizer.sanitize_filename(f"file_{operations_count}.mp4")
                sanitizer.validate_command(["python", "script.py", f"arg{operations_count}"])

                operations_count += 3  # 3 operations per iteration

            except Exception:
                errors_count += 1

        end_time = time.perf_counter()
        actual_duration = end_time - start_time
        throughput = operations_count / actual_duration

        print(f"Sustained load: {operations_count} ops in {actual_duration:.2f}s = {throughput:.0f} ops/sec, {errors_count} errors")

        # Should maintain performance over time
        assert throughput > 1000, f"Sustained throughput too low: {throughput:.0f} ops/sec"
        assert errors_count == 0, f"Errors during sustained load: {errors_count}"
