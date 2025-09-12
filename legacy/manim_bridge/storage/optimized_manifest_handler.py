"""
OptimizedManifestHandler with Multi-Tier Caching and Async I/O

This module implements a highly optimized manifest handler featuring:
- L1 Cache: In-memory hot data (LRU cache)
- L2 Cache: Memory-mapped file cache for recent data
- L3 Cache: Compressed disk cache for warm data
- Async file I/O with configurable buffer sizes
- Write-behind caching for improved performance
- Smart cache eviction and preloading strategies
"""

import asyncio
import gzip
import json
import mmap
import os
import threading
import time
import weakref
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any, Dict, Optional, Union, Set
import hashlib
import struct
import tempfile

from ..core.exceptions import ManifestError
from ..monitoring.logger import get_logger
from .manifest_handler import ManifestHandler


class LRUCache:
    """Thread-safe LRU cache implementation"""

    def __init__(self, max_size: int = 1000):
        self.max_size = max_size
        self.cache = OrderedDict()
        self._lock = threading.RLock()
        self.hits = 0
        self.misses = 0

    def get(self, key: str) -> Optional[Any]:
        """Get item from cache, moving to end (most recent)"""
        with self._lock:
            if key in self.cache:
                # Move to end (most recently used)
                value = self.cache.pop(key)
                self.cache[key] = value
                self.hits += 1
                return value
            self.misses += 1
            return None

    def put(self, key: str, value: Any) -> None:
        """Put item in cache, evicting LRU if necessary"""
        with self._lock:
            if key in self.cache:
                # Update existing key
                self.cache.pop(key)
            elif len(self.cache) >= self.max_size:
                # Remove least recently used
                self.cache.popitem(last=False)

            self.cache[key] = value

    def invalidate(self, key: str) -> bool:
        """Remove specific key from cache"""
        with self._lock:
            return self.cache.pop(key, None) is not None

    def clear(self) -> None:
        """Clear all cached items"""
        with self._lock:
            self.cache.clear()
            self.hits = 0
            self.misses = 0

    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        with self._lock:
            total_requests = self.hits + self.misses
            hit_rate = (self.hits / total_requests * 100) if total_requests > 0 else 0
            return {
                "size": len(self.cache),
                "max_size": self.max_size,
                "hits": self.hits,
                "misses": self.misses,
                "hit_rate": hit_rate
            }


