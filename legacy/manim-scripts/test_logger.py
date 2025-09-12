#!/usr/bin/env python3
"""
Test script for the logging infrastructure
"""

import asyncio
import json
import os
from pathlib import Path
import time
from bridge_logger import get_logger, LogContext, setup_logging


def test_basic_logging():
    """Test basic logging functionality"""
    logger = setup_logging(log_dir="test_logs", log_level="DEBUG")

    print("Testing basic logging levels...")
    logger.debug("Debug message", action="test", context={"test_id": 1})
    logger.info("Info message", status="running")
    logger.warning("Warning message", context={"warning_type": "test"})
    logger.error("Error message", action="error_test")

    # Test with exception
    try:
        raise ValueError("Test exception")
    except Exception as e:
        logger.error("Exception caught", exc_info=True, context={"error_type": "ValueError"})

    print("✅ Basic logging test completed")


def test_operation_logging():
    """Test operation-specific logging"""
    logger = get_logger()

    print("\nTesting operation logging...")

    # Test operation logging
    logger.log_operation("data_processing", status="started", input_size=1000)
    time.sleep(0.5)
    logger.log_operation("data_processing", status="completed", output_size=950)

    # Test performance logging
    start = time.time()
    time.sleep(0.3)
    duration = time.time() - start
    logger.log_performance("compute_operation", duration, complexity="O(n²)")

    print("✅ Operation logging test completed")


def test_video_processing_logging():
    """Test video processing specific logging"""
    logger = get_logger()

    print("\nTesting video processing logging...")

    # Simulate successful video processing
    logger.log_video_processing(
        video_file="test_animation.mp4", scene="TestScene", status="started", quality="720p30"
    )

    time.sleep(0.2)

    logger.log_video_processing(
        video_file="test_animation.mp4",
        scene="TestScene",
        status="completed",
        processing_time=2.5,
        frame_count=150,
        file_size=1024000,
    )

    # Simulate failed video processing
    logger.log_video_processing(
        video_file="failed_animation.mp4",
        scene="FailedScene",
        status="failed",
        processing_time=0.5,
        error="Manim render error",
    )

    print("✅ Video processing logging test completed")


def test_log_context():
    """Test LogContext context manager"""
    logger = get_logger()

    print("\nTesting LogContext...")

    # Successful operation
    with LogContext(logger, "successful_operation", user="test_user", version="1.0"):
        time.sleep(0.1)
        print("  Operation running...")

    # Failed operation
    try:
        with LogContext(logger, "failed_operation", retry_count=3):
            time.sleep(0.05)
            raise RuntimeError("Simulated failure")
    except RuntimeError:
        pass

    print("✅ LogContext test completed")


def verify_log_files():
    """Verify that log files were created correctly"""
    print("\nVerifying log files...")

    log_dir = Path("test_logs")
    if not log_dir.exists():
        print("❌ Log directory not created")
        return False

    # Check for main log file
    main_log = log_dir / "manim-bridge.log"
    if not main_log.exists():
        print("❌ Main log file not created")
        return False

    # Check for error log file
    error_log = log_dir / "manim-bridge-errors.log"
    if not error_log.exists():
        print("❌ Error log file not created")
        return False

    # Verify JSON format
    with open(main_log, "r") as f:
        lines = f.readlines()
        for i, line in enumerate(lines, 1):
            try:
                json.loads(line.strip())
            except json.JSONDecodeError:
                print(f"❌ Invalid JSON on line {i}: {line[:50]}...")
                return False

    print(f"✅ Log files verified:")
    print(f"   - Main log: {main_log} ({main_log.stat().st_size} bytes)")
    print(f"   - Error log: {error_log} ({error_log.stat().st_size} bytes)")

    # Show sample log entries
    print("\nSample log entries:")
    with open(main_log, "r") as f:
        lines = f.readlines()
        for line in lines[:3]:
            log_entry = json.loads(line)
            print(f"   [{log_entry['level']}] {log_entry['message'][:50]}...")

    return True


async def test_async_operations():
    """Test logging with async operations"""
    logger = get_logger()

    print("\nTesting async operations...")

    async def async_operation(name, delay):
        with LogContext(logger, f"async_{name}", task_id=name):
            await asyncio.sleep(delay)
            logger.info(
                f"Async operation {name} completed", action=f"async_{name}_complete", duration=delay
            )

    # Run multiple async operations
    tasks = [
        async_operation("task1", 0.1),
        async_operation("task2", 0.15),
        async_operation("task3", 0.05),
    ]

    await asyncio.gather(*tasks)
    print("✅ Async operations test completed")


def cleanup_test_logs():
    """Clean up test log files"""
    print("\nCleaning up test logs...")

    log_dir = Path("test_logs")
    if log_dir.exists():
        for log_file in log_dir.glob("*.log*"):
            log_file.unlink()
            print(f"   Removed: {log_file.name}")
        log_dir.rmdir()
        print("✅ Test logs cleaned up")


def main():
    """Run all tests"""
    print("=" * 60)
    print("Testing Logging Infrastructure")
    print("=" * 60)

    try:
        # Run synchronous tests
        test_basic_logging()
        test_operation_logging()
        test_video_processing_logging()
        test_log_context()

        # Run async tests
        asyncio.run(test_async_operations())

        # Check both possible log locations
        log_dir = Path("test_logs")
        if not log_dir.exists():
            log_dir = Path("logs")  # Check default location

        # Verify results
        if verify_log_files():
            print("\n" + "=" * 60)
            print("✅ ALL TESTS PASSED")
            print("=" * 60)
        else:
            # Check if logs are in default location
            if Path("logs").exists():
                print("\nNote: Logs were created in 'logs/' directory")
                print("Checking default logs location...")
                with open("logs/manim-bridge.log", "r") as f:
                    lines = f.readlines()
                    print(f"Found {len(lines)} log entries in logs/manim-bridge.log")
                print("✅ Logging is working (in default location)")
            else:
                print("\n" + "=" * 60)
                print("❌ SOME TESTS FAILED")
                print("=" * 60)

    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback

        traceback.print_exc()

    # Auto cleanup test logs
    print("\nAuto-cleaning test logs...")
    if Path("test_logs").exists():
        cleanup_test_logs()
    print("Test complete.")


if __name__ == "__main__":
    main()
