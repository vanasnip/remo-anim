"""Unit tests for the monitoring module (logging, performance metrics)."""

import json
import threading
import time
from datetime import datetime

import pytest

from manim_bridge.monitoring.logger import get_logger, setup_logging
from manim_bridge.monitoring.metrics import MetricEntry, PerformanceMonitor


@pytest.mark.unit
class TestMetricEntry:
    """Test the MetricEntry dataclass."""

    def test_metric_entry_creation(self):
        """Test creating MetricEntry object."""
        timestamp = datetime.now()
        entry = MetricEntry(
            operation="test_op",
            duration=1.5,
            timestamp=timestamp,
            success=True,
            metadata={"key": "value"},
        )

        assert entry.operation == "test_op"
        assert entry.duration == 1.5
        assert entry.timestamp == timestamp
        assert entry.success is True
        assert entry.metadata == {"key": "value"}

    def test_metric_entry_defaults(self):
        """Test MetricEntry with default values."""
        timestamp = datetime.now()
        entry = MetricEntry(operation="default_op", duration=0.5, timestamp=timestamp)

        assert entry.success is True  # Default
        assert entry.metadata == {}  # Default empty dict

    def test_metric_entry_repr(self):
        """Test MetricEntry string representation."""
        timestamp = datetime.now()
        entry = MetricEntry(operation="repr_test", duration=2.0, timestamp=timestamp, success=False)

        repr_str = repr(entry)
        assert "MetricEntry" in repr_str
        assert "repr_test" in repr_str


