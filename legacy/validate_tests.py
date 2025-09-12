#!/usr/bin/env python3
"""
Validation script to check test infrastructure
Validates syntax and structure without requiring external dependencies
"""

import ast
import sys
from pathlib import Path


def validate_python_syntax(file_path):
    """Validate Python syntax of a file"""
    try:
        with open(file_path, encoding="utf-8") as f:
            source = f.read()

        # Parse the AST to check syntax
        ast.parse(source, filename=str(file_path))
        return True, None
    except SyntaxError as e:
        return False, f"Syntax error: {e}"
    except Exception as e:
        return False, f"Error: {e}"


def check_test_structure():
    """Check that test directory structure is correct"""
    project_root = Path(__file__).parent
    tests_dir = project_root / "tests"

    required_dirs = ["tests", "tests/unit", "tests/integration", "tests/fixtures"]

    required_files = [
        "tests/__init__.py",
        "tests/conftest.py",
        "tests/unit/__init__.py",
        "tests/unit/test_path_validator.py",
        "tests/unit/test_command_sanitizer.py",
        "tests/unit/test_manifest_handler.py",
        "tests/unit/test_security.py",
        "tests/integration/__init__.py",
        "tests/integration/test_bridge_integration.py",
        "tests/fixtures/__init__.py",
    ]

    missing = []

    # Check directories
    for dir_path in required_dirs:
        if not (project_root / dir_path).exists():
            missing.append(f"Directory: {dir_path}")

    # Check files
    for file_path in required_files:
        if not (project_root / file_path).exists():
            missing.append(f"File: {file_path}")

    return missing


def main():
    """Main validation function"""
    print("🔍 Validating Test Infrastructure")
    print("=" * 50)

    project_root = Path(__file__).parent

    # Check directory structure
    print("\n📁 Checking directory structure...")
    missing = check_test_structure()
    if missing:
        print("❌ Missing components:")
        for item in missing:
            print(f"   - {item}")
        return False
    else:
        print("✅ Directory structure is complete")

    # Check Python syntax in test files
    print("\n🐍 Validating Python syntax...")

    test_files = []
    tests_dir = project_root / "tests"

    # Find all Python files in tests directory
    for py_file in tests_dir.rglob("*.py"):
        test_files.append(py_file)

    # Also check main test files
    main_test_files = [
        "run_tests.py",
        "validate_tests.py",
    ]

    for file_name in main_test_files:
        file_path = project_root / file_name
        if file_path.exists():
            test_files.append(file_path)

    syntax_errors = []

    for test_file in test_files:
        is_valid, error = validate_python_syntax(test_file)
        if is_valid:
            print(f"   ✅ {test_file.relative_to(project_root)}")
        else:
            print(f"   ❌ {test_file.relative_to(project_root)}: {error}")
            syntax_errors.append((test_file, error))

    if syntax_errors:
        print(f"\n❌ Found {len(syntax_errors)} files with syntax errors")
        return False

    # Check configuration files
    print("\n⚙️  Checking configuration files...")

    config_files = ["pytest.ini", "pyproject.toml", "requirements-test.txt"]

    for config_file in config_files:
        file_path = project_root / config_file
        if file_path.exists():
            print(f"   ✅ {config_file}")
        else:
            print(f"   ❌ {config_file} (missing)")

    # Check for important imports
    print("\n📦 Checking test imports...")

    conftest_path = project_root / "tests" / "conftest.py"
    if conftest_path.exists():
        with open(conftest_path) as f:
            conftest_content = f.read()

        important_imports = ["pytest", "pathlib", "json", "tempfile", "unittest.mock"]

        for import_name in important_imports:
            if (
                f"import {import_name}" in conftest_content
                or f"from {import_name}" in conftest_content
            ):
                print(f"   ✅ {import_name} imported")
            else:
                print(f"   ⚠️  {import_name} not found in imports")

    # Summary
    print("\n" + "=" * 50)
    print("📊 Test Infrastructure Summary:")
    print(f"   • Test files: {len(test_files)}")
    print(f"   • Configuration files: {len(config_files)}")
    print(f"   • All syntax valid: {'Yes' if not syntax_errors else 'No'}")

    if not syntax_errors:
        print("\n🎉 Test infrastructure validation successful!")
        print("\n📋 Next steps:")
        print("   1. Install test dependencies:")
        print("      pip install -r requirements-test.txt")
        print("   2. Run tests:")
        print("      python run_tests.py")
        print("   3. Generate coverage report:")
        print("      python run_tests.py --coverage --html-coverage")
        return True
    else:
        print("\n❌ Validation failed. Please fix syntax errors before proceeding.")
        return False


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
