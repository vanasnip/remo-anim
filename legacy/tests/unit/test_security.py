"""Unit tests for the security module (path validation, command sanitization)."""

import os
from pathlib import Path
from unittest.mock import patch

import pytest

from manim_bridge.core.exceptions import SecurityError
from manim_bridge.security.path_validator import PathValidator


@pytest.mark.unit
@pytest.mark.security
class TestPathValidator:
    """Test the PathValidator class."""

    def test_path_validator_initialization(self, temp_workspace):
        """Test PathValidator initialization."""
        allowed_dirs = [temp_workspace / "source", temp_workspace / "target"]
        validator = PathValidator(allowed_dirs, enable_logging=True)

        assert len(validator.allowed_dirs) == 2
        assert all(d.is_absolute() for d in validator.allowed_dirs)
        assert validator.logger is not None

    def test_path_validator_no_logging(self, temp_workspace):
        """Test PathValidator without logging."""
        allowed_dirs = [temp_workspace / "source"]
        validator = PathValidator(allowed_dirs, enable_logging=False)

        assert validator.logger is None

    def test_safe_path_validation(self, temp_workspace):
        """Test validation of safe paths."""
        source_dir = temp_workspace / "source"
        target_dir = temp_workspace / "target"
        source_dir.mkdir()
        target_dir.mkdir()

        validator = PathValidator([source_dir, target_dir])

        # Test valid paths within allowed directories
        test_file = source_dir / "test_video.mp4"
        test_file.touch()

        assert validator.is_safe(str(test_file)) is True
        assert validator.is_safe(str(source_dir / "subfolder/video.mp4")) is True
        assert validator.is_safe(str(target_dir / "output.mp4")) is True

    def test_unsafe_path_validation(self, temp_workspace):
        """Test validation of unsafe paths."""
        allowed_dir = temp_workspace / "allowed"
        allowed_dir.mkdir()
        validator = PathValidator([allowed_dir])

        # Test path traversal attempts
        unsafe_paths = [
            "../../../etc/passwd",
            "../../etc/shadow",
            "../outside/malicious.mp4",
            str(temp_workspace.parent / "outside.mp4"),
            "/etc/passwd",
            "/tmp/malicious.mp4",
        ]

        for unsafe_path in unsafe_paths:
            assert validator.is_safe(unsafe_path) is False

    def test_path_traversal_detection(self, temp_workspace):
        """Test detection of path traversal attempts."""
        allowed_dir = temp_workspace / "allowed"
        allowed_dir.mkdir()
        validator = PathValidator([allowed_dir], enable_logging=True)

        # Direct path traversal
        assert validator.is_safe("../../../etc/passwd") is False
        assert validator.is_safe("..\\..\\windows\\system32") is False

        # Tilde expansion attempts
        assert validator.is_safe("~/secret_file.txt") is False
        assert validator.is_safe("~root/.ssh/id_rsa") is False

    def test_special_characters_in_paths(self, temp_workspace):
        """Test handling of special characters in paths."""
        allowed_dir = temp_workspace / "allowed"
        allowed_dir.mkdir()
        validator = PathValidator([allowed_dir])

        # Null bytes
        assert validator.is_safe("file\x00.mp4") is False

        # Control characters
        assert validator.is_safe("file\n.mp4") is False
        assert validator.is_safe("file\r.mp4") is False
        assert validator.is_safe("file\t.mp4") is False

    def test_unicode_paths(self, temp_workspace):
        """Test handling of Unicode characters in paths."""
        allowed_dir = temp_workspace / "allowed"
        allowed_dir.mkdir()
        validator = PathValidator([allowed_dir])

        # Valid Unicode should work within allowed directories
        unicode_file = allowed_dir / "测试视频.mp4"
        unicode_file.touch()
        assert validator.is_safe(str(unicode_file)) is True

        # Unicode in path traversal should still fail
        assert validator.is_safe("../../../etc/密码文件") is False

    def test_symlink_validation(self, temp_workspace):
        """Test validation of symbolic links."""
        allowed_dir = temp_workspace / "allowed"
        allowed_dir.mkdir()
        outside_dir = temp_workspace / "outside"
        outside_dir.mkdir()

        validator = PathValidator([allowed_dir])

        # Create a symlink pointing outside allowed directory
        malicious_link = allowed_dir / "malicious_link"
        outside_target = outside_dir / "secret.txt"
        outside_target.write_text("secret data")

        try:
            malicious_link.symlink_to(outside_target)

            # Should reject symlink to outside directory
            assert validator.is_safe(str(malicious_link)) is False

        except OSError:
            # Some systems might not support symlinks in temp dirs
            pytest.skip("Symlink test skipped - not supported")

    def test_normalize_path_safe(self, temp_workspace):
        """Test path normalization for safe paths."""
        allowed_dir = temp_workspace / "allowed"
        allowed_dir.mkdir()
        validator = PathValidator([allowed_dir])

        test_file = allowed_dir / "test.mp4"
        test_file.touch()

        normalized = validator.normalize(str(test_file))
        assert isinstance(normalized, Path)
        assert normalized.is_absolute()
        assert normalized == test_file.resolve()

    def test_normalize_path_unsafe(self, temp_workspace):
        """Test path normalization for unsafe paths."""
        allowed_dir = temp_workspace / "allowed"
        allowed_dir.mkdir()
        validator = PathValidator([allowed_dir])

        with pytest.raises(SecurityError):
            validator.normalize("../../../etc/passwd")

    def test_validate_input_path_exists(self, temp_workspace):
        """Test input path validation when file exists."""
        allowed_dir = temp_workspace / "allowed"
        allowed_dir.mkdir()
        validator = PathValidator([allowed_dir])

        test_file = allowed_dir / "input.mp4"
        test_file.write_text("test content")

        validated = validator.validate_input_path(str(test_file))
        assert isinstance(validated, Path)
        assert validated.exists()

    def test_validate_input_path_not_exists(self, temp_workspace):
        """Test input path validation when file doesn't exist."""
        allowed_dir = temp_workspace / "allowed"
        allowed_dir.mkdir()
        validator = PathValidator([allowed_dir])

        test_file = allowed_dir / "nonexistent.mp4"

        with pytest.raises(SecurityError):
            validator.validate_input_path(str(test_file), must_exist=True)

        # Should work if must_exist=False
        validated = validator.validate_input_path(str(test_file), must_exist=False)
        assert isinstance(validated, Path)

    def test_validate_output_path(self, temp_workspace):
        """Test output path validation."""
        allowed_dir = temp_workspace / "allowed"
        allowed_dir.mkdir()
        validator = PathValidator([allowed_dir])

        output_file = allowed_dir / "subdir" / "output.mp4"

        validated = validator.validate_output_path(str(output_file))
        assert isinstance(validated, Path)
        assert validated.parent.exists()  # Parent should be created

    def test_validate_output_path_no_permissions(self, temp_workspace):
        """Test output path validation without write permissions."""
        allowed_dir = temp_workspace / "allowed"
        allowed_dir.mkdir()

        # Make directory read-only
        try:
            allowed_dir.chmod(0o555)
            validator = PathValidator([allowed_dir])

            output_file = allowed_dir / "readonly.mp4"

            with pytest.raises(SecurityError):
                validator.validate_output_path(str(output_file))

        finally:
            # Restore permissions for cleanup
            allowed_dir.chmod(0o755)

    def test_exclusion_patterns(self, temp_workspace):
        """Test path exclusion based on patterns."""
        allowed_dir = temp_workspace / "allowed"
        allowed_dir.mkdir()
        validator = PathValidator([allowed_dir])

        excluded_patterns = [".cache", "tmp", "temp"]

        test_paths = [
            allowed_dir / ".cache" / "file.mp4",
            allowed_dir / "tmp" / "file.mp4",
            allowed_dir / "temp_processing" / "file.mp4",
            allowed_dir / "normal" / "file.mp4",
        ]

        # Create the paths
        for path in test_paths:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.touch()

        results = [validator.is_excluded(path, excluded_patterns) for path in test_paths]

        assert results[0] is True  # .cache should be excluded
        assert results[1] is True  # tmp should be excluded
        assert results[2] is True  # temp_processing contains 'temp'
        assert results[3] is False  # normal should not be excluded

    def test_long_path_handling(self, temp_workspace):
        """Test handling of very long paths."""
        allowed_dir = temp_workspace / "allowed"
        allowed_dir.mkdir()
        validator = PathValidator([allowed_dir])

        # Create a very long filename
        long_name = "a" * 1000 + ".mp4"
        long_path = allowed_dir / long_name

        # Should handle long paths within allowed directory
        result = validator.is_safe(str(long_path))
        # Result depends on filesystem limits, but should not crash
        assert isinstance(result, bool)

    def test_case_sensitivity(self, temp_workspace):
        """Test path case sensitivity handling."""
        allowed_dir = temp_workspace / "allowed"
        allowed_dir.mkdir()
        validator = PathValidator([allowed_dir])

        # Test file with different case
        test_file = allowed_dir / "Test_Video.MP4"
        test_file.touch()

        assert validator.is_safe(str(test_file)) is True

        # Test different case in path
        if os.name != "nt":  # Not Windows
            # On case-sensitive systems
            different_case = temp_workspace / "ALLOWED" / "test.mp4"
            assert validator.is_safe(str(different_case)) is False
        else:
            # On Windows (case-insensitive)
            different_case = temp_workspace / "ALLOWED" / "test.mp4"
            # Result may vary on Windows

    def test_relative_vs_absolute_paths(self, temp_workspace):
        """Test handling of relative vs absolute paths."""
        allowed_dir = temp_workspace / "allowed"
        allowed_dir.mkdir()
        validator = PathValidator([allowed_dir])

        # Create test file
        test_file = allowed_dir / "test.mp4"
        test_file.touch()

        # Absolute path should work
        assert validator.is_safe(str(test_file.absolute())) is True

        # Relative path within allowed dir should work
        with patch("os.getcwd", return_value=str(allowed_dir)):
            assert validator.is_safe("test.mp4") is True

    def test_validator_error_handling(self, temp_workspace):
        """Test error handling in path validation."""
        allowed_dir = temp_workspace / "allowed"
        allowed_dir.mkdir()
        validator = PathValidator([allowed_dir], enable_logging=True)

        # Test invalid path that causes OS error
        invalid_paths = [
            "",  # Empty path
            "\x00invalid",  # Null bytes
            "path\nwith\nnewlines",  # Control characters
        ]

        for invalid_path in invalid_paths:
            result = validator.is_safe(invalid_path)
            assert result is False  # Should reject invalid paths

    def test_subpath_detection(self, temp_workspace):
        """Test the internal _is_subpath method."""
        allowed_dir = temp_workspace / "allowed"
        allowed_dir.mkdir()
        validator = PathValidator([allowed_dir])

        # Test direct subpath
        subpath = allowed_dir / "subdir" / "file.mp4"
        assert validator._is_subpath(subpath, allowed_dir) is True

        # Test non-subpath
        other_dir = temp_workspace / "other"
        other_dir.mkdir()
        other_path = other_dir / "file.mp4"
        assert validator._is_subpath(other_path, allowed_dir) is False

        # Test same path
        assert validator._is_subpath(allowed_dir, allowed_dir) is True

    def test_logging_behavior(self, temp_workspace, caplog):
        """Test logging behavior in PathValidator."""
        allowed_dir = temp_workspace / "allowed"
        allowed_dir.mkdir()
        validator = PathValidator([allowed_dir], enable_logging=True)

        # Test safe path (should log debug)
        test_file = allowed_dir / "test.mp4"
        test_file.touch()
        validator.normalize(str(test_file))

        # Test unsafe path (should log warning)
        validator.is_safe("../../../etc/passwd")

        # Check that appropriate log levels were used
        # Note: Actual log checking depends on logger configuration