@pytest.mark.unit
class TestPerformanceMonitor:
    """Test the PerformanceMonitor class."""

    def test_performance_monitor_initialization_enabled(self):
        """Test PerformanceMonitor initialization when enabled."""
        monitor = PerformanceMonitor(enabled=True)

        assert monitor.enabled is True
        assert isinstance(monitor.metrics, dict)
        assert isinstance(monitor.start_times, dict)
        assert len(monitor.metrics) == 0
        assert len(monitor.start_times) == 0

    def test_performance_monitor_initialization_disabled(self):
        """Test PerformanceMonitor initialization when disabled."""
        monitor = PerformanceMonitor(enabled=False)

        assert monitor.enabled is False
        assert isinstance(monitor.metrics, dict)
        assert isinstance(monitor.start_times, dict)

    def test_start_operation_enabled(self):
        """Test starting an operation when monitor is enabled."""
        monitor = PerformanceMonitor(enabled=True)

        operation = "test_operation"
        monitor.start_operation(operation)

        assert operation in monitor.start_times
        assert isinstance(monitor.start_times[operation], float)

    def test_start_operation_disabled(self):
        """Test starting an operation when monitor is disabled."""
        monitor = PerformanceMonitor(enabled=False)

        operation = "test_operation"
        monitor.start_operation(operation)

        # Should not record anything when disabled
        assert len(monitor.start_times) == 0

    def test_end_operation_success(self):
        """Test ending an operation successfully."""
        monitor = PerformanceMonitor(enabled=True)

        operation = "test_operation"
        monitor.start_operation(operation)

        # Small delay to ensure measurable duration
        time.sleep(0.01)

        duration = monitor.end_operation(operation, success=True, test_metadata="value")

        assert duration > 0
        assert operation not in monitor.start_times  # Should be removed
        assert operation in monitor.metrics
        assert len(monitor.metrics[operation]) == 1

        entry = monitor.metrics[operation][0]
        assert entry.operation == operation
        assert entry.duration == duration
        assert entry.success is True
        assert entry.metadata["test_metadata"] == "value"

    def test_end_operation_failure(self):
        """Test ending an operation with failure."""
        monitor = PerformanceMonitor(enabled=True)

        operation = "failed_operation"
        monitor.start_operation(operation)
        time.sleep(0.01)

        duration = monitor.end_operation(operation, success=False, error="test error")

        assert duration > 0
        entry = monitor.metrics[operation][0]
        assert entry.success is False
        assert entry.metadata["error"] == "test error"

    def test_end_operation_without_start(self):
        """Test ending an operation that wasn't started."""
        monitor = PerformanceMonitor(enabled=True)

        duration = monitor.end_operation("never_started")

        assert duration == 0.0
        assert len(monitor.metrics) == 0

    def test_end_operation_disabled(self):
        """Test ending an operation when monitor is disabled."""
        monitor = PerformanceMonitor(enabled=False)

        duration = monitor.end_operation("test_op")

        assert duration == 0.0
        assert len(monitor.metrics) == 0

    def test_measure_context_manager_success(self):
        """Test the measure context manager with successful operation."""
        monitor = PerformanceMonitor(enabled=True)

        operation = "context_test"
        test_metadata = {"context": True}

        with monitor.measure(operation, **test_metadata):
            time.sleep(0.01)
            # Simulate some work
            result = 42

        assert operation in monitor.metrics
        entry = monitor.metrics[operation][0]
        assert entry.success is True
        assert entry.metadata["context"] is True
        assert entry.duration > 0

    def test_measure_context_manager_exception(self):
        """Test the measure context manager with exception."""
        monitor = PerformanceMonitor(enabled=True)

        operation = "exception_test"

        with pytest.raises(ValueError):
            with monitor.measure(operation):
                time.sleep(0.01)
                raise ValueError("Test exception")

        # Should still record the operation as failed
        assert operation in monitor.metrics
        entry = monitor.metrics[operation][0]
        assert entry.success is False
        assert entry.duration > 0

    def test_get_stats_single_operation(self):
        """Test getting statistics for a single operation."""
        monitor = PerformanceMonitor(enabled=True)

        operation = "single_op"

        # Record multiple entries
        for i in range(5):
            with monitor.measure(operation):
                time.sleep(0.01)

        stats = monitor.get_stats(operation)

        assert stats["count"] == 5
        assert stats["successful"] == 5
        assert stats["failed"] == 0
        assert stats["success_rate"] == 100.0
        assert stats["total_time"] > 0
        assert stats["average_time"] > 0
        assert stats["min_time"] > 0
        assert stats["max_time"] > 0
        assert stats["min_time"] <= stats["average_time"] <= stats["max_time"]

    def test_get_stats_mixed_success_failure(self):
        """Test statistics with mixed success and failure."""
        monitor = PerformanceMonitor(enabled=True)

        operation = "mixed_op"

        # Add successful operations
        for i in range(3):
            monitor.start_operation(operation)
            time.sleep(0.01)
            monitor.end_operation(operation, success=True)

        # Add failed operations
        for i in range(2):
            monitor.start_operation(operation)
            time.sleep(0.01)
            monitor.end_operation(operation, success=False)

        stats = monitor.get_stats(operation)

        assert stats["count"] == 5
        assert stats["successful"] == 3
        assert stats["failed"] == 2
        assert stats["success_rate"] == 60.0

    def test_get_stats_nonexistent_operation(self):
        """Test getting statistics for non-existent operation."""
        monitor = PerformanceMonitor(enabled=True)

        stats = monitor.get_stats("nonexistent")

        assert stats == {}

    def test_get_stats_all_operations(self):
        """Test getting statistics for all operations."""
        monitor = PerformanceMonitor(enabled=True)

        # Record operations of different types
        operations = ["op1", "op2", "op3"]
        for op in operations:
            with monitor.measure(op):
                time.sleep(0.01)

        stats = monitor.get_stats()  # No specific operation

        assert stats["count"] == 3
        assert stats["successful"] == 3
        assert stats["failed"] == 0
        assert stats["success_rate"] == 100.0

    def test_get_stats_disabled(self):
        """Test getting statistics when monitor is disabled."""
        monitor = PerformanceMonitor(enabled=False)

        stats = monitor.get_stats()

        assert stats == {}

    def test_get_report(self):
        """Test getting full performance report."""
        monitor = PerformanceMonitor(enabled=True)

        # Record some operations
        operations = ["report_op1", "report_op2"]
        for op in operations:
            with monitor.measure(op):
                time.sleep(0.01)

        report = monitor.get_report()

        assert report["enabled"] is True
        assert "operations" in report
        assert "summary" in report

        for op in operations:
            assert op in report["operations"]
            assert report["operations"][op]["count"] == 1

        assert report["summary"]["count"] == 2

    def test_get_report_disabled(self):
        """Test getting report when monitor is disabled."""
        monitor = PerformanceMonitor(enabled=False)

        report = monitor.get_report()

        assert report == {"enabled": False}

    def test_export_json(self, temp_workspace):
        """Test exporting metrics to JSON file."""
        monitor = PerformanceMonitor(enabled=True)

        # Record some operations
        with monitor.measure("export_test", category="test"):
            time.sleep(0.01)

        export_file = temp_workspace / "metrics.json"
        monitor.export_json(str(export_file))

        assert export_file.exists()

        with open(export_file) as f:
            data = json.load(f)

        assert "timestamp" in data
        assert "metrics" in data
        assert "export_test" in data["metrics"]

        entry = data["metrics"]["export_test"][0]
        assert "duration" in entry
        assert "timestamp" in entry
        assert "success" in entry
        assert "metadata" in entry
        assert entry["metadata"]["category"] == "test"

    def test_export_json_disabled(self, temp_workspace):
        """Test exporting JSON when monitor is disabled."""
        monitor = PerformanceMonitor(enabled=False)

        export_file = temp_workspace / "disabled_metrics.json"
        monitor.export_json(str(export_file))

        # Should not create file when disabled
        assert not export_file.exists()

    def test_reset_metrics(self):
        """Test resetting all metrics."""
        monitor = PerformanceMonitor(enabled=True)

        # Record some operations
        with monitor.measure("reset_test"):
            time.sleep(0.01)

        assert len(monitor.metrics) > 0

        # Start an operation but don't finish it
        monitor.start_operation("unfinished")
        assert len(monitor.start_times) > 0

        # Reset
        monitor.reset()

        assert len(monitor.metrics) == 0
        assert len(monitor.start_times) == 0

    def test_concurrent_metrics(self):
        """Test metrics collection under concurrent access."""
        monitor = PerformanceMonitor(enabled=True)

        results = []
        errors = []

        def worker(worker_id):
            try:
                for i in range(10):
                    op_name = f"worker_{worker_id}_op_{i}"
                    with monitor.measure(op_name, worker=worker_id):
                        time.sleep(0.001)
                    results.append(op_name)
            except Exception as e:
                errors.append(e)

        # Run concurrent workers
        threads = []
        for worker_id in range(3):
            t = threading.Thread(target=worker, args=(worker_id,))
            threads.append(t)
            t.start()

        for t in threads:
            t.join()

        # Should complete without errors
        assert len(errors) == 0
        assert len(results) == 30  # 3 workers * 10 operations
        assert len(monitor.metrics) == 30

    def test_performance_overhead(self):
        """Test that monitoring has minimal performance overhead."""
        operations_count = 1000

        # Test without monitoring
        start_time = time.time()
        for i in range(operations_count):
            time.sleep(0.0001)  # Simulate minimal work
        no_monitor_time = time.time() - start_time

        # Test with monitoring enabled
        monitor = PerformanceMonitor(enabled=True)
        start_time = time.time()
        for i in range(operations_count):
            with monitor.measure(f"op_{i}"):
                time.sleep(0.0001)
        with_monitor_time = time.time() - start_time

        # Monitoring overhead should be reasonable (less than 50% increase)
        overhead_ratio = with_monitor_time / no_monitor_time
        assert overhead_ratio < 1.5, f"Monitoring overhead too high: {overhead_ratio}"


