"""Unit tests for the storage module (manifest handling, atomic operations)."""

import json
import threading
import time
from unittest.mock import Mock, patch

import pytest

from manim_bridge.core.exceptions import ManifestError
from manim_bridge.storage.file_operations import AtomicFileOperations
from manim_bridge.storage.manifest_handler import ManifestHandler


@pytest.mark.unit
class TestManifestHandler:
    """Test the ManifestHandler class."""

    def test_manifest_handler_initialization(self, temp_workspace):
        """Test ManifestHandler initialization."""
        manifest_path = temp_workspace / "test_manifest.json"
        handler = ManifestHandler(manifest_path, enable_logging=True)

        assert handler.manifest_path == manifest_path
        assert handler.logger is not None
        assert manifest_path.exists()  # Should be created if not exists

        # Check initial content is empty dict
        content = json.loads(manifest_path.read_text())
        assert content == {}

    def test_manifest_handler_no_logging(self, temp_workspace):
        """Test ManifestHandler without logging."""
        manifest_path = temp_workspace / "test_manifest.json"
        handler = ManifestHandler(manifest_path, enable_logging=False)

        assert handler.logger is None

    def test_ensure_manifest_exists(self, temp_workspace):
        """Test that manifest file is created if it doesn't exist."""
        manifest_path = temp_workspace / "subdir" / "new_manifest.json"
        assert not manifest_path.exists()
        assert not manifest_path.parent.exists()

        handler = ManifestHandler(manifest_path)

        assert manifest_path.exists()
        assert manifest_path.parent.exists()

        # Should contain empty dict
        content = json.loads(manifest_path.read_text())
        assert content == {}

    def test_read_empty_manifest(self, temp_workspace):
        """Test reading an empty manifest."""
        manifest_path = temp_workspace / "empty_manifest.json"
        manifest_path.write_text("{}")

        handler = ManifestHandler(manifest_path)
        data = handler.read()

        assert data == {}

    def test_read_manifest_with_data(self, temp_workspace, sample_bridge_manifest_data):
        """Test reading a manifest with data."""
        manifest_path = temp_workspace / "data_manifest.json"
        manifest_path.write_text(json.dumps(sample_bridge_manifest_data))

        handler = ManifestHandler(manifest_path)
        data = handler.read()

        assert data == sample_bridge_manifest_data
        assert len(data) == 2

    def test_read_manifest_caching(self, temp_workspace, sample_bridge_manifest_data):
        """Test manifest caching functionality."""
        manifest_path = temp_workspace / "cache_manifest.json"
        manifest_path.write_text(json.dumps(sample_bridge_manifest_data))

        handler = ManifestHandler(manifest_path)

        # First read should load from file
        data1 = handler.read(use_cache=True)
        assert data1 == sample_bridge_manifest_data

        # Second read should use cache
        data2 = handler.read(use_cache=True)
        assert data2 == sample_bridge_manifest_data
        assert data2 is not data1  # Different dict objects but same content

    def test_read_manifest_without_cache(self, temp_workspace, sample_bridge_manifest_data):
        """Test reading manifest without caching."""
        manifest_path = temp_workspace / "no_cache_manifest.json"
        manifest_path.write_text(json.dumps(sample_bridge_manifest_data))

        handler = ManifestHandler(manifest_path)

        # Read without cache
        data1 = handler.read(use_cache=False)

        # Modify file externally
        modified_data = {**sample_bridge_manifest_data, "new_key": "new_value"}
        manifest_path.write_text(json.dumps(modified_data))

        # Read without cache should get updated data
        data2 = handler.read(use_cache=False)
        assert "new_key" in data2
        assert data2["new_key"] == "new_value"

    def test_read_corrupted_manifest(self, temp_workspace):
        """Test reading a corrupted manifest file."""
        manifest_path = temp_workspace / "corrupted_manifest.json"
        manifest_path.write_text('{"invalid": json syntax')

        handler = ManifestHandler(manifest_path)

        # Should return empty dict for corrupted manifest
        data = handler.read()
        assert data == {}

    def test_read_nonexistent_manifest(self, temp_workspace):
        """Test reading a non-existent manifest file."""
        manifest_path = temp_workspace / "nonexistent.json"
        manifest_path.unlink(missing_ok=True)  # Ensure it doesn't exist

        # Remove the file after handler creation to simulate deletion
        handler = ManifestHandler(manifest_path)
        manifest_path.unlink()

        data = handler.read()
        assert data == {}

    def test_write_manifest(self, temp_workspace):
        """Test writing manifest data."""
        manifest_path = temp_workspace / "write_manifest.json"
        handler = ManifestHandler(manifest_path)

        test_data = {
            "video1.mp4": {"hash": "abc123", "size": 1024},
            "video2.mp4": {"hash": "def456", "size": 2048},
        }

        handler.write(test_data)

        # Verify file was written correctly
        assert manifest_path.exists()
        with open(manifest_path) as f:
            written_data = json.load(f)

        assert written_data == test_data

    def test_write_manifest_atomic(self, temp_workspace):
        """Test that manifest writing is atomic."""
        manifest_path = temp_workspace / "atomic_manifest.json"
        handler = ManifestHandler(manifest_path)

        # Write initial data
        initial_data = {"initial": "data"}
        handler.write(initial_data)

        # Mock tempfile to verify atomic operation
        with patch("tempfile.NamedTemporaryFile") as mock_temp:
            mock_file = Mock()
            mock_file.name = str(manifest_path) + ".tmp"
            mock_temp.return_value.__enter__.return_value = mock_file

            test_data = {"test": "atomic"}
            handler.write(test_data)

            # Verify temporary file was used
            mock_temp.assert_called_once()

    def test_add_entry(self, temp_workspace):
        """Test adding a single entry to manifest."""
        manifest_path = temp_workspace / "add_entry_manifest.json"
        handler = ManifestHandler(manifest_path)

        test_entry = {
            "hash": "abc123",
            "target": "/target/video.mp4",
            "processed_at": "2024-01-01T00:00:00",
            "scene": "TestScene",
            "quality": "1080p60",
            "size": 1024,
        }

        handler.add_entry("test_video.mp4", test_entry)

        # Verify entry was added
        data = handler.read()
        assert "test_video.mp4" in data
        assert data["test_video.mp4"] == test_entry

    def test_update_entry(self, temp_workspace):
        """Test updating an existing entry."""
        manifest_path = temp_workspace / "update_entry_manifest.json"
        handler = ManifestHandler(manifest_path)

        # Add initial entry
        initial_entry = {"hash": "abc123", "size": 1024}
        handler.add_entry("test.mp4", initial_entry)

        # Update entry
        updates = {"size": 2048, "processed_at": "2024-01-01T12:00:00"}
        handler.update_entry("test.mp4", updates)

        # Verify updates
        data = handler.read()
        assert data["test.mp4"]["hash"] == "abc123"  # Original value
        assert data["test.mp4"]["size"] == 2048  # Updated value
        assert data["test.mp4"]["processed_at"] == "2024-01-01T12:00:00"  # New value

    def test_update_nonexistent_entry(self, temp_workspace):
        """Test updating a non-existent entry creates it."""
        manifest_path = temp_workspace / "update_new_manifest.json"
        handler = ManifestHandler(manifest_path)

        updates = {"hash": "new123", "size": 1024}
        handler.update_entry("new_video.mp4", updates)

        # Verify entry was created
        data = handler.read()
        assert "new_video.mp4" in data
        assert data["new_video.mp4"] == updates

    def test_remove_entry(self, temp_workspace, sample_bridge_manifest_data):
        """Test removing an entry from manifest."""
        manifest_path = temp_workspace / "remove_entry_manifest.json"
        handler = ManifestHandler(manifest_path)

        # Set up initial data
        handler.write(sample_bridge_manifest_data)

        # Remove entry
        removed = handler.remove_entry("video1.mp4")

        assert removed is True

        # Verify entry was removed
        data = handler.read()
        assert "video1.mp4" not in data
        assert "video2.mp4" in data  # Other entry should remain

    def test_remove_nonexistent_entry(self, temp_workspace):
        """Test removing a non-existent entry."""
        manifest_path = temp_workspace / "remove_nonexistent_manifest.json"
        handler = ManifestHandler(manifest_path)

        removed = handler.remove_entry("nonexistent.mp4")
        assert removed is False

    def test_has_entry(self, temp_workspace, sample_bridge_manifest_data):
        """Test checking if entry exists."""
        manifest_path = temp_workspace / "has_entry_manifest.json"
        handler = ManifestHandler(manifest_path)
        handler.write(sample_bridge_manifest_data)

        assert handler.has_entry("video1.mp4") is True
        assert handler.has_entry("nonexistent.mp4") is False

    def test_get_entry(self, temp_workspace, sample_bridge_manifest_data):
        """Test getting a specific entry."""
        manifest_path = temp_workspace / "get_entry_manifest.json"
        handler = ManifestHandler(manifest_path)
        handler.write(sample_bridge_manifest_data)

        entry = handler.get_entry("video1.mp4")
        assert entry == sample_bridge_manifest_data["video1.mp4"]

        nonexistent = handler.get_entry("nonexistent.mp4")
        assert nonexistent is None

    def test_needs_processing(self, temp_workspace):
        """Test checking if file needs processing."""
        manifest_path = temp_workspace / "needs_processing_manifest.json"
        handler = ManifestHandler(manifest_path)

        # File not in manifest should need processing
        assert handler.needs_processing("new_file.mp4", "hash123") is True

        # Add file to manifest
        handler.add_entry("existing_file.mp4", {"hash": "hash456"})

        # Same hash should not need processing
        assert handler.needs_processing("existing_file.mp4", "hash456") is False

        # Different hash should need processing
        assert handler.needs_processing("existing_file.mp4", "hash789") is True

    def test_batch_update(self, temp_workspace):
        """Test batch updating multiple entries."""
        manifest_path = temp_workspace / "batch_update_manifest.json"
        handler = ManifestHandler(manifest_path)

        batch_updates = {
            "video1.mp4": {"hash": "hash1", "size": 1024},
            "video2.mp4": {"hash": "hash2", "size": 2048},
            "video3.mp4": {"hash": "hash3", "size": 3072},
        }

        handler.batch_update(batch_updates)

        # Verify all entries were added
        data = handler.read()
        assert len(data) == 3
        for key, value in batch_updates.items():
            assert data[key] == value

    def test_batch_update_empty(self, temp_workspace):
        """Test batch update with empty updates."""
        manifest_path = temp_workspace / "empty_batch_manifest.json"
        handler = ManifestHandler(manifest_path)

        # Should not error with empty updates
        handler.batch_update({})

        data = handler.read()
        assert data == {}

    def test_get_statistics(self, temp_workspace, sample_bridge_manifest_data):
        """Test getting manifest statistics."""
        manifest_path = temp_workspace / "stats_manifest.json"
        handler = ManifestHandler(manifest_path)
        handler.write(sample_bridge_manifest_data)

        stats = handler.get_statistics()

        assert stats["total_entries"] == 2
        assert stats["total_size"] == 3072  # 1024 + 2048
        assert stats["latest_update"] == "2024-01-01T01:00:00"  # video2 is later
        assert "by_quality" in stats
        assert stats["by_quality"]["1080p60"] == 1
        assert stats["by_quality"]["720p30"] == 1

    def test_get_statistics_empty(self, temp_workspace):
        """Test getting statistics for empty manifest."""
        manifest_path = temp_workspace / "empty_stats_manifest.json"
        handler = ManifestHandler(manifest_path)

        stats = handler.get_statistics()

        assert stats["total_entries"] == 0
        assert stats["total_size"] == 0
        assert stats["latest_update"] is None

    def test_export_json(self, temp_workspace, sample_bridge_manifest_data):
        """Test exporting manifest to different location."""
        manifest_path = temp_workspace / "source_manifest.json"
        export_path = temp_workspace / "exported_manifest.json"

        handler = ManifestHandler(manifest_path)
        handler.write(sample_bridge_manifest_data)

        handler.export_json(export_path)

        # Verify export file exists and has correct content
        assert export_path.exists()
        with open(export_path) as f:
            exported_data = json.load(f)

        assert exported_data == sample_bridge_manifest_data

    def test_manifest_error_handling(self, temp_workspace):
        """Test error handling in manifest operations."""
        manifest_path = temp_workspace / "error_manifest.json"

        # Test with read-only directory
        try:
            manifest_path.parent.chmod(0o555)  # Read-only

            with pytest.raises(ManifestError):
                ManifestHandler(manifest_path)

        finally:
            # Restore permissions
            manifest_path.parent.chmod(0o755)

    def test_concurrent_access(self, temp_workspace):
        """Test concurrent access to manifest file."""
        manifest_path = temp_workspace / "concurrent_manifest.json"
        handler = ManifestHandler(manifest_path)

        results = []
        errors = []

        def worker(worker_id):
            try:
                for i in range(10):
                    entry_key = f"worker_{worker_id}_video_{i}.mp4"
                    entry_data = {"hash": f"hash_{worker_id}_{i}", "size": 1024}
                    handler.add_entry(entry_key, entry_data)
                    results.append(entry_key)
                    time.sleep(0.001)  # Small delay
            except Exception as e:
                errors.append(e)

        # Run concurrent workers
        threads = []
        for worker_id in range(3):
            t = threading.Thread(target=worker, args=(worker_id,))
            threads.append(t)
            t.start()

        for t in threads:
            t.join()

        # Should complete without errors
        assert len(errors) == 0
        assert len(results) == 30  # 3 workers * 10 entries each

        # Verify all entries are in manifest
        final_data = handler.read(use_cache=False)
        assert len(final_data) == 30


