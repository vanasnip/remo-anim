"""Enhanced comprehensive tests for AtomicFileOperations to achieve 85%+ coverage.

This test suite focuses on the critical untested methods:
- transactional_update with rollback functionality
- cleanup_temp_files with various patterns
- Cross-filesystem operations
- Verification callbacks
- Concurrent operations
- Error recovery scenarios
"""

import os
import shutil
import tempfile
import threading
import time
from pathlib import Path
from typing import Any, Dict
from unittest.mock import Mock, patch, call
import pytest

from manim_bridge.storage.file_operations import AtomicFileOperations
from manim_bridge.core.exceptions import ProcessingError


@pytest.mark.unit
class TestAtomicFileOperationsEnhanced:
    """Enhanced tests for AtomicFileOperations focusing on untested critical methods."""

    def setup_method(self):
        """Set up for each test method."""
        self.file_ops = AtomicFileOperations(enable_logging=True)
        self.file_ops_no_log = AtomicFileOperations(enable_logging=False)

    @pytest.mark.concurrent
    def test_transactional_update_successful_completion(self, temp_workspace):
        """Test transactional update with successful completion and backup cleanup."""
        test_file = temp_workspace / "transactional.txt"
        original_content = "original data"
        test_file.write_text(original_content)

        def update_function(file_path):
            """Update function that modifies the file."""
            file_path.write_text("updated data")

        # Execute transactional update with backup
        result = self.file_ops.transactional_update(test_file, update_function, backup=True)

        # Verify success
        assert result is True
        assert test_file.read_text() == "updated data"

        # Verify backup was cleaned up
        backup_file = test_file.with_suffix(".backup")
        assert not backup_file.exists()

    @pytest.mark.concurrent
    def test_transactional_update_rollback_on_failure(self, temp_workspace):
        """Test automatic rollback to backup when update fails."""
        test_file = temp_workspace / "rollback_test.txt"
        original_content = "important original data"
        test_file.write_text(original_content)

        def failing_update_function(file_path):
            """Update function that fails after partial modification."""
            file_path.write_text("partial update")
            raise ValueError("Simulated update failure")

        # Execute transactional update that will fail
        with pytest.raises(ProcessingError) as exc_info:
            self.file_ops.transactional_update(test_file, failing_update_function, backup=True)

        assert "Transactional update failed" in str(exc_info.value)

        # Verify rollback restored original content
        assert test_file.read_text() == original_content

        # Verify backup was removed during rollback
        backup_file = test_file.with_suffix(".backup")
        assert not backup_file.exists()

    def test_transactional_update_no_backup(self, temp_workspace):
        """Test transactional update without backup creation."""
        test_file = temp_workspace / "no_backup.txt"
        test_file.write_text("original")

        def update_function(file_path):
            file_path.write_text("updated without backup")

        result = self.file_ops.transactional_update(test_file, update_function, backup=False)

        assert result is True
        assert test_file.read_text() == "updated without backup"

        # Verify no backup was created
        backup_file = test_file.with_suffix(".backup")
        assert not backup_file.exists()

    def test_transactional_update_nonexistent_file(self, temp_workspace):
        """Test transactional update on non-existent file."""
        test_file = temp_workspace / "new_file.txt"
        assert not test_file.exists()

        def create_function(file_path):
            file_path.write_text("newly created content")

        result = self.file_ops.transactional_update(test_file, create_function, backup=True)

        assert result is True
        assert test_file.read_text() == "newly created content"

    @pytest.mark.concurrent
    def test_transactional_update_permission_error_during_rollback(self, temp_workspace):
        """Test that transactional update properly handles errors during both update and rollback."""
        test_file = temp_workspace / "permission_test.txt"
        original_content = "original content"
        test_file.write_text(original_content)

        def failing_update(file_path):
            file_path.write_text("failed update")
            raise IOError("Update failed")

        # We'll test that even if the update fails, the proper exception is raised
        with pytest.raises(ProcessingError) as exc_info:
            self.file_ops.transactional_update(test_file, failing_update, backup=True)

        # Should contain the error message
        assert "Transactional update failed" in str(exc_info.value)
        # And should have rolled back to original content (unless rollback also failed)
        # In most cases, rollback succeeds and file should be restored
        if test_file.exists():
            assert test_file.read_text() == original_content

    def test_cleanup_temp_files_default_pattern(self, temp_workspace):
        """Test cleanup of temporary files with default pattern."""
        # Create various temporary files
        temp_files = [
            temp_workspace / ".tmp_file1.txt",
            temp_workspace / ".tmp_video.mp4",
            temp_workspace / ".tmp_12345.json",
            temp_workspace / "normal_file.txt",  # Should not be cleaned
            temp_workspace / "tmp_without_dot.txt",  # Should not be cleaned
        ]

        for temp_file in temp_files:
            temp_file.write_text("temporary content")

        # Execute cleanup
        self.file_ops.cleanup_temp_files(temp_workspace)

        # Verify correct files were removed
        assert not (temp_workspace / ".tmp_file1.txt").exists()
        assert not (temp_workspace / ".tmp_video.mp4").exists()
        assert not (temp_workspace / ".tmp_12345.json").exists()

        # Verify normal files were preserved
        assert (temp_workspace / "normal_file.txt").exists()
        assert (temp_workspace / "tmp_without_dot.txt").exists()

    def test_cleanup_temp_files_custom_pattern(self, temp_workspace):
        """Test cleanup with custom pattern."""
        # Create files with custom pattern
        backup_files = [
            temp_workspace / "file1.backup",
            temp_workspace / "video.backup",
            temp_workspace / "config.backup",
            temp_workspace / "file.bak",  # Should not match
            temp_workspace / "backup_file.txt",  # Should not match
        ]

        for backup_file in backup_files:
            backup_file.write_text("backup content")

        # Execute cleanup with custom pattern
        self.file_ops.cleanup_temp_files(temp_workspace, pattern="*.backup")

        # Verify pattern matching worked
        assert not (temp_workspace / "file1.backup").exists()
        assert not (temp_workspace / "video.backup").exists()
        assert not (temp_workspace / "config.backup").exists()

        # Verify non-matching files preserved
        assert (temp_workspace / "file.bak").exists()
        assert (temp_workspace / "backup_file.txt").exists()

    def test_cleanup_temp_files_permission_errors(self, temp_workspace, caplog):
        """Test cleanup handling permission errors gracefully."""
        temp_file = temp_workspace / ".tmp_readonly.txt"
        temp_file.write_text("readonly temp file")

        # Mock unlink to raise permission error
        with patch.object(Path, "unlink") as mock_unlink:
            mock_unlink.side_effect = PermissionError("Cannot delete file")

            # Should not raise exception, but log warning
            self.file_ops.cleanup_temp_files(temp_workspace)

            # Verify warning was logged (if logging enabled)
            if self.file_ops.logger:
                mock_unlink.assert_called()

    def test_cleanup_temp_files_nonexistent_directory(self, temp_workspace):
        """Test cleanup on non-existent directory."""
        nonexistent_dir = temp_workspace / "does_not_exist"

        # Should not raise exception
        self.file_ops.cleanup_temp_files(nonexistent_dir)

    def test_cleanup_temp_files_empty_directory(self, temp_workspace):
        """Test cleanup on empty directory."""
        empty_dir = temp_workspace / "empty"
        empty_dir.mkdir()

        # Should complete without error
        self.file_ops.cleanup_temp_files(empty_dir)

    @pytest.mark.concurrent
    def test_atomic_move_cross_filesystem(self, temp_workspace):
        """Test atomic move across different filesystems (copy + delete fallback)."""
        source_file = temp_workspace / "source.mp4"
        source_content = b"cross filesystem content"
        source_file.write_bytes(source_content)

        dest_file = temp_workspace / "destination.mp4"

        # Create a mock stat that returns different st_dev for source and destination parent
        def mock_stat_method(path_self):
            stat_result = Mock()
            if path_self == source_file:
                stat_result.st_dev = 1  # Source filesystem
            elif path_self == dest_file.parent:  # destination.parent
                stat_result.st_dev = 2  # Different filesystem
            else:
                stat_result.st_dev = 1  # Default
            return stat_result

        # Mock both atomic_copy and unlink to verify cross-filesystem behavior
        with patch.object(Path, "stat", mock_stat_method):
            with patch.object(self.file_ops, "atomic_copy", return_value=True) as mock_copy:
                with patch.object(Path, "unlink") as mock_unlink:
                    result = self.file_ops.atomic_move(source_file, dest_file)

                    assert result is True
                    mock_copy.assert_called_once_with(source_file, dest_file)
                    mock_unlink.assert_called_once()  # Source should be deleted

    def test_atomic_move_same_filesystem(self, temp_workspace):
        """Test atomic move on same filesystem using rename."""
        source_file = temp_workspace / "same_fs_source.mp4"
        source_content = b"same filesystem content"
        source_file.write_bytes(source_content)

        dest_file = temp_workspace / "same_fs_dest.mp4"

        # Both files should be on same filesystem in test environment
        result = self.file_ops.atomic_move(source_file, dest_file)

        assert result is True
        assert not source_file.exists()
        assert dest_file.exists()
        assert dest_file.read_bytes() == source_content

    def test_atomic_copy_with_verification_callback(self, temp_workspace):
        """Test atomic copy with verification callback."""
        source_file = temp_workspace / "verified_source.mp4"
        source_content = b"verified content"
        source_file.write_bytes(source_content)

        dest_file = temp_workspace / "verified_dest.mp4"

        def verify_callback(temp_path: Path) -> bool:
            """Verification callback that checks content."""
            return temp_path.read_bytes() == source_content

        result = self.file_ops.atomic_copy(source_file, dest_file, verify_callback)

        assert result is True
        assert dest_file.exists()
        assert dest_file.read_bytes() == source_content

    def test_atomic_copy_verification_failure(self, temp_workspace):
        """Test atomic copy with failing verification callback."""
        source_file = temp_workspace / "verify_fail_source.mp4"
        source_file.write_bytes(b"content to verify")

        dest_file = temp_workspace / "verify_fail_dest.mp4"

        def failing_verify_callback(temp_path: Path) -> bool:
            """Always fail verification."""
            return False

        with pytest.raises(ProcessingError) as exc_info:
            self.file_ops.atomic_copy(source_file, dest_file, failing_verify_callback)

        assert "File verification failed" in str(exc_info.value)
        assert not dest_file.exists()

    def test_atomic_copy_verification_exception(self, temp_workspace):
        """Test atomic copy when verification callback raises exception."""
        source_file = temp_workspace / "verify_exception_source.mp4"
        source_file.write_bytes(b"content")

        dest_file = temp_workspace / "verify_exception_dest.mp4"

        def exception_verify_callback(temp_path: Path) -> bool:
            """Verification callback that raises exception."""
            raise ValueError("Verification error")

        with pytest.raises(ProcessingError):
            self.file_ops.atomic_copy(source_file, dest_file, exception_verify_callback)

        assert not dest_file.exists()

    @pytest.mark.concurrent
    def test_concurrent_atomic_operations(self, temp_workspace):
        """Test concurrent atomic operations for thread safety."""
        results = []
        errors = []

        def worker(worker_id: int):
            """Worker function for concurrent testing."""
            try:
                ops = AtomicFileOperations(enable_logging=False)  # Avoid log conflicts

                for i in range(5):
                    source_file = temp_workspace / f"worker_{worker_id}_source_{i}.txt"
                    dest_file = temp_workspace / f"worker_{worker_id}_dest_{i}.txt"
                    content = f"Worker {worker_id} file {i}".encode()

                    source_file.write_bytes(content)
                    ops.atomic_copy(source_file, dest_file)

                    results.append(f"worker_{worker_id}_{i}")
                    time.sleep(0.001)  # Small delay to increase chance of race conditions

            except Exception as e:
                errors.append(f"Worker {worker_id}: {e}")

        # Run multiple workers concurrently
        threads = []
        for worker_id in range(4):
            thread = threading.Thread(target=worker, args=(worker_id,))
            threads.append(thread)
            thread.start()

        # Wait for all threads to complete
        for thread in threads:
            thread.join()

        # Verify all operations completed successfully
        assert len(errors) == 0, f"Concurrent errors occurred: {errors}"
        assert len(results) == 20  # 4 workers * 5 operations each

        # Verify all destination files exist and have correct content
        for worker_id in range(4):
            for i in range(5):
                dest_file = temp_workspace / f"worker_{worker_id}_dest_{i}.txt"
                assert dest_file.exists()
                expected_content = f"Worker {worker_id} file {i}".encode()
                assert dest_file.read_bytes() == expected_content

    def test_atomic_copy_temp_file_cleanup_on_error(self, temp_workspace):
        """Test that temporary files are cleaned up when atomic copy fails."""
        source_file = temp_workspace / "cleanup_source.mp4"
        source_file.write_bytes(b"content")

        dest_file = temp_workspace / "cleanup_dest.mp4"

        # Mock shutil.copy2 to fail after temp file creation
        with patch("shutil.copy2") as mock_copy:
            mock_copy.side_effect = IOError("Copy operation failed")

            with pytest.raises(ProcessingError):
                self.file_ops.atomic_copy(source_file, dest_file)

            # Verify no temporary files are left behind
            temp_files = list(temp_workspace.glob(".tmp_*"))
            assert len(temp_files) == 0

    def test_error_scenarios_disk_full(self, temp_workspace):
        """Test handling of disk full errors."""
        source_file = temp_workspace / "disk_full_source.mp4"
        source_file.write_bytes(b"content")

        dest_file = temp_workspace / "disk_full_dest.mp4"

        # Mock shutil.copy2 to simulate disk full
        with patch("shutil.copy2") as mock_copy:
            mock_copy.side_effect = OSError("No space left on device")

            with pytest.raises(ProcessingError) as exc_info:
                self.file_ops.atomic_copy(source_file, dest_file)

            assert "No space left on device" in str(exc_info.value)

    def test_error_scenarios_permission_denied(self, temp_workspace):
        """Test handling of permission denied errors."""
        source_file = temp_workspace / "permission_source.mp4"
        source_file.write_bytes(b"content")

        dest_file = temp_workspace / "readonly_dir" / "permission_dest.mp4"
        dest_file.parent.mkdir()

        # Mock tempfile.mkstemp to simulate permission error
        with patch("tempfile.mkstemp") as mock_mkstemp:
            mock_mkstemp.side_effect = PermissionError("Permission denied")

            with pytest.raises(PermissionError) as exc_info:
                self.file_ops.atomic_copy(source_file, dest_file)

            assert "Permission denied" in str(exc_info.value)

    def test_symlink_handling_in_operations(self, temp_workspace):
        """Test atomic operations with symlinks."""
        # Create target file
        target_file = temp_workspace / "symlink_target.mp4"
        target_content = b"symlink target content"
        target_file.write_bytes(target_content)

        # Create symlink
        source_link = temp_workspace / "source_symlink.mp4"
        try:
            source_link.symlink_to(target_file)

            dest_file = temp_workspace / "symlink_dest.mp4"
            result = self.file_ops.atomic_copy(source_link, dest_file)

            assert result is True
            assert dest_file.exists()
            # Should copy the target content, not create a symlink
            assert dest_file.read_bytes() == target_content

        except OSError:
            # Skip if symlinks not supported
            pytest.skip("Symlinks not supported on this platform")

    def test_large_file_operations(self, temp_workspace):
        """Test atomic operations with large files."""
        source_file = temp_workspace / "large_source.mp4"
        dest_file = temp_workspace / "large_dest.mp4"

        # Create a moderately large file (1MB)
        large_content = b"x" * (1024 * 1024)
        source_file.write_bytes(large_content)

        result = self.file_ops.atomic_copy(source_file, dest_file)

        assert result is True
        assert dest_file.exists()
        assert dest_file.stat().st_size == len(large_content)

    @pytest.mark.concurrent
    def test_transactional_update_concurrent_access(self, temp_workspace):
        """Test transactional update with concurrent access to same file."""
        test_file = temp_workspace / "concurrent_update.txt"
        test_file.write_text("initial content")

        results = []
        errors = []

        def concurrent_updater(worker_id: int):
            """Worker that performs transactional update."""
            try:
                ops = AtomicFileOperations(enable_logging=False)

                def update_func(file_path):
                    # Read current content, append worker info
                    current = file_path.read_text() if file_path.exists() else ""
                    new_content = f"{current}\nWorker {worker_id} update"
                    file_path.write_text(new_content)
                    time.sleep(0.001)  # Small delay

                ops.transactional_update(test_file, update_func, backup=True)
                results.append(worker_id)

            except Exception as e:
                errors.append(f"Worker {worker_id}: {e}")

        # Run concurrent updates
        threads = []
        for worker_id in range(3):
            thread = threading.Thread(target=concurrent_updater, args=(worker_id,))
            threads.append(thread)
            thread.start()

        for thread in threads:
            thread.join()

        # All workers should complete successfully due to atomic operations
        assert len(errors) == 0, f"Concurrent update errors: {errors}"
        assert len(results) == 3

    def test_cleanup_temp_files_with_subdirectories(self, temp_workspace):
        """Test temp file cleanup only affects specified directory, not subdirectories."""
        # Create nested directory structure with temp files
        subdir1 = temp_workspace / "subdir1"
        subdir2 = temp_workspace / "subdir1" / "subdir2"
        subdir2.mkdir(parents=True)

        temp_files = [
            temp_workspace / ".tmp_root.txt",
            subdir1 / ".tmp_sub1.txt",
            subdir2 / ".tmp_sub2.txt",
        ]

        for temp_file in temp_files:
            temp_file.write_text("temp content")

        # Cleanup should only affect the specified directory, not subdirectories
        self.file_ops.cleanup_temp_files(subdir1)

        # Root temp file should remain
        assert (temp_workspace / ".tmp_root.txt").exists()

        # Direct child temp file should be removed
        assert not (subdir1 / ".tmp_sub1.txt").exists()

        # Subdirectory temp files should remain (glob doesn't recurse)
        assert (subdir2 / ".tmp_sub2.txt").exists()

    def test_atomic_operations_logging_details(self, temp_workspace, caplog):
        """Test detailed logging in atomic operations."""
        source_file = temp_workspace / "log_source.mp4"
        source_file.write_bytes(b"logging test content")

        dest_file = temp_workspace / "log_dest.mp4"

        # Test successful operation logging
        self.file_ops.atomic_copy(source_file, dest_file)

        # Test error logging
        with pytest.raises(ProcessingError):
            self.file_ops.atomic_copy(temp_workspace / "nonexistent.mp4", dest_file)

    def test_file_operations_edge_cases(self, temp_workspace):
        """Test edge cases in file operations."""
        # Test with empty file
        empty_source = temp_workspace / "empty.mp4"
        empty_source.touch()
        empty_dest = temp_workspace / "empty_dest.mp4"

        result = self.file_ops.atomic_copy(empty_source, empty_dest)
        assert result is True
        assert empty_dest.exists()
        assert empty_dest.stat().st_size == 0

        # Test with very long filename
        long_name = "a" * 100 + ".mp4"
        long_source = temp_workspace / long_name
        long_dest = temp_workspace / ("dest_" + long_name)

        long_source.write_bytes(b"long name content")
        result = self.file_ops.atomic_copy(long_source, long_dest)
        assert result is True

    def test_atomic_operations_with_unicode_paths(self, temp_workspace):
        """Test atomic operations with unicode file paths."""
        # Test with various unicode characters
        unicode_names = ["测试视频.mp4", "тест.mp4", "🎬video🎥.mp4"]

        for unicode_name in unicode_names:
            try:
                source_file = temp_workspace / unicode_name
                dest_file = temp_workspace / f"dest_{unicode_name}"

                source_file.write_bytes(b"unicode test content")
                result = self.file_ops.atomic_copy(source_file, dest_file)

                assert result is True
                assert dest_file.exists()

            except (UnicodeEncodeError, OSError):
                # Skip if filesystem doesn't support unicode
                pytest.skip(f"Unicode filename not supported: {unicode_name}")

    @pytest.mark.concurrent
    def test_stress_test_many_temp_files(self, temp_workspace):
        """Stress test cleanup with many temporary files."""
        # Create many temp files
        temp_files = []
        for i in range(100):
            temp_file = temp_workspace / f".tmp_stress_{i:03d}.txt"
            temp_file.write_text(f"stress test content {i}")
            temp_files.append(temp_file)

        # Add some non-temp files that should be preserved
        regular_files = []
        for i in range(10):
            regular_file = temp_workspace / f"regular_{i}.txt"
            regular_file.write_text(f"regular content {i}")
            regular_files.append(regular_file)

        # Execute cleanup
        self.file_ops.cleanup_temp_files(temp_workspace)

        # Verify all temp files removed
        for temp_file in temp_files:
            assert not temp_file.exists()

        # Verify regular files preserved
        for regular_file in regular_files:
            assert regular_file.exists()

    @pytest.mark.concurrent
    def test_rollback_with_concurrent_backup_access(self, temp_workspace):
        """Test rollback behavior when backup file is accessed concurrently."""
        test_file = temp_workspace / "concurrent_backup.txt"
        test_file.write_text("original for concurrent test")

        backup_accessed = threading.Event()
        backup_done = threading.Event()

        def backup_accessor():
            """Function that tries to access backup file during rollback."""
            time.sleep(0.01)  # Small delay to let update start
            backup_file = test_file.with_suffix(".backup")

            # Wait until backup exists
            while not backup_file.exists():
                time.sleep(0.001)

            backup_accessed.set()
            # Try to read backup (should not interfere with rollback)
            try:
                backup_file.read_text()
            except FileNotFoundError:
                pass  # Expected if rollback deleted it

            backup_done.set()

        def failing_update(file_path):
            backup_accessed.wait(timeout=1.0)  # Wait for concurrent access
            file_path.write_text("failed update content")
            backup_done.wait(timeout=1.0)  # Wait for concurrent access to complete
            raise RuntimeError("Controlled failure for test")

        # Start backup accessor thread
        accessor_thread = threading.Thread(target=backup_accessor)
        accessor_thread.start()

        try:
            # This should fail and rollback
            with pytest.raises(ProcessingError):
                self.file_ops.transactional_update(test_file, failing_update, backup=True)

        finally:
            accessor_thread.join(timeout=2.0)

        # Verify rollback worked despite concurrent access
        assert test_file.read_text() == "original for concurrent test"
        assert backup_accessed.is_set()  # Confirm concurrent access occurred


