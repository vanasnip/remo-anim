"""Comprehensive unit tests for hash_calculator.py to achieve 85%+ coverage."""

import hashlib
import os
import tempfile
import time
from pathlib import Path
from unittest.mock import Mock, patch, mock_open

import pytest

from manim_bridge.core.constants import DEFAULT_CHUNK_SIZE
from manim_bridge.core.exceptions import ProcessingError
from manim_bridge.processing.hash_calculator import HashCalculator


@pytest.mark.unit
class TestHashCalculatorAlgorithms:
    """Test all supported hash algorithms for correctness and consistency."""

    def test_md5_algorithm(self, temp_workspace):
        """Test MD5 hash calculation."""
        calculator = HashCalculator()
        test_file = temp_workspace / "md5_test.txt"
        test_content = b"test content for MD5"
        test_file.write_bytes(test_content)

        result = calculator.calculate_hash(test_file, algorithm="md5")
        expected = hashlib.md5(test_content).hexdigest()

        assert result == expected
        assert len(result) == 32  # MD5 produces 32-character hex string

    def test_sha1_algorithm(self, temp_workspace):
        """Test SHA1 hash calculation."""
        calculator = HashCalculator()
        test_file = temp_workspace / "sha1_test.txt"
        test_content = b"test content for SHA1"
        test_file.write_bytes(test_content)

        result = calculator.calculate_hash(test_file, algorithm="sha1")
        expected = hashlib.sha1(test_content).hexdigest()

        assert result == expected
        assert len(result) == 40  # SHA1 produces 40-character hex string

    def test_sha256_algorithm(self, temp_workspace):
        """Test SHA256 hash calculation."""
        calculator = HashCalculator()
        test_file = temp_workspace / "sha256_test.txt"
        test_content = b"test content for SHA256"
        test_file.write_bytes(test_content)

        result = calculator.calculate_hash(test_file, algorithm="sha256")
        expected = hashlib.sha256(test_content).hexdigest()

        assert result == expected
        assert len(result) == 64  # SHA256 produces 64-character hex string

    def test_unsupported_algorithm(self, temp_workspace):
        """Test error handling for unsupported hash algorithms."""
        calculator = HashCalculator()
        test_file = temp_workspace / "test.txt"
        test_file.write_bytes(b"content")

        with pytest.raises(ProcessingError, match="Unsupported hash algorithm"):
            calculator.calculate_hash(test_file, algorithm="sha512")

    def test_algorithm_consistency_across_chunk_sizes(self, temp_workspace):
        """Test that all algorithms produce consistent results with different chunk sizes."""
        test_content = b"consistency test content " * 100  # ~2.5KB
        test_file = temp_workspace / "consistency_test.txt"
        test_file.write_bytes(test_content)

        algorithms = ["md5", "sha1", "sha256"]
        chunk_sizes = [512, 1024, 2048, 4096]

        for algorithm in algorithms:
            hashes = []
            for chunk_size in chunk_sizes:
                calculator = HashCalculator(chunk_size=chunk_size)
                hash_result = calculator.calculate_hash(test_file, algorithm=algorithm)
                hashes.append(hash_result)

            # All hashes for the same algorithm should be identical
            assert all(h == hashes[0] for h in hashes), f"Inconsistent {algorithm} hashes"


