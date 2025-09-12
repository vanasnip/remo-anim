"""Advanced performance profiler with comprehensive metrics and baseline tracking"""

import json
import psutil
import statistics
import threading
import time
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union
from collections import defaultdict, deque

from ..core.exceptions import MonitoringError
from .logger import get_logger


@dataclass
class BaselineMetrics:
    """Baseline performance metrics for regression detection"""

    operation: str
    mean_duration: float
    median_duration: float
    percentile_95: float
    percentile_99: float
    min_duration: float
    max_duration: float
    sample_count: int
    memory_usage: Optional[float] = None
    cpu_usage: Optional[float] = None
    established_at: datetime = field(default_factory=datetime.now)


@dataclass
class PerformanceSnapshot:
    """Single performance measurement snapshot"""

    operation: str
    duration: float
    timestamp: datetime
    success: bool
    memory_before: Optional[int] = None
    memory_after: Optional[int] = None
    memory_peak: Optional[int] = None
    cpu_percent: Optional[float] = None
    thread_id: str = field(default_factory=lambda: threading.current_thread().name)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class PerformanceAlert:
    """Performance regression alert"""

    operation: str
    current_duration: float
    baseline_duration: float
    regression_factor: float
    threshold_type: str  # "mean", "p95", "p99"
    timestamp: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)