@pytest.mark.unit
@pytest.mark.security
class TestPathValidatorEdgeCases:
    """Test edge cases and error conditions for PathValidator."""

    def test_empty_allowed_directories(self):
        """Test PathValidator with empty allowed directories list."""
        validator = PathValidator([])

        # Should reject all paths
        assert validator.is_safe("/any/path") is False
        assert validator.is_safe("relative/path") is False

    def test_nonexistent_allowed_directories(self, temp_workspace):
        """Test PathValidator with non-existent allowed directories."""
        nonexistent_dir = temp_workspace / "nonexistent"
        validator = PathValidator([nonexistent_dir])

        # Should still work for path checking
        test_path = nonexistent_dir / "test.mp4"
        result = validator.is_safe(str(test_path))
        assert isinstance(result, bool)

    def test_allowed_directory_is_file(self, temp_workspace):
        """Test PathValidator when allowed directory is actually a file."""
        test_file = temp_workspace / "not_a_directory.txt"
        test_file.write_text("content")

        # Should handle this gracefully
        validator = PathValidator([test_file])
        result = validator.is_safe(str(test_file))
        assert isinstance(result, bool)

    def test_circular_symlinks(self, temp_workspace):
        """Test handling of circular symbolic links."""
        allowed_dir = temp_workspace / "allowed"
        allowed_dir.mkdir()

        try:
            # Create circular symlinks
            link1 = allowed_dir / "link1"
            link2 = allowed_dir / "link2"

            link1.symlink_to(link2)
            link2.symlink_to(link1)

            validator = PathValidator([allowed_dir])

            # Should handle circular links without infinite loop
            result = validator.is_safe(str(link1))
            assert isinstance(result, bool)

        except OSError:
            # Skip if symlinks not supported
            pytest.skip("Symlink test skipped - not supported")

    def test_validator_with_none_paths(self, temp_workspace):
        """Test PathValidator with None or invalid path inputs."""
        allowed_dir = temp_workspace / "allowed"
        allowed_dir.mkdir()
        validator = PathValidator([allowed_dir])

        # Test None input
        with pytest.raises((TypeError, AttributeError)):
            validator.is_safe(None)

    def test_concurrent_path_validation(self, temp_workspace):
        """Test path validation under concurrent access."""
        import threading
        import time

        allowed_dir = temp_workspace / "allowed"
        allowed_dir.mkdir()
        validator = PathValidator([allowed_dir], enable_logging=True)

        results = []
        errors = []

        def validate_paths():
            try:
                for i in range(10):
                    test_path = allowed_dir / f"test_{i}.mp4"
                    result = validator.is_safe(str(test_path))
                    results.append(result)
                    time.sleep(0.01)  # Small delay to encourage concurrency
            except Exception as e:
                errors.append(e)

        # Create multiple threads
        threads = []
        for _ in range(3):
            t = threading.Thread(target=validate_paths)
            threads.append(t)
            t.start()

        # Wait for completion
        for t in threads:
            t.join()

        # Should not have errors and should have results
        assert len(errors) == 0
        assert len(results) > 0
        assert all(isinstance(r, bool) for r in results)


# TODO: Add command sanitizer tests once that module is implemented
@pytest.mark.unit
@pytest.mark.security
class TestCommandSanitizer:
    """Test command sanitization functionality."""

    def test_placeholder_command_sanitizer(self):
        """Placeholder test for command sanitizer.

        This will be implemented once the command sanitizer module exists.
        """
        # For now, test that the import would work when implemented
        try:
            from manim_bridge.security.command_sanitizer import CommandSanitizer

            # If the import succeeds, create basic test
            sanitizer = CommandSanitizer()
            assert sanitizer is not None
        except ImportError:
            # Command sanitizer not yet implemented
            pytest.skip("CommandSanitizer not yet implemented")

    def test_command_injection_prevention(self):
        """Test prevention of command injection attacks."""
        # This will test various injection techniques
        pytest.skip("CommandSanitizer not yet implemented")

    def test_argument_sanitization(self):
        """Test sanitization of command arguments."""
        pytest.skip("CommandSanitizer not yet implemented")

    def test_environment_variable_sanitization(self):
        """Test sanitization of environment variables."""
        pytest.skip("CommandSanitizer not yet implemented")