@pytest.mark.unit
class TestVerifyFile:
    """Test the verify_file method thoroughly."""

    def test_verify_file_correct_hash_md5(self, temp_workspace):
        """Test file verification with correct MD5 hash."""
        calculator = HashCalculator(enable_logging=True)
        test_file = temp_workspace / "verify_md5.txt"
        test_content = b"content to verify with MD5"
        test_file.write_bytes(test_content)

        expected_hash = hashlib.md5(test_content).hexdigest()
        result = calculator.verify_file(test_file, expected_hash, algorithm="md5")

        assert result is True

    def test_verify_file_correct_hash_sha256(self, temp_workspace):
        """Test file verification with correct SHA256 hash."""
        calculator = HashCalculator()
        test_file = temp_workspace / "verify_sha256.txt"
        test_content = b"content to verify with SHA256"
        test_file.write_bytes(test_content)

        expected_hash = hashlib.sha256(test_content).hexdigest()
        result = calculator.verify_file(test_file, expected_hash, algorithm="sha256")

        assert result is True

    def test_verify_file_incorrect_hash(self, temp_workspace):
        """Test file verification with incorrect hash."""
        calculator = HashCalculator(enable_logging=True)
        test_file = temp_workspace / "verify_wrong.txt"
        test_file.write_bytes(b"actual content")

        wrong_hash = "1234567890abcdef" * 2  # 32-character fake hash
        result = calculator.verify_file(test_file, wrong_hash, algorithm="md5")

        assert result is False

    def test_verify_file_nonexistent_file(self, temp_workspace):
        """Test file verification with non-existent file."""
        calculator = HashCalculator()
        nonexistent_file = temp_workspace / "nonexistent.txt"

        result = calculator.verify_file(nonexistent_file, "any_hash", algorithm="md5")

        assert result is False

    def test_verify_file_with_processing_error(self, temp_workspace):
        """Test file verification when calculate_hash raises ProcessingError."""
        calculator = HashCalculator()
        test_file = temp_workspace / "test.txt"
        test_file.write_bytes(b"content")

        # Mock calculate_hash to raise ProcessingError
        with patch.object(calculator, "calculate_hash", side_effect=ProcessingError("Mock error")):
            result = calculator.verify_file(test_file, "any_hash")
            assert result is False


@pytest.mark.unit
class TestCalculateMultiple:
    """Test the calculate_multiple method for batch processing."""

    def test_calculate_multiple_all_successful(self, temp_workspace):
        """Test batch calculation with all files successful."""
        calculator = HashCalculator(enable_logging=True)

        # Create multiple test files
        files = []
        expected_hashes = {}
        for i in range(3):
            file_path = temp_workspace / f"file_{i}.txt"
            content = f"content for file {i}".encode()
            file_path.write_bytes(content)
            files.append(file_path)
            expected_hashes[str(file_path)] = hashlib.md5(content).hexdigest()

        results = calculator.calculate_multiple(files, algorithm="md5")

        assert len(results) == 3
        for file_path, hash_value in results.items():
            assert hash_value == expected_hashes[file_path]
            assert hash_value is not None

    def test_calculate_multiple_some_failures(self, temp_workspace):
        """Test batch calculation with some files failing."""
        calculator = HashCalculator(enable_logging=True)

        # Create mix of existing and non-existent files
        existing_file = temp_workspace / "exists.txt"
        existing_file.write_bytes(b"existing content")

        nonexistent_file = temp_workspace / "nonexistent.txt"

        files = [existing_file, nonexistent_file]
        results = calculator.calculate_multiple(files, algorithm="md5")

        assert len(results) == 2
        assert results[str(existing_file)] is not None
        assert results[str(nonexistent_file)] is None

    def test_calculate_multiple_different_algorithms(self, temp_workspace):
        """Test batch calculation with different algorithms."""
        calculator = HashCalculator()

        file_path = temp_workspace / "algo_test.txt"
        content = b"test content for different algorithms"
        file_path.write_bytes(content)

        files = [file_path]

        # Test with different algorithms
        for algorithm in ["md5", "sha1", "sha256"]:
            results = calculator.calculate_multiple(files, algorithm=algorithm)
            expected = getattr(hashlib, algorithm)(content).hexdigest()
            assert results[str(file_path)] == expected

    def test_calculate_multiple_empty_list(self, temp_workspace):
        """Test batch calculation with empty file list."""
        calculator = HashCalculator()

        results = calculator.calculate_multiple([], algorithm="md5")

        assert results == {}

    def test_calculate_multiple_pathlib_and_string_paths(self, temp_workspace):
        """Test batch calculation with mix of Path objects and strings."""
        calculator = HashCalculator()

        # Create two different files to avoid key collision
        file_path1 = temp_workspace / "path_test1.txt"
        file_path2 = temp_workspace / "path_test2.txt"
        content1 = b"path test content 1"
        content2 = b"path test content 2"
        file_path1.write_bytes(content1)
        file_path2.write_bytes(content2)

        # Mix Path objects and string paths
        files = [file_path1, str(file_path2)]
        results = calculator.calculate_multiple(files, algorithm="md5")

        expected_hash1 = hashlib.md5(content1).hexdigest()
        expected_hash2 = hashlib.md5(content2).hexdigest()
        assert len(results) == 2
        assert results[str(file_path1)] == expected_hash1
        assert results[str(file_path2)] == expected_hash2


