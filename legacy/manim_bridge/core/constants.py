"""Constants for Manim Bridge"""

# File processing
DEFAULT_CHUNK_SIZE = 1024 * 1024  # 1MB
MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024  # 5GB

# Video formats
SUPPORTED_VIDEO_FORMATS = {".mp4", ".mov", ".avi", ".webm", ".mkv"}

# Processing
MAX_WORKERS = 4
DEFAULT_POLL_INTERVAL = 2.0  # seconds
RETRY_ATTEMPTS = 3
RETRY_DELAY = 1.0  # seconds

# Paths to exclude
EXCLUDED_PATHS = [
    "partial_movie_files",
    ".tmp",
    ".cache",
    "__pycache__",
]

# Performance
CACHE_TTL = 300  # 5 minutes
MAX_CACHE_SIZE = 100  # entries

# Logging
LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
LOG_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"
MAX_LOG_SIZE = 10 * 1024 * 1024  # 10MB
LOG_BACKUP_COUNT = 5