class MemoryMappedCache:
    """Memory-mapped file cache for efficient large file handling"""

    def __init__(self, cache_dir: Path, max_files: int = 100):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.max_files = max_files
        self._lock = threading.RLock()
        self._active_maps = {}  # key -> (mmap, file_path, access_time)

    def _get_cache_path(self, key: str) -> Path:
        """Get cache file path for key"""
        key_hash = hashlib.md5(key.encode()).hexdigest()
        return self.cache_dir / f"mmap_{key_hash}.cache"

    def get(self, key: str) -> Optional[bytes]:
        """Get data from memory-mapped cache"""
        with self._lock:
            if key in self._active_maps:
                mmap_obj, file_path, _ = self._active_maps[key]
                self._active_maps[key] = (mmap_obj, file_path, time.time())
                try:
                    mmap_obj.seek(0)
                    try:
                        size = struct.unpack('<Q', mmap_obj.read(8))[0]
                        if size <= 0 or size > len(mmap_obj) - 8:
                            raise struct.error("Invalid size header")
                        return mmap_obj.read(size)
                    except (struct.error, ValueError):
                        # Corrupted cache entry, remove it
                        self._remove_from_cache(key)
                        return None
                except (OSError, struct.error):
                    # Corrupted cache entry, remove it
                    self._remove_from_cache(key)
                    return None

            # Try to load from disk
            cache_path = self._get_cache_path(key)
            if cache_path.exists():
                try:
                    with open(cache_path, 'rb') as f:
                        size = os.path.getsize(cache_path) - 8  # Subtract header size
                        if size > 0:
                            mmap_obj = mmap.mmap(f.fileno(), 0, access=mmap.ACCESS_READ)
                            self._active_maps[key] = (mmap_obj, cache_path, time.time())
                            self._evict_if_needed()

                            mmap_obj.seek(0)
                            try:
                                stored_size = struct.unpack('<Q', mmap_obj.read(8))[0]
                                if stored_size <= 0 or stored_size > len(mmap_obj) - 8:
                                    raise struct.error("Invalid size header")
                                return mmap_obj.read(stored_size)
                            except (struct.error, ValueError):
                                # Corrupted cache, clean up
                                mmap_obj.close()
                                cache_path.unlink(missing_ok=True)
                                return None
                except (OSError, struct.error) as e:
                    # Clean up corrupted file
                    cache_path.unlink(missing_ok=True)

            return None

    def put(self, key: str, data: bytes) -> None:
        """Store data in memory-mapped cache"""
        cache_path = self._get_cache_path(key)

        try:
            # Write data with size header
            with open(cache_path, 'wb') as f:
                f.write(struct.pack('<Q', len(data)))  # 8-byte size header
                f.write(data)
                f.flush()
                os.fsync(f.fileno())

            # Create memory mapping
            with open(cache_path, 'rb') as f:
                mmap_obj = mmap.mmap(f.fileno(), 0, access=mmap.ACCESS_READ)

            with self._lock:
                # Close existing mapping if it exists
                if key in self._active_maps:
                    old_mmap, _, _ = self._active_maps[key]
                    old_mmap.close()

                self._active_maps[key] = (mmap_obj, cache_path, time.time())
                self._evict_if_needed()

        except (OSError, struct.error) as e:
            # Clean up on failure
            cache_path.unlink(missing_ok=True)
            raise ManifestError(f"Failed to create memory-mapped cache: {e}")

    def _evict_if_needed(self):
        """Evict least recently used entries if over limit"""
        if len(self._active_maps) <= self.max_files:
            return

        # Sort by access time and remove oldest
        sorted_entries = sorted(
            self._active_maps.items(),
            key=lambda x: x[1][2]  # Sort by access_time
        )

        # Remove oldest entries
        to_remove = len(self._active_maps) - self.max_files
        for key, (mmap_obj, file_path, _) in sorted_entries[:to_remove]:
            self._remove_from_cache(key)

    def _remove_from_cache(self, key: str):
        """Remove entry from cache and clean up resources"""
        if key in self._active_maps:
            mmap_obj, file_path, _ = self._active_maps[key]
            mmap_obj.close()
            file_path.unlink(missing_ok=True)
            del self._active_maps[key]

    def invalidate(self, key: str) -> bool:
        """Remove specific key from cache"""
        with self._lock:
            if key in self._active_maps:
                self._remove_from_cache(key)
                return True
            else:
                # Check disk cache
                cache_path = self._get_cache_path(key)
                if cache_path.exists():
                    cache_path.unlink(missing_ok=True)
                    return True
            return False

    def clear(self):
        """Clear all cached data"""
        with self._lock:
            # Close all active memory maps
            for key in list(self._active_maps.keys()):
                self._remove_from_cache(key)

            # Clean up any remaining cache files
            for cache_file in self.cache_dir.glob("mmap_*.cache"):
                cache_file.unlink(missing_ok=True)

    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        with self._lock:
            total_size = sum(
                file_path.stat().st_size
                for _, file_path, _ in self._active_maps.values()
                if file_path.exists()
            )
            return {
                "active_mappings": len(self._active_maps),
                "max_files": self.max_files,
                "total_size_bytes": total_size,
                "cache_dir": str(self.cache_dir)
            }