@pytest.mark.unit
class TestCalculateWithProgress:
    """Test the calculate_with_progress method with progress callbacks."""

    def test_calculate_with_progress_basic(self, temp_workspace):
        """Test basic progress calculation without callback."""
        calculator = HashCalculator(chunk_size=1024)
        test_file = temp_workspace / "progress_basic.txt"
        content = b"basic progress test content " * 100  # ~2.7KB
        test_file.write_bytes(content)

        result = calculator.calculate_with_progress(test_file, algorithm="md5")
        expected = hashlib.md5(content).hexdigest()

        assert result == expected

    def test_calculate_with_progress_with_callback(self, temp_workspace):
        """Test progress calculation with callback function."""
        calculator = HashCalculator(chunk_size=512)  # Small chunks for more callbacks
        test_file = temp_workspace / "progress_callback.txt"
        content = b"progress callback test content " * 200  # ~5.4KB
        test_file.write_bytes(content)

        # Track progress calls
        progress_calls = []

        def progress_callback(progress, bytes_read, file_size):
            progress_calls.append((progress, bytes_read, file_size))

        result = calculator.calculate_with_progress(
            test_file, progress_callback=progress_callback, algorithm="sha256"
        )

        expected = hashlib.sha256(content).hexdigest()
        assert result == expected

        # Should have made progress callbacks
        assert len(progress_calls) > 0

        # Verify callback parameters
        for progress, bytes_read, file_size in progress_calls:
            assert 0 <= progress <= 100
            assert bytes_read <= file_size
            assert file_size == len(content)

        # Final callback should be 100% progress
        final_progress, final_bytes, final_size = progress_calls[-1]
        assert final_progress == 100.0
        assert final_bytes == final_size

    def test_calculate_with_progress_sha1_not_supported(self, temp_workspace):
        """Test that progress calculation doesn't support SHA1 algorithm (implementation limitation)."""
        calculator = HashCalculator()
        test_file = temp_workspace / "progress_sha1.txt"
        test_file.write_bytes(b"SHA1 progress test")

        with pytest.raises(ProcessingError, match="Unsupported hash algorithm"):
            calculator.calculate_with_progress(test_file, algorithm="sha1")

    def test_calculate_with_progress_unsupported_algorithm(self, temp_workspace):
        """Test progress calculation with unsupported algorithm."""
        calculator = HashCalculator()
        test_file = temp_workspace / "progress_unsupported.txt"
        test_file.write_bytes(b"test content")

        with pytest.raises(ProcessingError, match="Unsupported hash algorithm"):
            calculator.calculate_with_progress(test_file, algorithm="sha512")

    def test_calculate_with_progress_nonexistent_file(self, temp_workspace):
        """Test progress calculation with non-existent file."""
        calculator = HashCalculator()
        nonexistent_file = temp_workspace / "nonexistent.txt"

        with pytest.raises(ProcessingError, match="File not found"):
            calculator.calculate_with_progress(nonexistent_file)

    def test_calculate_with_progress_file_read_error(self, temp_workspace):
        """Test progress calculation with file read error."""
        calculator = HashCalculator()
        test_file = temp_workspace / "read_error.txt"
        test_file.write_bytes(b"test content")

        # Mock file open to raise an exception during reading
        with patch("builtins.open", mock_open()) as mock_file:
            mock_file.return_value.read.side_effect = OSError("Permission denied")

            with pytest.raises(ProcessingError, match="Failed to calculate hash"):
                calculator.calculate_with_progress(test_file)

    def test_calculate_with_progress_large_file(self, temp_workspace):
        """Test progress calculation with larger file to ensure multiple progress calls."""
        calculator = HashCalculator(chunk_size=1024)
        test_file = temp_workspace / "large_progress.txt"

        # Create content larger than chunk size to ensure multiple reads
        large_content = b"large file content for progress testing " * 1000  # ~40KB
        test_file.write_bytes(large_content)

        progress_updates = []

        def track_progress(progress, bytes_read, file_size):
            progress_updates.append(progress)

        result = calculator.calculate_with_progress(
            test_file, progress_callback=track_progress, algorithm="md5"
        )

        expected = hashlib.md5(large_content).hexdigest()
        assert result == expected

        # Should have multiple progress updates
        assert len(progress_updates) > 1

        # Progress should be increasing
        for i in range(1, len(progress_updates)):
            assert progress_updates[i] >= progress_updates[i - 1]


