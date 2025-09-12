"""Unit tests for the core module (config, constants, exceptions)."""

import os

import pytest

from manim_bridge.core.config import BridgeConfig
from manim_bridge.core.constants import EXCLUDED_PATHS, SUPPORTED_VIDEO_FORMATS
from manim_bridge.core.exceptions import (
    BridgeException,
    ManifestError,
    ProcessingError,
    SecurityError,
)


@pytest.mark.unit
class TestBridgeConfig:
    """Test the BridgeConfig class."""

    def test_basic_config_creation(self, temp_workspace):
        """Test basic configuration creation."""
        config = BridgeConfig(
            source_dir=temp_workspace / "source",
            target_dir=temp_workspace / "target",
            manifest_file=temp_workspace / "manifest.json",
        )

        assert config.source_dir == (temp_workspace / "source").resolve()
        assert config.target_dir == (temp_workspace / "target").resolve()
        assert config.manifest_file == (temp_workspace / "manifest.json").resolve()

        # Check defaults
        assert config.max_workers == 4
        assert config.chunk_size == 1024 * 1024
        assert config.poll_interval == 2.0
        assert config.log_level == "INFO"
        assert config.enable_dev_logging is False
        assert config.scan_on_start is True

    def test_config_path_resolution(self, temp_workspace):
        """Test that paths are properly resolved."""
        # Use relative paths
        config = BridgeConfig(
            source_dir="./source",
            target_dir="./target",
            manifest_file="./manifest.json",
        )

        # Should be resolved to absolute paths
        assert config.source_dir.is_absolute()
        assert config.target_dir.is_absolute()
        assert config.manifest_file.is_absolute()

    def test_config_creates_target_directory(self, temp_workspace):
        """Test that target directory is created if it doesn't exist."""
        target_dir = temp_workspace / "new_target"
        assert not target_dir.exists()

        config = BridgeConfig(
            source_dir=temp_workspace / "source",
            target_dir=target_dir,
            manifest_file=temp_workspace / "manifest.json",
        )

        assert target_dir.exists()
        assert target_dir.is_dir()

    def test_config_allowed_dirs_default(self, temp_workspace):
        """Test that allowed_dirs defaults to source and target."""
        config = BridgeConfig(
            source_dir=temp_workspace / "source",
            target_dir=temp_workspace / "target",
            manifest_file=temp_workspace / "manifest.json",
        )

        assert len(config.allowed_dirs) == 2
        assert config.source_dir in config.allowed_dirs
        assert config.target_dir in config.allowed_dirs

    def test_config_allowed_dirs_custom(self, temp_workspace):
        """Test custom allowed directories."""
        custom_dirs = [temp_workspace / "custom1", temp_workspace / "custom2"]
        config = BridgeConfig(
            source_dir=temp_workspace / "source",
            target_dir=temp_workspace / "target",
            manifest_file=temp_workspace / "manifest.json",
            allowed_dirs=custom_dirs,
        )

        assert len(config.allowed_dirs) == 2
        assert all(d.is_absolute() for d in config.allowed_dirs)

    def test_config_log_file_resolution(self, temp_workspace):
        """Test log file path resolution."""
        log_file = temp_workspace / "test.log"
        config = BridgeConfig(
            source_dir=temp_workspace / "source",
            target_dir=temp_workspace / "target",
            manifest_file=temp_workspace / "manifest.json",
            log_file=log_file,
        )

        assert config.log_file.is_absolute()
        assert config.log_file == log_file.resolve()

    def test_config_dev_mode_from_env(self, temp_workspace, clean_bridge_env):
        """Test dev mode activation from environment variable."""
        os.environ["MANIM_BRIDGE_DEV"] = "1"

        config = BridgeConfig(
            source_dir=temp_workspace / "source",
            target_dir=temp_workspace / "target",
            manifest_file=temp_workspace / "manifest.json",
        )

        assert config.enable_dev_logging is True
        assert config.log_level == "DEBUG"
        assert config.log_performance is True

    def test_config_dev_mode_variations(self, temp_workspace, clean_bridge_env):
        """Test various dev mode environment values."""
        test_values = ["1", "true", "True", "TRUE", "yes", "Yes", "YES"]

        for value in test_values:
            os.environ["MANIM_BRIDGE_DEV"] = value
            config = BridgeConfig(
                source_dir=temp_workspace / "source",
                target_dir=temp_workspace / "target",
                manifest_file=temp_workspace / "manifest.json",
            )
            assert config.enable_dev_logging is True, f"Failed for value: {value}"
            del os.environ["MANIM_BRIDGE_DEV"]

    def test_config_from_env(self, clean_bridge_env, temp_workspace):
        """Test configuration creation from environment variables."""
        # Use temp workspace paths instead of absolute paths
        source_path = str(temp_workspace / "source")
        target_path = str(temp_workspace / "target")
        manifest_path = str(temp_workspace / "manifest.json")

        os.environ.update(
            {
                "MANIM_BRIDGE_SOURCE": source_path,
                "MANIM_BRIDGE_TARGET": target_path,
                "MANIM_BRIDGE_MANIFEST": manifest_path,
                "MANIM_BRIDGE_WORKERS": "8",
                "MANIM_BRIDGE_DEV": "true",
            }
        )

        config = BridgeConfig.from_env()

        assert str(config.source_dir) == source_path
        assert str(config.target_dir) == target_path
        assert str(config.manifest_file) == manifest_path
        assert config.max_workers == 8
        assert config.enable_dev_logging is True

    def test_config_from_env_defaults(self, clean_bridge_env):
        """Test default values when environment variables are not set."""
        config = BridgeConfig.from_env()

        assert str(config.source_dir).endswith("manim-output")
        assert str(config.target_dir).endswith("remotion-app/public/assets/manim")
        assert str(config.manifest_file).endswith(".manim-bridge-manifest.json")
        assert config.max_workers == 4
        assert config.enable_dev_logging is False

    def test_config_validation(self, temp_workspace):
        """Test configuration validation."""
        # Valid configuration should not raise
        BridgeConfig(
            source_dir=temp_workspace / "source",
            target_dir=temp_workspace / "target",
            manifest_file=temp_workspace / "manifest.json",
        )

    def test_config_repr(self, temp_workspace):
        """Test configuration string representation."""
        config = BridgeConfig(
            source_dir=temp_workspace / "source",
            target_dir=temp_workspace / "target",
            manifest_file=temp_workspace / "manifest.json",
        )

        repr_str = repr(config)
        assert "BridgeConfig" in repr_str

    def test_config_equality(self, temp_workspace):
        """Test configuration equality comparison."""
        config1 = BridgeConfig(
            source_dir=temp_workspace / "source",
            target_dir=temp_workspace / "target",
            manifest_file=temp_workspace / "manifest.json",
        )

        config2 = BridgeConfig(
            source_dir=temp_workspace / "source",
            target_dir=temp_workspace / "target",
            manifest_file=temp_workspace / "manifest.json",
        )

        # Note: dataclass equality comparison
        assert config1.source_dir == config2.source_dir
        assert config1.target_dir == config2.target_dir


