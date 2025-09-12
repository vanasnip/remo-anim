"""
Test suite for the logging infrastructure.
Tests both Python logging (manim-bridge) and integration points.
"""

import json
import logging
import tempfile
import time
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Import our logging components
from manim_bridge.logging_config import (
    StructuredJSONFormatter,
    PerformanceLogger,
    setup_logger,
    log_file_operation,
    log_performance,
    log_system_event,
)
from manim_bridge.log_parser import LogEntry, LogParser


class TestStructuredJSONFormatter(unittest.TestCase):
    """Test the structured JSON formatter."""

    def setUp(self):
        self.formatter = StructuredJSONFormatter(component="test-component")

    def test_basic_formatting(self):
        """Test basic log record formatting."""
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="test.py",
            lineno=10,
            msg="Test message",
            args=(),
            exc_info=None,
        )
        record.module = "test_module"
        record.funcName = "test_function"

        formatted = self.formatter.format(record)
        parsed = json.loads(formatted)

        self.assertEqual(parsed["level"], "INFO")
        self.assertEqual(parsed["component"], "test-component")
        self.assertEqual(parsed["module"], "test_module")
        self.assertEqual(parsed["function"], "test_function")
        self.assertEqual(parsed["message"], "Test message")
        self.assertIn("timestamp", parsed)

    def test_extra_fields(self):
        """Test formatting with extra fields."""
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="test.py",
            lineno=10,
            msg="Test message",
            args=(),
            exc_info=None,
        )
        record.module = "test_module"
        record.funcName = "test_function"
        record.action = "test_action"
        record.data = {"key": "value"}
        record.performance = {"duration_seconds": 1.5}

        formatted = self.formatter.format(record)
        parsed = json.loads(formatted)

        self.assertEqual(parsed["action"], "test_action")
        self.assertEqual(parsed["data"], {"key": "value"})
        self.assertEqual(parsed["performance"], {"duration_seconds": 1.5})

    def test_exception_formatting(self):
        """Test exception formatting."""
        import sys
        try:
            raise ValueError("Test exception")
        except ValueError:
            exc_info = sys.exc_info()
            record = logging.LogRecord(
                name="test",
                level=logging.ERROR,
                pathname="test.py",
                lineno=10,
                msg="Error occurred",
                args=(),
                exc_info=exc_info,
            )
            record.module = "test_module"
            record.funcName = "test_function"

            formatted = self.formatter.format(record)
            parsed = json.loads(formatted)

            self.assertIn("exception", parsed)
            self.assertEqual(parsed["exception"]["type"], "ValueError")
            self.assertEqual(parsed["exception"]["message"], "Test exception")
            self.assertIn("traceback", parsed["exception"])


class TestPerformanceLogger(unittest.TestCase):
    """Test the performance logging context manager."""

    def setUp(self):
        self.logger = MagicMock(spec=logging.Logger)

    def test_successful_operation(self):
        """Test logging successful operation."""
        with PerformanceLogger(self.logger, "test_operation", param="value"):
            time.sleep(0.01)  # Small delay to ensure measurable duration

        # Should log start and complete
        self.assertEqual(self.logger.debug.call_count, 1)
        self.assertEqual(self.logger.info.call_count, 1)
        self.assertEqual(self.logger.error.call_count, 0)

        # Check complete log call
        complete_call = self.logger.info.call_args
        self.assertIn("Completed test_operation", complete_call[0][0])
        extra = complete_call[1]["extra"]
        self.assertEqual(extra["action"], "test_operation_complete")
        self.assertIn("duration_seconds", extra["performance"])

    def test_failed_operation(self):
        """Test logging failed operation."""
        with self.assertRaises(ValueError):
            with PerformanceLogger(self.logger, "test_operation"):
                raise ValueError("Test error")

        # Should log start and error
        self.assertEqual(self.logger.debug.call_count, 1)
        self.assertEqual(self.logger.error.call_count, 1)
        self.assertEqual(self.logger.info.call_count, 0)