@pytest.mark.unit
class TestLoggingSetup:
    """Test the logging setup functionality."""

    def test_setup_logging_basic(self):
        """Test basic logging setup."""
        logger = setup_logging(name="test_logger", level="INFO")

        # BridgeLogger wraps the actual logger
        assert logger.logger.name == "test_logger"
        assert logger.logger.level == 20  # INFO level

    def test_setup_logging_debug_level(self):
        """Test logging setup with DEBUG level."""
        logger = setup_logging(name="debug_logger", level="DEBUG")

        assert logger.logger.level == 10  # DEBUG level

    def test_setup_logging_with_dev_mode(self):
        """Test logging setup with development mode."""
        logger = setup_logging(name="dev_logger", level="INFO", enable_dev=True)

        # Should have appropriate handlers for dev mode
        assert len(logger.logger.handlers) > 0

    def test_setup_logging_with_file(self, temp_workspace):
        """Test logging setup with file output."""
        log_file = temp_workspace / "test.log"

        logger = setup_logging(name="file_logger", level="INFO", log_file=log_file)

        # Log a test message
        logger.info("Test log message")

        # Verify file was created and contains message
        assert log_file.exists()
        content = log_file.read_text()
        assert "Test log message" in content

    def test_setup_logging_with_performance(self, caplog):
        """Test logging setup with performance logging."""
        logger = setup_logging(name="perf_logger", level="DEBUG", log_performance=True)

        # Should be able to log performance messages
        if hasattr(logger, "performance"):
            logger.performance("test_op", 1.5, success=True)

    def test_get_logger(self):
        """Test getting logger instance."""
        # Setup a logger first
        setup_logging("test_get_logger", level="INFO")

        # Get logger - get_logger doesn't take arguments
        logger = get_logger()

        assert logger is not None
        # BridgeLogger wraps the actual logger
        if hasattr(logger, "logger"):
            assert logger.logger is not None

    def test_get_logger_default(self):
        """Test getting default logger."""
        logger = get_logger()

        assert logger is not None

    def test_logging_performance_method(self):
        """Test custom performance logging method."""
        logger = setup_logging(name="performance_test", level="DEBUG", log_performance=True)

        # Test if performance method exists and works
        if hasattr(logger, "performance"):
            try:
                logger.performance(
                    operation="test_operation",
                    duration=2.5,
                    success=True,
                    total_processed=100,
                    success_rate=95.0,
                )
                # Should not raise exception
            except Exception as e:
                pytest.fail(f"Performance logging failed: {e}")

    def test_logging_levels(self):
        """Test different logging levels."""
        levels = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]

        for level in levels:
            logger = setup_logging(f"test_{level.lower()}", level=level)

            # Verify level is set correctly
            expected_level = getattr(__import__("logging"), level)
            assert logger.logger.level == expected_level

    def test_logging_formatters(self, temp_workspace):
        """Test logging formatters."""
        log_file = temp_workspace / "formatted.log"

        logger = setup_logging(name="format_test", level="INFO", log_file=log_file, enable_dev=True)

        # Log various types of messages
        logger.debug("Debug message")
        logger.info("Info message")
        logger.warning("Warning message")
        logger.error("Error message")

        # Check that log file has properly formatted messages
        if log_file.exists():
            content = log_file.read_text()
            assert "format_test" in content  # Logger name should be in format

    def test_logging_exception_handling(self):
        """Test logging with exception information."""
        bridge_logger = setup_logging("exception_test", level="DEBUG")

        try:
            raise ValueError("Test exception")
        except ValueError:
            # BridgeLogger uses error method with exc_info=True
            bridge_logger.error("Caught test exception", exc_info=True)
            # Should not raise, even when logging exception info

    def test_multiple_loggers(self):
        """Test setting up multiple loggers."""
        logger1 = setup_logging("logger1", level="INFO")
        logger2 = setup_logging("logger2", level="DEBUG")

        assert logger1.logger.name != logger2.logger.name
        assert logger1.logger.level != logger2.logger.level

    def test_logger_cleanup(self, temp_workspace):
        """Test proper logger cleanup."""
        log_file = temp_workspace / "cleanup.log"

        logger = setup_logging(name="cleanup_test", level="INFO", log_file=log_file)

        # Log some messages
        logger.info("Before cleanup")

        # Cleanup handlers (this would typically be done in teardown)
        if hasattr(logger, "logger"):
            for handler in logger.logger.handlers[:]:
                handler.close()
                logger.logger.removeHandler(handler)

        # File should still exist with logged content
        assert log_file.exists()
        content = log_file.read_text()
        assert "Before cleanup" in content


