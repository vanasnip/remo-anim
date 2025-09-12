#!/usr/bin/env python3
"""
Async Manim to Remotion Bridge - Production Version
Optimized for performance with proper error handling
"""

import argparse
import asyncio
import hashlib
import json
import logging
import shutil
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import List

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

try:
    import aiofiles

    AIOFILES_AVAILABLE = True
except ImportError:
    AIOFILES_AVAILABLE = False
    logger.warning("aiofiles not available, falling back to sync I/O in async wrapper")


@dataclass
class VideoInfo:
    """Information about a video file"""

    path: Path
    hash: str
    size: int
    scene_name: str
    quality: str


class AsyncManimBridgeV2:
    """Production-ready async bridge with fallback to sync operations"""

    def __init__(
        self,
        source_dir: Path,
        target_dir: Path,
        manifest_file: Path,
        max_workers: int = 4,
        chunk_size: int = 1024 * 1024,  # 1MB
    ):
        self.source_dir = source_dir
        self.target_dir = target_dir
        self.manifest_file = manifest_file
        self.max_workers = max_workers
        self.chunk_size = chunk_size
        self.processed_files = {}

        # Ensure directories exist
        self.target_dir.mkdir(parents=True, exist_ok=True)

        # Load existing manifest
        self.load_manifest_sync()

    def load_manifest_sync(self):
        """Load manifest synchronously (for initialization)"""
        if self.manifest_file.exists():
            try:
                with open(self.manifest_file) as f:
                    self.processed_files = json.load(f)
            except Exception as e:
                logger.error(f"Error loading manifest: {e}")
                self.processed_files = {}

    async def save_manifest_async(self):
        """Save manifest asynchronously with atomic write"""
        temp_file = self.manifest_file.with_suffix(".tmp")

        try:
            if AIOFILES_AVAILABLE:
                async with aiofiles.open(temp_file, "w") as f:
                    await f.write(json.dumps(self.processed_files, indent=2, default=str))
            else:
                # Fallback to sync in executor
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(
                    None,
                    lambda: temp_file.write_text(
                        json.dumps(self.processed_files, indent=2, default=str)
                    ),
                )

            # Atomic rename
            temp_file.replace(self.manifest_file)

        except Exception as e:
            logger.error(f"Error saving manifest: {e}")
            if temp_file.exists():
                temp_file.unlink()

    async def calculate_hash_async(self, file_path: Path) -> str:
        """Calculate file hash asynchronously"""
        hash_md5 = hashlib.md5()

        try:
            if AIOFILES_AVAILABLE:
                async with aiofiles.open(file_path, "rb") as f:
                    while chunk := await f.read(self.chunk_size):
                        hash_md5.update(chunk)
            else:
                # Fallback to sync in executor
                loop = asyncio.get_event_loop()

                def _hash_file():
                    with open(file_path, "rb") as f:
                        while chunk := f.read(self.chunk_size):
                            hash_md5.update(chunk)
                    return hash_md5.hexdigest()

                return await loop.run_in_executor(None, _hash_file)

            return hash_md5.hexdigest()

        except Exception as e:
            logger.error(f"Error calculating hash for {file_path}: {e}")
            raise

    async def copy_video_async(self, source: Path, target: Path) -> bool:
        """Copy video file asynchronously"""
        try:
            target.parent.mkdir(parents=True, exist_ok=True)

            if AIOFILES_AVAILABLE:
                async with aiofiles.open(source, "rb") as src:
                    async with aiofiles.open(target, "wb") as dst:
                        while chunk := await src.read(self.chunk_size):
                            await dst.write(chunk)
            else:
                # Fallback to sync copy in executor
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(None, shutil.copy2, source, target)

            return True

        except Exception as e:
            logger.error(f"Error copying {source} to {target}: {e}")
            return False

    def extract_video_info(self, video_path: Path) -> VideoInfo:
        """Extract metadata from video path"""
        parts = video_path.parts
        quality = parts[-2] if len(parts) > 1 else "unknown"
        scene_name = video_path.stem
        size = video_path.stat().st_size

        return VideoInfo(
            path=video_path,
            hash="",  # Will be calculated later
            size=size,
            scene_name=scene_name,
            quality=quality,
        )

    async def process_video(self, video_path: Path) -> bool:
        """Process a single video file"""
        try:
            # Extract info
            info = self.extract_video_info(video_path)

            # Calculate hash
            info.hash = await self.calculate_hash_async(video_path)

            # Check if already processed
            if str(video_path) in self.processed_files:
                if self.processed_files[str(video_path)].get("hash") == info.hash:
                    logger.debug(f"Skipping already processed: {video_path.name}")
                    return False

            # Generate target filename
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            target_filename = f"{info.scene_name}_{info.quality}_{timestamp}{video_path.suffix}"
            target_path = self.target_dir / target_filename

            # Copy video
            success = await self.copy_video_async(video_path, target_path)

            if success:
                # Update manifest entry
                self.processed_files[str(video_path)] = {
                    "hash": info.hash,
                    "target": str(target_path),
                    "processed_at": datetime.now().isoformat(),
                    "scene": info.scene_name,
                    "quality": info.quality,
                    "size": info.size,
                }

                # Create latest symlink
                latest_link = self.target_dir / f"{info.scene_name}_latest{video_path.suffix}"
                if latest_link.exists():
                    latest_link.unlink()
                latest_link.symlink_to(target_filename)

                logger.info(f"✅ Processed: {video_path.name} -> {target_filename}")
                return True

            return False

        except Exception as e:
            logger.error(f"Error processing {video_path}: {e}")
            return False

    async def process_videos_batch(self, video_paths: List[Path]) -> int:
        """Process multiple videos concurrently with limited workers"""
        if not video_paths:
            return 0

        # Create semaphore for concurrency control
        semaphore = asyncio.Semaphore(self.max_workers)

        async def process_with_semaphore(video_path):
            async with semaphore:
                return await self.process_video(video_path)

        # Process all videos concurrently
        results = await asyncio.gather(
            *[process_with_semaphore(p) for p in video_paths], return_exceptions=True
        )

        # Count successes
        processed_count = sum(1 for r in results if r is True)

        # Save manifest after batch
        if processed_count > 0:
            await self.save_manifest_async()
            await self.update_video_index()

        return processed_count

    async def update_video_index(self):
        """Update the video index file"""
        videos = []

        for video_file in self.target_dir.glob("*.mp4"):
            if "_latest" not in video_file.name:
                videos.append(
                    {
                        "filename": video_file.name,
                        "path": f"/assets/manim/{video_file.name}",
                        "size": video_file.stat().st_size,
                        "modified": video_file.stat().st_mtime,
                    }
                )

        # Sort by modification time (newest first)
        videos.sort(key=lambda x: x["modified"], reverse=True)

        # Write index file
        index_file = self.target_dir / "index.json"
        index_data = {
            "videos": videos,
            "updated_at": datetime.now().isoformat(),
            "total_count": len(videos),
        }

        if AIOFILES_AVAILABLE:
            async with aiofiles.open(index_file, "w") as f:
                await f.write(json.dumps(index_data, indent=2))
        else:
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None, lambda: index_file.write_text(json.dumps(index_data, indent=2))
            )

        logger.info(f"📝 Updated video index: {len(videos)} videos available")

    def find_video_files(self) -> List[Path]:
        """Find all video files in source directory"""
        video_extensions = {".mp4", ".mov", ".avi", ".webm"}
        videos = []

        for ext in video_extensions:
            videos.extend(self.source_dir.rglob(f"*{ext}"))

        # Filter out partial files
        videos = [v for v in videos if "partial_movie_files" not in str(v)]

        return videos

    async def scan_and_process(self) -> int:
        """Scan for videos and process them"""
        logger.info(f"🔍 Scanning {self.source_dir} for videos...")

        videos = self.find_video_files()

        if not videos:
            logger.info("No videos found to process")
            return 0

        logger.info(f"Found {len(videos)} video(s) to check")

        # Process in batches
        start_time = time.perf_counter()
        processed_count = await self.process_videos_batch(videos)
        elapsed = time.perf_counter() - start_time

        if processed_count > 0:
            logger.info(f"✨ Processed {processed_count} videos in {elapsed:.2f}s")
            logger.info(f"   Average: {elapsed/processed_count:.2f}s per video")

        return processed_count

    async def watch_loop(self, interval: float = 2.0):
        """Continuously watch for new videos"""
        logger.info("👀 Watching for new videos... (Press Ctrl+C to stop)")

        while True:
            try:
                await self.scan_and_process()
                await asyncio.sleep(interval)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in watch loop: {e}")
                await asyncio.sleep(interval * 2)


