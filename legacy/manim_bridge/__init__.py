"""
Manim Bridge - Modular Architecture
A security-hardened, high-performance bridge between Manim and Remotion with 2x performance optimization
"""

__version__ = "2.1.0"  # Updated for performance improvements

from .bridge import ManimBridge
from .core.config import BridgeConfig
from .monitoring.logger import setup_logging
from .processing import (
    AsyncVideoProcessor,
    PerformancePipeline,
    PipelineConfig,
    ParallelHashCalculator
)

__all__ = [
    "ManimBridge",
    "BridgeConfig",
    "setup_logging",
    "AsyncVideoProcessor",
    "PerformancePipeline",
    "PipelineConfig",
    "ParallelHashCalculator"
]
