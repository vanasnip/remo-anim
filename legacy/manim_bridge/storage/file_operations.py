"""Atomic file operations for safe concurrent access"""

import os
import shutil
import tempfile
from pathlib import Path
from typing import Callable, Optional

from ..core.exceptions import ProcessingError
from ..monitoring.logger import get_logger


class AtomicFileOperations:
    """Provides atomic file operations to prevent corruption"""

    def __init__(self, enable_logging: bool = False):
        self.logger = get_logger() if enable_logging else None

    def atomic_copy(
        self,
        source: Path,
        destination: Path,
        verify_callback: Optional[Callable] = None,
    ) -> bool:
        """Copy file atomically with optional verification"""
        source = Path(source)
        destination = Path(destination)

        if not source.exists():
            raise FileNotFoundError(f"Source file not found: {source}")

        # Ensure destination directory exists
        self.ensure_directory(destination.parent)

        # Create temp file in same directory for atomic rename

        temp_fd, temp_path = tempfile.mkstemp(
            dir=destination.parent, prefix=".tmp_", suffix=destination.suffix
        )

        try:
            # Close the file descriptor
            os.close(temp_fd)

            # Copy to temp file with file locking
            with open(source, "rb") as src_file:
                try:
                    import fcntl

                    fcntl.flock(src_file.fileno(), fcntl.LOCK_SH)
                    shutil.copy2(source, temp_path)
                except (ImportError, OSError) as lock_error:
                    if "Resource temporarily unavailable" in str(lock_error):
                        raise ProcessingError("File lock timeout")
                    # Fall back to normal copy if fcntl not available
                    shutil.copy2(source, temp_path)
                finally:
                    try:
                        fcntl.flock(src_file.fileno(), fcntl.LOCK_UN)
                    except:
                        pass

            # Verify if callback provided
            if verify_callback and not verify_callback(Path(temp_path)):
                raise ProcessingError("File verification failed")

            # Atomic rename
            Path(temp_path).replace(destination)

            if self.logger:
                self.logger.debug(f"Atomic copy: {source} -> {destination}")

            return True

        except Exception as e:
            # Clean up temp file on failure
            if Path(temp_path).exists():
                Path(temp_path).unlink()

            if self.logger:
                self.logger.error(f"Atomic copy failed: {e}")

            raise ProcessingError(f"Failed to copy {source} to {destination}: {e}")

    def atomic_move(self, source: Path, destination: Path) -> bool:
        """Move file atomically"""
        source = Path(source)
        destination = Path(destination)

        if not source.exists():
            raise FileNotFoundError(f"Source file not found: {source}")

        try:
            # If on same filesystem, use rename (atomic)
            if source.stat().st_dev == destination.parent.stat().st_dev:
                source.rename(destination)
            else:
                # Different filesystem, copy then delete
                self.atomic_copy(source, destination)
                source.unlink()

            if self.logger:
                self.logger.debug(f"Atomic move: {source} -> {destination}")

            return True

        except Exception as e:
            if self.logger:
                self.logger.error(f"Atomic move failed: {e}")

            raise ProcessingError(f"Failed to move {source} to {destination}: {e}")

    def safe_symlink(self, target: Path, link_path: Path) -> bool:
        """Create symlink safely using atomic operations to prevent TOCTOU attacks"""
        target = Path(target)
        link_path = Path(link_path)

        if not target.exists():
            raise ProcessingError(f"Symlink target not found: {target}")

        try:
            # Use atomic replace strategy to prevent TOCTOU vulnerability
            temp_link = link_path.with_suffix(f"{link_path.suffix}.tmp.{os.getpid()}")

            # Create symlink at temporary location first
            temp_link.symlink_to(target)

            # Atomically replace the target symlink (this is the critical fix)
            # os.replace() is atomic on POSIX systems and prevents race conditions
            os.replace(temp_link, link_path)

            if self.logger:
                self.logger.debug(f"Created symlink atomically: {link_path} -> {target}")

            return True

        except Exception as e:
            # Cleanup temporary file if it exists
            try:
                if 'temp_link' in locals() and temp_link.exists():
                    temp_link.unlink()
            except:
                pass  # Ignore cleanup errors

            if self.logger:
                self.logger.error(f"Symlink creation failed: {e}")

            raise ProcessingError(f"Failed to create symlink {link_path}: {e}")

    def transactional_update(
        self, file_path: Path, update_func: Callable, backup: bool = True
    ) -> bool:
        """Update file transactionally with rollback capability"""
        file_path = Path(file_path)
        backup_path = None

        try:
            # Create backup if requested
            if backup and file_path.exists():
                backup_path = file_path.with_suffix(".backup")
                shutil.copy2(file_path, backup_path)

                if self.logger:
                    self.logger.debug(f"Created backup: {backup_path}")

            # Perform update
            update_func(file_path)

            # Remove backup on success
            if backup_path and backup_path.exists():
                backup_path.unlink()

            if self.logger:
                self.logger.debug(f"Transactional update successful: {file_path}")

            return True

        except Exception as e:
            # Rollback on failure
            if backup_path and backup_path.exists():
                backup_path.replace(file_path)

                if self.logger:
                    self.logger.warning(f"Rolled back to backup after error: {e}")

            raise ProcessingError(f"Transactional update failed: {e}")

    def ensure_directory(self, directory: Path) -> bool:
        """Ensure directory exists, creating it if necessary"""
        directory = Path(directory)

        try:
            # If path exists but is a file, remove it first
            if directory.exists() and not directory.is_dir():
                directory.unlink()
                if self.logger:
                    self.logger.warning(f"Removed file to create directory: {directory}")

            directory.mkdir(parents=True, exist_ok=True)

            if self.logger:
                self.logger.debug(f"Ensured directory exists: {directory}")

            return True

        except Exception as e:
            if self.logger:
                self.logger.error(f"Failed to create directory {directory}: {e}")

            raise ProcessingError(f"Failed to create directory {directory}: {e}")

    def safe_remove(self, file_path: Path) -> bool:
        """Safely remove a file, returning True if removed, False if didn't exist"""
        file_path = Path(file_path)

        try:
            if file_path.exists():
                file_path.unlink()

                if self.logger:
                    self.logger.debug(f"Safely removed file: {file_path}")

                return True
            else:
                return False

        except Exception as e:
            if self.logger:
                self.logger.error(f"Failed to remove file {file_path}: {e}")

            raise ProcessingError(f"Failed to remove file {file_path}: {e}")

    def backup_file(self, file_path: Path) -> Path:
        """Create a backup of a file, returning the backup path"""
        file_path = Path(file_path)

        if not file_path.exists():
            raise ProcessingError(f"Cannot backup non-existent file: {file_path}")

        # Create backup with timestamp
        import time

        timestamp = int(time.time())
        backup_path = file_path.with_name(f"{file_path.stem}.backup.{timestamp}{file_path.suffix}")

        try:
            shutil.copy2(file_path, backup_path)

            if self.logger:
                self.logger.debug(f"Created backup: {file_path} -> {backup_path}")

            return backup_path

        except Exception as e:
            if self.logger:
                self.logger.error(f"Failed to create backup of {file_path}: {e}")

            raise ProcessingError(f"Failed to create backup of {file_path}: {e}")

    def restore_from_backup(self, backup_path: Path, original_path: Path) -> bool:
        """Restore a file from its backup"""
        backup_path = Path(backup_path)
        original_path = Path(original_path)

        if not backup_path.exists():
            raise ProcessingError(f"Backup file not found: {backup_path}")

        try:
            # Use atomic copy to restore
            self.atomic_copy(backup_path, original_path)

            if self.logger:
                self.logger.debug(f"Restored from backup: {backup_path} -> {original_path}")

            return True

        except Exception as e:
            if self.logger:
                self.logger.error(f"Failed to restore from backup {backup_path}: {e}")

            raise ProcessingError(f"Failed to restore from backup {backup_path}: {e}")

    def cleanup_temp_files(self, directory: Path, pattern: str = ".tmp_*"):
        """Clean up temporary files in a directory"""
        directory = Path(directory)

        if not directory.exists():
            return

        count = 0
        for temp_file in directory.glob(pattern):
            try:
                temp_file.unlink()
                count += 1
            except Exception as e:
                if self.logger:
                    self.logger.warning(f"Failed to clean up {temp_file}: {e}")

        if count > 0 and self.logger:
            self.logger.info(f"Cleaned up {count} temporary files in {directory}")
