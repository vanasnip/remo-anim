# Test Suite Documentation

## Overview

This comprehensive test suite ensures the security, reliability, and functionality of the Manim-Remotion Bridge components. The test suite focuses heavily on security validation and attack prevention.

## Test Structure

```
tests/
├── README.md                    # This file
├── __init__.py                  # Package initialization
├── conftest.py                  # Shared fixtures and utilities
├── unit/                        # Unit tests
│   ├── __init__.py
│   ├── test_path_validator.py   # PathValidator security tests
│   ├── test_command_sanitizer.py # Command injection prevention tests
│   ├── test_manifest_handler.py # Manifest security and integrity tests
│   └── test_security.py        # Comprehensive security tests
├── integration/                 # Integration tests
│   ├── __init__.py
│   └── test_bridge_integration.py # End-to-end functionality tests
└── fixtures/                   # Test fixtures and data
    └── __init__.py
```

## Test Categories

### 🔒 Security Tests (`@pytest.mark.security`)

**Primary Focus:** Attack prevention and security validation

- **Path Traversal Prevention:** Tests against `../../../etc/passwd` style attacks
- **Command Injection Prevention:** Tests against `;rm -rf /`, `$(evil)`, `` `malicious` `` attacks
- **Symlink Attack Prevention:** Tests against malicious symlink exploitation
- **Input Sanitization:** Comprehensive validation of all user inputs
- **Environment Variable Injection:** Prevention of env var manipulation
- **Resource Exhaustion:** Protection against DoS via large files/paths
- **Information Disclosure:** Prevention of sensitive data leakage
- **Race Condition Protection:** Atomic operations and TOCTOU prevention

### 🧩 Unit Tests (`@pytest.mark.unit`)

**Focus:** Individual component functionality

- **PathValidator:** Sandboxing, path normalization, security validation
- **CommandSanitizer:** Input sanitization, command whitelist enforcement
- **ManifestHandler:** Atomic updates, corruption recovery, concurrent access
- **SecureManimExecutor:** Safe command execution, argument validation

### 🔗 Integration Tests (`@pytest.mark.integration`)

**Focus:** Component interactions and end-to-end workflows

- **Bridge Integration:** Complete video processing pipeline
- **File Watcher Integration:** File system event handling
- **Concurrent Processing:** Multi-threaded safety validation
- **Error Recovery:** Resilience and graceful degradation
- **Performance Testing:** Scale and efficiency validation

## Running Tests

### Quick Start

```bash
# Install dependencies
pip install -r requirements-test.txt

# Run all tests
python run_tests.py

# Run with coverage
python run_tests.py --coverage --html-coverage
```

### Specific Test Categories

```bash
# Security tests only
python run_tests.py --security

# Unit tests only
python run_tests.py --unit

# Integration tests only
python run_tests.py --integration

# Fast parallel execution
python run_tests.py --fast
```

### Direct pytest Commands

```bash
# All tests with coverage
pytest --cov=. --cov-report=html

# Security tests only
pytest -m security -v

# Specific test file
pytest tests/unit/test_security.py -v

# Run with detailed output
pytest --tb=long -v
```

## Test Fixtures

### Key Fixtures (from `conftest.py`)

- **`temp_workspace`:** Clean temporary directory with proper structure
- **`mock_video_file`:** Simulated MP4 file for testing
- **`path_validator`:** Configured PathValidator instance
- **`command_sanitizer`:** Configured CommandSanitizer instance
- **`secure_handler`:** Complete SecureManimRenderHandler instance
- **`dangerous_filenames`:** Collection of malicious filename attack vectors
- **`dangerous_paths`:** Collection of path traversal attack vectors
- **`safe_filenames`:** Collection of legitimate filenames for validation

### Security Test Data

The test suite includes comprehensive collections of attack vectors:

- **Path Traversal:** `../../../etc/passwd`, Unicode variants, encoded variants
- **Command Injection:** `;rm -rf /`, `$(malicious)`, `|evil`, backticks
- **Filename Attacks:** Control characters, reserved names, long filenames
- **Environment Attacks:** Variable manipulation, command substitution