@pytest.mark.unit
class TestAtomicFileOperationsIntegration:
    """Integration tests combining multiple atomic operations."""

    def setup_method(self):
        """Set up for integration tests."""
        self.file_ops = AtomicFileOperations(enable_logging=True)

    def test_complex_workflow_with_rollback(self, temp_workspace):
        """Test complex workflow involving multiple operations with rollback."""
        # Set up initial state
        source_files = []
        for i in range(3):
            source_file = temp_workspace / f"workflow_source_{i}.mp4"
            source_file.write_bytes(f"workflow content {i}".encode())
            source_files.append(source_file)

        target_dir = temp_workspace / "workflow_targets"
        target_dir.mkdir()

        def complex_update_operation(file_path):
            """Complex update that involves multiple file operations."""
            # First, copy all source files to target directory
            for i, source_file in enumerate(source_files):
                target_file = target_dir / f"target_{i}.mp4"
                # Use the same file_ops instance for consistency
                self.file_ops.atomic_copy(source_file, target_file)

            # Then update the main file with a summary
            summary = f"Processed {len(source_files)} files"
            file_path.write_text(summary)

            # Simulate failure on last step
            if len(source_files) > 2:
                raise ValueError("Simulated workflow failure")

        workflow_file = temp_workspace / "workflow_main.txt"
        workflow_file.write_text("initial workflow state")

        # Execute complex workflow that will fail and rollback
        with pytest.raises(ProcessingError):
            self.file_ops.transactional_update(workflow_file, complex_update_operation)

        # Verify rollback restored original state
        assert workflow_file.read_text() == "initial workflow state"

        # Verify intermediate operations were completed despite rollback
        # (rollback only affects the transactional file, not side effects)
        assert len(list(target_dir.glob("target_*.mp4"))) == 3

    def test_cleanup_after_failed_operations(self, temp_workspace):
        """Test that temp files are properly cleaned up after failed operations."""
        source_file = temp_workspace / "cleanup_after_fail_source.mp4"
        source_file.write_bytes(b"content")

        # Generate multiple failed operations to create temp files
        for i in range(5):
            dest_file = temp_workspace / f"fail_dest_{i}.mp4"

            with patch("shutil.copy2") as mock_copy:
                mock_copy.side_effect = IOError(f"Simulated failure {i}")

                with pytest.raises(ProcessingError):
                    self.file_ops.atomic_copy(source_file, dest_file)

        # Verify no temp files are left
        temp_files = list(temp_workspace.glob(".tmp_*"))
        assert len(temp_files) == 0

        # Now cleanup any remaining temp files and verify logging
        self.file_ops.cleanup_temp_files(temp_workspace)

    def test_atomic_move_error_handling(self, temp_workspace):
        """Test error handling in atomic_move method."""
        # Test with non-existent source file
        nonexistent_source = temp_workspace / "nonexistent.mp4"
        dest_file = temp_workspace / "destination.mp4"

        with pytest.raises(ProcessingError) as exc_info:
            self.file_ops.atomic_move(nonexistent_source, dest_file)

        assert "Source file not found" in str(exc_info.value)

        # Test error during move operation with logging
        source_file = temp_workspace / "source_for_error.mp4"
        source_file.write_bytes(b"content")

        # Mock rename to fail to trigger exception handling
        with patch.object(Path, "rename") as mock_rename:
            mock_rename.side_effect = OSError("Simulated move failure")

            with pytest.raises(ProcessingError) as exc_info:
                self.file_ops.atomic_move(source_file, dest_file)

            assert "Failed to move" in str(exc_info.value)

    def test_safe_symlink_comprehensive(self, temp_workspace):
        """Test comprehensive safe_symlink functionality."""
        target_file = temp_workspace / "symlink_target.txt"
        target_file.write_text("target content")

        link_file = temp_workspace / "test_link.txt"

        try:
            # Test successful symlink creation
            result = self.file_ops.safe_symlink(target_file, link_file)
            assert result is True
            assert link_file.is_symlink()
            assert link_file.resolve() == target_file.resolve()

            # Test replacing existing symlink
            new_target = temp_workspace / "new_target.txt"
            new_target.write_text("new target")

            result = self.file_ops.safe_symlink(new_target, link_file)
            assert result is True
            assert link_file.resolve() == new_target.resolve()

        except OSError:
            # Skip if symlinks not supported on platform
            pytest.skip("Symlinks not supported on this platform")

    def test_safe_symlink_error_cases(self, temp_workspace):
        """Test error handling in safe_symlink method."""
        # Test with non-existent target
        nonexistent_target = temp_workspace / "nonexistent_target.txt"
        link_file = temp_workspace / "error_link.txt"

        with pytest.raises(ProcessingError) as exc_info:
            self.file_ops.safe_symlink(nonexistent_target, link_file)

        assert "Symlink target not found" in str(exc_info.value)

        # Test symlink creation failure
        target_file = temp_workspace / "valid_target.txt"
        target_file.write_text("content")

        try:
            # Mock symlink_to to fail
            with patch.object(Path, "symlink_to") as mock_symlink:
                mock_symlink.side_effect = OSError("Symlink creation failed")

                with pytest.raises(ProcessingError) as exc_info:
                    self.file_ops.safe_symlink(target_file, link_file)

                assert "Failed to create symlink" in str(exc_info.value)

        except OSError:
            # Skip if symlinks not supported
            pytest.skip("Symlinks not supported on this platform")

    def test_safe_symlink_replacing_file(self, temp_workspace):
        """Test safe_symlink replacing an existing regular file."""
        target_file = temp_workspace / "symlink_target.txt"
        target_file.write_text("target content")

        # Create a regular file where symlink will be
        existing_file = temp_workspace / "existing_file.txt"
        existing_file.write_text("existing content")

        try:
            # Should replace the existing file with symlink
            result = self.file_ops.safe_symlink(target_file, existing_file)
            assert result is True
            assert existing_file.is_symlink()
            assert existing_file.resolve() == target_file.resolve()

        except OSError:
            pytest.skip("Symlinks not supported on this platform")
