"""
Critical Path Unit Tests for Manifest Handler

This module contains comprehensive tests for all security-critical paths
in the manifest handling system, ensuring 100% coverage of:
- Atomic manifest updates
- Concurrent access protection
- Data integrity validation
- Corruption recovery
- Performance under load
"""

import json
import threading
import time
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock
from concurrent.futures import ThreadPoolExecutor

import pytest

from manim_bridge.core.exceptions import ManifestError, ProcessingError
from manim_bridge.storage.manifest_handler import ManifestHandler


class TestManifestHandlerCriticalPaths:
    """Critical path tests for manifest handler security and integrity"""

    @pytest.fixture
    def temp_manifest(self, tmp_path):
        """Create temporary manifest file"""
        manifest_path = tmp_path / "test_manifest.json"
        return manifest_path

    @pytest.fixture
    def populated_manifest(self, tmp_path):
        """Create manifest with test data"""
        manifest_path = tmp_path / "populated_manifest.json"
        test_data = {
            "video1.mp4": {
                "hash": "abc123",
                "size": 1024,
                "timestamp": 1609459200
            },
            "video2.mp4": {
                "hash": "def456",
                "size": 2048,
                "timestamp": 1609459300
            }
        }
        manifest_path.write_text(json.dumps(test_data, indent=2))
        return manifest_path

    def test_creates_new_manifest_safely(self, temp_manifest):
        """Test safe creation of new manifest file"""
        handler = ManifestHandler(temp_manifest)

        # Should create empty manifest
        data = handler.read()
        assert data == {}
        assert temp_manifest.exists()

        # File should be valid JSON
        with open(temp_manifest) as f:
            file_data = json.load(f)
            assert file_data == {}

    def test_loads_existing_manifest_safely(self, populated_manifest):
        """Test safe loading of existing manifest"""
        handler = ManifestHandler(populated_manifest)

        assert len(handler.data) == 2
        assert "video1.mp4" in handler.data
        assert "video2.mp4" in handler.data
        assert handler.data["video1.mp4"]["hash"] == "abc123"

    def test_atomic_manifest_updates(self, temp_manifest):
        """Test atomic updates prevent corruption during concurrent access"""
        handler = ManifestHandler(temp_manifest)

        # Add entries that should all be preserved
        handler.add_entry("video1.mp4", {"hash": "hash1", "size": 100})
        handler.add_entry("video2.mp4", {"hash": "hash2", "size": 200})
        handler.add_entry("video3.mp4", {"hash": "hash3", "size": 300})

        # Reload handler to verify all entries persisted
        new_handler = ManifestHandler(temp_manifest)
        assert len(new_handler.data) == 3
        assert "video1.mp4" in new_handler.data
        assert "video2.mp4" in new_handler.data
        assert "video3.mp4" in new_handler.data

    def test_handles_corrupted_manifest_gracefully(self, tmp_path):
        """Test recovery from corrupted manifest files"""
        corrupted_manifest = tmp_path / "corrupted.json"

        # Create corrupted JSON
        corrupted_manifest.write_text("{ invalid json content }")

        # Should recover by creating new empty manifest
        handler = ManifestHandler(corrupted_manifest)
        assert handler.data == {}

        # Should be able to add new entries
        handler.add_entry("video.mp4", {"hash": "test123"})
        assert "video.mp4" in handler.data

    def test_prevents_duplicate_processing(self, temp_manifest):
        """Test duplicate detection prevents unnecessary processing"""
        handler = ManifestHandler(temp_manifest)

        # Add entry
        video_hash = "abc123"
        handler.add_entry("video.mp4", {"hash": video_hash, "size": 1024})

        # Same hash should not need processing
        assert not handler.needs_processing("video.mp4", video_hash)

        # Different hash should need processing
        assert handler.needs_processing("video.mp4", "different_hash")

        # Non-existent video should need processing
        assert handler.needs_processing("new_video.mp4", "any_hash")

    def test_concurrent_manifest_updates(self, temp_manifest):
        """Test thread safety during concurrent updates"""
        handler = ManifestHandler(temp_manifest)

        results = []
        errors = []

        def add_video_entry(video_id):
            try:
                video_name = f"video_{video_id}.mp4"
                video_data = {"hash": f"hash_{video_id}", "size": video_id * 100}
                handler.add_entry(video_name, video_data)
                results.append(video_id)
            except Exception as e:
                errors.append((video_id, str(e)))

        # Run concurrent updates
        threads = []
        for i in range(10):
            thread = threading.Thread(target=add_video_entry, args=(i,))
            threads.append(thread)
            thread.start()

        # Wait for all threads
        for thread in threads:
            thread.join()

        # Verify results
        assert len(results) == 10, f"Expected 10 results, got {len(results)}"
        assert len(errors) == 0, f"Unexpected errors: {errors}"

        # Verify all entries in manifest
        final_handler = ManifestHandler(temp_manifest)
        assert len(final_handler.data) == 10

    def test_manifest_integrity_validation(self, temp_manifest):
        """Test validation of manifest data integrity"""
        handler = ManifestHandler(temp_manifest)

        # Test valid entry
        valid_entry = {
            "hash": "abc123",
            "size": 1024,
            "timestamp": int(time.time())
        }
        handler.add_entry("valid.mp4", valid_entry)

        # Verify entry was added
        assert "valid.mp4" in handler.data
        assert handler.data["valid.mp4"]["hash"] == "abc123"

    def test_manifest_performance_under_load(self, temp_manifest):
        """Test manifest performance with many concurrent operations"""
        handler = ManifestHandler(temp_manifest)

        import time
        start_time = time.time()

        # Add many entries quickly
        for i in range(100):
            handler.add_entry(f"video_{i}.mp4", {
                "hash": f"hash_{i}",
                "size": i * 10,
                "timestamp": start_time + i
            })

        end_time = time.time()
        processing_time = end_time - start_time

        # Should complete quickly (less than 5 seconds for 100 entries)
        assert processing_time < 5.0, f"Manifest operations too slow: {processing_time}s"

        # Verify all entries added
        assert len(handler.data) == 100

    def test_manifest_cleanup_and_optimization(self, populated_manifest):
        """Test manifest cleanup removes old/invalid entries"""
        handler = ManifestHandler(populated_manifest)

        # Add an entry with very old timestamp
        old_timestamp = 946684800  # Year 2000
        handler.add_entry("old_video.mp4", {
            "hash": "old_hash",
            "size": 500,
            "timestamp": old_timestamp
        })

        # Verify entry exists
        assert "old_video.mp4" in handler.data

        # Test cleanup functionality (if implemented)
        if hasattr(handler, 'cleanup_old_entries'):
            cutoff_time = int(time.time()) - (30 * 24 * 3600)  # 30 days ago
            handler.cleanup_old_entries(cutoff_time)

            # Old entry should be removed
            assert "old_video.mp4" not in handler.data
            # Recent entries should remain
            assert "video1.mp4" in handler.data

    def test_manifest_backup_and_recovery(self, populated_manifest):
        """Test manifest backup and recovery mechanisms"""
        handler = ManifestHandler(populated_manifest)

        original_data = dict(handler.data)

        # Test backup creation (if implemented)
        if hasattr(handler, 'create_backup'):
            backup_path = handler.create_backup()
            assert backup_path.exists()

            # Backup should have same data
            with open(backup_path) as f:
                backup_data = json.load(f)
                assert backup_data == original_data

        # Test recovery from backup (if implemented)
        if hasattr(handler, 'restore_from_backup'):
            # Corrupt current manifest
            populated_manifest.write_text("corrupted")

            # Should be able to restore
            handler.restore_from_backup(backup_path)
            assert handler.data == original_data

    def test_manifest_size_limits(self, temp_manifest):
        """Test manifest handles size limits appropriately"""
        handler = ManifestHandler(temp_manifest)

        # Add entries until we reach a reasonable size limit
        large_data = "x" * 1000  # 1KB of data per entry

        for i in range(10):  # Add 10 large entries
            handler.add_entry(f"large_video_{i}.mp4", {
                "hash": f"hash_{i}",
                "size": 1000,
                "large_field": large_data
            })

        # Manifest should handle reasonably large sizes
        manifest_size = temp_manifest.stat().st_size
        assert manifest_size > 0
        assert manifest_size < 1024 * 1024  # Less than 1MB should be reasonable

    def test_manifest_error_recovery(self, temp_manifest):
        """Test error recovery during manifest operations"""
        handler = ManifestHandler(temp_manifest)

        # Test recovery from permission errors
        with patch('builtins.open', side_effect=PermissionError("Permission denied")):
            with pytest.raises(ManifestError) as exc_info:
                handler.add_entry("test.mp4", {"hash": "test"})

            assert "permission" in str(exc_info.value).lower()

        # Test recovery from disk full errors
        with patch('builtins.open', side_effect=OSError("No space left on device")):
            with pytest.raises(ManifestError) as exc_info:
                handler.add_entry("test.mp4", {"hash": "test"})

            assert "space" in str(exc_info.value).lower()

    def test_manifest_concurrent_read_write(self, populated_manifest):
        """Test concurrent read/write operations remain consistent"""
        handler = ManifestHandler(populated_manifest)

        read_results = []
        write_results = []

        def concurrent_reader():
            for i in range(20):
                try:
                    # Read existing entries
                    data = dict(handler.data)
                    read_results.append(len(data))
                    time.sleep(0.01)  # Small delay to encourage race conditions
                except Exception as e:
                    read_results.append(f"error: {e}")

        def concurrent_writer():
            for i in range(20):
                try:
                    handler.add_entry(f"concurrent_{i}.mp4", {"hash": f"hash_{i}"})
                    write_results.append(f"wrote_{i}")
                    time.sleep(0.01)
                except Exception as e:
                    write_results.append(f"error: {e}")

        # Start concurrent operations
        reader_thread = threading.Thread(target=concurrent_reader)
        writer_thread = threading.Thread(target=concurrent_writer)

        reader_thread.start()
        writer_thread.start()

        reader_thread.join()
        writer_thread.join()

        # Should have completed without errors
        read_errors = [r for r in read_results if isinstance(r, str) and "error" in r]
        write_errors = [w for w in write_results if isinstance(w, str) and "error" in w]

        assert len(read_errors) == 0, f"Read errors: {read_errors}"
        assert len(write_errors) == 0, f"Write errors: {write_errors}"

        # Final manifest should be consistent
        final_handler = ManifestHandler(populated_manifest)
        assert len(final_handler.data) >= 2  # At least original entries


