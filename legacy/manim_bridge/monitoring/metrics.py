"""Performance monitoring and metrics collection"""

import json
import time
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional


@dataclass
class MetricEntry:
    """Single metric entry"""

    operation: str
    duration: float
    timestamp: datetime
    success: bool = True
    metadata: Dict = field(default_factory=dict)


class PerformanceMonitor:
    """Monitor and track performance metrics"""

    def __init__(self, enabled: bool = True):
        self.enabled = enabled
        self.metrics: Dict[str, List[MetricEntry]] = {}
        self.start_times: Dict[str, float] = {}

    def start_operation(self, operation: str) -> None:
        """Start timing an operation"""
        if self.enabled:
            self.start_times[operation] = time.perf_counter()

    def end_operation(self, operation: str, success: bool = True, **metadata) -> float:
        """End timing an operation and record the metric"""
        if not self.enabled or operation not in self.start_times:
            return 0.0

        duration = time.perf_counter() - self.start_times[operation]
        del self.start_times[operation]

        entry = MetricEntry(
            operation=operation,
            duration=duration,
            timestamp=datetime.now(),
            success=success,
            metadata=metadata,
        )

        if operation not in self.metrics:
            self.metrics[operation] = []
        self.metrics[operation].append(entry)

        return duration

    @contextmanager
    def measure(self, operation: str, **metadata):
        """Context manager for measuring operation time"""
        self.start_operation(operation)
        success = True
        try:
            yield
        except Exception:
            success = False
            raise
        finally:
            self.end_operation(operation, success, **metadata)

    def get_stats(self, operation: Optional[str] = None) -> Dict:
        """Get statistics for operations"""
        if not self.enabled:
            return {}

        if operation:
            if operation not in self.metrics:
                return {}
            entries = self.metrics[operation]
        else:
            entries = [e for entries in self.metrics.values() for e in entries]

        if not entries:
            return {}

        durations = [e.duration for e in entries]
        successful = [e for e in entries if e.success]

        return {
            "count": len(entries),
            "successful": len(successful),
            "failed": len(entries) - len(successful),
            "total_time": sum(durations),
            "average_time": sum(durations) / len(durations),
            "min_time": min(durations),
            "max_time": max(durations),
            "success_rate": len(successful) / len(entries) * 100,
        }

    def get_report(self) -> Dict:
        """Get full performance report"""
        if not self.enabled:
            return {"enabled": False}

        report = {"enabled": True, "operations": {}, "summary": self.get_stats()}

        for operation in self.metrics:
            report["operations"][operation] = self.get_stats(operation)

        return report

    def export_json(self, path: str) -> None:
        """Export metrics to JSON file"""
        if not self.enabled:
            return

        data = {"timestamp": datetime.now().isoformat(), "metrics": {}}

        for operation, entries in self.metrics.items():
            data["metrics"][operation] = [
                {
                    "duration": e.duration,
                    "timestamp": e.timestamp.isoformat(),
                    "success": e.success,
                    "metadata": e.metadata,
                }
                for e in entries
            ]

        with open(path, "w") as f:
            json.dump(data, f, indent=2)

    def reset(self) -> None:
        """Reset all metrics"""
        self.metrics.clear()
        self.start_times.clear()
