"""
Comprehensive logging infrastructure for Manim Bridge
Provides structured JSON logging with rotation and multiple handlers
"""

import logging
import json
import sys
import os
from datetime import datetime
from logging.handlers import RotatingFileHandler, TimedRotatingFileHandler
from pathlib import Path
from typing import Any, Dict, Optional
import traceback


class JsonFormatter(logging.Formatter):
    """Custom JSON formatter for structured logging"""

    def format(self, record: logging.LogRecord) -> str:
        log_obj = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "component": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }

        # Add extra fields if present
        if hasattr(record, "action"):
            log_obj["action"] = record.action
        if hasattr(record, "processing_time"):
            log_obj["processing_time"] = record.processing_time
        if hasattr(record, "status"):
            log_obj["status"] = record.status
        if hasattr(record, "context"):
            log_obj["context"] = record.context
        if hasattr(record, "video_file"):
            log_obj["video_file"] = record.video_file
        if hasattr(record, "scene"):
            log_obj["scene"] = record.scene

        # Add exception info if present
        if record.exc_info:
            log_obj["exception"] = {
                "type": record.exc_info[0].__name__,
                "message": str(record.exc_info[1]),
                "traceback": traceback.format_exception(*record.exc_info),
            }

        return json.dumps(log_obj, default=str)


class BridgeLogger:
    """Main logger class for Manim Bridge operations"""

    def __init__(self, name: str = "manim-bridge", log_dir: str = "logs"):
        self.name = name
        self.log_dir = Path(log_dir)
        self.log_dir.mkdir(exist_ok=True)

        # Create logger
        self.logger = logging.getLogger(name)
        self.logger.setLevel(logging.DEBUG)
        self.logger.handlers = []  # Clear any existing handlers

        # Setup handlers
        self._setup_file_handler()
        self._setup_console_handler()
        self._setup_error_handler()

    def _setup_file_handler(self):
        """Setup rotating file handler for all logs"""
        log_file = self.log_dir / f"{self.name}.log"

        file_handler = RotatingFileHandler(
            log_file, maxBytes=10 * 1024 * 1024, backupCount=5, encoding="utf-8"  # 10MB
        )
        file_handler.setLevel(logging.DEBUG)
        file_handler.setFormatter(JsonFormatter())
        self.logger.addHandler(file_handler)

    def _setup_console_handler(self):
        """Setup console handler for INFO and above"""
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(logging.INFO)

        # Use simple format for console
        console_format = logging.Formatter(
            "%(asctime)s - %(name)s - %(levelname)s - %(message)s", datefmt="%Y-%m-%d %H:%M:%S"
        )
        console_handler.setFormatter(console_format)
        self.logger.addHandler(console_handler)

    def _setup_error_handler(self):
        """Setup separate handler for errors"""
        error_file = self.log_dir / f"{self.name}-errors.log"

        error_handler = TimedRotatingFileHandler(
            error_file, when="midnight", interval=1, backupCount=30, encoding="utf-8"
        )
        error_handler.setLevel(logging.ERROR)
        error_handler.setFormatter(JsonFormatter())
        self.logger.addHandler(error_handler)

    def debug(self, message: str, **kwargs):
        """Log debug message with optional context"""
        self._log(logging.DEBUG, message, **kwargs)

    def info(self, message: str, **kwargs):
        """Log info message with optional context"""
        self._log(logging.INFO, message, **kwargs)

    def warning(self, message: str, **kwargs):
        """Log warning message with optional context"""
        self._log(logging.WARNING, message, **kwargs)

    def error(self, message: str, exc_info: bool = False, **kwargs):
        """Log error message with optional exception info"""
        self._log(logging.ERROR, message, exc_info=exc_info, **kwargs)

    def critical(self, message: str, exc_info: bool = False, **kwargs):
        """Log critical message with optional exception info"""
        self._log(logging.CRITICAL, message, exc_info=exc_info, **kwargs)

    def _log(self, level: int, message: str, exc_info: bool = False, **kwargs):
        """Internal logging method with context"""
        extra = {}

        # Standard fields
        for key in [
            "action",
            "processing_time",
            "status",
            "context",
            "video_file",
            "scene",
            "quality",
            "frame_count",
        ]:
            if key in kwargs:
                extra[key] = kwargs[key]

        self.logger.log(level, message, extra=extra, exc_info=exc_info)

    def log_operation(self, operation: str, status: str = "started", **kwargs):
        """Log a specific operation with timing"""
        self.info(f"Operation: {operation}", action=operation, status=status, **kwargs)

    def log_performance(self, operation: str, duration: float, **kwargs):
        """Log performance metrics"""
        self.info(
            f"Performance: {operation} completed in {duration:.2f}s",
            action=f"performance_{operation}",
            processing_time=duration,
            status="completed",
            **kwargs,
        )

    def log_video_processing(
        self,
        video_file: str,
        scene: str,
        status: str,
        processing_time: Optional[float] = None,
        **kwargs,
    ):
        """Log video processing operations"""
        message = f"Video processing: {video_file} - {status}"
        extra = {
            "action": "process_video",
            "video_file": video_file,
            "scene": scene,
            "status": status,
        }

        if processing_time:
            extra["processing_time"] = processing_time
            message += f" ({processing_time:.2f}s)"

        extra.update(kwargs)

        if status == "failed":
            self.error(message, **extra)
        else:
            self.info(message, **extra)


class LogContext:
    """Context manager for logging operations with timing"""

    def __init__(self, logger: BridgeLogger, operation: str, **context):
        self.logger = logger
        self.operation = operation
        self.context = context
        self.start_time = None

    def __enter__(self):
        self.start_time = datetime.now()
        self.logger.log_operation(self.operation, status="started", context=self.context)
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        duration = (datetime.now() - self.start_time).total_seconds()

        if exc_type:
            self.logger.error(
                f"Operation failed: {self.operation}",
                exc_info=True,
                action=self.operation,
                status="failed",
                processing_time=duration,
                context=self.context,
            )
        else:
            self.logger.log_operation(
                self.operation, status="completed", processing_time=duration, context=self.context
            )
        return False


# Singleton logger instance
_logger_instance: Optional[BridgeLogger] = None


def get_logger(name: str = "manim-bridge") -> BridgeLogger:
    """Get or create logger instance"""
    global _logger_instance
    if _logger_instance is None:
        _logger_instance = BridgeLogger(name)
    return _logger_instance


# Convenience functions
def setup_logging(log_dir: str = "logs", log_level: str = "INFO"):
    """Setup logging configuration"""
    logger = get_logger()

    # Set log level
    level = getattr(logging, log_level.upper(), logging.INFO)
    logger.logger.setLevel(level)

    logger.info("Logging system initialized", context={"log_dir": log_dir, "log_level": log_level})

    return logger
