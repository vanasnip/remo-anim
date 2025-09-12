#!/usr/bin/env python3
"""
Async Manim to Remotion Bridge Script
High-performance async implementation with chunked processing and concurrent operations
"""

import argparse
import asyncio
import hashlib
import json
import multiprocessing
import time
from collections.abc import AsyncIterator
from concurrent.futures import ProcessPoolExecutor
from contextlib import asynccontextmanager
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import aiofiles


@dataclass
class ProcessingResult:
    """Result of video processing operation"""

    success: bool
    file_path: Optional[Path] = None
    file_hash: Optional[str] = None
    output_path: Optional[Path] = None
    error: Optional[str] = None
    processing_time: float = 0.0


class PerformanceMonitor:
    """Monitor and log performance metrics"""

    def __init__(self):
        self.metrics = {}

    @asynccontextmanager
    async def measure(self, operation: str):
        """Context manager to measure operation time"""
        start = time.perf_counter()
        try:
            yield
        finally:
            duration = time.perf_counter() - start
            self.record_metric(operation, duration)

    def record_metric(self, operation: str, duration: float):
        """Record performance metric"""
        if operation not in self.metrics:
            self.metrics[operation] = []
        self.metrics[operation].append(duration)

    def get_stats(self, operation: str) -> Dict[str, float]:
        """Get statistics for an operation"""
        if operation not in self.metrics:
            return {}

        values = self.metrics[operation]
        return {
            "count": len(values),
            "total": sum(values),
            "average": sum(values) / len(values) if values else 0,
            "min": min(values) if values else 0,
            "max": max(values) if values else 0,
        }


class AsyncFileManager:
    """Manages asynchronous file operations with chunking"""

    def __init__(self, chunk_size: int = 1024 * 1024):  # 1MB chunks
        self.chunk_size = chunk_size

    async def read_chunks(self, file_path: Path) -> AsyncIterator[bytes]:
        """Read file in chunks asynchronously"""
        async with aiofiles.open(file_path, "rb") as f:
            while True:
                chunk = await f.read(self.chunk_size)
                if not chunk:
                    break
                yield chunk

    async def calculate_hash_async(self, file_path: Path) -> str:
        """Calculate file hash asynchronously with chunking"""
        hash_obj = hashlib.md5()

        async for chunk in self.read_chunks(file_path):
            hash_obj.update(chunk)

        return hash_obj.hexdigest()

    async def copy_file_async(
        self,
        source: Path,
        destination: Path,
        progress_callback: Optional[callable] = None,
    ) -> Path:
        """Copy file asynchronously with progress tracking"""
        total_size = source.stat().st_size
        copied = 0

        destination.parent.mkdir(parents=True, exist_ok=True)

        async with aiofiles.open(source, "rb") as src:
            async with aiofiles.open(destination, "wb") as dst:
                while True:
                    chunk = await src.read(self.chunk_size)
                    if not chunk:
                        break

                    await dst.write(chunk)
                    copied += len(chunk)

                    if progress_callback:
                        await progress_callback(copied, total_size)

        return destination


class OptimizedManifestHandler:
    """Optimized manifest operations with caching and atomic updates"""

    def __init__(self, manifest_path: Path):
        self.manifest_path = manifest_path
        self._cache = {}
        self._cache_valid = False
        self._lock = asyncio.Lock()

    async def read_cached(self) -> Dict[str, Any]:
        """Read manifest with in-memory caching"""
        async with self._lock:
            if not self._cache_valid:
                if self.manifest_path.exists():
                    async with aiofiles.open(self.manifest_path, "r") as f:
                        content = await f.read()
                        self._cache = json.loads(content) if content else {}
                else:
                    self._cache = {}
                self._cache_valid = True

            return self._cache.copy()

    async def batch_update(self, updates: Dict[str, Any]):
        """Update multiple entries in single operation"""
        async with self._lock:
            data = await self.read_cached()
            data.update(updates)

            # Write atomically
            temp_file = self.manifest_path.with_suffix(".tmp")
            async with aiofiles.open(temp_file, "w") as f:
                await f.write(json.dumps(data, indent=2, default=str))

            # Atomic rename
            temp_file.replace(self.manifest_path)

            # Invalidate cache
            self._cache_valid = False

    async def has_processed(self, file_path: str, file_hash: str) -> bool:
        """Check if file was already processed"""
        data = await self.read_cached()
        entry = data.get(file_path)
        return entry and entry.get("hash") == file_hash


