"""Logging configuration for Manim Bridge with dev mode support"""

import json
import logging
import sys
from datetime import datetime
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Optional

from ..core.constants import LOG_BACKUP_COUNT, LOG_DATE_FORMAT, LOG_FORMAT, MAX_LOG_SIZE


class DevFormatter(logging.Formatter):
    """Enhanced formatter for development mode with colors and extra context"""

    # ANSI color codes
    COLORS = {
        "DEBUG": "\033[36m",  # Cyan
        "INFO": "\033[32m",  # Green
        "WARNING": "\033[33m",  # Yellow
        "ERROR": "\033[31m",  # Red
        "CRITICAL": "\033[35m",  # Magenta
        "RESET": "\033[0m",
    }

    def format(self, record):
        if sys.stdout.isatty():  # Only use colors in terminal
            levelname = record.levelname
            record.levelname = f"{self.COLORS.get(levelname, '')}{levelname}{self.COLORS['RESET']}"

        # Add extra context in dev mode
        if hasattr(record, "extra_context"):
            record.msg = f"{record.msg} | Context: {record.extra_context}"

        return super().format(record)


class JsonFormatter(logging.Formatter):
    """JSON formatter for structured logging"""

    def format(self, record):
        log_obj = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }

        # Add extra fields
        for key, value in record.__dict__.items():
            if key not in [
                "name",
                "msg",
                "args",
                "created",
                "filename",
                "funcName",
                "levelname",
                "levelno",
                "lineno",
                "module",
                "msecs",
                "message",
                "pathname",
                "process",
                "processName",
                "relativeCreated",
                "thread",
                "threadName",
            ]:
                log_obj[key] = value

        return json.dumps(log_obj)


class BridgeLogger:
    """Logger with dev mode support and performance tracking"""

    def __init__(
        self,
        name: str = "manim-bridge",
        level: str = "INFO",
        enable_dev: bool = False,
        log_file: Optional[Path] = None,
        log_performance: bool = False,
    ):
        self.logger = logging.getLogger(name)
        self.logger.setLevel(getattr(logging, level.upper()))
        self.enable_dev = enable_dev
        self.log_performance = log_performance

        # Clear existing handlers
        self.logger.handlers.clear()

        # Console handler
        console_handler = logging.StreamHandler(sys.stdout)

        if enable_dev:
            # Use colorized formatter in dev mode
            console_formatter = DevFormatter(
                "%(asctime)s [%(levelname)s] %(name)s:%(funcName)s:%(lineno)d - %(message)s",
                datefmt="%H:%M:%S",
            )
            console_handler.setLevel(logging.DEBUG)
        else:
            # Simple formatter for production
            console_formatter = logging.Formatter(LOG_FORMAT, datefmt=LOG_DATE_FORMAT)
            console_handler.setLevel(logging.INFO)

        console_handler.setFormatter(console_formatter)
        self.logger.addHandler(console_handler)

        # File handler (if specified)
        if log_file:
            log_file.parent.mkdir(parents=True, exist_ok=True)

            file_handler = RotatingFileHandler(
                log_file, maxBytes=MAX_LOG_SIZE, backupCount=LOG_BACKUP_COUNT
            )

            # Always use JSON format for file logs
            file_handler.setFormatter(JsonFormatter())
            file_handler.setLevel(logging.DEBUG if enable_dev else logging.INFO)
            self.logger.addHandler(file_handler)

        # Prevent propagation to root logger
        self.logger.propagate = False

        if enable_dev:
            self.logger.debug("🔧 Development logging enabled")

    def debug(self, msg, **kwargs):
        """Debug level logging (only shown in dev mode)"""
        if self.enable_dev:
            self.logger.debug(msg, extra=kwargs)

    def info(self, msg, **kwargs):
        """Info level logging"""
        self.logger.info(msg, extra=kwargs)

    def warning(self, msg, **kwargs):
        """Warning level logging"""
        self.logger.warning(msg, extra=kwargs)

    def error(self, msg, exc_info=False, **kwargs):
        """Error level logging"""
        self.logger.error(msg, exc_info=exc_info, extra=kwargs)

    def critical(self, msg, exc_info=False, **kwargs):
        """Critical level logging"""
        self.logger.critical(msg, exc_info=exc_info, extra=kwargs)

    def performance(self, operation: str, duration: float, **kwargs):
        """Log performance metrics (only in dev mode or when performance logging enabled)"""
        if self.log_performance or self.enable_dev:
            self.logger.info(
                f"⚡ Performance: {operation} took {duration:.3f}s",
                extra={
                    "performance": True,
                    "operation": operation,
                    "duration": duration,
                    **kwargs,
                },
            )

    def set_level(self, level: str):
        """Dynamically change log level"""
        self.logger.setLevel(getattr(logging, level.upper()))
        for handler in self.logger.handlers:
            if isinstance(handler, logging.StreamHandler) and handler.stream == sys.stdout:
                handler.setLevel(getattr(logging, level.upper()))


# Global logger instance
_logger: Optional[BridgeLogger] = None


def setup_logging(
    name: str = "manim-bridge",
    level: str = "INFO",
    enable_dev: bool = False,
    log_file: Optional[Path] = None,
    log_performance: bool = False,
) -> BridgeLogger:
    """Setup global logging configuration"""
    global _logger

    _logger = BridgeLogger(
        name=name,
        level=level,
        enable_dev=enable_dev,
        log_file=log_file,
        log_performance=log_performance,
    )

    return _logger


def get_logger() -> BridgeLogger:
    """Get the global logger instance"""
    global _logger
    if _logger is None:
        _logger = setup_logging()
    return _logger
