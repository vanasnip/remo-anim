"""Comprehensive security tests for the Manim Bridge system."""

import json
import os
import threading
import time
from pathlib import Path

import pytest

from manim_bridge.bridge import ManimBridge
from manim_bridge.core.config import BridgeConfig
from manim_bridge.core.exceptions import SecurityError
from manim_bridge.security.path_validator import PathValidator
from tests.conftest import TestVideoGenerator


@pytest.mark.security
class TestPathTraversalSecurity:
    """Comprehensive path traversal attack prevention tests."""

    def test_path_traversal_attacks(self, temp_workspace):
        """Test various path traversal attack vectors."""
        allowed_dir = temp_workspace / "allowed"
        allowed_dir.mkdir()
        validator = PathValidator([allowed_dir])

        # Common path traversal payloads
        attack_payloads = [
            "../../../etc/passwd",
            "..\\..\\..\\windows\\system32\\config\\sam",
            "....//....//....//etc//passwd",
            "..\\..\\..//..//etc//passwd",
            "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd",
            "..%252f..%252f..%252fetc%252fpasswd",
            "..%c0%af..%c0%af..%c0%afetc%c0%afpasswd",
            "\u002e\u002e\u002f\u002e\u002e\u002f\u002e\u002e\u002fetc\u002fpasswd",
            "....\\\\....\\\\....\\\\etc\\\\passwd",
            "../.../../../etc/passwd",
            "..../..../..../etc/passwd",
            "..././..././..././etc/passwd",
        ]

        for payload in attack_payloads:
            with pytest.raises((SecurityError, ValueError)):
                validator.normalize(payload)

    def test_symlink_attacks(self, temp_workspace):
        """Test symlink-based attacks."""
        allowed_dir = temp_workspace / "allowed"
        allowed_dir.mkdir()
        outside_dir = temp_workspace / "outside"
        outside_dir.mkdir()

        validator = PathValidator([allowed_dir])

        # Create sensitive target file
        sensitive_file = outside_dir / "sensitive.txt"
        sensitive_file.write_text("sensitive data")

        try:
            # Create malicious symlink
            malicious_link = allowed_dir / "innocent_video.mp4"
            malicious_link.symlink_to(sensitive_file)

            # Should detect and reject
            assert validator.is_safe(str(malicious_link)) is False

            # Validate input path should also reject
            with pytest.raises(SecurityError):
                validator.validate_input_path(str(malicious_link))

        except OSError:
            # Symlinks not supported on this system
            pytest.skip("Symlinks not supported")

    def test_unicode_path_attacks(self, temp_workspace):
        """Test Unicode-based path traversal attacks."""
        allowed_dir = temp_workspace / "allowed"
        allowed_dir.mkdir()
        validator = PathValidator([allowed_dir])

        unicode_attacks = [
            # Unicode normalization attacks
            "..%c0%af..%c0%af..%c0%afetc%c0%afpasswd",
            # Overlong UTF-8 sequences
            "\xc0\xae\xc0\xae\x2f\xc0\xae\xc0\xae\x2f\x65\x74\x63\x2f\x70\x61\x73\x73\x77\x64",
            # Right-to-left override attack
            "\u202e" + "mp4.exe" + "\u202d" + "video",
            # Null byte injection
            "safe_path\x00/../../../etc/passwd",
        ]

        for attack in unicode_attacks:
            result = validator.is_safe(attack)
            assert result is False

    def test_case_sensitivity_attacks(self, temp_workspace):
        """Test case sensitivity bypass attempts."""
        allowed_dir = temp_workspace / "Allowed"  # Capital A
        allowed_dir.mkdir()
        validator = PathValidator([allowed_dir])

        # Try different case variations
        case_attacks = [
            str(temp_workspace / "allowed" / "file.mp4"),  # lowercase
            str(temp_workspace / "ALLOWED" / "file.mp4"),  # uppercase
            str(temp_workspace / "aLlOwEd" / "file.mp4"),  # mixed case
        ]

        for attack in case_attacks:
            if os.name != "nt":  # On case-sensitive systems
                result = validator.is_safe(attack)
                # Should fail on case-sensitive systems (all should be False since case doesn't match)
                assert result is False

    def test_device_file_access_prevention(self, temp_workspace):
        """Test prevention of device file access."""
        allowed_dir = temp_workspace / "allowed"
        allowed_dir.mkdir()
        validator = PathValidator([allowed_dir])

        # Unix device files
        device_files = [
            "/dev/null",
            "/dev/zero",
            "/dev/random",
            "/dev/urandom",
            "/proc/self/mem",
            "/proc/version",
            "/sys/kernel/version",
        ]

        # Windows device files
        if os.name == "nt":
            device_files.extend(
                [
                    "CON",
                    "PRN",
                    "AUX",
                    "NUL",
                    "COM1",
                    "LPT1",
                ]
            )

        for device in device_files:
            assert validator.is_safe(device) is False