class ConcurrentVideoProcessor:
    """Processes multiple videos concurrently"""

    def __init__(self, max_workers: int = None):
        self.max_workers = max_workers or multiprocessing.cpu_count()
        self.executor = ProcessPoolExecutor(max_workers=self.max_workers)
        self.semaphore = asyncio.Semaphore(self.max_workers * 2)
        self.file_manager = AsyncFileManager()

    async def process_video_batch(
        self,
        video_paths: List[Path],
        target_dir: Path,
        manifest_handler: OptimizedManifestHandler,
        monitor: PerformanceMonitor,
    ) -> List[ProcessingResult]:
        """Process multiple videos concurrently"""
        tasks = [
            self._process_with_limit(video_path, target_dir, manifest_handler, monitor)
            for video_path in video_paths
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Handle exceptions
        processed_results = []
        for path, result in zip(video_paths, results):
            if isinstance(result, Exception):
                processed_results.append(
                    ProcessingResult(success=False, file_path=path, error=str(result))
                )
            else:
                processed_results.append(result)

        return processed_results

    async def _process_with_limit(
        self,
        video_path: Path,
        target_dir: Path,
        manifest_handler: OptimizedManifestHandler,
        monitor: PerformanceMonitor,
    ) -> ProcessingResult:
        """Process video with concurrency limit"""
        async with self.semaphore:
            return await self._process_video_async(
                video_path, target_dir, manifest_handler, monitor
            )

    async def _process_video_async(
        self,
        video_path: Path,
        target_dir: Path,
        manifest_handler: OptimizedManifestHandler,
        monitor: PerformanceMonitor,
    ) -> ProcessingResult:
        """Process single video asynchronously"""
        start_time = time.perf_counter()

        try:
            # Calculate hash
            async with monitor.measure("hash_calculation"):
                file_hash = await self.file_manager.calculate_hash_async(video_path)

            # Check if already processed
            if await manifest_handler.has_processed(str(video_path), file_hash):
                return ProcessingResult(
                    success=True,
                    file_path=video_path,
                    file_hash=file_hash,
                    processing_time=time.perf_counter() - start_time,
                )

            # Generate target filename
            parts = video_path.parts
            quality = parts[-2] if len(parts) > 1 else "unknown"
            scene_name = video_path.stem
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            target_filename = f"{scene_name}_{quality}_{timestamp}{video_path.suffix}"
            target_path = target_dir / target_filename

            # Copy file asynchronously
            async with monitor.measure("file_copy"):
                await self.file_manager.copy_file_async(video_path, target_path)

            # Create symlink for latest
            latest_link = target_dir / f"{scene_name}_latest{video_path.suffix}"
            if latest_link.exists():
                latest_link.unlink()
            latest_link.symlink_to(target_filename)

            processing_time = time.perf_counter() - start_time

            return ProcessingResult(
                success=True,
                file_path=video_path,
                file_hash=file_hash,
                output_path=target_path,
                processing_time=processing_time,
            )

        except Exception as e:
            return ProcessingResult(
                success=False,
                file_path=video_path,
                error=str(e),
                processing_time=time.perf_counter() - start_time,
            )


class AsyncManimBridge:
    """Asynchronous version of the Manim-Remotion bridge"""

    def __init__(
        self,
        source_dir: Path,
        target_dir: Path,
        manifest_file: Path,
        chunk_size: int = 1024 * 1024,
        max_workers: int = None,
    ):
        self.source_dir = source_dir
        self.target_dir = target_dir
        self.manifest_handler = OptimizedManifestHandler(manifest_file)
        self.processor = ConcurrentVideoProcessor(max_workers)
        self.monitor = PerformanceMonitor()
        self.running = False

        # Ensure target directory exists
        self.target_dir.mkdir(parents=True, exist_ok=True)

    def is_video_file(self, path: Path) -> bool:
        """Check if file is a video"""
        return path.suffix.lower() in [
            ".mp4",
            ".mov",
            ".avi",
            ".webm",
        ] and "partial_movie_files" not in str(path)

    async def find_new_videos(self) -> List[Path]:
        """Find unprocessed video files"""
        videos = []

        for video_file in self.source_dir.rglob("*.mp4"):
            if self.is_video_file(video_file):
                # Quick check if file is complete
                try:
                    initial_size = video_file.stat().st_size
                    await asyncio.sleep(0.1)
                    if video_file.stat().st_size == initial_size:
                        videos.append(video_file)
                except OSError:
                    continue

        return videos

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
        async with aiofiles.open(index_file, "w") as f:
            await f.write(
                json.dumps(
                    {"videos": videos, "updated_at": datetime.now().isoformat()},
                    indent=2,
                )
            )

        return len(videos)

    async def process_batch(self, videos: List[Path]) -> int:
        """Process a batch of videos"""
        if not videos:
            return 0

        print(f"\n🎬 Processing {len(videos)} videos...")

        # Process videos concurrently
        async with self.monitor.measure("batch_processing"):
            results = await self.processor.process_video_batch(
                videos, self.target_dir, self.manifest_handler, self.monitor
            )

        # Prepare batch updates for manifest
        updates = {}
        successful = 0

        for result in results:
            if result.success and result.output_path:
                successful += 1

                parts = result.file_path.parts
                quality = parts[-2] if len(parts) > 1 else "unknown"
                scene_name = result.file_path.stem

                updates[str(result.file_path)] = {
                    "hash": result.file_hash,
                    "target": str(result.output_path),
                    "processed_at": datetime.now().isoformat(),
                    "scene": scene_name,
                    "quality": quality,
                    "processing_time": result.processing_time,
                }

                print(f"  ✅ {result.file_path.name} ({result.processing_time:.2f}s)")
            elif result.error:
                print(f"  ❌ {result.file_path.name}: {result.error}")

        # Batch update manifest
        if updates:
            await self.manifest_handler.batch_update(updates)

        # Update video index
        if successful > 0:
            video_count = await self.update_video_index()
            print(f"📝 Updated video index: {video_count} videos available")

        # Log performance stats
        stats = self.monitor.get_stats("batch_processing")
        if stats:
            print(f"\n⚡ Performance: Processed {successful}/{len(videos)} videos")
            print(f"   Total time: {stats['total']:.2f}s")
            print(f"   Average: {stats['average']:.2f}s per video")

        return successful

    async def scan_existing(self):
        """Scan and process existing videos"""
        print("🔍 Scanning for existing manim renders...")

        videos = await self.find_new_videos()
        if videos:
            print(f"  Found {len(videos)} videos to process")
            processed = await self.process_batch(videos)
            print(f"✨ Processed {processed} videos")
        else:
            print("  No new videos to process")

    async def watch_loop(self):
        """Main watch loop"""
        self.running = True
        print("\n👀 Watching for new manim renders... (Press Ctrl+C to stop)")

        while self.running:
            try:
                # Check for new videos periodically
                videos = await self.find_new_videos()

                # Filter out already processed videos
                new_videos = []
                for video in videos:
                    file_hash = await self.processor.file_manager.calculate_hash_async(video)
                    if not await self.manifest_handler.has_processed(str(video), file_hash):
                        new_videos.append(video)

                if new_videos:
                    await self.process_batch(new_videos)

                await asyncio.sleep(2)  # Check every 2 seconds

            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"❌ Error in watch loop: {e}")
                await asyncio.sleep(5)

    async def run(self, scan_only: bool = False):
        """Main entry point"""
        print("🌉 Async Manim to Remotion Bridge")
        print(f"  Source: {self.source_dir}")
        print(f"  Target: {self.target_dir}")
        print(f"  Workers: {self.processor.max_workers}")
        print()

        # Scan existing files
        await self.scan_existing()

        if not scan_only:
            await self.watch_loop()
        else:
            print("\n✅ Scan complete (--scan-only mode)")

    def stop(self):
        """Stop the watch loop"""
        self.running = False


async def main():
    parser = argparse.ArgumentParser(description="Async Bridge between Manim and Remotion")
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
        "--workers",
        type=int,
        default=None,
        help="Max number of concurrent workers (default: CPU count)",
    )
    parser.add_argument(
        "--chunk-size",
        type=int,
        default=1024 * 1024,
        help="Chunk size for file operations in bytes (default: 1MB)",
    )

    args = parser.parse_args()

    # Setup paths
    source_dir = Path(args.source).resolve()
    target_dir = Path(args.target).resolve()
    manifest_file = Path(args.manifest).resolve()

    # Create bridge
    bridge = AsyncManimBridge(
        source_dir=source_dir,
        target_dir=target_dir,
        manifest_file=manifest_file,
        chunk_size=args.chunk_size,
        max_workers=args.workers,
    )

    try:
        await bridge.run(scan_only=args.scan_only)
    except KeyboardInterrupt:
        bridge.stop()
        print("\n👋 Bridge stopped")


if __name__ == "__main__":
    asyncio.run(main())
