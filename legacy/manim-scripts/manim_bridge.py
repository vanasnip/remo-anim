#!/usr/bin/env python3
"""
Manim Bridge - Interface between Remotion and Manim animations
Provides async processing and manifest management with comprehensive logging
"""

import json
import asyncio
import subprocess
import sys
import os
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Any
import time

# Import our logging infrastructure
from bridge_logger import get_logger, LogContext, setup_logging

# Initialize logger
logger = setup_logging(log_dir="logs", log_level="INFO")


class ManimBridge:
    """Bridge between Remotion and Manim with comprehensive logging"""

    def __init__(self, output_dir: str = "../remotion-app/public/assets/manim"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.manifest_file = self.output_dir / "manifest.json"
        self.manifest = self.load_manifest()

        logger.info(
            "ManimBridge initialized",
            context={
                "output_dir": str(self.output_dir),
                "manifest_file": str(self.manifest_file),
                "existing_videos": len(self.manifest.get("videos", [])),
            },
        )

    def load_manifest(self) -> Dict:
        """Load or create manifest file with logging"""
        if self.manifest_file.exists():
            try:
                with open(self.manifest_file, "r") as f:
                    manifest = json.load(f)
                    logger.debug(
                        "Manifest loaded successfully",
                        context={"video_count": len(manifest.get("videos", []))},
                    )
                    return manifest
            except json.JSONDecodeError as e:
                logger.error(
                    "Failed to parse manifest file",
                    exc_info=True,
                    context={"file": str(self.manifest_file)},
                )
                return self.create_new_manifest()
        else:
            logger.info("Creating new manifest file")
            return self.create_new_manifest()

    def create_new_manifest(self) -> Dict:
        """Create a new manifest structure"""
        manifest = {"videos": [], "lastUpdated": datetime.now().isoformat(), "version": "1.0.0"}
        logger.debug("New manifest created", context=manifest)
        return manifest

    def save_manifest(self):
        """Save manifest to file with logging"""
        try:
            self.manifest["lastUpdated"] = datetime.now().isoformat()
            with open(self.manifest_file, "w") as f:
                json.dump(self.manifest, f, indent=2)
            logger.debug(
                "Manifest saved", context={"video_count": len(self.manifest.get("videos", []))}
            )
        except Exception as e:
            logger.error(
                "Failed to save manifest", exc_info=True, context={"file": str(self.manifest_file)}
            )
            raise

    async def render_scene(
        self, scene_file: str, scene_class: str, quality: str = "480p15", **kwargs
    ) -> Optional[str]:
        """Render a Manim scene asynchronously with comprehensive logging"""

        with LogContext(logger, "render_scene", scene=scene_class, quality=quality) as ctx:

            output_file = f"{scene_class}_{quality}.mp4"
            output_path = self.output_dir / output_file

            # Build manim command
            cmd = [
                "manim",
                "-q",
                quality.lower(),
                "--output_file",
                output_file,
                "--media_dir",
                str(self.output_dir.parent),
                scene_file,
                scene_class,
            ]

            logger.debug(
                "Executing Manim command",
                action="manim_command",
                context={"command": " ".join(cmd)},
            )

            try:
                # Run manim command
                start_time = time.time()
                process = await asyncio.create_subprocess_exec(
                    *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
                )

                stdout, stderr = await process.communicate()
                processing_time = time.time() - start_time

                if process.returncode == 0:
                    # Success - update manifest
                    video_entry = {
                        "filename": output_file,
                        "path": f"/assets/manim/{output_file}",
                        "scene": scene_class,
                        "quality": quality,
                        "createdAt": datetime.now().isoformat(),
                        "processingTime": processing_time,
                        "fileSize": output_path.stat().st_size if output_path.exists() else 0,
                        **kwargs,
                    }

                    # Update or add to manifest
                    existing = next(
                        (v for v in self.manifest["videos"] if v["filename"] == output_file), None
                    )

                    if existing:
                        existing.update(video_entry)
                        logger.info(
                            "Updated existing video in manifest",
                            video_file=output_file,
                            scene=scene_class,
                            processing_time=processing_time,
                        )
                    else:
                        self.manifest["videos"].append(video_entry)
                        logger.info(
                            "Added new video to manifest",
                            video_file=output_file,
                            scene=scene_class,
                            processing_time=processing_time,
                        )

                    self.save_manifest()

                    logger.log_video_processing(
                        video_file=output_file,
                        scene=scene_class,
                        status="success",
                        processing_time=processing_time,
                        quality=quality,
                        file_size=video_entry["fileSize"],
                    )

                    return str(output_path)

                else:
                    # Failure
                    error_msg = stderr.decode("utf-8")
                    logger.error(
                        f"Manim render failed for {scene_class}",
                        action="render_failed",
                        video_file=output_file,
                        scene=scene_class,
                        status="failed",
                        processing_time=processing_time,
                        context={
                            "return_code": process.returncode,
                            "error": error_msg[:500],  # Truncate long errors
                        },
                    )
                    return None

            except asyncio.TimeoutError:
                logger.error(
                    "Render timeout",
                    action="render_timeout",
                    video_file=output_file,
                    scene=scene_class,
                    status="timeout",
                    context={"timeout": 300},
                )
                return None

            except Exception as e:
                logger.error(
                    f"Unexpected error during render: {str(e)}",
                    exc_info=True,
                    action="render_error",
                    video_file=output_file,
                    scene=scene_class,
                    status="error",
                )
                return None

    async def batch_render(self, scenes: List[Dict[str, Any]]) -> List[Optional[str]]:
        """Render multiple scenes concurrently with logging"""

        with LogContext(logger, "batch_render", scene_count=len(scenes)):
            logger.info(
                f"Starting batch render of {len(scenes)} scenes",
                action="batch_render_start",
                context={"scenes": [s.get("scene_class") for s in scenes]},
            )

            tasks = []
            for scene_config in scenes:
                task = self.render_scene(
                    scene_config["scene_file"],
                    scene_config["scene_class"],
                    scene_config.get("quality", "480p15"),
                    **scene_config.get("metadata", {}),
                )
                tasks.append(task)

            results = await asyncio.gather(*tasks, return_exceptions=True)

            # Log batch results
            successful = sum(1 for r in results if r and not isinstance(r, Exception))
            failed = len(results) - successful

            logger.info(
                f"Batch render completed: {successful}/{len(scenes)} successful",
                action="batch_render_complete",
                context={"total": len(scenes), "successful": successful, "failed": failed},
            )

            # Log individual failures
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    logger.error(
                        f"Scene {scenes[i]['scene_class']} failed in batch",
                        exc_info=True,
                        action="batch_scene_error",
                        scene=scenes[i]["scene_class"],
                    )

            return results

    def get_video_info(self, filename: str) -> Optional[Dict]:
        """Get video information from manifest with logging"""
        video = next((v for v in self.manifest["videos"] if v["filename"] == filename), None)

        if video:
            logger.debug(
                f"Video info retrieved: {filename}", action="get_video_info", context=video
            )
        else:
            logger.warning(f"Video not found in manifest: {filename}", action="video_not_found")

        return video

    def list_videos(self, scene: Optional[str] = None) -> List[Dict]:
        """List all videos or filter by scene"""
        videos = self.manifest["videos"]

        if scene:
            videos = [v for v in videos if v.get("scene") == scene]

        logger.debug(
            f"Listed {len(videos)} videos",
            action="list_videos",
            context={"filter_scene": scene, "count": len(videos)},
        )

        return videos

    def cleanup_old_videos(self, days: int = 7):
        """Clean up videos older than specified days with logging"""

        with LogContext(logger, "cleanup_old_videos", days=days):
            cutoff_date = datetime.now().timestamp() - (days * 24 * 60 * 60)
            removed_count = 0

            for video in self.manifest["videos"][:]:
                try:
                    created = datetime.fromisoformat(video["createdAt"]).timestamp()
                    if created < cutoff_date:
                        video_path = self.output_dir / video["filename"]
                        if video_path.exists():
                            video_path.unlink()
                            logger.info(
                                f"Deleted old video: {video['filename']}",
                                action="delete_video",
                                video_file=video["filename"],
                                context={"age_days": days},
                            )
                        self.manifest["videos"].remove(video)
                        removed_count += 1
                except Exception as e:
                    logger.error(
                        f"Error cleaning up video: {video.get('filename')}",
                        exc_info=True,
                        action="cleanup_error",
                        video_file=video.get("filename"),
                    )

            if removed_count > 0:
                self.save_manifest()
                logger.info(
                    f"Cleanup completed: removed {removed_count} videos",
                    action="cleanup_complete",
                    context={"removed_count": removed_count},
                )


async def main():
    """Main entry point with example usage and logging"""
    logger.info("Starting Manim Bridge application")

    try:
        bridge = ManimBridge()

        # Example: Render a single scene
        result = await bridge.render_scene(
            "sine_wave.py", "SineWaveAnimation", "720p30", description="Sine wave visualization"
        )

        if result:
            logger.info(f"Successfully rendered: {result}")

        # Example: Batch render
        scenes = [
            {
                "scene_file": "sine_wave.py",
                "scene_class": "SineWaveAnimation",
                "quality": "480p15",
                "metadata": {"type": "mathematical"},
            },
            {
                "scene_file": "circle_area.py",
                "scene_class": "CircleAreaAnimation",
                "quality": "480p15",
                "metadata": {"type": "geometric"},
            },
        ]

        results = await bridge.batch_render(scenes)
        logger.info(f"Batch render results: {results}")

        # List all videos
        videos = bridge.list_videos()
        logger.info(
            f"Total videos in manifest: {len(videos)}",
            context={"videos": [v["filename"] for v in videos]},
        )

    except Exception as e:
        logger.critical("Application failed", exc_info=True, action="app_failure")
        sys.exit(1)

    logger.info("Manim Bridge application completed successfully")


if __name__ == "__main__":
    asyncio.run(main())
