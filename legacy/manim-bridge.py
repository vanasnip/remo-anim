#!/usr/bin/env python3
"""
Manim to Remotion Bridge Script
Watches for new manim renders and automatically copies them to Remotion's assets directory
"""

import argparse
import hashlib
import json
import logging
import shutil
import time
from datetime import datetime
from pathlib import Path

from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer

from manim_bridge.logging_config import (
    log_file_operation,
    log_performance,
    log_system_event,
    setup_logger,
)


class ManimRenderHandler(FileSystemEventHandler):
    def __init__(self, source_dir, target_dir, manifest_file, logger=None):
        self.source_dir = Path(source_dir)
        self.target_dir = Path(target_dir)
        self.manifest_file = Path(manifest_file)
        self.logger = logger or logging.getLogger(__name__)
        self.processed_files = self.load_manifest()

        # Ensure target directory exists
        self.target_dir.mkdir(parents=True, exist_ok=True)

        log_system_event(
            self.logger,
            "ManimRenderHandler initialized",
            source_dir=str(self.source_dir),
            target_dir=str(self.target_dir),
            manifest_file=str(self.manifest_file)
        )

    def load_manifest(self):
        """Load the manifest of already processed files"""
        try:
            if self.manifest_file.exists():
                with log_performance(self.logger, "load_manifest", filepath=str(self.manifest_file)):
                    with open(self.manifest_file) as f:
                        manifest = json.load(f)
                    self.logger.info(f"Loaded manifest with {len(manifest)} entries")
                    return manifest
            else:
                self.logger.info("No existing manifest found, starting fresh")
                return {}
        except Exception as e:
            self.logger.error(f"Failed to load manifest: {e}", exc_info=True)
            return {}

    def save_manifest(self):
        """Save the manifest of processed files"""
        try:
            with log_performance(self.logger, "save_manifest",
                               filepath=str(self.manifest_file),
                               entry_count=len(self.processed_files)):
                with open(self.manifest_file, "w") as f:
                    json.dump(self.processed_files, f, indent=2, default=str)
                self.logger.debug(f"Saved manifest with {len(self.processed_files)} entries")
        except Exception as e:
            self.logger.error(f"Failed to save manifest: {e}", exc_info=True)

    def get_file_hash(self, filepath):
        """Calculate MD5 hash of a file"""
        try:
            with log_performance(self.logger, "calculate_hash", filepath=str(filepath)):
                hash_md5 = hashlib.md5()
                with open(filepath, "rb") as f:
                    for chunk in iter(lambda: f.read(4096), b""):
                        hash_md5.update(chunk)
                file_hash = hash_md5.hexdigest()
                self.logger.debug(f"Calculated hash for {Path(filepath).name}: {file_hash}")
                return file_hash
        except Exception as e:
            self.logger.error(f"Failed to calculate hash for {filepath}: {e}", exc_info=True)
            return None

    def should_process_file(self, filepath):
        """Check if file should be processed"""
        filepath = Path(filepath)

        self.logger.debug(f"Evaluating file for processing: {filepath.name}")

        # Only process video files
        if filepath.suffix.lower() not in [".mp4", ".mov", ".avi", ".webm"]:
            self.logger.debug(f"Skipping {filepath.name}: not a video file")
            return False

        # Skip partial movie files
        if "partial_movie_files" in str(filepath):
            self.logger.debug(f"Skipping {filepath.name}: partial movie file")
            return False

        # Check if file is complete (wait for file to finish writing)
        try:
            initial_size = filepath.stat().st_size
            time.sleep(0.5)
            if filepath.stat().st_size != initial_size:
                self.logger.debug(f"Skipping {filepath.name}: file still being written")
                return False  # File is still being written
        except OSError as e:
            self.logger.warning(f"Cannot access file {filepath.name}: {e}")
            return False

        # Check if file was already processed with same hash
        file_hash = self.get_file_hash(filepath)
        if not file_hash:
            self.logger.warning(f"Cannot calculate hash for {filepath.name}")
            return False

        if str(filepath) in self.processed_files:
            if self.processed_files[str(filepath)].get("hash") == file_hash:
                self.logger.debug(f"Skipping {filepath.name}: already processed with same hash")
                return False  # Already processed

        self.logger.info(f"File {filepath.name} ready for processing")
        return True

    def copy_video(self, source_path):
        """Copy video to Remotion assets directory"""
        source_path = Path(source_path)

        # Generate target filename based on source
        # Extract scene name and quality from path
        parts = source_path.parts
        quality = parts[-2] if len(parts) > 1 else "unknown"
        scene_name = source_path.stem

        # Create descriptive filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        target_filename = f"{scene_name}_{quality}_{timestamp}{source_path.suffix}"
        target_path = self.target_dir / target_filename

        try:
            with log_performance(self.logger, "copy_video",
                               source=str(source_path),
                               target=str(target_path),
                               size=source_path.stat().st_size):

                # Copy file
                shutil.copy2(source_path, target_path)

                # Update manifest
                file_hash = self.get_file_hash(source_path)
                self.processed_files[str(source_path)] = {
                    "hash": file_hash,
                    "target": str(target_path),
                    "processed_at": datetime.now().isoformat(),
                    "scene": scene_name,
                    "quality": quality,
                }
                self.save_manifest()

                log_file_operation(
                    self.logger, "copy", source_path, success=True,
                    target=str(target_path), scene=scene_name, quality=quality
                )

                # Create a symlink for easy access (latest render)
                latest_link = self.target_dir / f"{scene_name}_latest{source_path.suffix}"
                try:
                    if latest_link.exists():
                        latest_link.unlink()
                    latest_link.symlink_to(target_filename)
                    self.logger.debug(f"Created latest symlink: {latest_link.name}")
                except Exception as link_error:
                    self.logger.warning(f"Failed to create symlink: {link_error}")

            return True

        except Exception as e:
            log_file_operation(
                self.logger, "copy", source_path, success=False, error=e
            )
            return False

    def on_created(self, event):
        if not event.is_directory:
            self.process_file(event.src_path)

    def on_modified(self, event):
        if not event.is_directory:
            self.process_file(event.src_path)

    def process_file(self, filepath):
        """Process a potential manim render"""
        if self.should_process_file(filepath):
            self.logger.info(f"Processing new manim render: {Path(filepath).name}")
            if self.copy_video(filepath):
                # Create an index file for Remotion
                self.update_video_index()
            else:
                self.logger.warning(f"Failed to copy video: {Path(filepath).name}")

    def update_video_index(self):
        """Create/update an index of available manim videos for Remotion"""
        try:
            with log_performance(self.logger, "update_video_index"):
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
                with open(index_file, "w") as f:
                    json.dump(
                        {"videos": videos, "updated_at": datetime.now().isoformat()},
                        f,
                        indent=2,
                    )

                self.logger.info(f"Updated video index: {len(videos)} videos available")

        except Exception as e:
            self.logger.error(f"Failed to update video index: {e}", exc_info=True)


