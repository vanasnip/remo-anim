"""Integration tests for security components working together."""

import os
import threading
import time
from pathlib import Path
from unittest.mock import patch

import pytest

from manim_bridge.bridge import ManimBridge
from manim_bridge.core.config import BridgeConfig
from manim_bridge.core.exceptions import SecurityError
from manim_bridge.security.path_validator import PathValidator
from manim_bridge.security.command_sanitizer import CommandSanitizer
from tests.conftest import TestVideoGenerator


@pytest.mark.integration
@pytest.mark.security
class TestSecurityIntegration:
    """Integration tests for security systems working together."""

    def test_end_to_end_security_validation(self, temp_workspace):
        """Test complete security validation in realistic scenario."""
        config = BridgeConfig(
            source_dir=temp_workspace / "source",
            target_dir=temp_workspace / "target",
            manifest_file=temp_workspace / "manifest.json",
            enable_dev_logging=True
        )

        bridge = ManimBridge(config)

        # Create legitimate video file
        quality_dir = config.source_dir / "720p30"
        quality_dir.mkdir(parents=True)

        legitimate_video = quality_dir / "LegitimateVideo.mp4"
        TestVideoGenerator.create_fake_video(legitimate_video, size=10240)  # 10KB minimum

        # Test legitimate processing
        result = bridge.process_file(legitimate_video)
        assert result is True

        # Test malicious filename rejection
        malicious_names = [
            "video;rm -rf /.mp4",
            "video$(whoami).mp4",
            "../../../etc/passwd.mp4",
            "video`evil`.mp4"
        ]

        for malicious_name in malicious_names:
            malicious_path = quality_dir / malicious_name
            try:
                TestVideoGenerator.create_fake_video(malicious_path)
                result = bridge.process_file(malicious_path)
                assert result is False  # Should be rejected
            except (OSError, SecurityError):
                pass  # System or security rejection is expected

    def test_layered_security_defense(self, temp_workspace):
        """Test that multiple security layers work together."""
        config = BridgeConfig(
            source_dir=temp_workspace / "source",
            target_dir=temp_workspace / "target",
            manifest_file=temp_workspace / "manifest.json"
        )

        bridge = ManimBridge(config)

        # Attack vector that should be blocked at multiple layers
        attack_scenario = "../../../sensitive_data; rm -rf /"

        # Layer 1: Path validator should block
        assert bridge.path_validator.is_safe(attack_scenario) is False

        # Layer 2: Command sanitizer should block filename
        sanitizer = CommandSanitizer()
        with pytest.raises(SecurityError):
            sanitizer.sanitize_filename(attack_scenario + ".mp4")

        # Layer 3: Bridge processing should reject
        malicious_path = Path(attack_scenario + ".mp4")
        result = bridge.process_file(malicious_path)
        assert result is False

    def test_security_under_concurrent_load(self, temp_workspace):
        """Test security systems under concurrent processing load."""
        config = BridgeConfig(
            source_dir=temp_workspace / "source",
            target_dir=temp_workspace / "target",
            manifest_file=temp_workspace / "manifest.json",
            enable_dev_logging=True
        )

        bridge = ManimBridge(config)

        # Create test videos
        quality_dir = config.source_dir / "720p30"
        quality_dir.mkdir(parents=True)

        legitimate_videos = []
        for i in range(10):
            video = quality_dir / f"concurrent_test_{i}.mp4"
            TestVideoGenerator.create_fake_video(video, size=1024 + i * 10)
            legitimate_videos.append(video)

        results = []
        errors = []

        def concurrent_processor(videos):
            """Process videos concurrently."""
            try:
                for video in videos:
                    result = bridge.process_file(video)
                    results.append(result)
                    time.sleep(0.001)  # Small delay
            except Exception as e:
                errors.append(e)

        # Run concurrent processing
        threads = []
        for i in range(3):  # 3 concurrent threads
            video_subset = legitimate_videos[i::3]  # Distribute videos
            t = threading.Thread(target=concurrent_processor, args=(video_subset,))
            threads.append(t)
            t.start()

        for t in threads:
            t.join()

        # Verify concurrent security worked correctly
        assert len(errors) == 0, f"Security errors under concurrent load: {errors}"
        assert len(results) == len(legitimate_videos)
        assert all(isinstance(r, bool) for r in results)

    def test_security_configuration_validation(self, temp_workspace):
        """Test security validation of configuration parameters."""
        # Test with potentially dangerous paths in config
        dangerous_configs = [
            {
                "source_dir": "../../../etc",
                "target_dir": temp_workspace / "target",
                "manifest_file": "/etc/passwd"
            },
            {
                "source_dir": temp_workspace / "source",
                "target_dir": "/tmp/malicious",
                "manifest_file": temp_workspace / "manifest.json"
            }
        ]

        for dangerous_config in dangerous_configs:
            try:
                config = BridgeConfig(**dangerous_config)
                bridge = ManimBridge(config)

                # Config should resolve paths safely
                assert config.source_dir.is_absolute()
                assert config.target_dir.is_absolute()
                assert config.manifest_file.is_absolute()

                # Paths should not resolve to actual sensitive locations
                assert not str(config.manifest_file).endswith("/etc/passwd")

            except (SecurityError, OSError):
                # Security rejection is also acceptable
                pass

    def test_error_handling_security(self, temp_workspace, caplog):
        """Test that error handling doesn't leak security information."""
        config = BridgeConfig(
            source_dir=temp_workspace / "source",
            target_dir=temp_workspace / "target",
            manifest_file=temp_workspace / "manifest.json",
            enable_dev_logging=True
        )

        bridge = ManimBridge(config)

        # Attempt to process files that will cause various errors
        sensitive_paths = [
            "/etc/shadow",
            "/home/user/.ssh/id_rsa",
            "C:\\Windows\\System32\\drivers\\etc\\hosts"
        ]

        for sensitive_path in sensitive_paths:
            try:
                bridge.process_file(Path(sensitive_path))
            except Exception:
                pass  # Exceptions are expected

        # Check that sensitive paths don't appear in logs
        if caplog.records:
            log_content = " ".join(record.message for record in caplog.records)
            assert "/etc/shadow" not in log_content
            assert "id_rsa" not in log_content
            assert "System32" not in log_content

    def test_security_performance_integration(self, temp_workspace):
        """Test that security measures don't significantly impact performance."""
        config = BridgeConfig(
            source_dir=temp_workspace / "source",
            target_dir=temp_workspace / "target",
            manifest_file=temp_workspace / "manifest.json",
            enable_dev_logging=False  # Disable logging for performance
        )

        bridge = ManimBridge(config)

        # Create test videos
        quality_dir = config.source_dir / "720p30"
        quality_dir.mkdir(parents=True)

        test_videos = []
        for i in range(50):  # Test with 50 files
            video = quality_dir / f"perf_test_{i:03d}.mp4"
            TestVideoGenerator.create_fake_video(video, size=2048)
            test_videos.append(video)

        # Measure processing time with security enabled
        start_time = time.perf_counter()

        processed_count = 0
        for video in test_videos:
            if bridge.process_file(video):
                processed_count += 1

        end_time = time.perf_counter()

        processing_time = end_time - start_time
        throughput = processed_count / processing_time if processing_time > 0 else 0

        # Security shouldn't significantly impact throughput
        # Adjust threshold based on system capabilities
        min_throughput = 10  # files per second
        assert throughput >= min_throughput, f"Throughput too low with security: {throughput:.1f} files/sec"
        assert processed_count == len(test_videos), f"Processing failed for some files: {processed_count}/{len(test_videos)}"

    def test_security_with_edge_case_files(self, temp_workspace):
        """Test security with various edge case file scenarios."""
        config = BridgeConfig(
            source_dir=temp_workspace / "source",
            target_dir=temp_workspace / "target",
            manifest_file=temp_workspace / "manifest.json"
        )

        bridge = ManimBridge(config)
        quality_dir = config.source_dir / "720p30"
        quality_dir.mkdir(parents=True)

        edge_cases = [
            # Unicode filenames
            "测试视频.mp4",
            "видео.mp4",
            "動画.mp4",

            # Long filename
            ("a" * 200 + ".mp4"),

            # Filename with spaces and special chars
            "video with spaces & symbols!.mp4",

            # Filename with numbers and underscores
            "video_123_test.mp4",
        ]

        for filename in edge_cases:
            try:
                video_path = quality_dir / filename
                TestVideoGenerator.create_fake_video(video_path)

                # Should either process successfully or be safely rejected
                result = bridge.process_file(video_path)
                assert isinstance(result, bool)

            except (OSError, UnicodeError):
                # OS-level rejections are acceptable
                pass

    def test_security_logging_integration(self, temp_workspace, caplog):
        """Test that security events are properly logged."""
        config = BridgeConfig(
            source_dir=temp_workspace / "source",
            target_dir=temp_workspace / "target",
            manifest_file=temp_workspace / "manifest.json",
            enable_dev_logging=True
        )

        bridge = ManimBridge(config)

        # Trigger security events
        security_test_cases = [
            "../../../etc/passwd",
            "malicious;rm -rf /.mp4",
            "$(whoami).mp4"
        ]

        for test_case in security_test_cases:
            try:
                bridge.process_file(Path(test_case))
            except Exception:
                pass

        # Verify security events were logged appropriately
        if caplog.records:
            log_levels = [record.levelname for record in caplog.records]
            # Should have some warning or error logs for security events
            security_logs = [level for level in log_levels if level in ["WARNING", "ERROR"]]
            assert len(security_logs) > 0, "Expected security warnings/errors in logs"

    def test_manifest_security_integration(self, temp_workspace):
        """Test that manifest operations maintain security."""
        config = BridgeConfig(
            source_dir=temp_workspace / "source",
            target_dir=temp_workspace / "target",
            manifest_file=temp_workspace / "manifest.json"
        )

        bridge = ManimBridge(config)

        # Create and process legitimate video
        quality_dir = config.source_dir / "720p30"
        quality_dir.mkdir(parents=True)

        video = quality_dir / "ManifestSecurityTest.mp4"
        TestVideoGenerator.create_fake_video(video)

        result = bridge.process_file(video)
        assert result is True

        # Read manifest and verify no security issues
        manifest_data = bridge.manifest_handler.read()

        # Check that manifest content is safe
        manifest_str = str(manifest_data)

        # Should not contain script tags or other dangerous content
        dangerous_content = [
            "<script>",
            "javascript:",
            "$(",
            "`",
            "DROP TABLE",
            "rm -rf"
        ]

        for dangerous in dangerous_content:
            assert dangerous not in manifest_str, f"Dangerous content in manifest: {dangerous}"

        # Verify manifest structure is as expected
        assert isinstance(manifest_data, dict)
        for key, value in manifest_data.items():
            assert isinstance(key, str)
            assert isinstance(value, dict)
            assert "hash" in value
            assert "path" in value