class CompressedDiskCache:
    """Compressed disk cache for long-term storage of manifest data"""

    def __init__(self, cache_dir: Path, max_size_mb: int = 100):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.max_size_bytes = max_size_mb * 1024 * 1024
        self._lock = threading.RLock()

    def _get_cache_path(self, key: str) -> Path:
        """Get cache file path for key"""
        key_hash = hashlib.md5(key.encode()).hexdigest()
        return self.cache_dir / f"compressed_{key_hash}.gz"

    def get(self, key: str) -> Optional[bytes]:
        """Get compressed data from disk cache"""
        cache_path = self._get_cache_path(key)

        if not cache_path.exists():
            return None

        try:
            with gzip.open(cache_path, 'rb') as f:
                return f.read()
        except (OSError, gzip.BadGzipFile):
            # Corrupted cache file, remove it
            cache_path.unlink(missing_ok=True)
            return None

    def put(self, key: str, data: bytes) -> None:
        """Store compressed data in disk cache"""
        cache_path = self._get_cache_path(key)

        try:
            # Create temporary file first for atomic write
            temp_path = cache_path.with_suffix('.tmp.gz')
            with gzip.open(temp_path, 'wb', compresslevel=6) as f:
                f.write(data)
                f.flush()
                os.fsync(f.fileno())

            # Atomic rename
            temp_path.replace(cache_path)

            # Update access time
            os.utime(cache_path)

            # Check if we need to evict old entries
            with self._lock:
                self._evict_if_needed()

        except (OSError, gzip.BadGzipFile) as e:
            # Clean up on failure
            if temp_path.exists():
                temp_path.unlink(missing_ok=True)
            raise ManifestError(f"Failed to write compressed cache: {e}")

    def _evict_if_needed(self):
        """Evict old entries if cache size exceeds limit"""
        cache_files = list(self.cache_dir.glob("compressed_*.gz"))

        # Calculate total size
        total_size = sum(f.stat().st_size for f in cache_files if f.exists())

        if total_size <= self.max_size_bytes:
            return

        # Sort by modification time (oldest first)
        cache_files.sort(key=lambda f: f.stat().st_mtime if f.exists() else 0)

        # Remove oldest files until under limit
        for cache_file in cache_files:
            if not cache_file.exists():
                continue

            file_size = cache_file.stat().st_size
            cache_file.unlink(missing_ok=True)
            total_size -= file_size

            if total_size <= self.max_size_bytes:
                break

    def invalidate(self, key: str) -> bool:
        """Remove specific key from cache"""
        cache_path = self._get_cache_path(key)
        if cache_path.exists():
            cache_path.unlink(missing_ok=True)
            return True
        return False

    def clear(self):
        """Clear all cached data"""
        with self._lock:
            for cache_file in self.cache_dir.glob("compressed_*.gz"):
                cache_file.unlink(missing_ok=True)

    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        with self._lock:
            cache_files = list(self.cache_dir.glob("compressed_*.gz"))
            total_size = sum(f.stat().st_size for f in cache_files if f.exists())

            return {
                "file_count": len(cache_files),
                "total_size_bytes": total_size,
                "max_size_bytes": self.max_size_bytes,
                "cache_dir": str(self.cache_dir)
            }