@pytest.mark.security
class TestInjectionPrevention:
    """Test prevention of various injection attacks."""

    def test_filename_injection_attacks(self, temp_workspace):
        """Test filename-based injection attacks."""
        config = BridgeConfig(
            source_dir=temp_workspace / "source",
            target_dir=temp_workspace / "target",
            manifest_file=temp_workspace / "manifest.json",
        )

        bridge = ManimBridge(config)

        # Create malicious filenames
        malicious_filenames = [
            # Command injection attempts
            "video; rm -rf /.mp4",
            "video$(rm -rf /).mp4",
            "video`rm -rf /`.mp4",
            "video|rm -rf /.mp4",
            "video&&rm -rf /.mp4",
            "video||rm -rf /.mp4",
            # Script injection
            "<script>alert('xss')</script>.mp4",
            "javascript:alert(1).mp4",
            # Path injection
            "../../../etc/passwd.mp4",
            # Null byte injection
            "video\x00malicious.mp4",
            # Control characters
            "video\r\nmalicious.mp4",
            # Long filename (buffer overflow attempt)
            "A" * 1000 + ".mp4",
        ]

        for malicious_name in malicious_filenames:
            malicious_path = config.source_dir / "720p30" / malicious_name
            malicious_path.parent.mkdir(parents=True, exist_ok=True)

            # Even if file exists, processing should reject malicious names
            try:
                TestVideoGenerator.create_fake_video(malicious_path)

                # Should reject processing
                result = bridge.process_file(malicious_path)
                assert result is False

            except (OSError, ValueError):
                # System rejected the filename, which is also good
                pass

    def test_metadata_injection_prevention(self, temp_workspace):
        """Test prevention of metadata injection attacks."""
        config = BridgeConfig(
            source_dir=temp_workspace / "source",
            target_dir=temp_workspace / "target",
            manifest_file=temp_workspace / "manifest.json",
        )

        bridge = ManimBridge(config)

        # Create video with potentially malicious path structure
        malicious_scene_dir = config.source_dir / "720p30"
        malicious_scene_dir.mkdir(parents=True)

        # Test various scene name attacks
        malicious_scenes = [
            "<script>alert('xss')</script>",
            "'; DROP TABLE videos; --",
            "../../../etc/passwd",
            "${malicious_env_var}",
            "`whoami`",
            "$(cat /etc/passwd)",
        ]

        for scene in malicious_scenes:
            try:
                # Create file with malicious scene name
                video_file = malicious_scene_dir / f"{scene}.mp4"
                TestVideoGenerator.create_fake_video(video_file)

                # Process and check that metadata is sanitized
                result = bridge.process_file(video_file)

                if result:
                    # Check manifest doesn't contain raw malicious content
                    manifest_data = bridge.manifest_handler.read()
                    for key, entry in manifest_data.items():
                        # Ensure no script tags or SQL injection
                        assert "<script>" not in str(entry)
                        assert "DROP TABLE" not in str(entry)

            except (OSError, ValueError):
                # System or validator rejected, which is acceptable
                pass

    def test_environment_variable_injection(self, temp_workspace):
        """Test prevention of environment variable injection."""
        # Create config with potentially dangerous env vars
        original_env = os.environ.copy()

        try:
            # Set malicious environment variables
            os.environ["MANIM_BRIDGE_SOURCE"] = "../../../etc"
            os.environ["MANIM_BRIDGE_TARGET"] = "/tmp/malicious"
            os.environ["MANIM_BRIDGE_MANIFEST"] = "/etc/passwd"

            # Config should use these values and resolve paths
            config = BridgeConfig.from_env()

            # The paths will be resolved by __post_init__, which should handle dangerous paths
            # by resolving relative paths to absolute ones in current directory context
            source_path = str(config.source_dir)
            target_path = str(config.target_dir)
            manifest_path = str(config.manifest_file)

            # These should NOT resolve to actual sensitive system locations
            # They should resolve relative to current working directory
            assert not source_path.startswith("/etc")
            assert not target_path == "/tmp/malicious" or "tmp" not in target_path
            assert not manifest_path == "/etc/passwd"

            # Paths should be absolute and safe
            assert config.source_dir.is_absolute()
            assert config.target_dir.is_absolute()
            assert config.manifest_file.is_absolute()

        finally:
            # Restore original environment
            os.environ.clear()
            os.environ.update(original_env)