@pytest.mark.unit
class TestErrorHandling:
    """Test comprehensive error handling scenarios."""

    def test_calculate_hash_file_not_found(self, temp_workspace):
        """Test error when file doesn't exist."""
        calculator = HashCalculator()
        nonexistent_file = temp_workspace / "nonexistent.txt"

        with pytest.raises(ProcessingError, match="File not found"):
            calculator.calculate_hash(nonexistent_file)

    def test_calculate_hash_permission_error(self, temp_workspace):
        """Test error when file can't be read due to permissions."""
        calculator = HashCalculator()
        test_file = temp_workspace / "permission_test.txt"
        test_file.write_bytes(b"test content")

        # Mock file opening to raise permission error
        with patch("builtins.open", side_effect=PermissionError("Permission denied")):
            with pytest.raises(ProcessingError, match="Failed to calculate hash"):
                calculator.calculate_hash(test_file)

    def test_calculate_hash_io_error_during_read(self, temp_workspace):
        """Test error when file read fails mid-stream."""
        calculator = HashCalculator()
        test_file = temp_workspace / "io_error_test.txt"
        test_file.write_bytes(b"test content")

        # Mock file.read() to raise IOError after opening
        with patch("builtins.open", mock_open(read_data=b"")) as mock_file:
            mock_file.return_value.read.side_effect = IOError("Disk read error")

            with pytest.raises(ProcessingError, match="Failed to calculate hash"):
                calculator.calculate_hash(test_file)

    def test_calculate_hash_with_corrupted_file_simulation(self, temp_workspace):
        """Test handling of simulated corrupted file."""
        calculator = HashCalculator(chunk_size=10)
        test_file = temp_workspace / "corrupted.txt"

        # Create file with some content
        test_file.write_bytes(b"initial content")

        # Mock file reading to simulate corruption by raising exception mid-read
        original_open = open

        def mock_corrupted_open(file, mode="r", **kwargs):
            if str(file).endswith("corrupted.txt") and "rb" in mode:
                mock_file = Mock()
                mock_file.__enter__ = Mock(return_value=mock_file)
                mock_file.__exit__ = Mock(return_value=None)

                # First read succeeds, second fails
                call_count = 0

                def side_effect_read(size):
                    nonlocal call_count
                    call_count += 1
                    if call_count == 1:
                        return b"initial"
                    else:
                        raise OSError("File corrupted during read")

                mock_file.read = Mock(side_effect=side_effect_read)
                return mock_file
            return original_open(file, mode, **kwargs)

        with patch("builtins.open", side_effect=mock_corrupted_open):
            with pytest.raises(ProcessingError, match="Failed to calculate hash"):
                calculator.calculate_hash(test_file)


