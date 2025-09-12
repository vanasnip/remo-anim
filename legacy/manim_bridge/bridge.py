"""Main bridge orchestrator that coordinates all components"""

import time
from datetime import datetime
from pathlib import Path
from typing import Optional

from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer

from .core.config import BridgeConfig
from .core.exceptions import BridgeException
from .monitoring.logger import get_logger, setup_logging
from .monitoring.metrics import PerformanceMonitor
from .processing.hash_calculator import HashCalculator
from .processing.video_processor import VideoProcessor
from .security.path_validator import PathValidator
from .storage.file_operations import AtomicFileOperations
from .storage.manifest_handler import ManifestHandler


class ManimBridgeHandler(FileSystemEventHandler):
    """Handles file system events for the bridge"""

    def __init__(self, bridge):
        self.bridge = bridge
        self.logger = get_logger()

    def on_created(self, event):
        if not event.is_directory:
            self.logger.debug(f"File created: {event.src_path}")
            self.bridge.process_file(Path(event.src_path))

    def on_modified(self, event):
        if not event.is_directory:
            self.logger.debug(f"File modified: {event.src_path}")
            self.bridge.process_file(Path(event.src_path))


class ManimBridge:
    """Main orchestrator for Manim-Remotion bridge"""

    def __init__(self, config: Optional[BridgeConfig] = None):
        # Use provided config or create from environment
        self.config = config or BridgeConfig.from_env()

        # Setup logging
        self.logger = setup_logging(
            name="manim-bridge",
            level=self.config.log_level,
            enable_dev=self.config.enable_dev_logging,
            log_file=self.config.log_file,
            log_performance=self.config.log_performance,
        )

        self.logger.info("🌉 Manim Bridge initializing...")

        # Initialize components
        self._init_components()

        # Setup file watcher
        self.observer = None

        self.logger.info("✅ Manim Bridge initialized successfully")

    def _init_components(self):
        """Initialize all bridge components"""
        # Security
        self.path_validator = PathValidator(
            self.config.allowed_dirs, enable_logging=self.config.enable_dev_logging
        )

        # Storage
        self.manifest_handler = ManifestHandler(
            self.config.manifest_file, enable_logging=self.config.enable_dev_logging
        )
        self.file_operations = AtomicFileOperations(enable_logging=self.config.enable_dev_logging)

        # Processing
        self.hash_calculator = HashCalculator(
            chunk_size=self.config.chunk_size,
            enable_logging=self.config.enable_dev_logging,
        )
        self.video_processor = VideoProcessor(
            hash_calculator=self.hash_calculator,
            enable_logging=self.config.enable_dev_logging,
        )

        # Monitoring
        self.metrics = PerformanceMonitor(enabled=self.config.log_performance)

        self.logger.debug("All components initialized")

    def process_file(self, file_path: Path) -> bool:
        """Process a single video file"""
        try:
            # Validate it's a video file
            if not self.video_processor.is_video_file(file_path):
                return False

            # Check if excluded
            if self.video_processor.is_excluded(file_path):
                return False

            # Validate path security
            if not self.path_validator.is_safe(str(file_path)):
                self.logger.warning(f"Unsafe path rejected: {file_path}")
                return False

            # Wait for file to finish writing
            if not self._wait_for_file_complete(file_path):
                return False

            with self.metrics.measure("process_video"):
                # Extract metadata
                video_info = self.video_processor.extract_metadata(file_path)

                # Check if already processed
                if not self.manifest_handler.needs_processing(str(file_path), video_info.hash):
                    self.logger.debug(f"Already processed: {file_path.name}")
                    return False

                # Generate target path
                output_filename = self.video_processor.generate_output_filename(
                    file_path, include_timestamp=True
                )
                target_path = self.config.target_dir / output_filename

                # Copy video
                with self.metrics.measure("file_copy"):
                    self.file_operations.atomic_copy(file_path, target_path)

                # Create latest symlink if enabled
                if self.config.create_latest_symlink:
                    latest_link = (
                        self.config.target_dir / f"{video_info.scene_name}_latest{file_path.suffix}"
                    )
                    self.file_operations.safe_symlink(target_path, latest_link)

                # Update manifest
                self.manifest_handler.add_entry(
                    str(file_path),
                    {
                        "hash": video_info.hash,
                        "target": str(target_path),
                        "processed_at": datetime.now().isoformat(),
                        "scene": video_info.scene_name,
                        "quality": video_info.quality,
                        "size": video_info.size,
                        "duration": video_info.duration,
                        "codec": video_info.codec,
                    },
                )

                self.logger.info(f"✅ Processed: {file_path.name} -> {output_filename}")

                # Update video index if enabled
                if self.config.update_index:
                    self.update_video_index()

                return True

        except Exception as e:
            self.logger.error(f"Failed to process {file_path}: {e}", exc_info=True)
            return False

    def _wait_for_file_complete(self, file_path: Path, timeout: int = 10) -> bool:
        """Wait for file to finish being written"""
        try:
            for _ in range(timeout):
                initial_size = file_path.stat().st_size
                time.sleep(0.5)

                if file_path.stat().st_size == initial_size:
                    # File size stable, validate it
                    return self.video_processor.validate_video(file_path)

            self.logger.warning(f"File still being written after {timeout}s: {file_path}")
            return False

        except Exception as e:
            self.logger.error(f"Error waiting for file: {e}")
            return False

    def scan_existing_files(self) -> int:
        """Scan and process existing video files"""
        self.logger.info(f"🔍 Scanning {self.config.source_dir} for existing videos...")

        with self.metrics.measure("scan_existing"):
            videos = self.video_processor.find_videos(self.config.source_dir, recursive=True)

            processed_count = 0
            for video_path in videos:
                if self.process_file(video_path):
                    processed_count += 1

            self.logger.info(f"✨ Processed {processed_count}/{len(videos)} videos")

            return processed_count

    def update_video_index(self):
        """Update the video index file"""
        try:
            videos = []

            for video_file in self.config.target_dir.glob("*.mp4"):
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
            index_file = self.config.target_dir / "index.json"
            import json

            with open(index_file, "w") as f:
                json.dump(
                    {
                        "videos": videos,
                        "updated_at": datetime.now().isoformat(),
                        "total_count": len(videos),
                    },
                    f,
                    indent=2,
                )

            self.logger.debug(f"Updated video index: {len(videos)} videos")

        except Exception as e:
            self.logger.error(f"Failed to update video index: {e}")

    def start_watching(self):
        """Start watching for new video files"""
        if self.observer and self.observer.is_alive():
            self.logger.warning("Watcher already running")
            return

        self.observer = Observer()
        handler = ManimBridgeHandler(self)
        self.observer.schedule(handler, str(self.config.source_dir), recursive=True)
        self.observer.start()

        self.logger.info(f"👀 Watching {self.config.source_dir} for new videos...")

    def stop_watching(self):
        """Stop watching for new video files"""
        if self.observer and self.observer.is_alive():
            self.observer.stop()
            self.observer.join()
            self.logger.info("Stopped watching for new videos")

    def run(self, watch: bool = True):
        """Main entry point for the bridge"""
        try:
            # Print configuration
            self.logger.info(f"  Source: {self.config.source_dir}")
            self.logger.info(f"  Target: {self.config.target_dir}")
            self.logger.info(f"  Manifest: {self.config.manifest_file}")
            self.logger.info(
                f"  Dev Mode: {'✅ Enabled' if self.config.enable_dev_logging else '❌ Disabled'}"
            )

            # Scan existing files if enabled
            if self.config.scan_on_start:
                self.scan_existing_files()

            if watch:
                # Start watching
                self.start_watching()

                # Keep running until interrupted
                try:
                    while True:
                        time.sleep(1)

                        # Log metrics periodically in dev mode
                        if self.config.enable_dev_logging:
                            stats = self.metrics.get_stats()
                            if stats and stats.get("count", 0) > 0:
                                self.logger.performance(
                                    "overall",
                                    stats["average_time"],
                                    total_processed=stats["count"],
                                    success_rate=stats["success_rate"],
                                )

                except KeyboardInterrupt:
                    self.logger.info("\n👋 Shutting down...")
                finally:
                    self.stop_watching()

            # Export metrics if in dev mode
            if self.config.enable_dev_logging and self.config.log_performance:
                metrics_file = Path("bridge_metrics.json")
                self.metrics.export_json(str(metrics_file))
                self.logger.info(f"📊 Metrics exported to {metrics_file}")

        except Exception as e:
            self.logger.critical(f"Bridge failed: {e}", exc_info=True)
            raise BridgeException(f"Bridge failed: {e}")


def main():
    """Main entry point for CLI"""
    import argparse

    parser = argparse.ArgumentParser(description="Modular Bridge between Manim and Remotion")
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
        "--dev",
        action="store_true",
        help="Enable development mode with verbose logging",
    )
    parser.add_argument("--log-file", help="Log file path for persistent logging")

    args = parser.parse_args()

    # Create configuration
    config = BridgeConfig(
        source_dir=args.source,
        target_dir=args.target,
        manifest_file=args.manifest,
        enable_dev_logging=args.dev,
        log_file=Path(args.log_file) if args.log_file else None,
    )

    # Create and run bridge
    bridge = ManimBridge(config)
    bridge.run(watch=not args.scan_only)


if __name__ == "__main__":
    main()