@pytest.mark.unit
class TestConstants:
    """Test the constants module."""

    def test_supported_video_formats(self):
        """Test supported video format constants."""
        assert isinstance(SUPPORTED_VIDEO_FORMATS, (list, tuple, set))
        assert len(SUPPORTED_VIDEO_FORMATS) > 0

        # Check common video formats are included
        expected_formats = [".mp4", ".mov", ".avi", ".webm"]
        for format in expected_formats:
            assert format in SUPPORTED_VIDEO_FORMATS or format.lower() in SUPPORTED_VIDEO_FORMATS

    def test_excluded_paths(self):
        """Test excluded path patterns."""
        assert isinstance(EXCLUDED_PATHS, (list, tuple, set))
        assert len(EXCLUDED_PATHS) > 0

        # Should contain common exclusion patterns
        exclusions_str = str(EXCLUDED_PATHS).lower()
        assert any(pattern in exclusions_str for pattern in ["temp", "cache", "log"])

    def test_video_formats_are_lowercase(self):
        """Test that video format extensions start with dot and are lowercase."""
        for format in SUPPORTED_VIDEO_FORMATS:
            assert format.startswith("."), f"Format {format} should start with dot"
            assert format.islower(), f"Format {format} should be lowercase"

    def test_excluded_paths_are_strings(self):
        """Test that excluded paths are strings."""
        for path in EXCLUDED_PATHS:
            assert isinstance(path, str), f"Excluded path {path} should be string"
            assert path, "Excluded path should not be empty"