@pytest.mark.unit
class TestEdgeCases:
    """Test edge cases and performance scenarios."""

    def test_empty_file_all_algorithms(self, temp_workspace):
        """Test hash calculation for empty files with all algorithms."""
        calculator = HashCalculator()
        empty_file = temp_workspace / "empty.txt"
        empty_file.write_bytes(b"")

        algorithms = ["md5", "sha1", "sha256"]
        expected_hashes = {
            "md5": hashlib.md5(b"").hexdigest(),
            "sha1": hashlib.sha1(b"").hexdigest(),
            "sha256": hashlib.sha256(b"").hexdigest(),
        }

        for algorithm in algorithms:
            result = calculator.calculate_hash(empty_file, algorithm=algorithm)
            assert result == expected_hashes[algorithm]

    def test_single_byte_file(self, temp_workspace):
        """Test hash calculation for single-byte file."""
        calculator = HashCalculator()
        single_byte_file = temp_workspace / "single_byte.txt"
        single_byte_file.write_bytes(b"A")

        result = calculator.calculate_hash(single_byte_file, algorithm="md5")
        expected = hashlib.md5(b"A").hexdigest()

        assert result == expected

    def test_binary_data_with_null_bytes(self, temp_workspace):
        """Test hash calculation with binary data containing null bytes."""
        calculator = HashCalculator()
        binary_file = temp_workspace / "binary_nulls.bin"

        # Binary data with null bytes and various byte values
        binary_data = b"\x00\x01\x02\x03" + b"\x00" * 100 + bytes(range(256)) + b"\xff\xfe\xfd\xfc"
        binary_file.write_bytes(binary_data)

        result = calculator.calculate_hash(binary_file, algorithm="sha256")
        expected = hashlib.sha256(binary_data).hexdigest()

        assert result == expected

    def test_very_large_file_simulation(self, temp_workspace):
        """Test hash calculation performance with simulated large file."""
        calculator = HashCalculator(chunk_size=8192)
        large_file = temp_workspace / "large_simulation.txt"

        # Create moderately large content (~1MB)
        chunk_content = b"large file content chunk " * 1000  # ~25KB per iteration
        large_content = chunk_content * 40  # ~1MB total
        large_file.write_bytes(large_content)

        start_time = time.time()
        result = calculator.calculate_hash(large_file, algorithm="md5")
        elapsed = time.time() - start_time

        expected = hashlib.md5(large_content).hexdigest()
        assert result == expected

        # Should complete in reasonable time (less than 2 seconds for 1MB)
        assert elapsed < 2.0

    def test_chunk_size_boundary_conditions(self, temp_workspace):
        """Test hash calculation with various chunk size boundary conditions."""
        test_content = b"boundary test content " * 100  # ~2.2KB
        test_file = temp_workspace / "boundary_test.txt"
        test_file.write_bytes(test_content)

        # Test various chunk sizes including edge cases
        chunk_sizes = [
            1,
            10,
            100,
            1000,
            len(test_content) - 1,
            len(test_content),
            len(test_content) + 1,
            10000,
        ]

        expected_hash = hashlib.md5(test_content).hexdigest()

        for chunk_size in chunk_sizes:
            calculator = HashCalculator(chunk_size=chunk_size)
            result = calculator.calculate_hash(test_file, algorithm="md5")
            assert result == expected_hash, f"Failed with chunk_size={chunk_size}"

    def test_unicode_filename_support(self, temp_workspace):
        """Test hash calculation with Unicode filenames."""
        calculator = HashCalculator()

        # Create file with Unicode name
        unicode_file = temp_workspace / "测试文件_тест_🎬.txt"
        test_content = b"unicode filename test content"
        unicode_file.write_bytes(test_content)

        result = calculator.calculate_hash(unicode_file, algorithm="sha1")
        expected = hashlib.sha1(test_content).hexdigest()

        assert result == expected

    def test_different_chunk_sizes_consistency(self, temp_workspace):
        """Test that different chunk sizes produce identical results for the same file."""
        test_content = b"consistency across chunk sizes " * 500  # ~15KB
        test_file = temp_workspace / "chunk_consistency.txt"
        test_file.write_bytes(test_content)

        # Test various chunk sizes
        chunk_sizes = [512, 1024, 2048, 4096, 8192, 16384, DEFAULT_CHUNK_SIZE]
        hashes = []

        for chunk_size in chunk_sizes:
            calculator = HashCalculator(chunk_size=chunk_size)
            hash_result = calculator.calculate_hash(test_file, algorithm="sha256")
            hashes.append(hash_result)

        # All hashes should be identical
        assert all(h == hashes[0] for h in hashes)

        # Verify against expected
        expected = hashlib.sha256(test_content).hexdigest()
        assert hashes[0] == expected


