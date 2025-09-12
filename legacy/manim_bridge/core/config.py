"""Configuration management for Manim Bridge"""

import os
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional


@dataclass
class BridgeConfig:
    """Configuration for Manim Bridge"""

    # Directories
    source_dir: Path
    target_dir: Path
    manifest_file: Path

    # Processing
    max_workers: int = 4
    chunk_size: int = 1024 * 1024  # 1MB
    poll_interval: float = 2.0

    # Security
    allowed_dirs: Optional[List[Path]] = None
    enable_symlinks: bool = True
    validate_paths: bool = True

    # Logging
    log_level: str = "INFO"
    log_file: Optional[Path] = None
    enable_dev_logging: bool = False
    log_performance: bool = False

    # Features
    scan_on_start: bool = True
    update_index: bool = True
    create_latest_symlink: bool = True

    def __post_init__(self):
        """Validate and normalize configuration"""
        # Convert to Path objects
        self.source_dir = Path(self.source_dir).resolve()
        self.target_dir = Path(self.target_dir).resolve()
        self.manifest_file = Path(self.manifest_file).resolve()

        if self.log_file:
            self.log_file = Path(self.log_file).resolve()

        # Set allowed directories if not specified
        if self.allowed_dirs is None:
            self.allowed_dirs = [self.source_dir, self.target_dir]
        else:
            self.allowed_dirs = [Path(d).resolve() for d in self.allowed_dirs]

        # Create directories
        self.target_dir.mkdir(parents=True, exist_ok=True)

        # Check for dev mode from environment
        if os.getenv("MANIM_BRIDGE_DEV", "").lower() in ("1", "true", "yes"):
            self.enable_dev_logging = True
            self.log_level = "DEBUG"
            self.log_performance = True

    @classmethod
    def from_env(cls) -> "BridgeConfig":
        """Create configuration from environment variables"""
        return cls(
            source_dir=os.getenv("MANIM_BRIDGE_SOURCE", "manim-output"),
            target_dir=os.getenv("MANIM_BRIDGE_TARGET", "remotion-app/public/assets/manim"),
            manifest_file=os.getenv("MANIM_BRIDGE_MANIFEST", ".manim-bridge-manifest.json"),
            max_workers=int(os.getenv("MANIM_BRIDGE_WORKERS", "4")),
            enable_dev_logging=os.getenv("MANIM_BRIDGE_DEV", "").lower() in ("1", "true", "yes"),
        )
