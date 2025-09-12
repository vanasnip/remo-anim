#!/usr/bin/env python3
"""
Secure Manim to Remotion Bridge Script
Watches for new manim renders and automatically copies them to Remotion's assets directory
SECURITY HARDENED VERSION with comprehensive path validation and sandboxing
"""

import argparse
import hashlib
import json
import logging
import os
import re
import shutil
import signal
import sys
import time
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Set

from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer


# Custom Exception Classes
class SecurityError(Exception):
    """Custom exception for security violations"""

    pass


class BridgeProcessingError(Exception):
    """Custom exception for bridge processing failures"""

    def __init__(self, message: str, original_error: Exception = None):
        super().__init__(message)
        self.original_error = original_error
        self.timestamp = datetime.now().isoformat()


class ManifestUpdateError(Exception):
    """Custom exception for manifest file update failures"""

    def __init__(self, message: str, manifest_path: str = None):
        super().__init__(message)
        self.manifest_path = manifest_path
        self.timestamp = datetime.now().isoformat()


class VideoRenderError(Exception):
    """Custom exception for video rendering and processing failures"""

    def __init__(self, message: str, video_path: str = None, operation: str = None):
        super().__init__(message)
        self.video_path = video_path
        self.operation = operation
        self.timestamp = datetime.now().isoformat()