@pytest.mark.unit
class TestLoggingIntegration:
    """Test logging integration and behavior."""

    def test_hash_calculation_with_logging(self, temp_workspace):
        """Test that logging works correctly during hash calculation."""
        calculator = HashCalculator(enable_logging=True)
        test_file = temp_workspace / "logging_test.txt"
        test_file.write_bytes(b"logging test content")

        # Mock the logger to capture log calls
        with patch.object(calculator, "logger") as mock_logger:
            result = calculator.calculate_hash(test_file, algorithm="md5")

            # Should have called debug log
            mock_logger.debug.assert_called_once()

            # Log message should contain algorithm, filename, and hash preview
            call_args = mock_logger.debug.call_args[0][0]
            assert "md5" in call_args.lower()
            assert "logging_test.txt" in call_args
            assert result[:8] in call_args

    def test_verify_file_logging_success(self, temp_workspace):
        """Test logging during successful file verification."""
        calculator = HashCalculator(enable_logging=True)
        test_file = temp_workspace / "verify_log_success.txt"
        content = b"verify logging success test"
        test_file.write_bytes(content)

        correct_hash = hashlib.md5(content).hexdigest()

        with patch.object(calculator, "logger") as mock_logger:
            result = calculator.verify_file(test_file, correct_hash, algorithm="md5")

            assert result is True
            # Should log successful verification
            mock_logger.debug.assert_called()
            call_args = mock_logger.debug.call_args[0][0]
            assert "verification passed" in call_args.lower()

    def test_verify_file_logging_failure(self, temp_workspace):
        """Test logging during failed file verification."""
        calculator = HashCalculator(enable_logging=True)
        test_file = temp_workspace / "verify_log_fail.txt"
        test_file.write_bytes(b"verify logging fail test")

        wrong_hash = "wrong_hash_value_1234567890abcdef"

        with patch.object(calculator, "logger") as mock_logger:
            result = calculator.verify_file(test_file, wrong_hash, algorithm="md5")

            assert result is False
            # Should log hash mismatch warning
            mock_logger.warning.assert_called()
            call_args = mock_logger.warning.call_args[0][0]
            assert "hash mismatch" in call_args.lower()

    def test_calculate_multiple_logging_errors(self, temp_workspace):
        """Test logging during calculate_multiple with errors."""
        calculator = HashCalculator(enable_logging=True)

        existing_file = temp_workspace / "exists.txt"
        existing_file.write_bytes(b"existing")

        nonexistent_file = temp_workspace / "nonexistent.txt"

        files = [existing_file, nonexistent_file]

        with patch.object(calculator, "logger") as mock_logger:
            results = calculator.calculate_multiple(files)

            # Should log error for the failed file
            mock_logger.error.assert_called()
            call_args = mock_logger.error.call_args[0][0]
            assert "hash calculation failed" in call_args.lower()
            assert "nonexistent.txt" in call_args


