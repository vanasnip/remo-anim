"""Command sanitization for subprocess execution"""

import re
import shlex
from typing import List, Optional

from ..core.exceptions import SecurityError
from ..monitoring.logger import get_logger


class CommandSanitizer:
    """Sanitizes commands for safe subprocess execution"""

    # Dangerous characters and patterns
    DANGEROUS_CHARS = [";", "&&", "||", "|", ">", "<", "`", "$", "\\"]
    DANGEROUS_PATTERNS = [
        r"\$\(",  # Command substitution
        r"`.*`",  # Backtick command substitution
        r">\s*/dev/",  # Redirect to device files
        r"rm\s+-rf\s+/",  # Dangerous rm commands
    ]

    def __init__(self, enable_logging: bool = False):
        self.logger = get_logger() if enable_logging else None

    def sanitize_filename(self, filename: str) -> str:
        """Sanitize a filename for use in commands"""
        # Check for dangerous characters first
        for char in self.DANGEROUS_CHARS:
            if char in filename:
                raise SecurityError(f"Dangerous character '{char}' found in filename: {filename}")

        # Check for dangerous patterns
        for pattern in self.DANGEROUS_PATTERNS:
            if re.search(pattern, filename, re.IGNORECASE):
                raise SecurityError(f"Dangerous pattern found in filename: {filename}")

        # Check for path traversal attempts
        if ".." in filename or filename.startswith("/") or "\\" in filename:
            raise SecurityError(f"Path traversal attempt in filename: {filename}")

        # Check for command substitution
        if "$(" in filename or "`" in filename or "${" in filename:
            raise SecurityError(f"Command substitution attempt in filename: {filename}")

        # Remove or escape dangerous characters
        sanitized = filename

        # Replace spaces with underscores
        sanitized = sanitized.replace(" ", "_")

        # Remove special characters
        sanitized = re.sub(r"[^\w\-_\.]", "", sanitized)

        # Ensure it doesn't start with a dash (could be interpreted as flag)
        if sanitized.startswith("-"):
            sanitized = "_" + sanitized

        if self.logger and sanitized != filename:
            self.logger.debug(f"Filename sanitized: {filename} -> {sanitized}")

        return sanitized

    def sanitize_path(self, path: str) -> str:
        """Sanitize a file path for use in commands"""
        # Check for dangerous path traversal attempts
        if "../" in path or "..\\" in path:
            raise SecurityError(f"Path traversal attempt in path: {path}")

        # Check for absolute paths to sensitive locations
        dangerous_paths = [
            "/etc/",
            "/usr/bin/",
            "/bin/",
            "/sbin/",
            "/root/",
            "/home/",
            "C:\\Windows\\",
            "C:\\Program Files\\",
            "~/.ssh/",
            "~/.aws/",
            "/var/",
            "/tmp/",
        ]

        for dangerous in dangerous_paths:
            if path.startswith(dangerous) or dangerous in path:
                raise SecurityError(f"Access to sensitive path attempted: {path}")

        # Check for environment variable expansion
        if "${" in path or "$(" in path or "~/" in path:
            raise SecurityError(f"Environment variable expansion attempted: {path}")

        # Use shlex.quote for proper escaping
        quoted = shlex.quote(str(path))

        if self.logger and quoted != path:
            self.logger.debug(f"Path sanitized: {path} -> {quoted}")

        return quoted

    def validate_command(self, command: List[str]) -> bool:
        """Validate a command list for safety"""
        command_str = " ".join(command)

        # Check for dangerous characters
        for char in self.DANGEROUS_CHARS:
            if char in command_str:
                if self.logger:
                    self.logger.warning(
                        f"Dangerous character '{char}' found in command: {command_str}"
                    )
                return False

        # Check for dangerous patterns
        for pattern in self.DANGEROUS_PATTERNS:
            if re.search(pattern, command_str, re.IGNORECASE):
                if self.logger:
                    self.logger.warning(f"Dangerous pattern found in command: {command_str}")
                return False

        return True

    def build_safe_command(
        self,
        executable: str,
        args: List[str],
        allowed_executables: Optional[List[str]] = None,
    ) -> List[str]:
        """Build a safe command list"""

        # Validate executable
        if allowed_executables and executable not in allowed_executables:
            raise SecurityError(f"Executable not in allowed list: {executable}")

        # Build command list
        command = [executable]

        # Sanitize arguments
        for arg in args:
            # Skip empty arguments
            if not arg:
                continue

            # Quote arguments that might contain spaces or special chars
            if " " in arg or any(c in arg for c in ['"', "'", "\\"]):
                command.append(shlex.quote(arg))
            else:
                command.append(arg)

        # Validate final command
        if not self.validate_command(command):
            raise SecurityError(f"Command failed validation: {' '.join(command)}")

        if self.logger:
            self.logger.debug(f"Safe command built: {command}")

        return command