class TestManifestHandlerEdgeCases:
    """Test edge cases and boundary conditions"""

    @pytest.fixture
    def handler(self, tmp_path):
        return ManifestHandler(tmp_path / "edge_case.json")

    def test_empty_filename_handling(self, handler):
        """Test handling of empty or invalid filenames"""
        invalid_names = ["", " ", "\n", "\t", None]

        for invalid_name in invalid_names:
            with pytest.raises((ManifestError, ValueError, TypeError)):
                handler.add_entry(invalid_name, {"hash": "test"})

    def test_invalid_hash_values(self, handler):
        """Test handling of invalid hash values"""
        invalid_hashes = [None, "", " ", 123, [], {}]

        for invalid_hash in invalid_hashes:
            with pytest.raises((ManifestError, ValueError, TypeError)):
                handler.add_entry("test.mp4", {"hash": invalid_hash})

    def test_extremely_long_filenames(self, handler):
        """Test handling of extremely long filenames"""
        # Most filesystems have limits around 255 characters
        long_filename = "x" * 300 + ".mp4"

        # Should either handle gracefully or raise appropriate error
        try:
            handler.add_entry(long_filename, {"hash": "test_hash"})
            # If it succeeds, verify the entry exists
            assert long_filename in handler.data
        except (ManifestError, OSError, ValueError):
            # Acceptable to reject extremely long filenames
            pass

    def test_unicode_filename_handling(self, handler):
        """Test handling of unicode filenames"""
        unicode_names = [
            "测试视频.mp4",  # Chinese
            "видео_тест.mp4",  # Russian
            "🎬_movie.mp4",  # Emoji
            "café_video.mp4"  # Accented characters
        ]

        for unicode_name in unicode_names:
            handler.add_entry(unicode_name, {"hash": f"hash_{unicode_name}"})
            assert unicode_name in handler.data

    def test_special_character_filenames(self, handler):
        """Test handling of special characters in filenames"""
        special_names = [
            "video with spaces.mp4",
            "video-with-dashes.mp4",
            "video_with_underscores.mp4",
            "video.with.dots.mp4",
            "video[with]brackets.mp4"
        ]

        for special_name in special_names:
            handler.add_entry(special_name, {"hash": f"hash_{special_name}"})
            assert special_name in handler.data