@pytest.mark.unit
class TestInitializationAndConfiguration:
    """Test HashCalculator initialization and configuration options."""

    def test_default_initialization(self):
        """Test HashCalculator with default parameters."""
        calculator = HashCalculator()

        assert calculator.chunk_size == DEFAULT_CHUNK_SIZE
        assert calculator.logger is None

    def test_custom_chunk_size_initialization(self):
        """Test HashCalculator with custom chunk size."""
        custom_chunk_size = 2048
        calculator = HashCalculator(chunk_size=custom_chunk_size)

        assert calculator.chunk_size == custom_chunk_size

    def test_logging_enabled_initialization(self):
        """Test HashCalculator with logging enabled."""
        calculator = HashCalculator(enable_logging=True)

        assert calculator.logger is not None

    def test_both_parameters_initialization(self):
        """Test HashCalculator with both custom chunk size and logging."""
        custom_chunk_size = 4096
        calculator = HashCalculator(chunk_size=custom_chunk_size, enable_logging=True)

        assert calculator.chunk_size == custom_chunk_size
        assert calculator.logger is not None

    def test_zero_chunk_size_handling(self):
        """Test HashCalculator behavior with zero chunk size."""
        calculator = HashCalculator(chunk_size=0)

        # Should still work but might be inefficient
        assert calculator.chunk_size == 0

    def test_negative_chunk_size_handling(self):
        """Test HashCalculator behavior with negative chunk size."""
        calculator = HashCalculator(chunk_size=-1)

        # Should store the value as-is (Python handles negative reads)
        assert calculator.chunk_size == -1


@pytest.mark.unit
class TestIntegrationScenarios:
    """Test integration scenarios combining multiple methods."""

    def test_full_workflow_md5(self, temp_workspace):
        """Test complete workflow: calculate -> verify -> batch process."""
        calculator = HashCalculator(enable_logging=True)

        # Create test files
        files = []
        for i in range(3):
            file_path = temp_workspace / f"workflow_{i}.txt"
            content = f"workflow test content {i}".encode()
            file_path.write_bytes(content)
            files.append(file_path)

        # Step 1: Calculate individual hashes
        individual_hashes = {}
        for file_path in files:
            hash_result = calculator.calculate_hash(file_path, algorithm="md5")
            individual_hashes[str(file_path)] = hash_result

        # Step 2: Verify each file
        for file_path in files:
            expected_hash = individual_hashes[str(file_path)]
            assert calculator.verify_file(file_path, expected_hash, algorithm="md5") is True

        # Step 3: Batch process
        batch_results = calculator.calculate_multiple(files, algorithm="md5")

        # Results should match individual calculations
        for file_path in files:
            assert batch_results[str(file_path)] == individual_hashes[str(file_path)]

    def test_progress_and_verification_workflow(self, temp_workspace):
        """Test workflow combining progress tracking and verification."""
        calculator = HashCalculator(chunk_size=1024)

        test_file = temp_workspace / "progress_verify.txt"
        test_content = b"progress and verification test content " * 200  # ~7.4KB
        test_file.write_bytes(test_content)

        progress_calls = []

        def progress_tracker(progress, bytes_read, file_size):
            progress_calls.append((progress, bytes_read, file_size))

        # Calculate with progress
        result_hash = calculator.calculate_with_progress(
            test_file, progress_callback=progress_tracker, algorithm="sha256"
        )

        # Verify progress was tracked
        assert len(progress_calls) > 0
        assert progress_calls[-1][0] == 100.0  # Final progress should be 100%

        # Verify the calculated hash
        assert calculator.verify_file(test_file, result_hash, algorithm="sha256") is True

        # Verify with wrong hash
        wrong_hash = "wrong" + result_hash[5:]
        assert calculator.verify_file(test_file, wrong_hash, algorithm="sha256") is False

    def test_mixed_algorithm_batch_processing(self, temp_workspace):
        """Test processing same files with different algorithms."""
        calculator = HashCalculator()

        test_file = temp_workspace / "mixed_algo.txt"
        test_content = b"mixed algorithm test content"
        test_file.write_bytes(test_content)

        files = [test_file]
        algorithms = ["md5", "sha1", "sha256"]

        # Calculate with each algorithm
        all_results = {}
        for algorithm in algorithms:
            results = calculator.calculate_multiple(files, algorithm=algorithm)
            all_results[algorithm] = results[str(test_file)]

        # Verify each result
        for algorithm, hash_result in all_results.items():
            assert calculator.verify_file(test_file, hash_result, algorithm=algorithm) is True

            # Verify hash length matches algorithm
            expected_lengths = {"md5": 32, "sha1": 40, "sha256": 64}
            assert len(hash_result) == expected_lengths[algorithm]