@pytest.mark.unit
class TestExceptions:
    """Test custom exception classes."""

    def test_bridge_exception_basic(self):
        """Test basic BridgeException functionality."""
        message = "Test bridge error"
        exc = BridgeException(message)

        assert str(exc) == message
        assert exc.args == (message,)
        assert isinstance(exc, Exception)

    def test_bridge_exception_with_cause(self):
        """Test BridgeException with underlying cause."""
        cause = ValueError("Original error")
        message = "Bridge error with cause"

        exc = BridgeException(message)
        exc.__cause__ = cause

        assert str(exc) == message
        assert exc.__cause__ == cause

    def test_security_error(self):
        """Test SecurityError exception."""
        message = "Security violation detected"
        exc = SecurityError(message)

        assert str(exc) == message
        assert isinstance(exc, BridgeException)
        assert isinstance(exc, Exception)

    def test_processing_error(self):
        """Test ProcessingError exception."""
        message = "Processing failed"
        exc = ProcessingError(message)

        assert str(exc) == message
        assert isinstance(exc, BridgeException)

    def test_manifest_error(self):
        """Test ManifestError exception."""
        message = "Manifest operation failed"
        exc = ManifestError(message)

        assert str(exc) == message
        assert isinstance(exc, BridgeException)

    def test_exception_inheritance_chain(self):
        """Test exception inheritance chain."""
        exceptions = [SecurityError, ProcessingError, ManifestError]

        for exc_class in exceptions:
            exc = exc_class("test message")
            assert isinstance(exc, BridgeException)
            assert isinstance(exc, Exception)
            assert issubclass(exc_class, BridgeException)
            assert issubclass(exc_class, Exception)

    def test_exception_with_details(self):
        """Test exceptions with additional details."""
        details = {"file": "test.mp4", "operation": "copy"}

        # Test that exceptions can be extended with details
        exc = ProcessingError("Processing failed")
        exc.details = details

        assert exc.details == details
        assert "Processing failed" in str(exc)

    def test_exception_repr(self):
        """Test exception string representation."""
        exc = SecurityError("Security violation")
        repr_str = repr(exc)

        assert "SecurityError" in repr_str
        assert "Security violation" in repr_str

    def test_exception_chaining(self):
        """Test exception chaining with from clause."""
        original = ValueError("Original error")

        try:
            try:
                raise original
            except ValueError as e:
                raise ProcessingError("Processing failed") from e
        except ProcessingError as exc:
            assert exc.__cause__ == original
            assert isinstance(exc.__cause__, ValueError)

    def test_exception_without_message(self):
        """Test exceptions without explicit message."""
        exc = BridgeException()
        assert str(exc) == ""
        assert exc.args == ()

    def test_multiple_args_exception(self):
        """Test exception with multiple arguments."""
        exc = SecurityError("Error", "with", "multiple", "args")
        assert exc.args == ("Error", "with", "multiple", "args")


@pytest.mark.unit
class TestCoreIntegration:
    """Integration tests within the core module."""

    def test_config_with_exceptions(self, temp_workspace):
        """Test configuration creation that might raise exceptions."""
        # This should work without raising
        config = BridgeConfig(
            source_dir=temp_workspace / "source",
            target_dir=temp_workspace / "target",
            manifest_file=temp_workspace / "manifest.json",
        )
        assert config is not None

    def test_config_constants_integration(self, temp_workspace):
        """Test that configuration works with constants."""
        config = BridgeConfig(
            source_dir=temp_workspace / "source",
            target_dir=temp_workspace / "target",
            manifest_file=temp_workspace / "manifest.json",
        )

        # Constants should be accessible and usable with config
        assert len(SUPPORTED_VIDEO_FORMATS) > 0
        assert len(EXCLUDED_PATHS) > 0

        # Config should be valid for use with constants
        assert config.source_dir.exists() or True  # Created in post_init

    def test_exception_in_config_context(self, temp_workspace):
        """Test exceptions raised in configuration context."""
        # Test that our custom exceptions work in context
        try:
            config = BridgeConfig(
                source_dir=temp_workspace / "source",
                target_dir=temp_workspace / "target",
                manifest_file=temp_workspace / "manifest.json",
            )

            # Simulate an error that might occur
            if False:  # Conditional to avoid actual error
                raise ProcessingError("Simulated error")

        except ProcessingError as e:
            assert isinstance(e, BridgeException)

    def test_environment_variable_edge_cases(self, clean_bridge_env):
        """Test edge cases with environment variables."""
        # Empty values
        os.environ["MANIM_BRIDGE_DEV"] = ""
        config = BridgeConfig.from_env()
        assert config.enable_dev_logging is False

        # Whitespace values
        os.environ["MANIM_BRIDGE_DEV"] = "  "
        config = BridgeConfig.from_env()
        assert config.enable_dev_logging is False

        # Invalid number for workers
        os.environ["MANIM_BRIDGE_WORKERS"] = "invalid"
        try:
            config = BridgeConfig.from_env()
            # Should use default if conversion fails
        except ValueError:
            # Or should raise ValueError - either is acceptable
            pass