class PerformanceProfiler:
    """Advanced performance profiler with baseline tracking and regression detection"""

    def __init__(
        self,
        enable_memory_monitoring: bool = True,
        enable_cpu_monitoring: bool = True,
        enable_regression_detection: bool = True,
        regression_threshold: float = 1.5,  # 50% slower than baseline
        baseline_sample_size: int = 100,
        max_history_size: int = 10000,
        enable_logging: bool = True,
    ):
        self.enable_memory_monitoring = enable_memory_monitoring
        self.enable_cpu_monitoring = enable_cpu_monitoring
        self.enable_regression_detection = enable_regression_detection
        self.regression_threshold = regression_threshold
        self.baseline_sample_size = baseline_sample_size
        self.max_history_size = max_history_size
        self.logger = get_logger() if enable_logging else None

        # Thread-safe data structures
        self._lock = threading.RLock()
        self._snapshots: Dict[str, deque] = defaultdict(lambda: deque(maxlen=max_history_size))
        self._baselines: Dict[str, BaselineMetrics] = {}
        self._alerts: List[PerformanceAlert] = []
        self._active_operations: Dict[str, Dict] = {}  # operation_id -> context

        # Process monitoring
        self._process = psutil.Process() if (enable_memory_monitoring or enable_cpu_monitoring) else None

        # Statistics cache
        self._stats_cache: Dict[str, Tuple[Dict, datetime]] = {}
        self._cache_ttl = timedelta(seconds=30)

        if self.logger:
            self.logger.info("PerformanceProfiler initialized with monitoring capabilities")

    @contextmanager
    def profile_operation(
        self,
        operation: str,
        expected_duration: Optional[float] = None,
        **metadata
    ):
        """Context manager for profiling operations with comprehensive metrics"""
        operation_id = f"{operation}_{time.time()}_{threading.current_thread().ident}"

        # Pre-operation setup
        start_time = time.perf_counter()
        memory_before = None
        cpu_before = None

        if self.enable_memory_monitoring and self._process:
            try:
                memory_before = self._process.memory_info().rss
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass

        if self.enable_cpu_monitoring and self._process:
            try:
                # Start CPU monitoring
                cpu_before = self._process.cpu_percent()
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass

        # Store active operation context
        with self._lock:
            self._active_operations[operation_id] = {
                "operation": operation,
                "start_time": start_time,
                "memory_before": memory_before,
                "cpu_before": cpu_before,
                "expected_duration": expected_duration,
                "metadata": metadata.copy(),
            }

        success = True
        exception_info = None

        try:
            yield operation_id
        except Exception as e:
            success = False
            exception_info = str(e)
            raise
        finally:
            # Post-operation metrics collection
            end_time = time.perf_counter()
            duration = end_time - start_time

            memory_after = None
            memory_peak = None
            cpu_percent = None

            if self.enable_memory_monitoring and self._process:
                try:
                    memory_info = self._process.memory_info()
                    memory_after = memory_info.rss
                    # Estimate peak memory (simplified approach)
                    memory_peak = max(memory_before or 0, memory_after or 0)
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass

            if self.enable_cpu_monitoring and self._process:
                try:
                    # Get CPU percentage for the operation duration
                    cpu_percent = self._process.cpu_percent()
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass

            # Create snapshot
            snapshot = PerformanceSnapshot(
                operation=operation,
                duration=duration,
                timestamp=datetime.now(),
                success=success,
                memory_before=memory_before,
                memory_after=memory_after,
                memory_peak=memory_peak,
                cpu_percent=cpu_percent,
                metadata={
                    **metadata,
                    "expected_duration": expected_duration,
                    "exception": exception_info,
                }
            )

            # Store snapshot and check for regressions
            self._record_snapshot(snapshot)

            # Clean up active operation
            with self._lock:
                self._active_operations.pop(operation_id, None)

    def _record_snapshot(self, snapshot: PerformanceSnapshot) -> None:
        """Record performance snapshot and check for regressions"""
        with self._lock:
            # Add to history
            self._snapshots[snapshot.operation].append(snapshot)

            # Update baseline if we have enough samples
            self._update_baseline(snapshot.operation)

            # Check for regression
            if self.enable_regression_detection:
                self._check_regression(snapshot)

            # Log performance if enabled
            if self.logger:
                status = "✅" if snapshot.success else "❌"
                memory_info = ""
                if snapshot.memory_before and snapshot.memory_after:
                    memory_delta = (snapshot.memory_after - snapshot.memory_before) / 1024 / 1024  # MB
                    memory_info = f", Δmem: {memory_delta:+.1f}MB"

                cpu_info = f", CPU: {snapshot.cpu_percent:.1f}%" if snapshot.cpu_percent else ""

                self.logger.performance(
                    operation=snapshot.operation,
                    duration=snapshot.duration,
                    status=status,
                    thread=snapshot.thread_id,
                    extra_info=f"{memory_info}{cpu_info}"
                )

    def _update_baseline(self, operation: str) -> None:
        """Update baseline metrics for an operation"""
        snapshots = self._snapshots[operation]

        if len(snapshots) < self.baseline_sample_size:
            return

        # Get recent successful snapshots
        recent_successful = [
            s for s in list(snapshots)[-self.baseline_sample_size:]
            if s.success
        ]

        if len(recent_successful) < self.baseline_sample_size * 0.8:  # At least 80% success rate
            return

        durations = [s.duration for s in recent_successful]
        memory_usage = [
            (s.memory_after - s.memory_before) / 1024 / 1024  # MB
            for s in recent_successful
            if s.memory_before and s.memory_after
        ]
        cpu_usage = [s.cpu_percent for s in recent_successful if s.cpu_percent]

        # Calculate baseline metrics
        baseline = BaselineMetrics(
            operation=operation,
            mean_duration=statistics.mean(durations),
            median_duration=statistics.median(durations),
            percentile_95=self._percentile(durations, 95),
            percentile_99=self._percentile(durations, 99),
            min_duration=min(durations),
            max_duration=max(durations),
            sample_count=len(durations),
            memory_usage=statistics.mean(memory_usage) if memory_usage else None,
            cpu_usage=statistics.mean(cpu_usage) if cpu_usage else None,
        )

        self._baselines[operation] = baseline

        if self.logger:
            self.logger.debug(
                f"Updated baseline for {operation}: "
                f"mean={baseline.mean_duration:.3f}s, "
                f"p95={baseline.percentile_95:.3f}s"
            )

    def _check_regression(self, snapshot: PerformanceSnapshot) -> None:
        """Check if current performance indicates a regression"""
        if not snapshot.success:
            return

        baseline = self._baselines.get(snapshot.operation)
        if not baseline:
            return

        # Check against multiple thresholds
        thresholds = [
            ("mean", baseline.mean_duration),
            ("p95", baseline.percentile_95),
            ("p99", baseline.percentile_99),
        ]

        for threshold_type, baseline_duration in thresholds:
            if snapshot.duration > baseline_duration * self.regression_threshold:
                alert = PerformanceAlert(
                    operation=snapshot.operation,
                    current_duration=snapshot.duration,
                    baseline_duration=baseline_duration,
                    regression_factor=snapshot.duration / baseline_duration,
                    threshold_type=threshold_type,
                    metadata=snapshot.metadata.copy(),
                )

                self._alerts.append(alert)

                if self.logger:
                    self.logger.warning(
                        f"Performance regression detected for {snapshot.operation}: "
                        f"{snapshot.duration:.3f}s vs {threshold_type} baseline "
                        f"{baseline_duration:.3f}s ({alert.regression_factor:.1f}x slower)"
                    )

                break  # Only alert once per snapshot

    def get_operation_stats(
        self,
        operation: str,
        time_window: Optional[timedelta] = None
    ) -> Dict[str, Any]:
        """Get comprehensive statistics for an operation"""
        with self._lock:
            # Check cache
            cache_key = f"{operation}_{time_window}"
            if cache_key in self._stats_cache:
                cached_stats, cache_time = self._stats_cache[cache_key]
                if datetime.now() - cache_time < self._cache_ttl:
                    return cached_stats

            snapshots = list(self._snapshots[operation])

            if time_window:
                cutoff_time = datetime.now() - time_window
                snapshots = [s for s in snapshots if s.timestamp > cutoff_time]

            if not snapshots:
                return {"operation": operation, "sample_count": 0}

            successful_snapshots = [s for s in snapshots if s.success]
            durations = [s.duration for s in successful_snapshots]

            if not durations:
                return {"operation": operation, "sample_count": len(snapshots), "success_rate": 0.0}

            # Calculate comprehensive statistics
            stats = {
                "operation": operation,
                "sample_count": len(snapshots),
                "successful_count": len(successful_snapshots),
                "success_rate": len(successful_snapshots) / len(snapshots) * 100,
                "duration_stats": {
                    "mean": statistics.mean(durations),
                    "median": statistics.median(durations),
                    "min": min(durations),
                    "max": max(durations),
                    "std_dev": statistics.stdev(durations) if len(durations) > 1 else 0,
                    "p95": self._percentile(durations, 95),
                    "p99": self._percentile(durations, 99),
                },
                "baseline": self._baselines.get(operation),
                "recent_alerts": [
                    alert for alert in self._alerts
                    if alert.operation == operation
                    and (not time_window or datetime.now() - alert.timestamp < time_window)
                ],
            }

            # Add memory statistics if available
            memory_deltas = [
                (s.memory_after - s.memory_before) / 1024 / 1024  # MB
                for s in successful_snapshots
                if s.memory_before and s.memory_after
            ]

            if memory_deltas:
                stats["memory_stats"] = {
                    "mean_delta_mb": statistics.mean(memory_deltas),
                    "max_delta_mb": max(memory_deltas),
                    "min_delta_mb": min(memory_deltas),
                }

            # Add CPU statistics if available
            cpu_percentages = [s.cpu_percent for s in successful_snapshots if s.cpu_percent]
            if cpu_percentages:
                stats["cpu_stats"] = {
                    "mean_percent": statistics.mean(cpu_percentages),
                    "max_percent": max(cpu_percentages),
                    "min_percent": min(cpu_percentages),
                }

            # Cache the results
            self._stats_cache[cache_key] = (stats, datetime.now())

            return stats

    def get_performance_report(self, time_window: Optional[timedelta] = None) -> Dict[str, Any]:
        """Get comprehensive performance report for all operations"""
        with self._lock:
            operations = list(self._snapshots.keys())

            report = {
                "timestamp": datetime.now().isoformat(),
                "time_window": str(time_window) if time_window else "all_time",
                "total_operations": len(operations),
                "operations": {},
                "system_info": self._get_system_info(),
                "active_operations": len(self._active_operations),
                "total_alerts": len(self._alerts),
            }

            for operation in operations:
                report["operations"][operation] = self.get_operation_stats(operation, time_window)

            # Add recent alerts summary
            if time_window:
                cutoff_time = datetime.now() - time_window
                recent_alerts = [a for a in self._alerts if a.timestamp > cutoff_time]
            else:
                recent_alerts = self._alerts[-50:]  # Last 50 alerts

            report["recent_alerts"] = [
                {
                    "operation": alert.operation,
                    "regression_factor": alert.regression_factor,
                    "threshold_type": alert.threshold_type,
                    "timestamp": alert.timestamp.isoformat(),
                }
                for alert in recent_alerts
            ]

            return report

    def export_baseline_metrics(self, output_path: Path) -> None:
        """Export baseline metrics to JSON file"""
        with self._lock:
            baseline_data = {
                "timestamp": datetime.now().isoformat(),
                "baselines": {}
            }

            for operation, baseline in self._baselines.items():
                baseline_data["baselines"][operation] = {
                    "mean_duration": baseline.mean_duration,
                    "median_duration": baseline.median_duration,
                    "percentile_95": baseline.percentile_95,
                    "percentile_99": baseline.percentile_99,
                    "sample_count": baseline.sample_count,
                    "memory_usage": baseline.memory_usage,
                    "cpu_usage": baseline.cpu_usage,
                    "established_at": baseline.established_at.isoformat(),
                }

            output_path.parent.mkdir(parents=True, exist_ok=True)
            with open(output_path, 'w') as f:
                json.dump(baseline_data, f, indent=2)

            if self.logger:
                self.logger.info(f"Exported baseline metrics to {output_path}")

    def import_baseline_metrics(self, input_path: Path) -> None:
        """Import baseline metrics from JSON file"""
        if not input_path.exists():
            raise MonitoringError(f"Baseline file not found: {input_path}")

        try:
            with open(input_path) as f:
                data = json.load(f)

            with self._lock:
                for operation, baseline_data in data.get("baselines", {}).items():
                    baseline = BaselineMetrics(
                        operation=operation,
                        mean_duration=baseline_data["mean_duration"],
                        median_duration=baseline_data["median_duration"],
                        percentile_95=baseline_data["percentile_95"],
                        percentile_99=baseline_data["percentile_99"],
                        min_duration=baseline_data.get("min_duration", 0),
                        max_duration=baseline_data.get("max_duration", 0),
                        sample_count=baseline_data["sample_count"],
                        memory_usage=baseline_data.get("memory_usage"),
                        cpu_usage=baseline_data.get("cpu_usage"),
                        established_at=datetime.fromisoformat(baseline_data["established_at"]),
                    )
                    self._baselines[operation] = baseline

            if self.logger:
                self.logger.info(f"Imported {len(data.get('baselines', {}))} baseline metrics")

        except Exception as e:
            raise MonitoringError(f"Failed to import baseline metrics: {e}")

    def clear_alerts(self, operation: Optional[str] = None) -> int:
        """Clear alerts, optionally for a specific operation"""
        with self._lock:
            if operation:
                before_count = len(self._alerts)
                self._alerts = [a for a in self._alerts if a.operation != operation]
                cleared = before_count - len(self._alerts)
            else:
                cleared = len(self._alerts)
                self._alerts.clear()

            return cleared

    def reset_baselines(self, operation: Optional[str] = None) -> None:
        """Reset baseline metrics, optionally for a specific operation"""
        with self._lock:
            if operation:
                self._baselines.pop(operation, None)
                # Clear stats cache for this operation
                cache_keys = [k for k in self._stats_cache.keys() if k.startswith(f"{operation}_")]
                for key in cache_keys:
                    self._stats_cache.pop(key, None)
            else:
                self._baselines.clear()
                self._stats_cache.clear()

            if self.logger:
                target = operation if operation else "all operations"
                self.logger.info(f"Reset baselines for {target}")

    @staticmethod
    def _percentile(data: List[float], percentile: float) -> float:
        """Calculate percentile value"""
        if not data:
            return 0.0

        data = sorted(data)
        k = (len(data) - 1) * percentile / 100
        f = int(k)
        c = k - f

        if f == len(data) - 1:
            return data[f]

        return data[f] * (1 - c) + data[f + 1] * c

    def _get_system_info(self) -> Dict[str, Any]:
        """Get current system information"""
        try:
            return {
                "cpu_count": psutil.cpu_count(),
                "memory_total_gb": psutil.virtual_memory().total / 1024 / 1024 / 1024,
                "memory_available_gb": psutil.virtual_memory().available / 1024 / 1024 / 1024,
                "disk_usage_percent": psutil.disk_usage('/').percent,
                "load_average": psutil.getloadavg() if hasattr(psutil, 'getloadavg') else None,
            }
        except Exception as e:
            if self.logger:
                self.logger.debug(f"Failed to get system info: {e}")
            return {"error": str(e)}


# Global profiler instance
_profiler: Optional[PerformanceProfiler] = None


def get_profiler() -> PerformanceProfiler:
    """Get or create the global performance profiler"""
    global _profiler
    if _profiler is None:
        _profiler = PerformanceProfiler()
    return _profiler


def setup_profiler(
    enable_memory_monitoring: bool = True,
    enable_cpu_monitoring: bool = True,
    enable_regression_detection: bool = True,
    regression_threshold: float = 1.5,
    **kwargs
) -> PerformanceProfiler:
    """Setup global performance profiler with custom configuration"""
    global _profiler
    _profiler = PerformanceProfiler(
        enable_memory_monitoring=enable_memory_monitoring,
        enable_cpu_monitoring=enable_cpu_monitoring,
        enable_regression_detection=enable_regression_detection,
        regression_threshold=regression_threshold,
        **kwargs
    )
    return _profiler