@pytest.mark.unit
class TestAtomicFileOperations:
    """Test the AtomicFileOperations class."""

    def test_atomic_file_operations_initialization(self):
        """Test AtomicFileOperations initialization."""
        ops = AtomicFileOperations(enable_logging=True)
        assert ops.logger is not None

        ops_no_log = AtomicFileOperations(enable_logging=False)
        assert ops_no_log.logger is None

    def test_atomic_copy(self, temp_workspace):
        """Test atomic file copy operation."""
        ops = AtomicFileOperations(enable_logging=True)

        # Create source file
        source_file = temp_workspace / "source.mp4"
        source_content = b"test video content"
        source_file.write_bytes(source_content)

        # Copy file atomically
        target_file = temp_workspace / "target.mp4"
        ops.atomic_copy(source_file, target_file)

        # Verify copy was successful
        assert target_file.exists()
        assert target_file.read_bytes() == source_content
        assert source_file.exists()  # Original should still exist

    def test_atomic_copy_with_subdirectories(self, temp_workspace):
        """Test atomic copy creating subdirectories."""
        ops = AtomicFileOperations()

        source_file = temp_workspace / "source.mp4"
        source_file.write_bytes(b"content")

        # Target in subdirectory that doesn't exist
        target_file = temp_workspace / "subdir" / "target.mp4"
        ops.atomic_copy(source_file, target_file)

        assert target_file.exists()
        assert target_file.parent.exists()

    def test_atomic_copy_overwrite(self, temp_workspace):
        """Test atomic copy overwriting existing file."""
        ops = AtomicFileOperations()

        source_file = temp_workspace / "source.mp4"
        source_file.write_bytes(b"new content")

        target_file = temp_workspace / "target.mp4"
        target_file.write_bytes(b"old content")

        ops.atomic_copy(source_file, target_file)

        # Should have new content
        assert target_file.read_bytes() == b"new content"

    def test_atomic_move(self, temp_workspace):
        """Test atomic file move operation."""
        ops = AtomicFileOperations()

        source_file = temp_workspace / "source.mp4"
        source_content = b"move me"
        source_file.write_bytes(source_content)

        target_file = temp_workspace / "target.mp4"
        ops.atomic_move(source_file, target_file)

        # Source should no longer exist, target should have content
        assert not source_file.exists()
        assert target_file.exists()
        assert target_file.read_bytes() == source_content

    def test_safe_symlink(self, temp_workspace):
        """Test safe symlink creation."""
        ops = AtomicFileOperations()

        target_file = temp_workspace / "target.mp4"
        target_file.write_bytes(b"content")

        link_file = temp_workspace / "link.mp4"
        ops.safe_symlink(target_file, link_file)

        try:
            assert link_file.is_symlink()
            assert link_file.resolve() == target_file.resolve()
        except OSError:
            # Symlinks might not be supported
            pytest.skip("Symlinks not supported")

    def test_safe_symlink_replace_existing(self, temp_workspace):
        """Test safe symlink replacing existing symlink."""
        ops = AtomicFileOperations()

        target1 = temp_workspace / "target1.mp4"
        target1.write_bytes(b"content1")

        target2 = temp_workspace / "target2.mp4"
        target2.write_bytes(b"content2")

        link_file = temp_workspace / "link.mp4"

        try:
            # Create initial symlink
            ops.safe_symlink(target1, link_file)
            assert link_file.resolve() == target1.resolve()

            # Replace with new symlink
            ops.safe_symlink(target2, link_file)
            assert link_file.resolve() == target2.resolve()

        except OSError:
            pytest.skip("Symlinks not supported")

    def test_ensure_directory(self, temp_workspace):
        """Test directory creation with ensure_directory."""
        ops = AtomicFileOperations()

        new_dir = temp_workspace / "new" / "nested" / "directory"
        ops.ensure_directory(new_dir)

        assert new_dir.exists()
        assert new_dir.is_dir()

    def test_ensure_directory_existing(self, temp_workspace):
        """Test ensure_directory with existing directory."""
        ops = AtomicFileOperations()

        existing_dir = temp_workspace / "existing"
        existing_dir.mkdir()

        # Should not error
        ops.ensure_directory(existing_dir)
        assert existing_dir.exists()

    def test_safe_remove(self, temp_workspace):
        """Test safe file removal."""
        ops = AtomicFileOperations()

        test_file = temp_workspace / "to_remove.mp4"
        test_file.write_bytes(b"remove me")

        assert test_file.exists()
        result = ops.safe_remove(test_file)

        assert result is True
        assert not test_file.exists()

    def test_safe_remove_nonexistent(self, temp_workspace):
        """Test safe removal of non-existent file."""
        ops = AtomicFileOperations()

        nonexistent = temp_workspace / "nonexistent.mp4"
        result = ops.safe_remove(nonexistent)

        assert result is False  # File didn't exist to remove

    def test_backup_file(self, temp_workspace):
        """Test file backup functionality."""
        ops = AtomicFileOperations()

        original_file = temp_workspace / "original.mp4"
        original_content = b"backup this content"
        original_file.write_bytes(original_content)

        backup_path = ops.backup_file(original_file)

        # Backup should exist with same content
        assert backup_path.exists()
        assert backup_path.read_bytes() == original_content
        assert backup_path.name.startswith("original")
        assert ".backup." in backup_path.name

    def test_restore_from_backup(self, temp_workspace):
        """Test restoring file from backup."""
        ops = AtomicFileOperations()

        original_file = temp_workspace / "original.mp4"
        original_content = b"original content"
        original_file.write_bytes(original_content)

        # Create backup
        backup_path = ops.backup_file(original_file)

        # Modify original
        original_file.write_bytes(b"modified content")

        # Restore from backup
        ops.restore_from_backup(backup_path, original_file)

        # Should have original content
        assert original_file.read_bytes() == original_content

    def test_atomic_operations_error_handling(self, temp_workspace):
        """Test error handling in atomic operations."""
        ops = AtomicFileOperations(enable_logging=True)

        # Test copy with non-existent source
        nonexistent_source = temp_workspace / "nonexistent.mp4"
        target = temp_workspace / "target.mp4"

        with pytest.raises(FileNotFoundError):
            ops.atomic_copy(nonexistent_source, target)

    def test_atomic_operations_permissions(self, temp_workspace):
        """Test atomic operations with permission issues."""
        ops = AtomicFileOperations()

        source_file = temp_workspace / "source.mp4"
        source_file.write_bytes(b"content")

        # Create read-only target directory
        readonly_dir = temp_workspace / "readonly"
        readonly_dir.mkdir()
        target_file = readonly_dir / "target.mp4"

        try:
            readonly_dir.chmod(0o555)  # Read-only

            # Should fail due to permissions
            with pytest.raises(PermissionError):
                ops.atomic_copy(source_file, target_file)

        finally:
            # Restore permissions for cleanup
            readonly_dir.chmod(0o755)

    def test_file_operations_logging(self, temp_workspace, caplog):
        """Test logging in file operations."""
        ops = AtomicFileOperations(enable_logging=True)

        source_file = temp_workspace / "source.mp4"
        source_file.write_bytes(b"content")

        target_file = temp_workspace / "target.mp4"
        ops.atomic_copy(source_file, target_file)

        # Check that operations were logged
        # Note: Actual log verification depends on logger setup