async def main():
    parser = argparse.ArgumentParser(
        description="Async Bridge between Manim and Remotion (Production Version)"
    )
    parser.add_argument("--source", default="manim-output", help="Manim output directory to watch")
    parser.add_argument(
        "--target",
        default="remotion-app/public/assets/manim",
        help="Remotion assets directory",
    )
    parser.add_argument(
        "--manifest",
        default=".manim-bridge-manifest.json",
        help="Manifest file to track processed videos",
    )
    parser.add_argument(
        "--scan-only",
        action="store_true",
        help="Only scan existing files, don't watch for new ones",
    )
    parser.add_argument(
        "--workers", type=int, default=4, help="Max concurrent workers (default: 4)"
    )

    args = parser.parse_args()

    # Setup paths
    source_dir = Path(args.source).resolve()
    target_dir = Path(args.target).resolve()
    manifest_file = Path(args.manifest).resolve()

    print("🌉 Async Manim to Remotion Bridge v2")
    print(f"  Source: {source_dir}")
    print(f"  Target: {target_dir}")
    print(f"  Workers: {args.workers}")
    print(
        f"  Async I/O: {'✅ Enabled' if AIOFILES_AVAILABLE else '⚠️  Disabled (install aiofiles for better performance)'}"
    )
    print()

    # Create bridge
    bridge = AsyncManimBridgeV2(
        source_dir=source_dir,
        target_dir=target_dir,
        manifest_file=manifest_file,
        max_workers=args.workers,
    )

    try:
        if args.scan_only:
            await bridge.scan_and_process()
            print("\n✅ Scan complete")
        else:
            # Initial scan
            await bridge.scan_and_process()
            # Start watching
            await bridge.watch_loop()

    except KeyboardInterrupt:
        print("\n👋 Bridge stopped")


if __name__ == "__main__":
    asyncio.run(main())