class PathValidator:
    """
    Comprehensive path validation and sandboxing class
    Implements defense-in-depth security controls for file path operations
    """

    def __init__(self, project_root: str, allowed_directories: Set[str]):
        """
        Initialize path validator with project root and allowed directories

        Args:
            project_root: Absolute path to project root directory
            allowed_directories: Set of allowed directory paths relative to project root
        """
        self.project_root = Path(project_root).resolve()
        self.allowed_directories = set()

        # Resolve and validate allowed directories
        for dir_path in allowed_directories:
            resolved_dir = (self.project_root / dir_path).resolve()
            if not str(resolved_dir).startswith(str(self.project_root)):
                raise SecurityError(f"Allowed directory '{dir_path}' is outside project root")
            self.allowed_directories.add(resolved_dir)

        # Setup security logging
        self.setup_security_logging()

        # Dangerous path patterns
        self.dangerous_patterns = [
            r"\.\./",  # Path traversal
            r"\.\.",  # Parent directory reference
            r"~/",  # Home directory
            r"/etc/",  # System directories
            r"/proc/",  # Process filesystem
            r"/sys/",  # System filesystem
            r"/dev/",  # Device files
        ]

    def setup_security_logging(self):
        """Setup dedicated security logging"""
        self.security_logger = logging.getLogger("manim_bridge_security")
        self.security_logger.setLevel(logging.WARNING)

        # Create file handler for security events
        security_handler = logging.FileHandler(
            self.project_root / "security_events.log", encoding="utf-8"
        )
        security_handler.setLevel(logging.WARNING)

        # Create console handler for critical security events
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.ERROR)

        # Create formatter
        formatter = logging.Formatter(
            "%(asctime)s - SECURITY - %(levelname)s - %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )

        security_handler.setFormatter(formatter)
        console_handler.setFormatter(formatter)

        self.security_logger.addHandler(security_handler)
        self.security_logger.addHandler(console_handler)

    def normalize_path(self, path: str) -> Path:
        """
        Normalize path using os.path.realpath for security

        Args:
            path: Input path to normalize

        Returns:
            Normalized Path object

        Raises:
            SecurityError: If path contains dangerous patterns
        """
        # Check for dangerous patterns first
        for pattern in self.dangerous_patterns:
            if re.search(pattern, str(path), re.IGNORECASE):
                self.security_logger.error(f"Dangerous path pattern detected: {path}")
                raise SecurityError(f"Path contains dangerous pattern: {path}")

        # Normalize path using realpath to resolve symlinks and relative paths
        try:
            normalized = Path(os.path.realpath(path))
            return normalized
        except (OSError, ValueError) as e:
            self.security_logger.error(f"Path normalization failed for: {path} - {e}")
            raise SecurityError(f"Invalid path: {path}")

    def is_within_sandbox(self, path: Path) -> bool:
        """
        Check if normalized path is within allowed sandbox directories

        Args:
            path: Normalized path to check

        Returns:
            True if path is within sandbox, False otherwise
        """
        path_str = str(path)

        # First check if within project root
        if not path_str.startswith(str(self.project_root)):
            return False

        # Check if within any allowed directory
        for allowed_dir in self.allowed_directories:
            if path_str.startswith(str(allowed_dir)):
                return True

        return False

    def validate_input_path(self, path: str) -> Path:
        """
        Validate input path (source files)

        Args:
            path: Input path to validate

        Returns:
            Validated Path object

        Raises:
            SecurityError: If path is invalid or outside sandbox
        """
        try:
            normalized_path = self.normalize_path(path)

            # Check if file exists and is readable
            if not normalized_path.exists():
                self.security_logger.warning(f"Input path does not exist: {path}")
                raise SecurityError(f"Input path does not exist: {path}")

            if not os.access(normalized_path, os.R_OK):
                self.security_logger.warning(f"Input path not readable: {path}")
                raise SecurityError(f"Input path not readable: {path}")

            # Check if within sandbox
            if not self.is_within_sandbox(normalized_path):
                self.security_logger.error(f"Input path outside sandbox: {path}")
                raise SecurityError(f"Input path outside allowed directories: {path}")

            # Check for symlink abuse
            if normalized_path.is_symlink():
                link_target = normalized_path.resolve()
                if not self.is_within_sandbox(link_target):
                    self.security_logger.error(
                        f"Symlink points outside sandbox: {path} -> {link_target}"
                    )
                    raise SecurityError(f"Symlink target outside sandbox: {path}")

            return normalized_path

        except SecurityError:
            raise
        except Exception as e:
            self.security_logger.error(f"Input path validation error: {path} - {e}")
            raise SecurityError(f"Input path validation failed: {path}")

    def validate_output_path(self, path: str) -> Path:
        """
        Validate output path (target files)

        Args:
            path: Output path to validate

        Returns:
            Validated Path object

        Raises:
            SecurityError: If path is invalid or outside sandbox
        """
        try:
            normalized_path = self.normalize_path(path)

            # Check if within sandbox
            if not self.is_within_sandbox(normalized_path):
                self.security_logger.error(f"Output path outside sandbox: {path}")
                raise SecurityError(f"Output path outside allowed directories: {path}")

            # Check if parent directory is writable
            parent_dir = normalized_path.parent
            if parent_dir.exists() and not os.access(parent_dir, os.W_OK):
                self.security_logger.warning(f"Output parent directory not writable: {parent_dir}")
                raise SecurityError(f"Output parent directory not writable: {parent_dir}")

            # Prevent overwriting critical files
            if normalized_path.exists() and normalized_path.name.startswith("."):
                self.security_logger.warning(f"Attempt to overwrite hidden file: {path}")
                raise SecurityError(f"Cannot overwrite hidden file: {path}")

            return normalized_path

        except SecurityError:
            raise
        except Exception as e:
            self.security_logger.error(f"Output path validation error: {path} - {e}")
            raise SecurityError(f"Output path validation failed: {path}")

    def validate_directory_traversal(self, base_path: str, traversal_pattern: str = "**/*") -> Path:
        """
        Safely validate directory traversal operations

        Args:
            base_path: Base directory for traversal
            traversal_pattern: Pattern for traversal (default: **/* for recursive)

        Returns:
            Validated base path

        Raises:
            SecurityError: If traversal would be unsafe
        """
        base_normalized = self.validate_input_path(base_path)

        # Ensure base path is a directory
        if not base_normalized.is_dir():
            raise SecurityError(f"Base path is not a directory: {base_path}")

        return base_normalized


class SecureManimRenderHandler(FileSystemEventHandler):
    """
    Secure version of ManimRenderHandler with comprehensive path validation
    """

    def __init__(self, source_dir: str, target_dir: str, manifest_file: str, project_root: str):
        # Define allowed directories for sandboxing
        allowed_dirs = {"manim-output", "remotion-app/public/assets"}

        # Initialize path validator
        self.path_validator = PathValidator(project_root, allowed_dirs)

        # Validate and set up directories with security checks
        self.source_dir = self.path_validator.validate_input_path(source_dir)
        self.target_dir = self.path_validator.validate_output_path(target_dir)
        self.manifest_file = self.path_validator.validate_output_path(manifest_file)

        self.processed_files = self.load_manifest()

        # Ensure target directory exists with proper permissions
        self.target_dir.mkdir(parents=True, exist_ok=True, mode=0o755)

        # Setup logging
        self.logger = logging.getLogger("manim_bridge")
        self.logger.setLevel(logging.INFO)
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter("%(asctime)s - %(levelname)s - %(message)s"))
        self.logger.addHandler(handler)

    def load_manifest(self) -> Dict[str, Any]:
        """Load the manifest of already processed files with comprehensive error handling"""
        max_retries = 3
        retry_delay = 1.0

        for attempt in range(max_retries):
            try:
                if not self.manifest_file.exists():
                    self.logger.info("Manifest file does not exist, starting with empty manifest")
                    return {}

                # Validate manifest file is within sandbox
                self.path_validator.validate_input_path(str(self.manifest_file))

                # Check file permissions before reading
                if not os.access(self.manifest_file, os.R_OK):
                    raise PermissionError(f"Cannot read manifest file: {self.manifest_file}")

                with open(self.manifest_file, encoding="utf-8") as f:
                    content = f.read()

                    # Basic JSON injection protection
                    if len(content) > 10 * 1024 * 1024:  # 10MB limit
                        raise SecurityError("Manifest file too large")

                    if not content.strip():
                        self.logger.warning("Manifest file is empty, starting with empty manifest")
                        return {}

                    parsed_content = json.loads(content)
                    self.logger.info(
                        f"Successfully loaded manifest with {len(parsed_content)} entries"
                    )
                    return parsed_content

            except FileNotFoundError:
                self.logger.info("Manifest file not found, starting with empty manifest")
                return {}
            except PermissionError as e:
                self.logger.error(
                    f"Permission denied accessing manifest file (attempt {attempt + 1}/{max_retries}): {e}"
                )
                if attempt == max_retries - 1:
                    raise ManifestUpdateError(
                        f"Failed to load manifest due to permissions: {e}",
                        str(self.manifest_file),
                    )
            except (json.JSONDecodeError, SecurityError) as e:
                self.logger.error(
                    f"Manifest file corrupted or invalid (attempt {attempt + 1}/{max_retries}): {e}"
                )
                if attempt == max_retries - 1:
                    # Try to backup corrupted manifest
                    try:
                        backup_path = self.manifest_file.with_suffix(".backup")
                        shutil.copy2(self.manifest_file, backup_path)
                        self.logger.info(f"Corrupted manifest backed up to: {backup_path}")
                    except Exception as backup_error:
                        self.logger.warning(f"Could not backup corrupted manifest: {backup_error}")
                    return {}  # Start fresh with empty manifest
            except OSError as e:
                self.logger.error(
                    f"I/O error reading manifest file (attempt {attempt + 1}/{max_retries}): {e}"
                )
                if attempt == max_retries - 1:
                    raise ManifestUpdateError(
                        f"I/O error loading manifest: {e}", str(self.manifest_file)
                    )
            except Exception as e:
                self.logger.error(
                    f"Unexpected error loading manifest (attempt {attempt + 1}/{max_retries}): {e}"
                )
                if attempt == max_retries - 1:
                    raise BridgeProcessingError(f"Unexpected error loading manifest: {e}", e)

            # Wait before retry
            if attempt < max_retries - 1:
                time.sleep(retry_delay)
                retry_delay *= 2  # Exponential backoff

        return {}

    @contextmanager
    def atomic_file_write(self, target_path: Path):
        """Context manager for atomic file writing with cleanup on failure"""
        temp_file = None
        try:
            # Create temporary file in same directory to ensure atomic rename works
            temp_file = target_path.with_suffix(".tmp")
            yield temp_file
            # If we get here, the write was successful, so do atomic rename
            temp_file.replace(target_path)
            temp_file = None  # Prevent cleanup
        except Exception:
            # Cleanup temporary file on any error
            if temp_file and temp_file.exists():
                try:
                    temp_file.unlink()
                except Exception as cleanup_error:
                    self.logger.warning(
                        f"Could not cleanup temporary file {temp_file}: {cleanup_error}"
                    )
            raise

    def save_manifest(self):
        """Save the manifest of processed files with comprehensive error handling"""
        max_retries = 3
        retry_delay = 1.0

        for attempt in range(max_retries):
            try:
                # Validate manifest file path
                self.path_validator.validate_output_path(str(self.manifest_file))

                # Ensure parent directory exists
                self.manifest_file.parent.mkdir(parents=True, exist_ok=True)

                # Check disk space before writing (basic check)
                try:
                    statvfs = os.statvfs(self.manifest_file.parent)
                    available_space = statvfs.f_frsize * statvfs.f_bavail
                    if available_space < 10 * 1024 * 1024:  # Less than 10MB
                        raise OSError("Insufficient disk space to save manifest")
                except AttributeError:
                    # os.statvfs not available on Windows, skip check
                    pass

                # Write atomically to prevent corruption
                with self.atomic_file_write(self.manifest_file) as temp_file:
                    with open(temp_file, "w", encoding="utf-8") as f:
                        json.dump(
                            self.processed_files,
                            f,
                            indent=2,
                            default=str,
                            ensure_ascii=False,
                        )
                        f.flush()  # Ensure data is written to disk
                        os.fsync(f.fileno())  # Force OS to write to disk

                # Verify the written file
                try:
                    with open(self.manifest_file, encoding="utf-8") as f:
                        json.load(f)  # Just parse to verify integrity
                except json.JSONDecodeError as verify_error:
                    raise ManifestUpdateError(
                        f"Manifest verification failed after write: {verify_error}"
                    )

                self.logger.info(
                    f"Successfully saved manifest with {len(self.processed_files)} entries"
                )
                return

            except PermissionError as e:
                self.logger.error(
                    f"Permission denied saving manifest (attempt {attempt + 1}/{max_retries}): {e}"
                )
                if attempt == max_retries - 1:
                    raise ManifestUpdateError(
                        f"Permission denied saving manifest: {e}",
                        str(self.manifest_file),
                    )
            except OSError as e:
                self.logger.error(
                    f"I/O error saving manifest (attempt {attempt + 1}/{max_retries}): {e}"
                )
                if attempt == max_retries - 1:
                    raise ManifestUpdateError(
                        f"I/O error saving manifest: {e}", str(self.manifest_file)
                    )
            except (SecurityError, ManifestUpdateError):
                # Don't retry security errors or manifest update errors
                raise
            except Exception as e:
                self.logger.error(
                    f"Unexpected error saving manifest (attempt {attempt + 1}/{max_retries}): {e}"
                )
                if attempt == max_retries - 1:
                    raise BridgeProcessingError(
                        f"Failed to save manifest after {max_retries} attempts: {e}", e
                    )

            # Wait before retry
            if attempt < max_retries - 1:
                time.sleep(retry_delay)
                retry_delay *= 2  # Exponential backoff

    def get_file_hash(self, filepath: Path) -> str:
        """Calculate SHA256 hash of a file with comprehensive error handling"""
        max_retries = 2

        for attempt in range(max_retries):
            try:
                # Validate file path
                validated_path = self.path_validator.validate_input_path(str(filepath))

                # Check if file still exists and is readable
                if not validated_path.exists():
                    raise FileNotFoundError(f"File no longer exists: {validated_path}")

                if not os.access(validated_path, os.R_OK):
                    raise PermissionError(f"Cannot read file for hashing: {validated_path}")

                hash_sha256 = hashlib.sha256()
                try:
                    with open(validated_path, "rb") as f:
                        while True:
                            chunk = f.read(8192)
                            if not chunk:
                                break
                            hash_sha256.update(chunk)

                    hash_result = hash_sha256.hexdigest()
                    self.logger.debug(
                        f"Calculated hash for {validated_path.name}: {hash_result[:16]}..."
                    )
                    return hash_result

                except OSError as e:
                    if "Bad file descriptor" in str(e) and attempt < max_retries - 1:
                        self.logger.warning(
                            f"File descriptor error reading {validated_path}, retrying..."
                        )
                        time.sleep(0.5)
                        continue
                    raise

            except FileNotFoundError as e:
                self.logger.error(f"File not found for hashing: {e}")
                raise VideoRenderError(
                    f"File not found for hashing: {e}",
                    str(filepath),
                    "hash_calculation",
                )
            except PermissionError as e:
                self.logger.error(f"Permission denied hashing file: {e}")
                raise VideoRenderError(
                    f"Permission denied hashing file: {e}",
                    str(filepath),
                    "hash_calculation",
                )
            except OSError as e:
                self.logger.error(f"I/O error hashing file: {e}")
                raise VideoRenderError(
                    f"I/O error hashing file: {e}", str(filepath), "hash_calculation"
                )
            except Exception as e:
                self.logger.error(f"Unexpected error calculating hash for {filepath}: {e}")
                raise BridgeProcessingError(f"Hash calculation failed: {e}", e)

        raise VideoRenderError(
            f"Failed to calculate hash after {max_retries} attempts",
            str(filepath),
            "hash_calculation",
        )

    def should_process_file(self, filepath: str) -> bool:
        """Check if file should be processed with security validation"""
        try:
            # Validate file path first
            validated_path = self.path_validator.validate_input_path(filepath)

            # Only process video files (whitelist approach)
            allowed_extensions = {".mp4", ".mov", ".avi", ".webm"}
            if validated_path.suffix.lower() not in allowed_extensions:
                return False

            # Skip partial movie files
            if "partial_movie_files" in str(validated_path):
                return False

            # Check file size limits (prevent DoS)
            file_size = validated_path.stat().st_size
            if file_size > 500 * 1024 * 1024:  # 500MB limit
                self.logger.warning(f"File too large: {validated_path} ({file_size} bytes)")
                return False

            # Check if file is complete (wait for file to finish writing)
            initial_size = validated_path.stat().st_size
            time.sleep(0.5)
            if validated_path.stat().st_size != initial_size:
                return False  # File is still being written

            # Check if file was already processed with same hash
            file_hash = self.get_file_hash(validated_path)
            if str(validated_path) in self.processed_files:
                if self.processed_files[str(validated_path)].get("hash") == file_hash:
                    return False  # Already processed

            return True

        except SecurityError as e:
            self.logger.warning(f"Security validation failed for {filepath}: {e}")
            return False
        except Exception as e:
            self.logger.error(f"Error validating file {filepath}: {e}")
            return False

    def cleanup_partial_files(self, target_path: Path):
        """Clean up partial or corrupted files"""
        try:
            if target_path.exists():
                target_path.unlink()
                self.logger.info(f"Cleaned up partial file: {target_path}")
        except Exception as cleanup_error:
            self.logger.warning(f"Could not cleanup partial file {target_path}: {cleanup_error}")

    def verify_copied_file(self, source_path: Path, target_path: Path) -> bool:
        """Verify that the copied file is intact"""
        try:
            # Check file sizes match
            source_size = source_path.stat().st_size
            target_size = target_path.stat().st_size

            if source_size != target_size:
                self.logger.error(f"File size mismatch: source={source_size}, target={target_size}")
                return False

            # For small files, verify hash matches
            if source_size < 100 * 1024 * 1024:  # Less than 100MB
                source_hash = self.get_file_hash(source_path)
                target_hash = self.get_file_hash(target_path)

                if source_hash != target_hash:
                    self.logger.error(
                        f"File hash mismatch: source={source_hash[:16]}..., target={target_hash[:16]}..."
                    )
                    return False

            return True

        except Exception as e:
            self.logger.error(f"Error verifying copied file: {e}")
            return False

    def copy_video(self, source_path: str) -> bool:
        """Copy video to Remotion assets directory with comprehensive error handling"""
        max_retries = 2
        validated_source = None
        validated_target = None

        for attempt in range(max_retries):
            try:
                # Validate source path
                validated_source = self.path_validator.validate_input_path(source_path)

                # Check if source file still exists and is readable
                if not validated_source.exists():
                    raise FileNotFoundError(f"Source file no longer exists: {validated_source}")

                if not os.access(validated_source, os.R_OK):
                    raise PermissionError(f"Cannot read source file: {validated_source}")

                # Generate secure target filename
                parts = validated_source.parts
                quality = parts[-2] if len(parts) > 1 else "unknown"

                # Sanitize scene name to prevent injection attacks
                scene_name = re.sub(r"[^a-zA-Z0-9_-]", "_", validated_source.stem)
                scene_name = scene_name[:50]  # Limit length

                # Create secure filename with timestamp
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                target_filename = f"{scene_name}_{quality}_{timestamp}{validated_source.suffix}"
                target_path = self.target_dir / target_filename

                # Validate target path
                validated_target = self.path_validator.validate_output_path(str(target_path))

                # Ensure target directory exists
                validated_target.parent.mkdir(parents=True, exist_ok=True)

                # Check available disk space
                source_size = validated_source.stat().st_size
                try:
                    statvfs = os.statvfs(validated_target.parent)
                    available_space = statvfs.f_frsize * statvfs.f_bavail
                    if available_space < source_size * 1.1:  # 10% buffer
                        raise OSError(
                            f"Insufficient disk space: need {source_size}, available {available_space}"
                        )
                except AttributeError:
                    # os.statvfs not available on Windows, skip check
                    pass

                # Copy file with error handling
                try:
                    shutil.copy2(validated_source, validated_target)
                except shutil.SameFileError:
                    raise VideoRenderError(
                        f"Source and target are the same file: {validated_source}",
                        source_path,
                        "copy",
                    )
                except PermissionError as e:
                    raise VideoRenderError(
                        f"Permission denied copying file: {e}", source_path, "copy"
                    )
                except OSError as e:
                    # Cleanup partial file on I/O error
                    self.cleanup_partial_files(validated_target)
                    raise VideoRenderError(f"I/O error copying file: {e}", source_path, "copy")

                # Set proper permissions
                try:
                    validated_target.chmod(0o644)  # Read-only for group/others
                except OSError as e:
                    self.logger.warning(f"Could not set file permissions: {e}")

                # Verify the copied file
                if not self.verify_copied_file(validated_source, validated_target):
                    self.cleanup_partial_files(validated_target)
                    if attempt < max_retries - 1:
                        self.logger.warning(
                            f"File verification failed, retrying copy (attempt {attempt + 1}/{max_retries})"
                        )
                        time.sleep(1.0)
                        continue
                    else:
                        raise VideoRenderError(
                            "File verification failed after copy",
                            source_path,
                            "verification",
                        )

                # Calculate hash and update manifest
                try:
                    file_hash = self.get_file_hash(validated_source)
                    self.processed_files[str(validated_source)] = {
                        "hash": file_hash,
                        "target": str(validated_target),
                        "processed_at": datetime.now().isoformat(),
                        "scene": scene_name,
                        "quality": quality,
                        "size": source_size,
                    }
                    self.save_manifest()
                except Exception as manifest_error:
                    # Don't fail the whole operation if manifest update fails
                    self.logger.error(
                        f"Failed to update manifest after successful copy: {manifest_error}"
                    )

                self.logger.info(
                    f"Successfully copied: {validated_source.name} -> {validated_target.name} ({source_size} bytes)"
                )
                return True

            except FileNotFoundError as e:
                self.logger.error(f"Source file not found: {e}")
                return False  # Don't retry for missing files
            except VideoRenderError:
                if attempt == max_retries - 1:
                    raise
                self.logger.warning(
                    f"Video processing error (attempt {attempt + 1}/{max_retries}), retrying..."
                )
                time.sleep(1.0)
            except SecurityError as e:
                self.logger.error(f"Security error copying {source_path}: {e}")
                return False  # Don't retry security errors
            except Exception as e:
                if attempt == max_retries - 1:
                    self.logger.error(f"Unexpected error copying {source_path}: {e}")
                    # Cleanup any partial files
                    if validated_target:
                        self.cleanup_partial_files(validated_target)
                    raise BridgeProcessingError(
                        f"Failed to copy video after {max_retries} attempts: {e}", e
                    )
                else:
                    self.logger.warning(
                        f"Error copying {source_path} (attempt {attempt + 1}/{max_retries}): {e}"
                    )
                    time.sleep(1.0)

        return False

    def on_created(self, event):
        if not event.is_directory:
            self.process_file(event.src_path)

    def on_modified(self, event):
        if not event.is_directory:
            self.process_file(event.src_path)

    def process_file(self, filepath: str):
        """Process a potential manim render with comprehensive error handling"""
        try:
            # Pre-validation checks
            if not filepath or not isinstance(filepath, str):
                self.logger.warning(f"Invalid filepath parameter: {filepath}")
                return

            # Check if we should process this file
            should_process = False
            try:
                should_process = self.should_process_file(filepath)
            except SecurityError as e:
                self.logger.warning(f"Security validation failed for {filepath}: {e}")
                return
            except Exception as e:
                self.logger.error(f"Error validating file {filepath}: {e}")
                return

            if not should_process:
                self.logger.debug(f"Skipping file (validation failed): {filepath}")
                return

            # Validate and process the file
            try:
                validated_path = self.path_validator.validate_input_path(filepath)
                self.logger.info(
                    f"New manim render detected: {validated_path.name} ({validated_path.stat().st_size} bytes)"
                )

                # Copy the video with error handling
                copy_successful = False
                try:
                    copy_successful = self.copy_video(str(validated_path))
                except VideoRenderError as e:
                    self.logger.error(f"Video processing error for {filepath}: {e}")
                    return
                except BridgeProcessingError as e:
                    self.logger.error(f"Bridge processing error for {filepath}: {e}")
                    return
                except Exception as e:
                    self.logger.error(f"Unexpected error copying {filepath}: {e}")
                    return

                # Update video index if copy was successful
                if copy_successful:
                    try:
                        self.update_video_index()
                        self.logger.info(
                            f"Successfully processed and indexed: {validated_path.name}"
                        )
                    except Exception as index_error:
                        self.logger.error(
                            f"Failed to update video index after processing {filepath}: {index_error}"
                        )
                        # Don't fail the whole operation if index update fails
                else:
                    self.logger.warning(f"Failed to copy video: {filepath}")

            except SecurityError as e:
                self.logger.error(f"Security error processing file {filepath}: {e}")
            except Exception as e:
                self.logger.error(f"Unexpected error processing file {filepath}: {e}")

        except Exception as e:
            # Catch-all for any unexpected errors in the main process_file logic
            self.logger.error(f"Critical error in process_file for {filepath}: {e}")
            # Don't re-raise to prevent crashing the file watcher

    def update_video_index(self):
        """Create/update an index of available manim videos for Remotion with comprehensive error handling"""
        max_retries = 2

        for attempt in range(max_retries):
            videos = []
            try:
                # Safely traverse target directory
                try:
                    validated_target_dir = self.path_validator.validate_directory_traversal(
                        str(self.target_dir)
                    )
                except SecurityError as e:
                    self.logger.error(f"Security error validating target directory: {e}")
                    raise

                # Check if target directory exists and is accessible
                if not validated_target_dir.exists():
                    self.logger.warning(f"Target directory does not exist: {validated_target_dir}")
                    validated_target_dir.mkdir(parents=True, exist_ok=True)

                if not os.access(validated_target_dir, os.R_OK):
                    raise PermissionError(f"Cannot read target directory: {validated_target_dir}")

                # Collect video files with error handling for each file
                video_extensions = {".mp4", ".mov", ".avi", ".webm"}
                processed_count = 0
                error_count = 0

                try:
                    for video_file in validated_target_dir.iterdir():
                        try:
                            # Skip directories and non-video files
                            if video_file.is_dir():
                                continue

                            if video_file.suffix.lower() not in video_extensions:
                                continue

                            # Skip hidden files and temporary files
                            if video_file.name.startswith(".") or video_file.name.endswith(".tmp"):
                                continue

                            # Validate each video file
                            try:
                                validated_video = self.path_validator.validate_input_path(
                                    str(video_file)
                                )
                            except SecurityError:
                                self.logger.warning(
                                    f"Skipping file that failed security validation: {video_file.name}"
                                )
                                error_count += 1
                                continue

                            # Get file stats with error handling
                            try:
                                file_stats = validated_video.stat()
                                file_size = file_stats.st_size
                                file_modified = file_stats.st_mtime
                            except OSError as stat_error:
                                self.logger.warning(
                                    f"Could not get stats for {video_file.name}: {stat_error}"
                                )
                                error_count += 1
                                continue

                            # Skip empty files
                            if file_size == 0:
                                self.logger.warning(f"Skipping empty video file: {video_file.name}")
                                error_count += 1
                                continue

                            # Prevent information disclosure in paths
                            safe_filename = re.sub(r"[^a-zA-Z0-9._-]", "_", video_file.name)

                            videos.append(
                                {
                                    "filename": safe_filename,
                                    "path": f"/assets/manim/{safe_filename}",
                                    "size": file_size,
                                    "modified": file_modified,
                                    "human_size": self._format_file_size(file_size),
                                }
                            )
                            processed_count += 1

                        except Exception as file_error:
                            self.logger.warning(
                                f"Error processing video file {video_file}: {file_error}"
                            )
                            error_count += 1
                            continue

                except Exception as dir_error:
                    raise OSError(f"Error reading target directory: {dir_error}")

                # Sort by modification time (newest first)
                videos.sort(key=lambda x: x["modified"], reverse=True)

                # Write index file securely with atomic operation
                index_file = self.target_dir / "index.json"
                try:
                    validated_index = self.path_validator.validate_output_path(str(index_file))
                except SecurityError as e:
                    raise BridgeProcessingError(
                        f"Security error validating index file path: {e}", e
                    )

                # Prepare index data
                index_data = {
                    "videos": videos,
                    "updated_at": datetime.now().isoformat(),
                    "count": len(videos),
                    "processed_count": processed_count,
                    "error_count": error_count,
                    "version": "1.0",
                }

                # Write atomically with comprehensive error handling
                try:
                    with self.atomic_file_write(validated_index) as temp_index:
                        with open(temp_index, "w", encoding="utf-8") as f:
                            json.dump(index_data, f, indent=2, ensure_ascii=False)
                            f.flush()
                            os.fsync(f.fileno())

                    # Verify the written index
                    try:
                        with open(validated_index, encoding="utf-8") as f:
                            json.load(f)  # Just parse to verify integrity
                    except json.JSONDecodeError as verify_error:
                        raise BridgeProcessingError(
                            f"Index file verification failed: {verify_error}"
                        )

                except PermissionError as e:
                    raise BridgeProcessingError(f"Permission denied writing index file: {e}", e)
                except OSError as e:
                    raise BridgeProcessingError(f"I/O error writing index file: {e}", e)

                self.logger.info(
                    f"Successfully updated video index: {len(videos)} videos, {processed_count} processed, {error_count} errors"
                )
                return

            except (SecurityError, BridgeProcessingError):
                # Don't retry these types of errors
                raise
            except PermissionError as e:
                if attempt == max_retries - 1:
                    raise BridgeProcessingError(f"Permission error updating video index: {e}", e)
                self.logger.warning(
                    f"Permission error updating index (attempt {attempt + 1}/{max_retries}): {e}"
                )
            except OSError as e:
                if attempt == max_retries - 1:
                    raise BridgeProcessingError(f"I/O error updating video index: {e}", e)
                self.logger.warning(
                    f"I/O error updating index (attempt {attempt + 1}/{max_retries}): {e}"
                )
            except Exception as e:
                if attempt == max_retries - 1:
                    raise BridgeProcessingError(f"Unexpected error updating video index: {e}", e)
                self.logger.warning(
                    f"Unexpected error updating index (attempt {attempt + 1}/{max_retries}): {e}"
                )

            # Wait before retry
            if attempt < max_retries - 1:
                time.sleep(1.0)

    def _format_file_size(self, size_bytes: int) -> str:
        """Format file size in human-readable format"""
        try:
            for unit in ["B", "KB", "MB", "GB"]:
                if size_bytes < 1024.0:
                    return f"{size_bytes:.1f} {unit}"
                size_bytes /= 1024.0
            return f"{size_bytes:.1f} TB"
        except Exception:
            return "Unknown"