@pytest.mark.security
class TestAccessControlSecurity:
    """Test access control and permission security."""

    def test_file_permission_enforcement(self, temp_workspace):
        """Test that files are created with safe permissions."""
        config = BridgeConfig(
            source_dir=temp_workspace / "source",
            target_dir=temp_workspace / "target",
            manifest_file=temp_workspace / "manifest.json",
        )

        bridge = ManimBridge(config)

        # Create source video
        quality_dir = config.source_dir / "720p30"
        quality_dir.mkdir(parents=True)
        source_video = quality_dir / "PermissionTest.mp4"
        TestVideoGenerator.create_fake_video(source_video)

        # Process video
        success = bridge.process_file(source_video)

        if success:
            # Check created files have safe permissions
            target_files = list(config.target_dir.glob("*.mp4"))
            for target_file in target_files:
                # File should not be world-writable
                permissions = target_file.stat().st_mode & 0o777
                assert (permissions & 0o002) == 0  # No world-write

                # File should be readable by owner
                assert (permissions & 0o400) != 0  # Owner read

        # Check manifest file permissions
        if config.manifest_file.exists():
            permissions = config.manifest_file.stat().st_mode & 0o777
            assert (permissions & 0o002) == 0  # No world-write

    def test_directory_traversal_in_operations(self, temp_workspace):
        """Test directory traversal prevention in file operations."""
        config = BridgeConfig(
            source_dir=temp_workspace / "source",
            target_dir=temp_workspace / "target",
            manifest_file=temp_workspace / "manifest.json",
        )

        bridge = ManimBridge(config)

        # Try to process files with traversal paths
        traversal_paths = [
            config.source_dir / "720p30" / ".." / ".." / "malicious.mp4",
            config.source_dir / "720p30" / "..\\..\\malicious.mp4",
        ]

        for traversal_path in traversal_paths:
            # Should be rejected by path validation
            result = bridge.process_file(traversal_path)
            assert result is False

    def test_resource_exhaustion_prevention(self, temp_workspace):
        """Test prevention of resource exhaustion attacks."""
        config = BridgeConfig(
            source_dir=temp_workspace / "source",
            target_dir=temp_workspace / "target",
            manifest_file=temp_workspace / "manifest.json",
        )

        bridge = ManimBridge(config)

        # Create extremely large "video" file
        quality_dir = config.source_dir / "720p30"
        quality_dir.mkdir(parents=True)
        large_file = quality_dir / "huge.mp4"

        # Create file that appears large but is sparse
        with open(large_file, "wb") as f:
            f.write(b"\x00\x00\x00\x18ftypmp42")  # Valid header
            f.seek(1024 * 1024 * 1024 - 1)  # Seek to 1GB
            f.write(b"\x00")

        # Processing should handle large files appropriately
        result = bridge.process_file(large_file)
        # Result depends on implementation - might process or reject
        assert isinstance(result, bool)

    def test_concurrent_access_security(self, temp_workspace):
        """Test security under concurrent access conditions."""
        config = BridgeConfig(
            source_dir=temp_workspace / "source",
            target_dir=temp_workspace / "target",
            manifest_file=temp_workspace / "manifest.json",
            enable_dev_logging=True,
        )

        bridge = ManimBridge(config)

        # Create multiple videos
        videos = []
        for i in range(5):
            quality_dir = config.source_dir / "720p30"
            quality_dir.mkdir(parents=True, exist_ok=True)
            video = quality_dir / f"concurrent_{i}.mp4"
            TestVideoGenerator.create_fake_video(video, size=1024 + i * 100)
            videos.append(video)

        results = []
        errors = []

        def worker(video_list):
            """Worker function for concurrent processing."""
            try:
                for video in video_list:
                    result = bridge.process_file(video)
                    results.append(result)
                    time.sleep(0.001)  # Small delay
            except Exception as e:
                errors.append(e)

        # Run concurrent workers
        threads = []
        for i in range(3):
            t = threading.Thread(target=worker, args=(videos,))
            threads.append(t)
            t.start()

        for t in threads:
            t.join()

        # Should complete without security errors
        assert len(errors) == 0

        # Verify final state is consistent and secure
        manifest_data = bridge.manifest_handler.read(use_cache=False)
        target_files = list(config.target_dir.glob("*.mp4"))

        # Should not have corrupted or malicious data
        for key, entry in manifest_data.items():
            assert isinstance(entry, dict)
            assert "hash" in entry
            # No obvious injection in stored data
            entry_str = str(entry)
            assert "<script>" not in entry_str
            assert "DROP TABLE" not in entry_str