class WriteBehindCache:
    """Write-behind cache for deferred manifest writes"""

    def __init__(self, flush_interval: float = 5.0, max_pending: int = 1000):
        self.flush_interval = flush_interval
        self.max_pending = max_pending
        self._pending_writes = {}  # key -> (data, timestamp)
        self._dirty_keys = set()
        self._lock = threading.RLock()
        self._stop_event = threading.Event()
        self._flush_thread = None
        self._write_callback = None

    def start(self, write_callback):
        """Start the write-behind thread"""
        self._write_callback = write_callback
        self._stop_event.clear()
        self._flush_thread = threading.Thread(target=self._flush_worker, daemon=True)
        self._flush_thread.start()

    def stop(self):
        """Stop the write-behind thread and flush remaining writes"""
        if self._flush_thread:
            self._stop_event.set()
            self._flush_thread.join(timeout=10.0)

        # Flush any remaining writes synchronously
        self.flush_all()

    def schedule_write(self, key: str, data: Dict[str, Any]):
        """Schedule a write to be performed later"""
        with self._lock:
            self._pending_writes[key] = (data.copy(), time.time())
            self._dirty_keys.add(key)

            # If we have too many pending writes, force a flush
            if len(self._pending_writes) >= self.max_pending:
                self._flush_oldest_batch()

    def flush_key(self, key: str) -> bool:
        """Flush a specific key immediately"""
        with self._lock:
            if key in self._pending_writes:
                data, _ = self._pending_writes.pop(key)
                self._dirty_keys.discard(key)

                if self._write_callback:
                    try:
                        self._write_callback(key, data)
                        return True
                    except Exception as e:
                        # Re-queue the write on failure
                        self._pending_writes[key] = (data, time.time())
                        self._dirty_keys.add(key)
                        raise ManifestError(f"Write-behind flush failed for {key}: {e}")

            return False

    def flush_all(self):
        """Flush all pending writes immediately"""
        with self._lock:
            failed_writes = {}

            for key in list(self._pending_writes.keys()):
                try:
                    self.flush_key(key)
                except ManifestError:
                    # Keep failed writes for retry
                    if key in self._pending_writes:
                        failed_writes[key] = self._pending_writes[key]

            # Restore failed writes
            self._pending_writes.update(failed_writes)
            for key in failed_writes:
                self._dirty_keys.add(key)

    def _flush_worker(self):
        """Background worker thread for periodic flushes"""
        while not self._stop_event.is_set():
            try:
                # Wait for flush interval or stop event
                if self._stop_event.wait(self.flush_interval):
                    break

                # Flush writes older than flush_interval
                current_time = time.time()
                with self._lock:
                    keys_to_flush = [
                        key for key, (_, timestamp) in self._pending_writes.items()
                        if current_time - timestamp >= self.flush_interval
                    ]

                for key in keys_to_flush:
                    try:
                        self.flush_key(key)
                    except ManifestError:
                        # Log error but continue flushing other keys
                        pass

            except Exception:
                # Continue running even if individual flushes fail
                pass

    def _flush_oldest_batch(self, batch_size: int = 100):
        """Flush a batch of the oldest pending writes"""
        with self._lock:
            # Sort by timestamp and flush oldest
            sorted_writes = sorted(
                self._pending_writes.items(),
                key=lambda x: x[1][1]  # Sort by timestamp
            )

            for key, _ in sorted_writes[:batch_size]:
                try:
                    self.flush_key(key)
                except ManifestError:
                    # Continue with other keys even if one fails
                    pass

    def has_pending_writes(self) -> bool:
        """Check if there are pending writes"""
        with self._lock:
            return len(self._pending_writes) > 0

    def get_pending_count(self) -> int:
        """Get number of pending writes"""
        with self._lock:
            return len(self._pending_writes)

    def get_stats(self) -> Dict[str, Any]:
        """Get write-behind cache statistics"""
        with self._lock:
            oldest_timestamp = None
            if self._pending_writes:
                oldest_timestamp = min(timestamp for _, timestamp in self._pending_writes.values())

            return {
                "pending_writes": len(self._pending_writes),
                "max_pending": self.max_pending,
                "flush_interval": self.flush_interval,
                "oldest_pending_age": time.time() - oldest_timestamp if oldest_timestamp else None,
                "is_active": self._flush_thread and self._flush_thread.is_alive()
            }


