"""
Integration tests for the complete Manim-Remotion bridge pipeline
Tests end-to-end workflow from Python rendering to video processing
"""

import json
import shutil
import subprocess
import threading
import time
from unittest.mock import Mock, patch

import pytest

from manim_bridge_secure import (
    SecureManimRenderHandler,
    VideoRenderError,
)
from subprocess_sanitizer import (
    CommandInjectionError,
    SecureManimExecutor,
)
from tests.conftest import create_test_video_file


class TestFullPipeline:
    """Integration tests for the complete pipeline"""

    @pytest.fixture
    def pipeline_workspace(self, tmp_path):
        """Create a complete workspace for pipeline testing"""
        workspace = tmp_path / "pipeline_workspace"
        workspace.mkdir()

        # Create directory structure
        scripts_dir = workspace / "scripts"
        scripts_dir.mkdir()

        output_dir = workspace / "manim-output"
        output_dir.mkdir()

        target_dir = workspace / "remotion-app" / "public" / "assets" / "manim"
        target_dir.mkdir(parents=True)

        # Create a sample Manim script
        sample_script = scripts_dir / "test_scene.py"
        sample_script.write_text(
            """
from manim import Scene, Circle, Create

class TestCircle(Scene):
    def construct(self):
        circle = Circle()
        self.play(Create(circle))
        self.wait()
"""
        )

        return workspace

    @pytest.fixture
    def full_pipeline_handler(self, pipeline_workspace):
        """Create a complete handler setup"""
        return SecureManimRenderHandler(
            source_dir=str(pipeline_workspace / "manim-output"),
            target_dir=str(pipeline_workspace / "remotion-app" / "public" / "assets" / "manim"),
            manifest_file=str(pipeline_workspace / ".manim-bridge-manifest.json"),
            project_root=str(pipeline_workspace),
        )

    @pytest.fixture
    def full_pipeline_executor(self, pipeline_workspace):
        """Create a complete executor setup"""
        return SecureManimExecutor(
            working_dir=pipeline_workspace / "scripts",
            output_dir=pipeline_workspace / "manim-output",
        )

    def test_complete_rendering_pipeline_success(
        self, pipeline_workspace, full_pipeline_handler, full_pipeline_executor
    ):
        """Test the complete pipeline from script to processed video"""

        # Mock the actual manim command execution
        mock_result = Mock()
        mock_result.returncode = 0
        mock_result.stdout = (
            f'File ready at "{pipeline_workspace}/manim-output/TestCircle_720p30.mp4"'
        )
        mock_result.stderr = ""
        mock_result.args = ["manim", "render"]

        # Create the expected output video file
        output_video = pipeline_workspace / "manim-output" / "TestCircle_720p30.mp4"
        create_test_video_file(output_video, size_mb=2)

        with patch.object(
            full_pipeline_executor.sanitizer,
            "execute_safe_command",
            return_value=mock_result,
        ):
            # Step 1: Render the scene
            rendered_video_path = full_pipeline_executor.render_scene(
                script_path=pipeline_workspace / "scripts" / "test_scene.py",
                scene_name="TestCircle",
                quality="720p30",
            )

            assert rendered_video_path.exists()
            assert rendered_video_path.name == "TestCircle_720p30.mp4"

            # Step 2: Process and copy the video
            success = full_pipeline_handler.copy_video(str(rendered_video_path))
            assert success is True

            # Step 3: Verify manifest was updated
            manifest_path = pipeline_workspace / ".manim-bridge-manifest.json"
            assert manifest_path.exists()

            with open(manifest_path) as f:
                manifest = json.load(f)

            assert str(rendered_video_path) in manifest
            entry = manifest[str(rendered_video_path)]
            assert "hash" in entry
            assert "target" in entry
            assert "processed_at" in entry

            # Step 4: Verify target video exists
            target_videos = list(full_pipeline_handler.target_dir.glob("*.mp4"))
            assert len(target_videos) > 0
            assert target_videos[0].exists()

    def test_pipeline_with_multiple_scenes(
        self, pipeline_workspace, full_pipeline_handler, full_pipeline_executor
    ):
        """Test pipeline with multiple scene rendering"""

        # Create multiple test scenes
        scenes = ["Scene1", "Scene2", "Scene3"]
        rendered_videos = []

        for scene_name in scenes:
            mock_result = Mock()
            mock_result.returncode = 0
            output_path = pipeline_workspace / "manim-output" / f"{scene_name}_720p30.mp4"
            mock_result.stdout = f'File ready at "{output_path}"'
            mock_result.stderr = ""

            # Create the video file
            create_test_video_file(output_path, size_mb=1)

            with patch.object(
                full_pipeline_executor.sanitizer,
                "execute_safe_command",
                return_value=mock_result,
            ):
                rendered_path = full_pipeline_executor.render_scene(
                    script_path=pipeline_workspace / "scripts" / "test_scene.py",
                    scene_name=scene_name,
                    quality="720p30",
                )
                rendered_videos.append(rendered_path)

        # Process all videos
        for video_path in rendered_videos:
            success = full_pipeline_handler.copy_video(str(video_path))
            assert success is True

        # Verify all were processed
        manifest_path = pipeline_workspace / ".manim-bridge-manifest.json"
        with open(manifest_path) as f:
            manifest = json.load(f)

        assert len(manifest) == 3

        target_videos = list(full_pipeline_handler.target_dir.glob("*.mp4"))
        assert len(target_videos) == 3

    def test_pipeline_error_handling_render_failure(
        self, pipeline_workspace, full_pipeline_executor
    ):
        """Test pipeline handles render failures gracefully"""

        # Mock manim command failure
        mock_result = Mock()
        mock_result.returncode = 1
        mock_result.stdout = "Render failed"
        mock_result.stderr = "Scene not found"
        mock_result.args = ["manim", "render"]

        with patch.object(
            full_pipeline_executor.sanitizer,
            "execute_safe_command",
            return_value=mock_result,
        ):
            with pytest.raises(subprocess.CalledProcessError):
                full_pipeline_executor.render_scene(
                    script_path=pipeline_workspace / "scripts" / "test_scene.py",
                    scene_name="NonExistentScene",
                    quality="720p30",
                )

    def test_pipeline_error_handling_copy_failure(self, pipeline_workspace, full_pipeline_handler):
        """Test pipeline handles copy failures gracefully"""

        # Try to copy a non-existent video
        nonexistent_video = pipeline_workspace / "manim-output" / "missing.mp4"

        success = full_pipeline_handler.copy_video(str(nonexistent_video))
        assert success is False

    def test_pipeline_with_security_validation(self, pipeline_workspace, full_pipeline_executor):
        """Test pipeline security validation works end-to-end"""

        # Test malicious script path
        with pytest.raises(CommandInjectionError):
            full_pipeline_executor.render_scene(
                script_path="../../../etc/passwd", scene_name="TestScene"
            )

        # Test malicious scene name
        with pytest.raises(CommandInjectionError):
            full_pipeline_executor.render_scene(
                script_path=pipeline_workspace / "scripts" / "test_scene.py",
                scene_name="Scene$(curl evil.com)",
            )

    def test_pipeline_manifest_integrity(self, pipeline_workspace, full_pipeline_handler):
        """Test manifest maintains integrity across operations"""

        # Create multiple test videos
        video_paths = []
        for i in range(5):
            video_path = pipeline_workspace / "manim-output" / f"test_video_{i}.mp4"
            create_test_video_file(video_path, size_mb=1)
            video_paths.append(video_path)

        # Process them all
        for video_path in video_paths:
            success = full_pipeline_handler.copy_video(str(video_path))
            assert success is True

        # Verify manifest integrity
        manifest_path = pipeline_workspace / ".manim-bridge-manifest.json"
        with open(manifest_path) as f:
            manifest = json.load(f)

        # Should have entries for all videos
        assert len(manifest) == 5

        # Each entry should have required fields
        for video_path in video_paths:
            entry = manifest[str(video_path)]
            assert "hash" in entry
            assert "target" in entry
            assert "processed_at" in entry
            assert "scene" in entry or "size" in entry  # Some metadata

        # Manifest should be valid JSON
        json.dumps(manifest)  # Should not raise

    def test_pipeline_concurrent_processing(self, pipeline_workspace, full_pipeline_handler):
        """Test pipeline handles concurrent video processing"""

        # Create multiple videos
        video_paths = []
        for i in range(3):
            video_path = pipeline_workspace / "manim-output" / f"concurrent_video_{i}.mp4"
            create_test_video_file(video_path, size_mb=1)
            video_paths.append(video_path)

        results = []

        def process_video(video_path):
            success = full_pipeline_handler.copy_video(str(video_path))
            results.append(success)

        # Process videos concurrently
        threads = []
        for video_path in video_paths:
            thread = threading.Thread(target=process_video, args=(video_path,))
            threads.append(thread)
            thread.start()

        # Wait for all to complete
        for thread in threads:
            thread.join()

        # All should succeed
        assert all(results)
        assert len(results) == 3

        # Verify manifest has all entries
        manifest_path = pipeline_workspace / ".manim-bridge-manifest.json"
        with open(manifest_path) as f:
            manifest = json.load(f)

        assert len(manifest) == 3

    def test_pipeline_recovery_after_failure(self, pipeline_workspace, full_pipeline_handler):
        """Test pipeline can recover from failures"""

        # Create a video file
        video_path = pipeline_workspace / "manim-output" / "recovery_test.mp4"
        create_test_video_file(video_path, size_mb=1)

        # First attempt - mock permission error
        with patch("shutil.copy2", side_effect=PermissionError("Permission denied")):
            success = full_pipeline_handler.copy_video(str(video_path))
            assert success is False

        # Second attempt - should succeed with retry logic
        success = full_pipeline_handler.copy_video(str(video_path))
        assert success is True

        # Verify video was processed
        target_videos = list(full_pipeline_handler.target_dir.glob("*.mp4"))
        assert len(target_videos) > 0

    def test_pipeline_performance_benchmarks(self, pipeline_workspace, full_pipeline_handler):
        """Test pipeline performance meets benchmarks"""

        # Create a moderately sized video
        video_path = pipeline_workspace / "manim-output" / "benchmark_video.mp4"
        create_test_video_file(video_path, size_mb=10)  # 10MB video

        # Time the processing
        start_time = time.time()
        success = full_pipeline_handler.copy_video(str(video_path))
        end_time = time.time()

        assert success is True

        # Processing should complete within reasonable time (10MB in < 5 seconds)
        processing_time = end_time - start_time
        assert processing_time < 5.0, f"Processing took {processing_time} seconds, expected < 5"

    def test_pipeline_large_file_handling(self, pipeline_workspace, full_pipeline_handler):
        """Test pipeline handles large files appropriately"""

        # Create a file at the size limit
        large_video = pipeline_workspace / "manim-output" / "large_video.mp4"
        create_test_video_file(large_video, size_mb=500)  # 500MB - at the limit

        success = full_pipeline_handler.copy_video(str(large_video))
        assert success is True

        # Verify it was processed
        target_videos = list(full_pipeline_handler.target_dir.glob("*.mp4"))
        assert len(target_videos) > 0

        # Create a file that exceeds the limit
        oversized_video = pipeline_workspace / "manim-output" / "oversized_video.mp4"
        create_test_video_file(oversized_video, size_mb=600)  # Over 500MB limit

        success = full_pipeline_handler.copy_video(str(oversized_video))
        assert success is False  # Should reject oversized files

    def test_pipeline_cleanup_on_failure(self, pipeline_workspace, full_pipeline_handler):
        """Test pipeline cleans up properly after failures"""

        video_path = pipeline_workspace / "manim-output" / "cleanup_test.mp4"
        create_test_video_file(video_path, size_mb=1)

        # Mock verification failure after copy
        with patch.object(full_pipeline_handler, "verify_copied_file", return_value=False):
            with pytest.raises(VideoRenderError, match="verification failed"):
                full_pipeline_handler.copy_video(str(video_path))

        # Verify partial files were cleaned up
        partial_files = list(full_pipeline_handler.target_dir.glob("*.tmp"))
        assert len(partial_files) == 0

        # Manifest should not have the failed entry
        manifest_path = pipeline_workspace / ".manim-bridge-manifest.json"
        if manifest_path.exists():
            with open(manifest_path) as f:
                manifest = json.load(f)
            assert str(video_path) not in manifest

    @pytest.mark.slow
    def test_pipeline_stress_test(self, pipeline_workspace, full_pipeline_handler):
        """Stress test the pipeline with many operations"""

        # Create many small video files
        video_count = 20
        video_paths = []

        for i in range(video_count):
            video_path = pipeline_workspace / "manim-output" / f"stress_video_{i:02d}.mp4"
            create_test_video_file(video_path, size_mb=1)
            video_paths.append(video_path)

        # Process all videos
        successes = 0
        for video_path in video_paths:
            if full_pipeline_handler.copy_video(str(video_path)):
                successes += 1

        # All should succeed
        assert successes == video_count

        # Verify all processed correctly
        target_videos = list(full_pipeline_handler.target_dir.glob("*.mp4"))
        assert len(target_videos) == video_count

        # Manifest should have all entries
        manifest_path = pipeline_workspace / ".manim-bridge-manifest.json"
        with open(manifest_path) as f:
            manifest = json.load(f)

        assert len(manifest) == video_count

    def test_pipeline_with_file_watcher_simulation(self, pipeline_workspace, full_pipeline_handler):
        """Test pipeline works with file watcher patterns"""

        # Simulate a file watcher creating files
        def create_and_process_video(index):
            video_path = pipeline_workspace / "manim-output" / f"watched_video_{index}.mp4"

            # Create file (simulate watcher detection)
            create_test_video_file(video_path, size_mb=1)

            # Small delay to simulate file system settling
            time.sleep(0.1)

            # Process the file
            success = full_pipeline_handler.copy_video(str(video_path))
            return success

        # Create multiple files in sequence (like a file watcher would)
        results = []
        for i in range(5):
            result = create_and_process_video(i)
            results.append(result)
            time.sleep(0.1)  # Simulate realistic timing

        # All should succeed
        assert all(results)

        # Verify final state
        target_videos = list(full_pipeline_handler.target_dir.glob("*.mp4"))
        assert len(target_videos) == 5

    def test_pipeline_manifest_versioning(self, pipeline_workspace, full_pipeline_handler):
        """Test manifest handles version conflicts gracefully"""

        # Create initial manifest
        video_path = pipeline_workspace / "manim-output" / "version_test.mp4"
        create_test_video_file(video_path, size_mb=1)

        success = full_pipeline_handler.copy_video(str(video_path))
        assert success is True

        # Simulate external modification of manifest
        manifest_path = pipeline_workspace / ".manim-bridge-manifest.json"
        with open(manifest_path) as f:
            original_manifest = json.load(f)

        # Add external entry
        external_entry = {
            "hash": "external_hash",
            "target": "/external/path.mp4",
            "processed_at": "2024-01-01T00:00:00",
        }
        original_manifest["/external/video.mp4"] = external_entry

        with open(manifest_path, "w") as f:
            json.dump(original_manifest, f)

        # Process another video - should preserve external entry
        video_path2 = pipeline_workspace / "manim-output" / "version_test2.mp4"
        create_test_video_file(video_path2, size_mb=1)

        success = full_pipeline_handler.copy_video(str(video_path2))
        assert success is True

        # Verify both entries exist
        with open(manifest_path) as f:
            final_manifest = json.load(f)

        assert len(final_manifest) >= 2
        assert "/external/video.mp4" in final_manifest  # External entry preserved
        assert str(video_path2) in final_manifest  # New entry added

    def test_pipeline_graceful_shutdown(self, pipeline_workspace, full_pipeline_handler):
        """Test pipeline handles shutdown gracefully"""

        # Create a video for processing
        video_path = pipeline_workspace / "manim-output" / "shutdown_test.mp4"
        create_test_video_file(video_path, size_mb=5)

        # Start processing
        processing_started = threading.Event()
        processing_completed = threading.Event()

        def slow_copy_with_signal(src, dst):
            processing_started.set()
            # Simulate slow processing
            time.sleep(0.5)
            processing_completed.set()
            shutil.copy2(src, dst)

        with patch("shutil.copy2", side_effect=slow_copy_with_signal):
            # Start processing in background
            def background_process():
                full_pipeline_handler.copy_video(str(video_path))

            thread = threading.Thread(target=background_process)
            thread.daemon = True
            thread.start()

            # Wait for processing to start
            processing_started.wait(timeout=2.0)

            # Simulate shutdown signal (would be handled by the application)
            # For testing, we just verify the process can complete
            thread.join(timeout=2.0)

            # Processing should have completed
            assert processing_completed.is_set()

    def test_end_to_end_integration_with_remotion(
        self, pipeline_workspace, full_pipeline_handler, full_pipeline_executor
    ):
        """Test complete integration that would work with Remotion"""

        # Step 1: Render multiple scenes for a Remotion composition
        scenes = {
            "IntroScene": {"quality": "720p30", "duration": 90},
            "MainScene": {"quality": "1080p30", "duration": 300},
            "OutroScene": {"quality": "720p30", "duration": 60},
        }

        rendered_videos = {}

        for scene_name, config in scenes.items():
            # Mock rendering
            mock_result = Mock()
            mock_result.returncode = 0
            output_path = (
                pipeline_workspace / "manim-output" / f"{scene_name}_{config['quality']}.mp4"
            )
            mock_result.stdout = f'File ready at "{output_path}"'
            mock_result.stderr = ""

            # Create video file
            create_test_video_file(output_path, size_mb=2)

            with patch.object(
                full_pipeline_executor.sanitizer,
                "execute_safe_command",
                return_value=mock_result,
            ):
                rendered_path = full_pipeline_executor.render_scene(
                    script_path=pipeline_workspace / "scripts" / "test_scene.py",
                    scene_name=scene_name,
                    quality=config["quality"],
                )
                rendered_videos[scene_name] = rendered_path

        # Step 2: Process all videos
        for scene_name, video_path in rendered_videos.items():
            success = full_pipeline_handler.copy_video(str(video_path))
            assert success is True

        # Step 3: Generate index file for Remotion (simulate what bridge would create)
        index_data = {}
        manifest_path = pipeline_workspace / ".manim-bridge-manifest.json"

        with open(manifest_path) as f:
            manifest = json.load(f)

        for scene_name, video_path in rendered_videos.items():
            if str(video_path) in manifest:
                entry = manifest[str(video_path)]
                index_data[scene_name] = {
                    "src": entry["target"],
                    "hash": entry["hash"],
                    "processed_at": entry["processed_at"],
                    "scene": scene_name,
                }

        # Step 4: Write index file for Remotion consumption
        index_file = (
            pipeline_workspace / "remotion-app" / "public" / "assets" / "manim" / "index.json"
        )
        with open(index_file, "w") as f:
            json.dump(index_data, f, indent=2)

        # Step 5: Verify Remotion would have all needed files
        target_dir = pipeline_workspace / "remotion-app" / "public" / "assets" / "manim"

        # Should have all video files
        video_files = list(target_dir.glob("*.mp4"))
        assert len(video_files) == len(scenes)

        # Should have index file
        assert index_file.exists()

        # Index should reference all scenes
        with open(index_file) as f:
            index_content = json.load(f)

        assert len(index_content) == len(scenes)
        for scene_name in scenes.keys():
            assert scene_name in index_content
            assert "src" in index_content[scene_name]
            assert "hash" in index_content[scene_name]

    def test_pipeline_resource_cleanup(self, pipeline_workspace, full_pipeline_handler):
        """Test pipeline properly cleans up resources"""

        # Create temporary files during processing
        temp_files_before = len(list(pipeline_workspace.glob("**/*.tmp")))

        # Process a video
        video_path = pipeline_workspace / "manim-output" / "cleanup_resource_test.mp4"
        create_test_video_file(video_path, size_mb=1)

        success = full_pipeline_handler.copy_video(str(video_path))
        assert success is True

        # Check no temporary files left behind
        temp_files_after = len(list(pipeline_workspace.glob("**/*.tmp")))
        assert temp_files_after == temp_files_before

        # Check no lock files left behind
        lock_files = list(pipeline_workspace.glob("**/*.lock"))
        assert len(lock_files) == 0

        # Check manifest is properly closed (no file handles)
        # This is more of a conceptual test - in practice we'd check process handles
        manifest_path = pipeline_workspace / ".manim-bridge-manifest.json"
        assert manifest_path.exists()

        # Should be able to read/write manifest immediately
        with open(manifest_path) as f:
            data = json.load(f)

        # Should be non-empty and valid
        assert len(data) > 0
        assert str(video_path) in data