## Security Testing Philosophy

### Defense in Depth

Tests verify that attacks are blocked at **multiple layers**:

1. **Input Validation Layer:** Raw input sanitization
2. **Path Validation Layer:** Sandboxing and traversal prevention
3. **Command Execution Layer:** Whitelist enforcement and argument validation
4. **File System Layer:** Permission checks and atomic operations

### Attack Simulation

Each security test simulates real attack scenarios:

- Uses actual malicious payloads from security research
- Tests both obvious and subtle attack variations
- Verifies proper logging of security events
- Ensures graceful degradation under attack

### Comprehensive Coverage

Security tests cover:

- **All input vectors** (files, paths, commands, environment)
- **All processing stages** (validation, sanitization, execution)
- **All error conditions** (malformed input, resource exhaustion)
- **All concurrent scenarios** (race conditions, atomic operations)

## Test Configuration

### pytest.ini

Core configuration for test discovery, execution, and reporting:

- **Test Discovery:** Automatic discovery of test files and functions
- **Coverage Reporting:** HTML, XML, and terminal coverage reports
- **Markers:** Categorization of test types for selective execution
- **Logging:** Comprehensive logging of test execution and security events

### pyproject.toml

Modern Python project configuration:

- **Tool Integration:** Black, isort, mypy, bandit configuration
- **Dependency Management:** Test and development dependencies
- **Coverage Settings:** Exclusion patterns and reporting options

## Performance Considerations

### Test Execution Time

- **Unit Tests:** < 1 minute for complete suite
- **Integration Tests:** < 5 minutes for complete suite
- **Security Tests:** < 2 minutes for complete suite

### Parallel Execution

```bash
# Run tests in parallel for faster execution
python run_tests.py --fast
# or
pytest -n auto
```

### Test Data Size

- Mock video files are kept small (< 1MB) for performance
- Large file tests use sparse files where possible
- Temporary files are automatically cleaned up

## Continuous Integration

### Required Checks

For CI/CD pipelines, ensure these checks pass:

```bash
# Code formatting
python run_tests.py --format

# Linting
python run_tests.py --lint

# Security audit
python run_tests.py --security-only

# Full test suite with coverage
python run_tests.py --coverage

# Performance validation
python run_tests.py --integration
```

### Coverage Requirements

- **Overall Coverage:** ≥ 80%
- **Security-Critical Code:** ≥ 95%
- **Path Validation:** 100%
- **Command Sanitization:** 100%

## Troubleshooting

### Common Issues

**ImportError: Module not found**

```bash
# Install test dependencies
pip install -r requirements-test.txt
```

**Permission Errors in Tests**

```bash
# Ensure proper permissions
chmod -R 755 tests/
```

**Symlink Tests Failing on Windows**

```bash
# Run as administrator or skip symlink tests
pytest -m "not symlink"
```

### Debug Mode

```bash
# Run with detailed debugging
pytest --tb=long --log-cli-level=DEBUG -v

# Run single test with debugging
pytest tests/unit/test_security.py::TestInjectionPrevention::test_command_injection_prevention -v -s
```

## Security Review Checklist

When adding new tests, ensure:

- [ ] All user inputs are validated
- [ ] Attack vectors are comprehensive
- [ ] Error messages don't leak information
- [ ] Security events are properly logged
- [ ] Defense in depth is maintained
- [ ] Performance impact is reasonable

## Contributing

### Adding New Tests

1. Follow the existing naming conventions
2. Add appropriate test markers (`@pytest.mark.security`, etc.)
3. Include comprehensive docstrings
4. Test both positive and negative cases
5. Include attack simulation for security tests
6. Update this documentation as needed

### Test Review Process

1. **Security Review:** All security tests reviewed for completeness
2. **Performance Review:** Ensure tests run efficiently
3. **Coverage Review:** Verify comprehensive coverage of new code
4. **Documentation Review:** Update docs for new test categories

---

**Security Note:** This test suite is designed to validate security controls and prevent attacks. The test data includes actual attack payloads for validation purposes. These should never be used outside the testing environment.