class TestSetupLogger(unittest.TestCase):
    """Test logger setup function."""

    def test_logger_setup(self):
        """Test basic logger setup."""
        with tempfile.TemporaryDirectory() as temp_dir:
            log_dir = Path(temp_dir)
            logger = setup_logger(
                name="test-logger",
                log_level="DEBUG",
                log_dir=log_dir,
                component="test-component",
            )

            # Test logging
            logger.info("Test message")

            # Check log file was created
            log_file = log_dir / "test-component.log"
            self.assertTrue(log_file.exists())

            # Check log content
            with open(log_file) as f:
                log_line = f.readline().strip()
                parsed = json.loads(log_line)
                self.assertEqual(parsed["level"], "INFO")
                self.assertEqual(parsed["component"], "test-component")
                self.assertEqual(parsed["message"], "Test message")

    def test_log_rotation(self):
        """Test log file rotation."""
        with tempfile.TemporaryDirectory() as temp_dir:
            log_dir = Path(temp_dir)
            logger = setup_logger(
                name="test-logger",
                log_level="DEBUG",
                log_dir=log_dir,
                component="test-component",
                max_bytes=100,  # Very small file size for testing
                backup_count=2,
            )

            # Generate enough logs to trigger rotation
            for i in range(50):
                logger.info(f"Test message {i} with some extra content to increase size")

            # Check that rotation occurred
            log_files = list(log_dir.glob("test-component.log*"))
            self.assertGreater(len(log_files), 1)


class TestLogHelpers(unittest.TestCase):
    """Test logging helper functions."""

    def setUp(self):
        self.logger = MagicMock(spec=logging.Logger)

    def test_log_file_operation_success(self):
        """Test successful file operation logging."""
        with tempfile.NamedTemporaryFile() as temp_file:
            file_path = Path(temp_file.name)

            log_file_operation(
                self.logger,
                "copy",
                file_path,
                success=True,
                target="/target/path",
                scene="test_scene",
            )

            self.logger.info.assert_called_once()
            call_args = self.logger.info.call_args
            self.assertIn("Successfully copy", call_args[0][0])
            extra = call_args[1]["extra"]
            self.assertEqual(extra["action"], "file_copy")
            self.assertIn("filepath", extra["data"])
            self.assertIn("target", extra["data"])

    def test_log_file_operation_failure(self):
        """Test failed file operation logging."""
        file_path = Path("/nonexistent/file")
        error = FileNotFoundError("File not found")

        log_file_operation(
            self.logger, "copy", file_path, success=False, error=error
        )

        self.logger.error.assert_called_once()
        call_args = self.logger.error.call_args
        self.assertIn("Failed to copy", call_args[0][0])
        extra = call_args[1]["extra"]
        self.assertEqual(extra["action"], "file_copy_error")
        self.assertIn("error", extra)

    def test_log_system_event(self):
        """Test system event logging."""
        log_system_event(
            self.logger,
            "System started",
            level="INFO",
            version="1.0.0",
            config="production",
        )

        self.logger.log.assert_called_once()
        call_args = self.logger.log.call_args
        self.assertEqual(call_args[0][0], logging.INFO)
        self.assertEqual(call_args[0][1], "System started")
        extra = call_args[1]["extra"]
        self.assertEqual(extra["action"], "system_event")
        self.assertEqual(extra["data"]["version"], "1.0.0")


class TestLogPerformanceContextManager(unittest.TestCase):
    """Test the log_performance context manager."""

    def setUp(self):
        self.logger = MagicMock(spec=logging.Logger)

    def test_performance_logging(self):
        """Test performance context manager."""
        with log_performance(self.logger, "test_operation", param="value"):
            time.sleep(0.01)

        # Should have debug and info calls
        self.assertEqual(self.logger.debug.call_count, 1)
        self.assertEqual(self.logger.info.call_count, 1)


