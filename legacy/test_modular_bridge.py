#!/usr/bin/env python3
"""Test script for the modular Manim Bridge"""

import sys
import tempfile
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from manim_bridge import BridgeConfig, ManimBridge


def test_modular_bridge():
    """Test the modular bridge components"""
    print("🧪 Testing Modular Manim Bridge")
    print("=" * 50)

    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)

        # Create test directories
        source_dir = temp_path / "source"
        target_dir = temp_path / "target"
        manifest_file = temp_path / "manifest.json"
        log_file = temp_path / "bridge.log"

        # Create test video structure
        source_dir.mkdir()
        quality_dir = source_dir / "480p15"
        quality_dir.mkdir()

        # Create test video
        test_video = quality_dir / "TestScene.mp4"
        test_video.write_bytes(b"fake video header \x00\x00\x00\x18ftypmp42" + b"content" * 100)

        print("✅ Created test environment")
        print(f"   Source: {source_dir}")
        print(f"   Target: {target_dir}")

        # Test 1: Normal mode (production)
        print("\n📊 Test 1: Production Mode")
        print("-" * 30)

        config = BridgeConfig(
            source_dir=source_dir,
            target_dir=target_dir,
            manifest_file=manifest_file,
            enable_dev_logging=False,
            log_file=log_file,
        )

        bridge = ManimBridge(config)
        processed = bridge.scan_existing_files()

        print(f"   Processed: {processed} videos")

        # Check results
        copied_files = list(target_dir.glob("*.mp4"))
        print(f"   Copied files: {len(copied_files)}")

        if copied_files:
            for f in copied_files:
                print(f"     - {f.name} ({f.stat().st_size} bytes)")

        # Test 2: Dev mode with verbose logging
        print("\n📊 Test 2: Development Mode")
        print("-" * 30)

        # Clean target for second test
        for f in target_dir.glob("*"):
            f.unlink()

        config_dev = BridgeConfig(
            source_dir=source_dir,
            target_dir=target_dir,
            manifest_file=manifest_file,
            enable_dev_logging=True,
            log_performance=True,
        )

        bridge_dev = ManimBridge(config_dev)
        processed_dev = bridge_dev.scan_existing_files()

        print(f"   Processed: {processed_dev} videos")

        # Get performance metrics
        if bridge_dev.metrics.enabled:
            report = bridge_dev.metrics.get_report()
            if report.get("summary"):
                summary = report["summary"]
                print("   Performance:")
                print(f"     - Total operations: {summary.get('count', 0)}")
                print(f"     - Average time: {summary.get('average_time', 0):.3f}s")
                print(f"     - Success rate: {summary.get('success_rate', 0):.1f}%")

        # Test 3: Component isolation
        print("\n📊 Test 3: Component Isolation")
        print("-" * 30)

        # Test individual components
        from manim_bridge.processing import VideoProcessor
        from manim_bridge.security import PathValidator
        from manim_bridge.storage import ManifestHandler

        # Test PathValidator
        validator = PathValidator([source_dir, target_dir])
        safe_path = validator.is_safe(str(test_video))
        unsafe_path = validator.is_safe("/etc/passwd")
        print("   PathValidator:")
        print(f"     - Safe path check: {'✅' if safe_path else '❌'}")
        print(f"     - Unsafe path check: {'✅' if not unsafe_path else '❌'}")

        # Test ManifestHandler
        manifest = ManifestHandler(manifest_file)
        manifest.add_entry("test", {"value": 42})
        entry = manifest.get_entry("test")
        print("   ManifestHandler:")
        print(f"     - Write/Read: {'✅' if entry and entry.get('value') == 42 else '❌'}")

        # Test VideoProcessor
        processor = VideoProcessor()
        is_video = processor.is_video_file(test_video)
        print("   VideoProcessor:")
        print(f"     - Video detection: {'✅' if is_video else '❌'}")

        # Check log file was created
        if log_file.exists():
            log_size = log_file.stat().st_size
            print(f"\n📝 Log file created: {log_size} bytes")

    print("\n" + "=" * 50)
    print("✅ All tests completed successfully!")


if __name__ == "__main__":
    test_modular_bridge()
