"""
Logging configuration for the Manim Bridge system.
Provides structured JSON logging with rotation and performance context.
"""

import json
import logging
import logging.handlers
import sys
import time
import traceback
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional


class StructuredJSONFormatter(logging.Formatter):
    """
    Custom formatter that outputs structured JSON logs.
    """

    def __init__(self, component: str = "manim-bridge"):
        super().__init__()
        self.component = component

    def format(self, record: logging.LogRecord) -> str:
        """Format log record as structured JSON."""
        log_entry = {
            "timestamp": datetime.fromtimestamp(record.created).isoformat() + "Z",
            "level": record.levelname,
            "component": self.component,
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
            "message": record.getMessage(),
        }

        # Add extra fields if present
        if hasattr(record, "action"):
            log_entry["action"] = record.action

        if hasattr(record, "data"):
            log_entry["data"] = record.data

        if hasattr(record, "performance"):
            log_entry["performance"] = record.performance

        if hasattr(record, "error"):
            log_entry["error"] = record.error

        # Add exception info if present
        if record.exc_info and record.exc_info != (None, None, None):
            try:
                exc_type, exc_value, exc_tb = record.exc_info
                log_entry["exception"] = {
                    "type": exc_type.__name__ if exc_type else "Unknown",
                    "message": str(exc_value) if exc_value else "Unknown error",
                    "traceback": traceback.format_exception(exc_type, exc_value, exc_tb)
                }
            except Exception:
                log_entry["exception"] = {
                    "type": "Unknown",
                    "message": "Error formatting exception",
                    "traceback": []
                }

        return json.dumps(log_entry, ensure_ascii=False)


class PerformanceLogger:
    """
    Context manager for logging performance metrics.
    """

    def __init__(self, logger: logging.Logger, action: str, **kwargs):
        self.logger = logger
        self.action = action
        self.data = kwargs
        self.start_time = None

    def __enter__(self):
        self.start_time = time.time()
        self.logger.debug(
            f"Starting {self.action}",
            extra={
                "action": f"{self.action}_start",
                "data": self.data
            }
        )
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        duration = time.time() - self.start_time

        performance_data = {
            "duration_seconds": round(duration, 3),
            **self.data
        }

        if exc_type:
            self.logger.error(
                f"Failed {self.action} after {duration:.3f}s",
                extra={
                    "action": f"{self.action}_error",
                    "performance": performance_data,
                    "error": {
                        "type": exc_type.__name__,
                        "message": str(exc_val)
                    }
                }
            )
        else:
            self.logger.info(
                f"Completed {self.action} in {duration:.3f}s",
                extra={
                    "action": f"{self.action}_complete",
                    "performance": performance_data
                }
            )


def setup_logger(
    name: str = "manim-bridge",
    log_level: str = "INFO",
    log_dir: Optional[Path] = None,
    component: str = "manim-bridge",
    max_bytes: int = 10 * 1024 * 1024,  # 10MB
    backup_count: int = 5
) -> logging.Logger:
    """
    Set up a structured JSON logger with file rotation.

    Args:
        name: Logger name
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_dir: Directory for log files (defaults to logs/python)
        component: Component identifier for log entries
        max_bytes: Maximum size per log file before rotation
        backup_count: Number of backup files to keep

    Returns:
        Configured logger instance
    """
    # Set up log directory
    if log_dir is None:
        log_dir = Path("logs/python")
    log_dir.mkdir(parents=True, exist_ok=True)

    # Create logger
    logger = logging.getLogger(name)
    logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))

    # Clear existing handlers
    logger.handlers.clear()

    # Create formatter
    formatter = StructuredJSONFormatter(component=component)

    # File handler with rotation
    log_file = log_dir / f"{component}.log"
    file_handler = logging.handlers.RotatingFileHandler(
        log_file,
        maxBytes=max_bytes,
        backupCount=backup_count,
        encoding="utf-8"
    )
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)

    # Console handler for development (optional)
    if sys.stdout.isatty():
        console_handler = logging.StreamHandler(sys.stdout)
        console_formatter = logging.Formatter(
            "%(asctime)s [%(levelname)s] %(component)s: %(message)s"
        )
        console_handler.setFormatter(console_formatter)
        console_handler.addFilter(lambda record: setattr(record, 'component', component) or True)
        logger.addHandler(console_handler)

    return logger


@contextmanager
def log_performance(logger: logging.Logger, action: str, **kwargs):
    """
    Context manager for performance logging.

    Usage:
        with log_performance(logger, "file_copy", filename="test.mp4"):
            # Your code here
            pass
    """
    perf_logger = PerformanceLogger(logger, action, **kwargs)
    with perf_logger:
        yield perf_logger


def log_file_operation(
    logger: logging.Logger,
    action: str,
    filepath: Path,
    success: bool = True,
    error: Optional[Exception] = None,
    **kwargs
) -> None:
    """
    Log file operations with structured data.

    Args:
        logger: Logger instance
        action: Action being performed (copy, move, delete, etc.)
        filepath: File being operated on
        success: Whether the operation succeeded
        error: Exception if operation failed
        **kwargs: Additional data to log
    """
    data = {
        "filepath": str(filepath),
        "filename": filepath.name,
        "size": filepath.stat().st_size if filepath.exists() else None,
        **kwargs
    }

    if success:
        logger.info(
            f"Successfully {action} {filepath.name}",
            extra={
                "action": f"file_{action}",
                "data": data
            }
        )
    else:
        error_data = {
            "type": type(error).__name__ if error else "Unknown",
            "message": str(error) if error else "Unknown error"
        }

        logger.error(
            f"Failed to {action} {filepath.name}",
            extra={
                "action": f"file_{action}_error",
                "data": data,
                "error": error_data
            }
        )


def log_system_event(
    logger: logging.Logger,
    event: str,
    level: str = "INFO",
    **kwargs
) -> None:
    """
    Log system-level events.

    Args:
        logger: Logger instance
        event: Event description
        level: Log level
        **kwargs: Additional data to log
    """
    log_level = getattr(logging, level.upper(), logging.INFO)

    logger.log(
        log_level,
        event,
        extra={
            "action": "system_event",
            "data": kwargs
        }
    )
