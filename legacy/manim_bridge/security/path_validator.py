"""Path validation and sandboxing for security"""

import os
from pathlib import Path
from typing import List, Optional

from ..core.exceptions import SecurityError
from ..monitoring.logger import get_logger


class PathValidator:
    """Validates and sanitizes file paths for security"""

    def __init__(self, allowed_directories: List[Path], enable_logging: bool = False):
        self.allowed_dirs = [Path(d).resolve() for d in allowed_directories]
        self.logger = get_logger() if enable_logging else None

        if self.logger:
            self.logger.debug(f"PathValidator initialized with allowed dirs: {self.allowed_dirs}")

    def is_safe(self, path: str) -> bool:
        """Check if path is within allowed directories"""
        try:
            # Handle circular symlinks gracefully
            try:
                resolved = Path(path).resolve()
            except RuntimeError as e:
                # RuntimeError is thrown for circular symlinks
                if "Symlink loop" in str(e):
                    if self.logger:
                        self.logger.warning(f"Circular symlink detected: {path}")
                    return False
                raise  # Re-raise other RuntimeErrors

            # Check for path traversal attempts in raw path
            if ".." in path or "~" in path:
                # But allow if it resolves within allowed directories
                pass  # Continue to check resolved path

            # Check if path is within allowed directories
            is_allowed = any(
                self._is_subpath(resolved, allowed_dir) for allowed_dir in self.allowed_dirs
            )

            if not is_allowed and self.logger:
                self.logger.warning(f"Path outside allowed directories: {resolved}")

            return is_allowed

        except (ValueError, OSError) as e:
            if self.logger:
                self.logger.error(f"Path validation error for {path}: {e}")
            return False

    def _is_subpath(self, path: Path, parent: Path) -> bool:
        """Check if path is a subpath of parent"""
        try:
            # Ensure both paths are fully resolved for accurate comparison
            try:
                resolved_path = path.resolve()
                resolved_parent = parent.resolve()
            except RuntimeError as e:
                # Handle circular symlinks
                if "Symlink loop" in str(e):
                    return False
                raise

            resolved_path.relative_to(resolved_parent)
            return True
        except ValueError:
            return False

    def normalize(self, path: str) -> Optional[Path]:
        """Normalize and validate a path"""
        if not self.is_safe(path):
            raise SecurityError(f"Unsafe path: {path}")

        normalized = Path(path).resolve()

        if self.logger:
            self.logger.debug(f"Path normalized: {path} -> {normalized}")

        return normalized

    def normalize_path(self, path: str) -> Optional[Path]:
        """Alias for normalize method for backward compatibility"""
        return self.normalize(path)

    def is_within_sandbox(self, path: Path) -> bool:
        """Check if a resolved path is within allowed directories"""
        return any(self._is_subpath(path, allowed_dir) for allowed_dir in self.allowed_dirs)

    def validate_input_path(self, path: str, must_exist: bool = True) -> Path:
        """Validate an input file path"""
        normalized = self.normalize(path)

        if must_exist and not normalized.exists():
            raise SecurityError(f"Path does not exist: {normalized}")

        if normalized.is_symlink():
            # Resolve symlink and validate target
            target = normalized.resolve()
            if not self.is_safe(str(target)):
                raise SecurityError(f"Symlink points outside allowed directories: {target}")

        return normalized

    def validate_output_path(self, path: str, create_parents: bool = True) -> Path:
        """Validate an output file path"""
        normalized = self.normalize(path)

        if create_parents:
            normalized.parent.mkdir(parents=True, exist_ok=True)

        # Check write permissions
        parent = normalized.parent
        if not os.access(parent, os.W_OK):
            raise SecurityError(f"No write permission for directory: {parent}")

        return normalized

    def is_excluded(self, path: Path, excluded_patterns: List[str]) -> bool:
        """Check if path matches any excluded patterns"""
        path_str = str(path)

        for pattern in excluded_patterns:
            if pattern in path_str:
                if self.logger:
                    self.logger.debug(f"Path excluded by pattern '{pattern}': {path}")
                return True

        return False

    def validate_directory_traversal(self, path: str) -> Path:
        """Validate a directory for traversal"""
        normalized = self.normalize(path)

        if not normalized.is_dir():
            raise SecurityError(f"Path is not a directory: {normalized}")

        return normalized
