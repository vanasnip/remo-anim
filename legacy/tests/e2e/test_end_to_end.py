"""End-to-end tests for the complete Manim Bridge pipeline."""

import json
import threading
import time
from pathlib import Path

import pytest

from manim_bridge.bridge import ManimBridge
from manim_bridge.core.config import BridgeConfig
from tests.conftest import TestVideoGenerator, create_corrupted_bridge_manifest


@pytest.mark.e2e
@pytest.mark.slow
class TestCompleteWorkflow:
    """Test complete workflows from start to finish."""

    def test_basic_video_processing_workflow(self, temp_workspace):
        """Test the basic video processing workflow end-to-end."""
        # Setup configuration
        config = BridgeConfig(
            source_dir=temp_workspace / "manim-output",
            target_dir=temp_workspace / "remotion-app/public/assets/manim",
            manifest_file=temp_workspace / ".manim-bridge-manifest.json",
            enable_dev_logging=True,
            log_performance=True,
            scan_on_start=False,
        )

        # Create source videos in typical manim structure
        scenes = [
            ("Intro", "480p15"),
            ("MainContent", "720p30"),
            ("Conclusion", "1080p60"),
        ]

        source_videos = []
        for scene_name, quality in scenes:
            quality_dir = config.source_dir / quality
            quality_dir.mkdir(parents=True)

            video_file = quality_dir / f"{scene_name}.mp4"
            TestVideoGenerator.create_fake_video(video_file, size=1024 + len(scene_name) * 100)
            source_videos.append(video_file)

        # Initialize bridge
        bridge = ManimBridge(config)

        # Process videos individually
        processed_videos = []
        for video in source_videos:
            success = bridge.process_file(video)
            assert success is True, f"Failed to process {video.name}"
            processed_videos.append(video)

        # Verify results
        # 1. Check target directory has processed videos (excluding symlinks)
        target_files = [f for f in config.target_dir.glob("*.mp4") if "_latest" not in f.name]
        assert len(target_files) == len(
            source_videos
        ), f"Expected {len(source_videos)} videos, found {len(target_files)}"

        # 2. Check manifest was updated
        manifest_data = bridge.manifest_handler.read()
        assert len(manifest_data) == len(source_videos), "Manifest missing entries"

        for video in source_videos:
            assert str(video) in manifest_data, f"Manifest missing entry for {video.name}"
            entry = manifest_data[str(video)]

            # Verify manifest entry structure
            required_fields = [
                "hash",
                "target",
                "processed_at",
                "scene",
                "quality",
                "size",
            ]
            for field in required_fields:
                assert field in entry, f"Manifest entry missing {field}"

            # Verify target file exists
            target_path = Path(entry["target"])
            assert target_path.exists(), f"Target file doesn't exist: {target_path}"

        # 3. Check video index was created (if enabled)
        if config.update_index:
            index_file = config.target_dir / "index.json"
            if index_file.exists():
                with open(index_file) as f:
                    index_data = json.load(f)

                assert "videos" in index_data
                assert len(index_data["videos"]) == len(source_videos)

        # 4. Verify performance metrics were collected
        if bridge.metrics.enabled:
            report = bridge.metrics.get_report()
            assert report["enabled"] is True
            assert report["summary"]["count"] > 0

    def test_bulk_scan_processing_workflow(self, temp_workspace):
        """Test bulk scanning and processing workflow."""
        config = BridgeConfig(
            source_dir=temp_workspace / "manim-output",
            target_dir=temp_workspace / "remotion-assets",
            manifest_file=temp_workspace / "bulk-manifest.json",
            enable_dev_logging=True,
            scan_on_start=True,
        )

        # Create multiple videos in different qualities
        qualities = ["480p15", "720p30", "1080p60"]
        scenes = ["Opening", "Scene1", "Scene2", "Scene3", "Finale"]

        all_videos = []
        for quality in qualities:
            quality_dir = config.source_dir / quality
            quality_dir.mkdir(parents=True)

            for scene in scenes:
                video_file = quality_dir / f"{scene}.mp4"
                size = 1024 + hash(scene + quality) % 2048  # Pseudo-random but consistent size
                TestVideoGenerator.create_fake_video(video_file, size=size)
                all_videos.append(video_file)

        # Initialize bridge (will scan on start)
        bridge = ManimBridge(config)

        # Manually trigger scan to ensure it processes
        processed_count = bridge.scan_existing_files()

        # Verify bulk processing results
        assert processed_count > 0, "No videos were processed"
        assert processed_count <= len(all_videos), "Processed more videos than exist"

        # Check all expected files were processed
        manifest_data = bridge.manifest_handler.read()
        target_files = [f for f in config.target_dir.glob("*.mp4") if "_latest" not in f.name]

        assert len(target_files) == processed_count
        assert len(manifest_data) == processed_count

        # Verify processing was efficient (no duplicates)
        processed_hashes = [entry["hash"] for entry in manifest_data.values()]
        assert len(set(processed_hashes)) == len(processed_hashes), "Duplicate processing detected"

    def test_incremental_processing_workflow(self, temp_workspace):
        """Test incremental processing of new videos."""
        config = BridgeConfig(
            source_dir=temp_workspace / "manim-output",
            target_dir=temp_workspace / "incremental-target",
            manifest_file=temp_workspace / "incremental-manifest.json",
            enable_dev_logging=True,
        )

        bridge = ManimBridge(config)

        # Phase 1: Process initial set of videos
        initial_videos = []
        for i in range(3):
            quality_dir = config.source_dir / "720p30"
            quality_dir.mkdir(parents=True, exist_ok=True)

            video_file = quality_dir / f"Initial_{i}.mp4"
            TestVideoGenerator.create_fake_video(video_file, size=1024 + i * 200)
            initial_videos.append(video_file)

            success = bridge.process_file(video_file)
            assert success is True

        # Verify initial processing
        initial_manifest = bridge.manifest_handler.read()
        initial_target_files = [
            f for f in config.target_dir.glob("*.mp4") if "_latest" not in f.name
        ]

        assert len(initial_manifest) == 3
        assert len(initial_target_files) == 3

        # Phase 2: Add new videos and process incrementally
        new_videos = []
        for i in range(3, 6):
            video_file = quality_dir / f"Additional_{i}.mp4"
            TestVideoGenerator.create_fake_video(video_file, size=1024 + i * 200)
            new_videos.append(video_file)

            success = bridge.process_file(video_file)
            assert success is True

        # Verify incremental processing
        final_manifest = bridge.manifest_handler.read()
        final_target_files = [f for f in config.target_dir.glob("*.mp4") if "_latest" not in f.name]

        assert len(final_manifest) == 6  # 3 initial + 3 new
        assert len(final_target_files) == 6

        # Verify original files weren't reprocessed
        for video in initial_videos:
            original_entry = initial_manifest[str(video)]
            current_entry = final_manifest[str(video)]
            assert (
                original_entry["processed_at"] == current_entry["processed_at"]
            ), "Original video was reprocessed"

        # Phase 3: Modify existing video and verify reprocessing
        modified_video = initial_videos[0]
        # Change content to change hash
        TestVideoGenerator.create_fake_video(modified_video, size=2048)  # Different size

        success = bridge.process_file(modified_video)
        assert success is True

        # Verify modified video was reprocessed
        updated_manifest = bridge.manifest_handler.read()
        original_entry = initial_manifest[str(modified_video)]
        updated_entry = updated_manifest[str(modified_video)]

        assert original_entry["hash"] != updated_entry["hash"], "Hash should have changed"
        assert (
            original_entry["processed_at"] != updated_entry["processed_at"]
        ), "Processed timestamp should have updated"

    def test_error_recovery_workflow(self, temp_workspace):
        """Test error recovery and resilience workflow."""
        config = BridgeConfig(
            source_dir=temp_workspace / "manim-output",
            target_dir=temp_workspace / "recovery-target",
            manifest_file=temp_workspace / "recovery-manifest.json",
            enable_dev_logging=True,
        )

        # Create initial working setup
        quality_dir = config.source_dir / "720p30"
        quality_dir.mkdir(parents=True)

        working_videos = []
        for i in range(3):
            video_file = quality_dir / f"Working_{i}.mp4"
            TestVideoGenerator.create_fake_video(video_file, size=1024 + i * 100)
            working_videos.append(video_file)

        bridge = ManimBridge(config)

        # Process working videos successfully
        for video in working_videos:
            success = bridge.process_file(video)
            assert success is True

        initial_state = bridge.manifest_handler.read()
        assert len(initial_state) == 3

        # Scenario 1: Corrupted manifest recovery
        create_corrupted_bridge_manifest(config.manifest_file)

        # Create new bridge instance (should handle corrupted manifest)
        recovery_bridge = ManimBridge(config)

        # Should start with empty manifest (corruption handled)
        recovered_manifest = recovery_bridge.manifest_handler.read()
        assert isinstance(recovered_manifest, dict)  # Should be valid dict, possibly empty

        # Should be able to reprocess videos
        reprocess_video = working_videos[0]
        success = recovery_bridge.process_file(reprocess_video)
        assert success is True

        # Scenario 2: Target directory issues
        # Make target directory read-only
        config.target_dir.chmod(0o555)

        try:
            problem_video = quality_dir / "Problem.mp4"
            TestVideoGenerator.create_fake_video(problem_video)

            # Should fail gracefully
            success = recovery_bridge.process_file(problem_video)
            assert success is False

            # System should still be in consistent state
            manifest_after_error = recovery_bridge.manifest_handler.read()
            assert isinstance(manifest_after_error, dict)

        finally:
            # Restore permissions
            config.target_dir.chmod(0o755)

        # Scenario 3: Invalid video file handling
        invalid_video = quality_dir / "Invalid.mp4"
        invalid_video.write_bytes(b"This is not a valid video file")

        # Should handle invalid video gracefully
        success = recovery_bridge.process_file(invalid_video)
        assert success is False  # Should fail but not crash

        # System should remain functional
        test_video = quality_dir / "TestAfterError.mp4"
        TestVideoGenerator.create_fake_video(test_video)
        success = recovery_bridge.process_file(test_video)
        assert success is True  # Should work after error

    def test_concurrent_processing_workflow(self, temp_workspace):
        """Test concurrent processing workflow."""
        config = BridgeConfig(
            source_dir=temp_workspace / "manim-output",
            target_dir=temp_workspace / "concurrent-target",
            manifest_file=temp_workspace / "concurrent-manifest.json",
            enable_dev_logging=True,
            log_performance=True,
        )

        # Create multiple videos for concurrent processing
        videos = []
        for quality in ["480p15", "720p30", "1080p60"]:
            quality_dir = config.source_dir / quality
            quality_dir.mkdir(parents=True)

            for i in range(5):  # 5 videos per quality
                video_file = quality_dir / f"Concurrent_{quality}_{i}.mp4"
                size = 1024 + i * 100 + hash(quality) % 500
                TestVideoGenerator.create_fake_video(video_file, size=size)
                videos.append(video_file)

        bridge = ManimBridge(config)

        # Process videos concurrently
        results = []
        errors = []

        def worker(video_list):
            """Worker function for concurrent processing."""
            try:
                worker_results = []
                for video in video_list:
                    success = bridge.process_file(video)
                    worker_results.append((video, success))
                    time.sleep(0.01)  # Small delay to encourage concurrency
                results.extend(worker_results)
            except Exception as e:
                errors.append(e)

        # Split videos among workers
        num_workers = 3
        videos_per_worker = len(videos) // num_workers
        threads = []

        for i in range(num_workers):
            start_idx = i * videos_per_worker
            end_idx = start_idx + videos_per_worker if i < num_workers - 1 else len(videos)
            worker_videos = videos[start_idx:end_idx]

            t = threading.Thread(target=worker, args=(worker_videos,))
            threads.append(t)
            t.start()

        # Wait for completion
        for t in threads:
            t.join()

        # Verify concurrent processing results
        assert len(errors) == 0, f"Concurrent processing errors: {errors}"
        assert len(results) == len(videos), "Not all videos were processed"

        successful_results = [r for r in results if r[1] is True]
        assert len(successful_results) > 0, "No videos processed successfully"

        # Verify final state consistency
        final_manifest = bridge.manifest_handler.read(use_cache=False)
        target_files = [f for f in config.target_dir.glob("*.mp4") if "_latest" not in f.name]

        assert len(target_files) == len(successful_results)
        assert len(final_manifest) == len(successful_results)

        # Verify no duplicate processing
        processed_hashes = [entry["hash"] for entry in final_manifest.values()]
        assert len(set(processed_hashes)) == len(processed_hashes), "Duplicate processing detected"

    def test_configuration_changes_workflow(self, temp_workspace):
        """Test workflow with configuration changes."""
        # Start with initial configuration
        initial_config = BridgeConfig(
            source_dir=temp_workspace / "manim-output",
            target_dir=temp_workspace / "initial-target",
            manifest_file=temp_workspace / "initial-manifest.json",
            enable_dev_logging=False,
            create_latest_symlink=False,
        )

        # Create test videos
        quality_dir = initial_config.source_dir / "720p30"
        quality_dir.mkdir(parents=True)

        test_videos = []
        for i in range(3):
            video_file = quality_dir / f"Config_{i}.mp4"
            TestVideoGenerator.create_fake_video(video_file, size=1024 + i * 200)
            test_videos.append(video_file)

        # Process with initial configuration
        initial_bridge = ManimBridge(initial_config)
        for video in test_videos:
            success = initial_bridge.process_file(video)
            assert success is True

        initial_target_files = [
            f for f in initial_config.target_dir.glob("*.mp4") if "_latest" not in f.name
        ]
        assert len(initial_target_files) == 3

        # Change configuration - new target directory and enable symlinks
        updated_config = BridgeConfig(
            source_dir=temp_workspace / "manim-output",  # Same source
            target_dir=temp_workspace / "updated-target",  # New target
            manifest_file=temp_workspace / "updated-manifest.json",  # New manifest
            enable_dev_logging=True,
            create_latest_symlink=True,
        )

        # Process with updated configuration
        updated_bridge = ManimBridge(updated_config)
        for video in test_videos:
            success = updated_bridge.process_file(video)
            assert success is True

        # Verify updated configuration results
        updated_target_files = [
            f for f in updated_config.target_dir.glob("*.mp4") if "_latest" not in f.name
        ]
        updated_symlinks = list(updated_config.target_dir.glob("*_latest.mp4"))

        assert len(updated_target_files) >= 3  # At least the main files
        if updated_config.create_latest_symlink:
            assert len(updated_symlinks) > 0, "Latest symlinks not created"

        # Original target should be unchanged
        assert len(list(initial_config.target_dir.glob("*.mp4"))) == 3

    def test_large_scale_workflow(self, temp_workspace):
        """Test large-scale processing workflow."""
        config = BridgeConfig(
            source_dir=temp_workspace / "manim-output",
            target_dir=temp_workspace / "large-scale-target",
            manifest_file=temp_workspace / "large-scale-manifest.json",
            enable_dev_logging=False,  # Disable for performance
            log_performance=True,
        )

        bridge = ManimBridge(config)

        # Create large number of videos
        num_videos = 50  # Reduced for testing environment
        qualities = ["480p15", "720p30", "1080p60"]

        all_videos = []
        for i in range(num_videos):
            quality = qualities[i % len(qualities)]
            quality_dir = config.source_dir / quality
            quality_dir.mkdir(parents=True, exist_ok=True)

            video_file = quality_dir / f"Large_{i:03d}.mp4"
            size = 1024 + (i % 10) * 200  # Varying sizes
            TestVideoGenerator.create_fake_video(video_file, size=size)
            all_videos.append(video_file)

        # Process using bulk scan
        start_time = time.perf_counter()
        processed_count = bridge.scan_existing_files()
        processing_time = time.perf_counter() - start_time

        # Verify large-scale processing
        assert processed_count == num_videos, f"Expected {num_videos}, processed {processed_count}"

        # Performance should be reasonable
        avg_time_per_video = processing_time / processed_count
        assert (
            avg_time_per_video < 1.0
        ), f"Large-scale processing too slow: {avg_time_per_video}s per video"

        # Verify results integrity
        manifest_data = bridge.manifest_handler.read()
        target_files = [f for f in config.target_dir.glob("*.mp4") if "_latest" not in f.name]

        assert len(manifest_data) == num_videos
        assert len(target_files) == num_videos

        # Verify no data corruption
        for video in all_videos:
            assert str(video) in manifest_data, f"Missing manifest entry: {video.name}"

            entry = manifest_data[str(video)]
            target_path = Path(entry["target"])
            assert target_path.exists(), f"Missing target file: {target_path}"

        # Test performance metrics collection
        if bridge.metrics.enabled:
            report = bridge.metrics.get_report()
            assert report["summary"]["count"] >= num_videos
            assert report["summary"]["success_rate"] == 100.0