def scan_existing_files(handler: SecureManimRenderHandler):
    """Scan and process any existing manim renders with comprehensive error handling"""
    print("🔍 Scanning for existing manim renders...")

    count = 0
    error_count = 0
    skipped_count = 0

    try:
        # Safe directory traversal with error handling
        try:
            validated_source = handler.path_validator.validate_directory_traversal(
                str(handler.source_dir)
            )
        except SecurityError as e:
            print(f"❌ Security error validating source directory: {e}")
            return
        except Exception as e:
            print(f"❌ Error validating source directory: {e}")
            return

        # Check if source directory exists and is readable
        if not validated_source.exists():
            print(f"⚠️  Source directory does not exist: {validated_source}")
            print("   Creating source directory...")
            try:
                validated_source.mkdir(parents=True, exist_ok=True)
                print(f"✅ Created source directory: {validated_source}")
            except Exception as create_error:
                print(f"❌ Could not create source directory: {create_error}")
                return

        if not os.access(validated_source, os.R_OK):
            print(f"❌ Cannot read source directory: {validated_source}")
            return

        # Scan for video files with comprehensive error handling
        video_extensions = {".mp4", ".mov", ".avi", ".webm"}

        try:
            # Use iterdir with recursive search for better error handling
            all_files = []
            for ext in video_extensions:
                try:
                    pattern_files = list(validated_source.rglob(f"*{ext}"))
                    all_files.extend(pattern_files)
                except Exception as pattern_error:
                    print(f"⚠️  Error scanning for {ext} files: {pattern_error}")
                    error_count += 1
                    continue

            print(f"   Found {len(all_files)} potential video files to examine")

            for video_file in all_files:
                try:
                    # Check if file should be processed
                    should_process = False
                    try:
                        should_process = handler.should_process_file(str(video_file))
                    except SecurityError as security_error:
                        print(
                            f"   ⚠️  Security validation failed for {video_file.name}: {security_error}"
                        )
                        skipped_count += 1
                        continue
                    except Exception as validation_error:
                        print(f"   ⚠️  Validation error for {video_file.name}: {validation_error}")
                        error_count += 1
                        continue

                    if not should_process:
                        skipped_count += 1
                        continue

                    print(
                        f"   📹 Processing: {video_file.name} ({handler._format_file_size(video_file.stat().st_size)})"
                    )

                    # Copy the video file
                    try:
                        if handler.copy_video(str(video_file)):
                            count += 1
                            print(f"   ✅ Successfully processed: {video_file.name}")
                        else:
                            print(f"   ❌ Failed to process: {video_file.name}")
                            error_count += 1
                    except VideoRenderError as render_error:
                        print(f"   ❌ Video processing error for {video_file.name}: {render_error}")
                        error_count += 1
                    except BridgeProcessingError as bridge_error:
                        print(
                            f"   ❌ Bridge processing error for {video_file.name}: {bridge_error}"
                        )
                        error_count += 1
                    except Exception as copy_error:
                        print(f"   ❌ Unexpected error processing {video_file.name}: {copy_error}")
                        error_count += 1

                except Exception as file_error:
                    print(f"   ❌ Error examining file {video_file}: {file_error}")
                    error_count += 1
                    continue

        except Exception as scan_error:
            print(f"❌ Critical error during file scanning: {scan_error}")
            return

        # Update video index if any files were processed
        if count > 0:
            try:
                print("   📝 Updating video index...")
                handler.update_video_index()
                print(f"✨ Successfully processed {count} existing videos")
            except Exception as index_error:
                print(f"⚠️  Processed {count} videos but failed to update index: {index_error}")
        else:
            if error_count > 0 or skipped_count > 0:
                print(f"   📊 Scan complete: {skipped_count} skipped, {error_count} errors")
            else:
                print("   📁 No new videos found to process")

    except KeyboardInterrupt:
        print("\n⚠️  Scan interrupted by user")
        raise
    except Exception as e:
        print(f"❌ Critical error during scan: {e}")
        handler.logger.error(f"Critical error in scan_existing_files: {e}")