class OptimizedManifestHandler(ManifestHandler):
    """
    Optimized manifest handler with multi-tier caching and async I/O

    Features:
    - L1 Cache: In-memory LRU cache for hot data
    - L2 Cache: Memory-mapped files for recent data
    - L3 Cache: Compressed disk cache for warm data
    - Write-behind caching for improved write performance
    - Async file I/O with optimized buffer sizes
    - Smart preloading and cache warming
    """

    def __init__(
        self,
        manifest_path: Path,
        enable_logging: bool = False,
        cache_dir: Optional[Path] = None,
        l1_cache_size: int = 1000,
        l2_cache_files: int = 100,
        l3_cache_size_mb: int = 100,
        buffer_size: int = 4 * 1024 * 1024,  # 4MB default buffer
        write_behind: bool = True,
        write_behind_interval: float = 2.0
    ):
        # Initialize base class
        super().__init__(manifest_path, enable_logging)

        # Configuration
        self.buffer_size = max(buffer_size, 64 * 1024)  # Minimum 64KB buffer
        self.write_behind_enabled = write_behind

        # Set up cache directory
        if cache_dir is None:
            cache_dir = self.manifest_path.parent / ".manifest_cache"
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)

        # Initialize multi-tier caching
        self.l1_cache = LRUCache(max_size=l1_cache_size)
        self.l2_cache = MemoryMappedCache(
            cache_dir=self.cache_dir / "l2_cache",
            max_files=l2_cache_files
        )
        self.l3_cache = CompressedDiskCache(
            cache_dir=self.cache_dir / "l3_cache",
            max_size_mb=l3_cache_size_mb
        )

        # Write-behind caching
        self.write_behind_cache = WriteBehindCache(
            flush_interval=write_behind_interval,
            max_pending=l1_cache_size
        ) if write_behind else None

        # Async I/O thread pool
        self.io_executor = ThreadPoolExecutor(
            max_workers=4,
            thread_name_prefix="manifest_io"
        )

        # Performance tracking
        self._read_times = []
        self._write_times = []
        self._cache_stats = {
            "l1_hits": 0, "l1_misses": 0,
            "l2_hits": 0, "l2_misses": 0,
            "l3_hits": 0, "l3_misses": 0
        }

        # Start write-behind thread
        if self.write_behind_cache:
            self.write_behind_cache.start(self._perform_write_behind)

        # Weak reference for cleanup
        self._cleanup_ref = weakref.finalize(self, self._cleanup_resources)

        if self.logger:
            self.logger.info(f"OptimizedManifestHandler initialized with multi-tier caching")

    def read(self, use_cache: bool = True) -> Dict[str, Any]:
        """Enhanced read with multi-tier caching"""
        if not use_cache:
            return self._read_from_disk()

        start_time = time.time()

        try:
            # L1 Cache check (hot data)
            manifest_key = str(self.manifest_path)
            cached_data = self.l1_cache.get(manifest_key)
            if cached_data is not None:
                self._cache_stats["l1_hits"] += 1
                return cached_data.copy()

            self._cache_stats["l1_misses"] += 1

            # L2 Cache check (memory-mapped recent data)
            try:
                cached_bytes = self.l2_cache.get(manifest_key)
                if cached_bytes:
                    data = json.loads(cached_bytes.decode('utf-8'))
                    self.l1_cache.put(manifest_key, data)
                    self._cache_stats["l2_hits"] += 1
                    return data.copy()
            except (json.JSONDecodeError, UnicodeDecodeError):
                # Corrupted L2 cache, invalidate
                self.l2_cache.invalidate(manifest_key)

            self._cache_stats["l2_misses"] += 1

            # L3 Cache check (compressed warm data)
            try:
                cached_bytes = self.l3_cache.get(manifest_key)
                if cached_bytes:
                    data = json.loads(cached_bytes.decode('utf-8'))
                    # Populate higher cache levels
                    self.l1_cache.put(manifest_key, data)
                    self.l2_cache.put(manifest_key, cached_bytes)
                    self._cache_stats["l3_hits"] += 1
                    return data.copy()
            except (json.JSONDecodeError, UnicodeDecodeError):
                # Corrupted L3 cache, invalidate
                self.l3_cache.invalidate(manifest_key)

            self._cache_stats["l3_misses"] += 1

            # Cache miss - read from disk
            data = self._read_from_disk_optimized()

            # Populate all cache levels
            if data:
                self._populate_caches(manifest_key, data)

            return data

        finally:
            end_time = time.time()
            self._read_times.append(end_time - start_time)
            if len(self._read_times) > 1000:  # Keep only recent 1000 measurements
                self._read_times = self._read_times[-500:]

    def write(self, data: Dict[str, Any]):
        """Enhanced write with write-behind caching and optimization"""
        start_time = time.time()

        try:
            manifest_key = str(self.manifest_path)

            if self.write_behind_enabled and self.write_behind_cache:
                # Schedule write-behind
                self.write_behind_cache.schedule_write(manifest_key, data)
                # Update L1 cache immediately for read consistency
                self.l1_cache.put(manifest_key, data.copy())
            else:
                # Immediate write
                self._write_to_disk_optimized(data)
                self._populate_caches(manifest_key, data)

        finally:
            end_time = time.time()
            self._write_times.append(end_time - start_time)
            if len(self._write_times) > 1000:
                self._write_times = self._write_times[-500:]

    def _read_from_disk(self) -> Dict[str, Any]:
        """Legacy method for compatibility with base class"""
        return super().read(use_cache=False)

    def _read_from_disk_optimized(self) -> Dict[str, Any]:
        """Optimized disk read with large buffers"""
        try:
            with open(self.manifest_path, 'rb', buffering=self.buffer_size) as f:
                # Use file locking for concurrent access
                import fcntl
                fcntl.flock(f.fileno(), fcntl.LOCK_SH)
                try:
                    # Read entire file with large buffer
                    raw_data = f.read()
                    data = json.loads(raw_data.decode('utf-8'))

                    # Validate structure
                    if not isinstance(data, dict):
                        if self.logger:
                            self.logger.error("Manifest has invalid structure - not a dict")
                        return {}

                    return data

                finally:
                    fcntl.flock(f.fileno(), fcntl.LOCK_UN)

        except FileNotFoundError:
            if self.logger:
                self.logger.warning("Manifest not found, returning empty")
            return {}
        except (json.JSONDecodeError, UnicodeDecodeError) as e:
            if self.logger:
                self.logger.error(f"Manifest decode error: {e}")
            return {}
        except Exception as e:
            raise ManifestError(f"Failed to read manifest: {e}")

    def _write_to_disk_optimized(self, data: Dict[str, Any]):
        """Optimized disk write with large buffers and fsync"""
        with self._lock:
            try:
                # Serialize data
                json_data = json.dumps(data, indent=2, default=str).encode('utf-8')

                # Write to temporary file with large buffer
                temp_fd, temp_path = tempfile.mkstemp(
                    dir=self.manifest_path.parent,
                    prefix='.manifest_tmp_',
                    suffix='.json'
                )

                try:
                    # Use large buffer for writing
                    with os.fdopen(temp_fd, 'wb', buffering=self.buffer_size) as temp_file:
                        temp_file.write(json_data)
                        temp_file.flush()
                        os.fsync(temp_file.fileno())

                    # Atomic rename
                    Path(temp_path).replace(self.manifest_path)

                    if self.logger:
                        self.logger.debug(f"Optimized manifest write: {len(data)} entries")

                except Exception as e:
                    # Clean up temp file
                    Path(temp_path).unlink(missing_ok=True)
                    raise e

            except Exception as e:
                raise ManifestError(f"Failed to write manifest: {e}")

    def _populate_caches(self, key: str, data: Dict[str, Any]):
        """Populate all cache levels with data"""
        try:
            # Serialize for byte caches
            json_bytes = json.dumps(data, default=str).encode('utf-8')

            # Populate L1 (memory)
            self.l1_cache.put(key, data.copy())

            # Populate L2 (memory-mapped) - async
            self.io_executor.submit(self._populate_l2_cache_async, key, json_bytes)

            # Populate L3 (compressed) - async
            self.io_executor.submit(self._populate_l3_cache_async, key, json_bytes)

        except Exception as e:
            if self.logger:
                self.logger.warning(f"Failed to populate caches: {e}")

    def _populate_l2_cache_async(self, key: str, data: bytes):
        """Asynchronously populate L2 cache"""
        try:
            self.l2_cache.put(key, data)
        except Exception as e:
            if self.logger:
                self.logger.debug(f"L2 cache population failed: {e}")

    def _populate_l3_cache_async(self, key: str, data: bytes):
        """Asynchronously populate L3 cache"""
        try:
            self.l3_cache.put(key, data)
        except Exception as e:
            if self.logger:
                self.logger.debug(f"L3 cache population failed: {e}")

    def _perform_write_behind(self, key: str, data: Dict[str, Any]):
        """Callback for write-behind cache to perform actual write"""
        self._write_to_disk_optimized(data)
        self._populate_caches(key, data)

    def add_entry(self, key: str, value: Dict[str, Any]):
        """Optimized add entry with cache invalidation"""
        with self._lock:
            # Force fresh read to ensure consistency
            data = self.read(use_cache=False)
            data[key] = value
            self.write(data)

            # Invalidate caches for consistency
            manifest_key = str(self.manifest_path)
            self._invalidate_caches(manifest_key)

            if self.logger:
                self.logger.debug(f"Added optimized manifest entry: {key}")

    def batch_update(self, updates: Dict[str, Dict[str, Any]]):
        """Optimized batch update with single write operation"""
        if not updates:
            return

        with self._lock:
            # Read current data
            data = self.read(use_cache=False)
            data.update(updates)
            self.write(data)

            # Invalidate caches
            manifest_key = str(self.manifest_path)
            self._invalidate_caches(manifest_key)

            if self.logger:
                self.logger.info(f"Batch updated {len(updates)} optimized manifest entries")

    def _invalidate_caches(self, key: str):
        """Invalidate all cache levels for a key"""
        self.l1_cache.invalidate(key)
        # L2 and L3 invalidation are async to avoid blocking
        self.io_executor.submit(self.l2_cache.invalidate, key)
        self.io_executor.submit(self.l3_cache.invalidate, key)

    def flush_write_behind(self):
        """Flush all pending write-behind operations"""
        if self.write_behind_cache:
            self.write_behind_cache.flush_all()

    def get_performance_stats(self) -> Dict[str, Any]:
        """Get comprehensive performance statistics"""
        stats = {
            "read_performance": {
                "total_reads": len(self._read_times),
                "avg_read_time": sum(self._read_times) / len(self._read_times) if self._read_times else 0,
                "min_read_time": min(self._read_times) if self._read_times else 0,
                "max_read_time": max(self._read_times) if self._read_times else 0
            },
            "write_performance": {
                "total_writes": len(self._write_times),
                "avg_write_time": sum(self._write_times) / len(self._write_times) if self._write_times else 0,
                "min_write_time": min(self._write_times) if self._write_times else 0,
                "max_write_time": max(self._write_times) if self._write_times else 0
            },
            "cache_performance": self._cache_stats.copy(),
            "cache_details": {
                "l1_cache": self.l1_cache.get_stats(),
                "l2_cache": self.l2_cache.get_stats(),
                "l3_cache": self.l3_cache.get_stats()
            },
            "configuration": {
                "buffer_size": self.buffer_size,
                "write_behind_enabled": self.write_behind_enabled,
                "cache_dir": str(self.cache_dir)
            }
        }

        if self.write_behind_cache:
            stats["write_behind"] = self.write_behind_cache.get_stats()

        return stats

    def warm_cache(self):
        """Pre-warm caches with current manifest data"""
        if self.logger:
            self.logger.info("Warming manifest caches...")

        try:
            # Read data and populate all caches
            manifest_key = str(self.manifest_path)
            data = self._read_from_disk_optimized()
            if data:
                self._populate_caches(manifest_key, data)

            if self.logger:
                self.logger.info("Cache warming completed")

        except Exception as e:
            if self.logger:
                self.logger.warning(f"Cache warming failed: {e}")

    def clear_caches(self):
        """Clear all cache levels"""
        self.l1_cache.clear()

        # Clear L2 and L3 asynchronously
        self.io_executor.submit(self.l2_cache.clear)
        self.io_executor.submit(self.l3_cache.clear)

        # Reset performance stats
        self._cache_stats = {
            "l1_hits": 0, "l1_misses": 0,
            "l2_hits": 0, "l2_misses": 0,
            "l3_hits": 0, "l3_misses": 0
        }

        if self.logger:
            self.logger.info("All caches cleared")

    def _cleanup_resources(self):
        """Clean up resources on deletion"""
        try:
            # Stop write-behind cache
            if self.write_behind_cache:
                self.write_behind_cache.stop()

            # Shut down thread pool
            self.io_executor.shutdown(wait=True, timeout=10.0)

            # Clear caches
            self.l1_cache.clear()
            self.l2_cache.clear()
            self.l3_cache.clear()

        except Exception:
            pass  # Ignore cleanup errors

    def __del__(self):
        """Ensure cleanup happens"""
        # The weakref finalizer will handle cleanup
        pass