@pytest.mark.unit
class TestMonitoringIntegration:
    """Integration tests within the monitoring module."""

    def test_metrics_with_logging(self, temp_workspace):
        """Test performance metrics with logging integration."""
        log_file = temp_workspace / "metrics.log"

        # Setup logger
        logger = setup_logging(
            name="metrics_integration",
            level="DEBUG",
            log_file=log_file,
            enable_dev=True,
            log_performance=True,
        )

        # Setup monitor
        monitor = PerformanceMonitor(enabled=True)

        # Perform monitored operations
        with monitor.measure("integrated_test", test=True):
            time.sleep(0.01)
            logger.info("Inside monitored operation")

        # Get stats and log them
        stats = monitor.get_stats("integrated_test")
        if hasattr(logger, "performance"):
            logger.performance(
                "integrated_test",
                stats.get("average_time", 0),
                success=True,
                total_processed=1,
            )

        # Verify both monitoring and logging worked
        assert len(monitor.metrics) > 0
        if log_file.exists():
            content = log_file.read_text()
            assert "Inside monitored operation" in content

    def test_monitoring_disabled_vs_enabled(self):
        """Test performance difference between disabled and enabled monitoring."""
        operation_count = 100

        # Test with disabled monitoring
        disabled_monitor = PerformanceMonitor(enabled=False)
        start_time = time.perf_counter()
        for i in range(operation_count):
            with disabled_monitor.measure(f"disabled_op_{i}"):
                pass  # Minimal work
        disabled_time = time.perf_counter() - start_time

        # Test with enabled monitoring
        enabled_monitor = PerformanceMonitor(enabled=True)
        start_time = time.perf_counter()
        for i in range(operation_count):
            with enabled_monitor.measure(f"enabled_op_{i}"):
                pass  # Minimal work
        enabled_time = time.perf_counter() - start_time

        # Verify monitoring states
        assert len(disabled_monitor.metrics) == 0
        assert len(enabled_monitor.metrics) == operation_count

        # Disabled should be faster (though difference might be minimal)
        assert disabled_time <= enabled_time * 2  # Allow some overhead tolerance