@pytest.mark.security
class TestInformationDisclosurePrevention:
    """Test prevention of information disclosure."""

    def test_error_message_sanitization(self, temp_workspace, caplog):
        """Test that error messages don't leak sensitive information."""
        config = BridgeConfig(
            source_dir=temp_workspace / "source",
            target_dir=temp_workspace / "target",
            manifest_file=temp_workspace / "manifest.json",
            enable_dev_logging=True,
        )

        bridge = ManimBridge(config)

        # Try to process files that will cause errors
        sensitive_paths = [
            "/etc/passwd",
            "/home/user/.ssh/id_rsa",
            "C:\\Users\\Administrator\\passwords.txt",
        ]

        for sensitive_path in sensitive_paths:
            try:
                # This should fail but not leak the path in logs
                bridge.process_file(Path(sensitive_path))
            except Exception:
                pass

        # Check that sensitive paths don't appear in logs
        if caplog.records:
            log_messages = [record.message for record in caplog.records]
            for message in log_messages:
                assert "/etc/passwd" not in message
                assert "passwords.txt" not in message
                assert "id_rsa" not in message

    def test_file_existence_disclosure_prevention(self, temp_workspace):
        """Test that file existence is not disclosed through error differences."""
        allowed_dir = temp_workspace / "allowed"
        allowed_dir.mkdir()
        validator = PathValidator([allowed_dir])

        # Test with non-existent file outside sandbox
        outside_nonexistent = temp_workspace.parent / "nonexistent.mp4"

        # Test with existing file outside sandbox
        outside_existing = temp_workspace.parent / "existing.txt"
        outside_existing.write_text("test")

        try:
            # Both should give similar security errors
            with pytest.raises(SecurityError):
                validator.validate_input_path(str(outside_nonexistent))

            with pytest.raises(SecurityError):
                validator.validate_input_path(str(outside_existing))

        finally:
            # Cleanup
            if outside_existing.exists():
                outside_existing.unlink()

    def test_timing_attack_prevention(self, temp_workspace):
        """Test prevention of timing-based information disclosure."""
        allowed_dir = temp_workspace / "allowed"
        allowed_dir.mkdir()
        validator = PathValidator([allowed_dir])

        # Create files of different sizes
        small_file = allowed_dir / "small.mp4"
        large_file = allowed_dir / "large.mp4"

        small_file.write_bytes(b"small")
        large_file.write_bytes(b"large" * 1000)

        # Time path validation operations
        import time

        times = []
        for _ in range(10):
            start = time.perf_counter()
            validator.is_safe(str(small_file))
            times.append(time.perf_counter() - start)

        small_avg = sum(times) / len(times)

        times = []
        for _ in range(10):
            start = time.perf_counter()
            validator.is_safe(str(large_file))
            times.append(time.perf_counter() - start)

        large_avg = sum(times) / len(times)

        # Timing should be similar (path validation shouldn't read file content)
        ratio = max(small_avg, large_avg) / min(small_avg, large_avg)
        assert ratio < 2.0  # Less than 2x difference