@pytest.mark.e2e
class TestRealWorldScenarios:
    """Test real-world usage scenarios."""

    def test_manim_development_workflow(self, temp_workspace):
        """Test typical manim development workflow."""
        config = BridgeConfig(
            source_dir=temp_workspace / "media/videos",  # Typical manim output
            target_dir=temp_workspace / "public/manim",
            manifest_file=temp_workspace / ".manim-bridge.json",
            enable_dev_logging=True,
            create_latest_symlink=True,
            scan_on_start=False,
        )

        # Simulate manim scene rendering workflow
        scenes = [
            ("intro/IntroScene", "1080p60"),
            ("content/MainContent", "1080p60"),
            ("content/Examples", "720p30"),
            ("outro/OutroScene", "480p15"),
        ]

        bridge = ManimBridge(config)

        # Phase 1: Render intro scene
        intro_dir = config.source_dir / scenes[0][0]
        intro_quality_dir = intro_dir / scenes[0][1]
        intro_quality_dir.mkdir(parents=True)

        intro_video = intro_quality_dir / "IntroScene.mp4"
        TestVideoGenerator.create_fake_video(intro_video, size=2048)

        success = bridge.process_file(intro_video)
        assert success is True

        # Check latest symlink was created
        if config.create_latest_symlink:
            latest_link = config.target_dir / "IntroScene_latest.mp4"
            if latest_link.exists():
                assert latest_link.is_symlink()

        # Phase 2: Render content scenes
        for scene_path, quality in scenes[1:3]:
            scene_dir = config.source_dir / scene_path
            quality_dir = scene_dir / quality
            quality_dir.mkdir(parents=True)

            scene_name = scene_path.split("/")[-1]
            video_file = quality_dir / f"{scene_name}.mp4"
            TestVideoGenerator.create_fake_video(video_file, size=1536)

            success = bridge.process_file(video_file)
            assert success is True

        # Phase 3: Re-render intro with changes
        # Simulate content change by creating different content
        TestVideoGenerator.create_fake_video(intro_video, size=2560)  # Different size

        success = bridge.process_file(intro_video)
        assert success is True

        # Verify final state
        manifest_data = bridge.manifest_handler.read()
        assert len(manifest_data) == 3  # 3 unique scenes processed

        # Check all target files exist
        target_files = [f for f in config.target_dir.glob("*.mp4") if "_latest" not in f.name]
        assert len(target_files) >= 3

    def test_production_deployment_workflow(self, temp_workspace):
        """Test production deployment workflow."""
        config = BridgeConfig(
            source_dir=temp_workspace / "manim-output",
            target_dir=temp_workspace / "production-assets",
            manifest_file=temp_workspace / "production-manifest.json",
            enable_dev_logging=False,  # Production: minimal logging
            log_performance=False,  # Production: no perf monitoring
            create_latest_symlink=False,  # Production: no symlinks
            update_index=True,  # Production: maintain index
        )

        # Create production-ready videos
        production_scenes = [
            ("ProductIntro", "1080p60"),
            ("FeatureDemo", "1080p60"),
            ("Tutorial", "720p30"),
            ("CallToAction", "1080p60"),
        ]

        bridge = ManimBridge(config)

        for scene_name, quality in production_scenes:
            quality_dir = config.source_dir / quality
            quality_dir.mkdir(parents=True, exist_ok=True)

            video_file = quality_dir / f"{scene_name}.mp4"
            # Production videos are larger
            size = 1024 * 1024 * 2  # 2MB each
            TestVideoGenerator.create_fake_video(video_file, size=size)

            success = bridge.process_file(video_file)
            assert success is True, f"Failed to process production video: {scene_name}"

        # Verify production deployment results
        target_files = [f for f in config.target_dir.glob("*.mp4") if "_latest" not in f.name]
        assert len(target_files) == len(production_scenes)

        # Check video index was created
        index_file = config.target_dir / "index.json"
        if config.update_index and index_file.exists():
            with open(index_file) as f:
                index_data = json.load(f)

            assert "videos" in index_data
            assert len(index_data["videos"]) == len(production_scenes)
            assert "updated_at" in index_data
            assert "total_count" in index_data

        # Verify no symlinks were created (production setting)
        symlinks = list(config.target_dir.glob("*_latest*"))
        assert len(symlinks) == 0, "No symlinks should be created in production"

        # Verify manifest is comprehensive
        manifest_data = bridge.manifest_handler.read()
        assert len(manifest_data) == len(production_scenes)

        for scene_name, quality in production_scenes:
            # Find corresponding manifest entry
            found = False
            for entry in manifest_data.values():
                if entry.get("scene") == scene_name and entry.get("quality") == quality:
                    found = True
                    # Verify production metadata
                    assert entry.get("size", 0) > 1024 * 1024  # Should be large
                    assert entry.get("hash") is not None
                    assert entry.get("target") is not None
                    break

            assert found, f"Manifest missing entry for {scene_name} ({quality})"

    def test_development_to_production_migration(self, temp_workspace):
        """Test migrating from development to production setup."""
        # Development configuration
        dev_config = BridgeConfig(
            source_dir=temp_workspace / "manim-output",
            target_dir=temp_workspace / "dev-assets",
            manifest_file=temp_workspace / "dev-manifest.json",
            enable_dev_logging=True,
            log_performance=True,
            create_latest_symlink=True,
        )

        # Production configuration
        prod_config = BridgeConfig(
            source_dir=temp_workspace / "manim-output",  # Same source
            target_dir=temp_workspace / "prod-assets",  # Different target
            manifest_file=temp_workspace / "prod-manifest.json",
            enable_dev_logging=False,
            log_performance=False,
            create_latest_symlink=False,
        )

        # Create test videos
        test_videos = []
        for i in range(5):
            quality_dir = dev_config.source_dir / "1080p60"
            quality_dir.mkdir(parents=True, exist_ok=True)

            video_file = quality_dir / f"Migration_{i}.mp4"
            TestVideoGenerator.create_fake_video(video_file, size=1024 + i * 200)
            test_videos.append(video_file)

        # Phase 1: Development processing
        dev_bridge = ManimBridge(dev_config)
        for video in test_videos:
            success = dev_bridge.process_file(video)
            assert success is True

        dev_manifest = dev_bridge.manifest_handler.read()
        dev_target_files = [
            f for f in dev_config.target_dir.glob("*.mp4") if "_latest" not in f.name
        ]

        assert len(dev_manifest) == 5
        assert len(dev_target_files) == 5

        # Phase 2: Production migration
        prod_bridge = ManimBridge(prod_config)

        # Process same videos in production
        for video in test_videos:
            success = prod_bridge.process_file(video)
            assert success is True

        prod_manifest = prod_bridge.manifest_handler.read()
        prod_target_files = [
            f for f in prod_config.target_dir.glob("*.mp4") if "_latest" not in f.name
        ]

        assert len(prod_manifest) == 5
        assert len(prod_target_files) == 5

        # Phase 3: Verify migration integrity
        # Same videos should have same hashes in both environments
        for video in test_videos:
            dev_entry = dev_manifest[str(video)]
            prod_entry = prod_manifest[str(video)]

            assert (
                dev_entry["hash"] == prod_entry["hash"]
            ), f"Hash mismatch for {video.name}: dev={dev_entry['hash']} vs prod={prod_entry['hash']}"
            assert dev_entry["scene"] == prod_entry["scene"]
            assert dev_entry["quality"] == prod_entry["quality"]

        # Verify environment-specific differences
        # Development should have symlinks, production shouldn't
        dev_symlinks = list(dev_config.target_dir.glob("*_latest*"))
        prod_symlinks = list(prod_config.target_dir.glob("*_latest*"))

        if dev_config.create_latest_symlink:
            assert len(dev_symlinks) > 0, "Development should have symlinks"
        assert len(prod_symlinks) == 0, "Production should not have symlinks"
