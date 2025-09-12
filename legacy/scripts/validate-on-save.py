#!/usr/bin/env python3
"""
Save-time validation hook that checks code against CLAUDE.md patterns.
Can be integrated with file watchers or editor save hooks.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Optional


class FileValidator:
    """Validates files against directory-specific CLAUDE.md patterns."""

    def __init__(self):
        self.project_root = Path(__file__).parent.parent
        self.claude_patterns = self._load_claude_patterns()

    def _load_claude_patterns(self) -> dict[str, dict]:
        """Load validation patterns from CLAUDE.md files."""
        patterns = {}

        # Define directory-specific patterns based on CLAUDE.md files
        patterns["manim-scripts"] = {
            "required_imports": ["from manim import *"],
            "class_pattern": r"class \w+\(Scene\)",
            "forbidden_patterns": [
                (r"subprocess\.run\([^)]*shell=True", "Never use shell=True"),
                (r"eval\(", "eval() is forbidden"),
                (r"exec\(", "exec() is forbidden"),
            ],
            "required_structure": {
                "has_scene_class": r"class \w+\(Scene\)",
                "has_construct_method": r"def construct\(self\)",
            },
        }

        patterns["bridge"] = {
            "required_imports": ["from subprocess_sanitizer import SafeCommand"],
            "forbidden_patterns": [
                (
                    r"subprocess\.(?:run|call|Popen)\(",
                    "Use SafeCommand instead of direct subprocess",
                ),
                (r"os\.system\(", "Never use os.system()"),
                (r"eval\(", "eval() is forbidden"),
                (r"pickle\.load", "Pickle is a security risk"),
                (r"open\([^)]*\)\.read\(\)(?!.*validate_path)", "Validate paths before reading"),
            ],
            "security_patterns": [
                (
                    r"def \w+.*\(.*path.*\):",
                    "validate_path",
                ),  # Functions with path params should validate
            ],
        }

        patterns["remotion-app/src"] = {
            "typescript_patterns": [
                (r"any(?:\s|;|,|\))", 'Avoid using "any" type'),
                (r"console\.log\(", "Use proper logging instead of console.log"),
                (r"// @ts-ignore", "Fix TypeScript errors instead of ignoring"),
            ],
            "required_patterns": [
                (r"interface \w+Props", "Components should have Props interface"),
                (r"React\.FC<", "Use React.FC with typed props"),
            ],
            "style_patterns": [
                (r"style=\{\{", "Use Material-UI styling instead of inline styles"),
            ],
        }

        return patterns

    def validate_file(self, file_path: str) -> tuple[bool, list[str]]:
        """Validate a single file against its directory's patterns."""
        path = Path(file_path)
        if not path.exists():
            return False, [f"File not found: {file_path}"]

        # Determine which patterns to apply based on file location
        relative_path = path.relative_to(self.project_root)
        dir_patterns = None

        for pattern_dir, patterns in self.claude_patterns.items():
            if str(relative_path).startswith(pattern_dir):
                dir_patterns = patterns
                break

        if not dir_patterns:
            return True, []  # No patterns defined for this directory

        errors = []
        content = path.read_text()

        # Check required imports (Python files)
        if path.suffix == ".py" and "required_imports" in dir_patterns:
            for required_import in dir_patterns["required_imports"]:
                if required_import not in content:
                    errors.append(f"Missing required import: {required_import}")

        # Check forbidden patterns
        if "forbidden_patterns" in dir_patterns:
            for pattern, message in dir_patterns["forbidden_patterns"]:
                if re.search(pattern, content):
                    errors.append(f"Forbidden pattern found: {message}")

        # Check security patterns (for bridge)
        if "security_patterns" in dir_patterns:
            for trigger_pattern, required_pattern in dir_patterns["security_patterns"]:
                if re.search(trigger_pattern, content):
                    if not re.search(required_pattern, content):
                        errors.append(
                            "Security check needed: Functions with path parameters should validate paths"
                        )

        # Check TypeScript patterns
        if path.suffix in [".ts", ".tsx"] and "typescript_patterns" in dir_patterns:
            for pattern, message in dir_patterns["typescript_patterns"]:
                if re.search(pattern, content):
                    errors.append(f"TypeScript issue: {message}")

        # Check required structure (Python)
        if path.suffix == ".py" and "required_structure" in dir_patterns:
            for check_name, pattern in dir_patterns["required_structure"].items():
                if not re.search(pattern, content):
                    errors.append(f"Missing required structure: {check_name}")

        return len(errors) == 0, errors

    def auto_fix(self, file_path: str) -> bool:
        """Attempt to auto-fix common issues."""
        path = Path(file_path)

        if path.suffix == ".py":
            # Run Black formatter
            try:
                subprocess.run(
                    ["black", "--line-length=100", str(path)],
                    capture_output=True,
                    text=True,
                    check=True,
                )
            except subprocess.CalledProcessError:
                pass

            # Run Ruff with auto-fix
            try:
                subprocess.run(
                    ["ruff", "check", "--fix", str(path)], capture_output=True, text=True
                )
            except subprocess.CalledProcessError:
                pass

        elif path.suffix in [".ts", ".tsx", ".js", ".jsx"]:
            # Run Prettier
            try:
                subprocess.run(
                    ["npx", "prettier", "--write", str(path)],
                    cwd=self.project_root / "remotion-app",
                    capture_output=True,
                    text=True,
                )
            except subprocess.CalledProcessError:
                pass

        return True


def main():
    """Main entry point for validation script."""
    if len(sys.argv) < 2:
        print("Usage: python validate-on-save.py <file_path>")
        sys.exit(1)

    file_path = sys.argv[1]
    validator = FileValidator()

    # Auto-fix formatting issues first
    validator.auto_fix(file_path)

    # Then validate against patterns
    is_valid, errors = validator.validate_file(file_path)

    if not is_valid:
        print(f"❌ Validation failed for {file_path}:")
        for error in errors:
            print(f"   • {error}")

        # Return non-zero exit code but don't block save
        # This is informational only
        sys.exit(1)
    else:
        print(f"✅ {file_path} validated successfully")
        sys.exit(0)


if __name__ == "__main__":
    main()
