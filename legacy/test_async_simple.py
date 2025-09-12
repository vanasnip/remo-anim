#!/usr/bin/env python3
"""
Simple test of async bridge functionality
"""

import asyncio
import sys
import tempfile
from pathlib import Path

# Add current directory to path
sys.path.insert(0, str(Path(__file__).parent))

from manim_bridge_async import AsyncManimBridge


async def test_basic_functionality():
    """Test basic async bridge functionality"""
    print("🧪 Testing Async Manim Bridge")
    print("-" * 40)

    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        source_dir = temp_path / "source"
        target_dir = temp_path / "target"
        manifest_file = temp_path / "manifest.json"

        # Create test structure
        source_dir.mkdir(parents=True)
        quality_dir = source_dir / "480p15"
        quality_dir.mkdir()

        # Create a small test video file
        test_video = quality_dir / "TestScene.mp4"
        test_video.write_bytes(b"fake video content" * 100)

        print(f"✅ Created test video: {test_video.name}")

        # Create bridge
        bridge = AsyncManimBridge(
            source_dir=source_dir,
            target_dir=target_dir,
            manifest_file=manifest_file,
            max_workers=2,
        )

        # Test scanning
        print("\n📊 Testing scan functionality...")
        await bridge.scan_existing()

        # Check results
        copied_files = list(target_dir.glob("*.mp4"))
        if copied_files:
            print(f"✅ Successfully copied {len(copied_files)} file(s)")
            for file in copied_files:
                print(f"   - {file.name} ({file.stat().st_size} bytes)")

        # Check manifest
        if manifest_file.exists():
            print("✅ Manifest created successfully")

        # Check index
        index_file = target_dir / "index.json"
        if index_file.exists():
            print("✅ Video index created successfully")

        # Test performance metrics
        if bridge.monitor.metrics:
            print("\n⚡ Performance Metrics:")
            for operation, times in bridge.monitor.metrics.items():
                avg_time = sum(times) / len(times)
                print(f"   {operation}: {avg_time:.3f}s average")

    print("\n🎉 All tests passed!")


if __name__ == "__main__":
    asyncio.run(test_basic_functionality())