class TestLogEntry(unittest.TestCase):
    """Test LogEntry class."""

    def test_log_entry_creation(self):
        """Test creating log entry from data."""
        data = {
            "timestamp": "2023-09-05T10:30:00Z",
            "level": "INFO",
            "component": "test",
            "module": "test_module",
            "message": "Test message",
            "action": "test_action",
            "data": {"key": "value"},
        }

        entry = LogEntry(data)

        self.assertEqual(entry.level, "INFO")
        self.assertEqual(entry.component, "test")
        self.assertEqual(entry.module, "test_module")
        self.assertEqual(entry.message, "Test message")
        self.assertEqual(entry.action, "test_action")
        self.assertEqual(entry.data, {"key": "value"})

    def test_matches_filter(self):
        """Test filter matching."""
        data = {
            "timestamp": "2023-09-05T10:30:00Z",
            "level": "INFO",
            "component": "test",
            "message": "Test message",
        }

        entry = LogEntry(data)

        # Should match
        self.assertTrue(entry.matches_filter({"level": "INFO"}))
        self.assertTrue(entry.matches_filter({"component": "test"}))
        self.assertTrue(entry.matches_filter({"text": "Test"}))

        # Should not match
        self.assertFalse(entry.matches_filter({"level": "ERROR"}))
        self.assertFalse(entry.matches_filter({"component": "other"}))
        self.assertFalse(entry.matches_filter({"text": "NotFound"}))


class TestLogParser(unittest.TestCase):
    """Test LogParser class."""

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.log_dir = Path(self.temp_dir)

    def tearDown(self):
        import shutil
        shutil.rmtree(self.temp_dir)

    def create_test_log(self, filename: str, entries: list):
        """Create a test log file with given entries."""
        log_file = self.log_dir / filename
        with open(log_file, 'w') as f:
            for entry in entries:
                f.write(json.dumps(entry) + '\n')

    def test_load_logs(self):
        """Test loading logs from directory."""
        entries = [
            {
                "timestamp": "2023-09-05T10:30:00Z",
                "level": "INFO",
                "component": "test",
                "message": "Test message 1",
            },
            {
                "timestamp": "2023-09-05T10:31:00Z",
                "level": "ERROR",
                "component": "test",
                "message": "Test message 2",
            },
        ]

        self.create_test_log("test.log", entries)

        parser = LogParser(self.log_dir)
        self.assertEqual(len(parser.entries), 2)
        self.assertEqual(parser.entries[0].message, "Test message 1")
        self.assertEqual(parser.entries[1].message, "Test message 2")

    def test_search_functionality(self):
        """Test log search functionality."""
        entries = [
            {
                "timestamp": "2023-09-05T10:30:00Z",
                "level": "INFO",
                "component": "test1",
                "message": "Info message",
            },
            {
                "timestamp": "2023-09-05T10:31:00Z",
                "level": "ERROR",
                "component": "test2",
                "message": "Error message",
            },
        ]

        self.create_test_log("test.log", entries)
        parser = LogParser(self.log_dir)

        # Test level filter
        info_logs = parser.search(level="INFO")
        self.assertEqual(len(info_logs), 1)
        self.assertEqual(info_logs[0].message, "Info message")

        # Test component filter
        test1_logs = parser.search(component="test1")
        self.assertEqual(len(test1_logs), 1)
        self.assertEqual(test1_logs[0].component, "test1")

        # Test text search
        error_logs = parser.search_text("Error")
        self.assertEqual(len(error_logs), 1)
        self.assertEqual(error_logs[0].level, "ERROR")

    def test_performance_stats(self):
        """Test performance statistics generation."""
        entries = [
            {
                "timestamp": "2023-09-05T10:30:00Z",
                "level": "INFO",
                "component": "test",
                "action": "copy_file",
                "message": "File copied",
                "performance": {"duration_seconds": 1.5},
            },
            {
                "timestamp": "2023-09-05T10:31:00Z",
                "level": "INFO",
                "component": "test",
                "action": "copy_file",
                "message": "File copied",
                "performance": {"duration_seconds": 2.5},
            },
        ]

        self.create_test_log("test.log", entries)
        parser = LogParser(self.log_dir)

        stats = parser.get_performance_stats()
        self.assertEqual(stats["count"], 2)
        self.assertEqual(stats["total_duration"], 4.0)
        self.assertEqual(stats["average_duration"], 2.0)
        self.assertEqual(stats["min_duration"], 1.5)
        self.assertEqual(stats["max_duration"], 2.5)

    def test_error_analysis(self):
        """Test error analysis functionality."""
        entries = [
            {
                "timestamp": "2023-09-05T10:30:00Z",
                "level": "ERROR",
                "component": "test",
                "message": "File not found: /path/to/file1",
            },
            {
                "timestamp": "2023-09-05T10:31:00Z",
                "level": "ERROR",
                "component": "test",
                "message": "File not found: /path/to/file2",
            },
        ]

        self.create_test_log("test.log", entries)
        parser = LogParser(self.log_dir)

        errors = parser.get_errors()
        self.assertEqual(len(errors), 2)

        patterns = parser.get_error_patterns()
        self.assertIn("File not found: <path>", patterns)
        self.assertEqual(patterns["File not found: <path>"], 2)

    def test_report_generation(self):
        """Test report generation."""
        entries = [
            {
                "timestamp": "2023-09-05T10:30:00Z",
                "level": "INFO",
                "component": "test",
                "message": "Info message",
            },
            {
                "timestamp": "2023-09-05T10:31:00Z",
                "level": "ERROR",
                "component": "test",
                "message": "Error message",
            },
        ]

        self.create_test_log("test.log", entries)
        parser = LogParser(self.log_dir)

        report = parser.generate_report()
        self.assertIn("LOG ANALYSIS REPORT", report)
        self.assertIn("Total entries: 2", report)
        self.assertIn("LOG LEVEL DISTRIBUTION", report)
        self.assertIn("INFO:", report)
        self.assertIn("ERROR:", report)