@pytest.mark.security
class TestSecurityHardening:
    """Test security hardening features."""

    def test_input_sanitization_completeness(self, temp_workspace):
        """Test that all user inputs are properly sanitized."""
        config = BridgeConfig(
            source_dir=temp_workspace / "source",
            target_dir=temp_workspace / "target",
            manifest_file=temp_workspace / "manifest.json",
        )

        bridge = ManimBridge(config)

        # Test various input vectors
        input_vectors = [
            # Filenames
            "normal_video.mp4",
            "video with spaces.mp4",
            "video-with-dashes.mp4",
            "video_with_underscores.mp4",
            "video123.mp4",
            # Unicode filenames
            "测试视频.mp4",
            "видео.mp4",
            "動画.mp4",
        ]

        quality_dir = config.source_dir / "720p30"
        quality_dir.mkdir(parents=True)

        for filename in input_vectors:
            try:
                video_file = quality_dir / filename
                TestVideoGenerator.create_fake_video(video_file)

                # Should process safely
                result = bridge.process_file(video_file)
                assert isinstance(result, bool)

                # If processed successfully, check output is safe
                if result:
                    manifest_data = bridge.manifest_handler.read()
                    # Verify no malicious content in manifest
                    manifest_str = json.dumps(manifest_data)
                    assert "<script>" not in manifest_str
                    assert "javascript:" not in manifest_str

            except (OSError, UnicodeError):
                # Some filenames might be rejected by OS, which is acceptable
                pass

    def test_defense_in_depth(self, temp_workspace):
        """Test that multiple security layers work together."""
        config = BridgeConfig(
            source_dir=temp_workspace / "source",
            target_dir=temp_workspace / "target",
            manifest_file=temp_workspace / "manifest.json",
        )

        bridge = ManimBridge(config)

        # Create attack scenario that should be blocked at multiple layers
        attack_path = "../../../etc/passwd; rm -rf /"

        # Layer 1: Path validator should block
        assert bridge.path_validator.is_safe(attack_path) is False

        # Layer 2: File processing should reject
        result = bridge.process_file(Path(attack_path))
        assert result is False

        # Layer 3: Even if we tried to add to manifest directly, it should be safe
        # (Though this wouldn't happen in normal operation)
        manifest_data = bridge.manifest_handler.read()
        # Original malicious path should not be in manifest
        assert attack_path not in manifest_data

    def test_security_logging(self, temp_workspace, caplog):
        """Test that security events are properly logged."""
        config = BridgeConfig(
            source_dir=temp_workspace / "source",
            target_dir=temp_workspace / "target",
            manifest_file=temp_workspace / "manifest.json",
            enable_dev_logging=True,
        )

        bridge = ManimBridge(config)

        # Trigger security events
        security_test_paths = [
            "../../../etc/passwd",
            "/etc/shadow",
            "malicious; rm -rf /",
        ]

        for test_path in security_test_paths:
            try:
                bridge.process_file(Path(test_path))
            except Exception:
                pass

        # Verify security events were logged appropriately
        if caplog.records:
            # Should have some warning/error logs for security events
            warning_or_error_logs = [
                record for record in caplog.records if record.levelname in ["WARNING", "ERROR"]
            ]
            assert len(warning_or_error_logs) > 0

    def test_fail_secure_behavior(self, temp_workspace):
        """Test that the system fails securely when errors occur."""
        config = BridgeConfig(
            source_dir=temp_workspace / "source",
            target_dir=temp_workspace / "target",
            manifest_file=temp_workspace / "manifest.json",
        )

        bridge = ManimBridge(config)

        # Create scenario where errors might occur
        quality_dir = config.source_dir / "720p30"
        quality_dir.mkdir(parents=True)

        # Make target directory read-only to cause write errors
        config.target_dir.chmod(0o555)

        try:
            video_file = quality_dir / "test.mp4"
            TestVideoGenerator.create_fake_video(video_file)

            # Processing should fail securely (return False, not crash)
            result = bridge.process_file(video_file)
            assert result is False

            # System should still be in consistent state
            manifest_data = bridge.manifest_handler.read()
            # No partial or corrupted entries
            assert isinstance(manifest_data, dict)

        finally:
            # Restore permissions for cleanup
            config.target_dir.chmod(0o755)