def scan_existing_files(handler):
    """Scan and process any existing manim renders"""
    handler.logger.info("Scanning for existing manim renders...")

    count = 0
    for video_file in handler.source_dir.rglob("*.mp4"):
        if handler.should_process_file(video_file):
            handler.logger.info(f"Found existing video: {video_file.name}")
            if handler.copy_video(video_file):
                count += 1

    if count > 0:
        handler.update_video_index()
        handler.logger.info(f"Processed {count} existing videos during scan")
    else:
        handler.logger.info("No new videos found during scan")


def main():
    parser = argparse.ArgumentParser(description="Bridge between Manim and Remotion")
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
        "--log-level",
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"],
        help="Set the logging level"
    )
    parser.add_argument(
        "--log-dir",
        default="logs/python",
        help="Directory for log files"
    )

    args = parser.parse_args()

    # Setup logging
    logger = setup_logger(
        name="manim-bridge",
        log_level=args.log_level,
        log_dir=Path(args.log_dir),
        component="manim-bridge"
    )

    # Setup paths
    source_dir = Path(args.source).resolve()
    target_dir = Path(args.target).resolve()
    manifest_file = Path(args.manifest).resolve()

    log_system_event(
        logger,
        "Manim to Remotion Bridge starting",
        source_dir=str(source_dir),
        target_dir=str(target_dir),
        manifest_file=str(manifest_file),
        log_level=args.log_level,
        scan_only=args.scan_only
    )

    # Create handler
    handler = ManimRenderHandler(source_dir, target_dir, manifest_file, logger)

    # Scan existing files
    scan_existing_files(handler)

    if args.scan_only:
        logger.info("Scan complete (--scan-only mode)")
        return

    # Setup file watcher
    observer = Observer()
    observer.schedule(handler, str(source_dir), recursive=True)
    observer.start()

    logger.info("Watching for new manim renders... (Press Ctrl+C to stop)")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
        logger.info("Bridge stopped by user")

    observer.join()
    log_system_event(logger, "Manim to Remotion Bridge shutdown complete")


if __name__ == "__main__":
    main()