class TestIntegration(unittest.TestCase):
    """Integration tests for the logging system."""

    def test_end_to_end_logging(self):
        """Test complete logging flow from creation to parsing."""
        with tempfile.TemporaryDirectory() as temp_dir:
            log_dir = Path(temp_dir)

            # Set up logger
            logger = setup_logger(
                name="integration-test",
                log_level="DEBUG",
                log_dir=log_dir,
                component="integration-test",
            )

            # Generate various log entries
            logger.debug("Debug message")
            logger.info("Info message")
            logger.warning("Warning message")

            # Log with performance data
            with log_performance(logger, "test_operation"):
                time.sleep(0.01)

            # Log file operation
            test_file = Path(temp_dir) / "test.txt"
            test_file.write_text("test content")
            log_file_operation(logger, "create", test_file, success=True)

            # Log system event
            log_system_event(logger, "Test completed", status="success")

            # Parse the logs
            parser = LogParser(log_dir)
            entries = parser.entries

            # Verify we have expected entries
            self.assertGreater(len(entries), 5)

            # Check for different log levels
            levels = {entry.level for entry in entries}
            self.assertIn("DEBUG", levels)
            self.assertIn("INFO", levels)
            self.assertIn("WARNING", levels)

            # Check for performance data
            perf_entries = [e for e in entries if e.performance]
            self.assertGreater(len(perf_entries), 0)

            # Generate report
            report = parser.generate_report()
            self.assertIn("LOG ANALYSIS REPORT", report)
            self.assertIn("PERFORMANCE STATISTICS", report)


if __name__ == "__main__":
    # Run the tests
    unittest.main(verbosity=2)