def signal_handler(signum, frame):
    """Handle shutdown signals gracefully"""
    print(f"\n⚠️  Received signal {signum}, shutting down gracefully...")
    sys.exit(0)


def main():
    """Main function with comprehensive error handling and graceful shutdown"""
    # Setup signal handlers for graceful shutdown
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    # Argument parsing with error handling
    parser = argparse.ArgumentParser(
        description="Secure Bridge between Manim and Remotion",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python manim_bridge_secure.py
  python manim_bridge_secure.py --scan-only
  python manim_bridge_secure.py --source custom-output --target custom-assets
        """,
    )
    parser.add_argument(
        "--source",
        default="manim-output",
        help="Manim output directory to watch (default: manim-output)",
    )
    parser.add_argument(
        "--target",
        default="remotion-app/public/assets/manim",
        help="Remotion assets directory (default: remotion-app/public/assets/manim)",
    )
    parser.add_argument(
        "--manifest",
        default=".manim-bridge-manifest.json",
        help="Manifest file to track processed videos (default: .manim-bridge-manifest.json)",
    )
    parser.add_argument(
        "--scan-only",
        action="store_true",
        help="Only scan existing files, don't watch for new ones",
    )
    parser.add_argument("--verbose", "-v", action="store_true", help="Enable verbose logging")

    try:
        args = parser.parse_args()
    except SystemExit as e:
        # argparse calls sys.exit on error, catch it to handle gracefully
        if e.code != 0:
            print("❌ Invalid command line arguments")
        sys.exit(e.code)

    # Get project root with error handling
    try:
        project_root = Path.cwd().resolve()
    except Exception as e:
        print(f"❌ Error determining project root directory: {e}")
        sys.exit(1)

    print("🔒 Secure Manim to Remotion Bridge v1.0")
    print(f"   Project Root: {project_root}")
    print(f"   Source: {args.source}")
    print(f"   Target: {args.target}")
    print(f"   Manifest: {args.manifest}")
    if args.verbose:
        print("   Verbose logging: enabled")
    print()

    handler = None
    observer = None

    try:
        # Create secure handler with comprehensive error handling
        try:
            print("🔧 Initializing secure bridge handler...")
            handler = SecureManimRenderHandler(
                args.source, args.target, args.manifest, str(project_root)
            )

            # Enable verbose logging if requested
            if args.verbose:
                handler.logger.setLevel(logging.DEBUG)

            print("✅ Bridge handler initialized successfully")

        except SecurityError as e:
            print(f"❌ Security Error during initialization: {e}")
            sys.exit(1)
        except BridgeProcessingError as e:
            print(f"❌ Bridge Processing Error during initialization: {e}")
            if e.original_error:
                print(f"   Original error: {e.original_error}")
            sys.exit(1)
        except Exception as e:
            print(f"❌ Unexpected error during initialization: {e}")
            sys.exit(1)

        # Scan existing files with error handling
        try:
            scan_existing_files(handler)
        except KeyboardInterrupt:
            print("\n⚠️  Scan interrupted by user")
            sys.exit(0)
        except Exception as scan_error:
            print(f"⚠️  Error during initial scan: {scan_error}")
            print("   Continuing with file watching...")

        if args.scan_only:
            print("\n✅ Scan complete (--scan-only mode)")
            return

        # Setup file watcher with error handling
        try:
            print("📡 Setting up file system watcher...")
            observer = Observer()
            observer.schedule(handler, str(handler.source_dir), recursive=True)
            observer.start()
            print("✅ File system watcher started successfully")
        except Exception as watcher_error:
            print(f"❌ Error setting up file watcher: {watcher_error}")
            sys.exit(1)

        print("\n👀 Watching for new manim renders... (Press Ctrl+C to stop)")
        print("🔒 Security logging enabled - check security_events.log for security events")
        if args.verbose:
            print("📝 Verbose logging enabled")
        print()

        try:
            # Main watching loop with periodic health checks
            last_health_check = time.time()
            health_check_interval = 30.0  # 30 seconds

            while True:
                time.sleep(1)

                # Periodic health check
                current_time = time.time()
                if current_time - last_health_check >= health_check_interval:
                    try:
                        # Check if observer is still alive
                        if not observer.is_alive():
                            print("⚠️  File watcher stopped unexpectedly, restarting...")
                            observer.stop()
                            observer.join(timeout=5.0)

                            # Restart observer
                            observer = Observer()
                            observer.schedule(handler, str(handler.source_dir), recursive=True)
                            observer.start()
                            print("✅ File watcher restarted successfully")

                        # Check if source directory still exists
                        if not handler.source_dir.exists():
                            print(f"⚠️  Source directory no longer exists: {handler.source_dir}")
                            print("   Creating source directory...")
                            handler.source_dir.mkdir(parents=True, exist_ok=True)

                        last_health_check = current_time

                    except Exception as health_error:
                        print(f"⚠️  Health check error: {health_error}")
                        last_health_check = current_time  # Don't spam health check errors

        except KeyboardInterrupt:
            print("\n🛑 Shutdown requested by user")
        except Exception as watch_error:
            print(f"\n❌ Error during file watching: {watch_error}")

    except SecurityError as e:
        print(f"❌ Security Error: {e}")
        sys.exit(1)
    except BridgeProcessingError as e:
        print(f"❌ Bridge Processing Error: {e}")
        if e.original_error:
            print(f"   Original error: {e.original_error}")
        sys.exit(1)
    except ManifestUpdateError as e:
        print(f"❌ Manifest Update Error: {e}")
        if e.manifest_path:
            print(f"   Manifest path: {e.manifest_path}")
        sys.exit(1)
    except VideoRenderError as e:
        print(f"❌ Video Render Error: {e}")
        if e.video_path:
            print(f"   Video path: {e.video_path}")
        if e.operation:
            print(f"   Operation: {e.operation}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        sys.exit(1)
    finally:
        # Cleanup resources
        if observer:
            try:
                print("🧹 Stopping file watcher...")
                observer.stop()
                observer.join(timeout=10.0)
                if observer.is_alive():
                    print("⚠️  File watcher did not stop gracefully")
                else:
                    print("✅ File watcher stopped successfully")
            except Exception as cleanup_error:
                print(f"⚠️  Error stopping file watcher: {cleanup_error}")

        print("👋 Secure bridge shutdown complete")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n👋 Bridge terminated by user")
        sys.exit(0)
    except Exception as e:
        print(f"\n💥 Critical error in main: {e}")
        sys.exit(1)
