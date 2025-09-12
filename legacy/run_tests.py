#!/usr/bin/env python3
"""
Comprehensive test runner for the Manim-Remotion Bridge project
Executes all test suites with proper reporting and coverage analysis
"""

import argparse
import json
import logging
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional, Tuple


@dataclass
class TestResult:
    """Test result data structure"""

    suite_name: str
    passed: int
    failed: int
    skipped: int
    duration: float
    coverage: Optional[float] = None
    exit_code: int = 0


class TestRunner:
    """Main test runner class"""

    def __init__(self, project_root: Path):
        self.project_root = project_root
        self.python_env = None
        self.node_env = None
        self.results: List[TestResult] = []

        # Setup logging
        logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
        self.logger = logging.getLogger(__name__)

    def setup_environments(self) -> bool:
        """Setup Python and Node.js environments"""
        self.logger.info("Setting up test environments...")

        # Check Python environment
        python_version = subprocess.run(
            [sys.executable, "--version"], capture_output=True, text=True
        )

        self.logger.info(f"Python: {python_version.stdout.strip()}")

        # Check if pytest is available
        try:
            pytest_version = subprocess.run(
                [sys.executable, "-m", "pytest", "--version"],
                capture_output=True,
                text=True,
                check=True,
            )
            self.logger.info(f"Pytest: {pytest_version.stdout.strip()}")
        except subprocess.CalledProcessError:
            self.logger.error("Pytest not found. Install with: pip install pytest pytest-cov")
            return False

        # Check Node.js environment
        try:
            node_version = subprocess.run(
                ["node", "--version"], capture_output=True, text=True, check=True
            )
            self.logger.info(f"Node.js: {node_version.stdout.strip()}")

            npm_version = subprocess.run(
                ["npm", "--version"], capture_output=True, text=True, check=True
            )
            self.logger.info(f"NPM: {npm_version.stdout.strip()}")

        except (subprocess.CalledProcessError, FileNotFoundError):
            self.logger.warning("Node.js/NPM not found. React tests will be skipped.")
            return True  # Python tests can still run

        return True

    def run_python_tests(self, test_type: str = "all") -> TestResult:
        """Run Python test suite"""
        self.logger.info(f"Running Python tests ({test_type})...")

        # Build pytest command
        cmd = [sys.executable, "-m", "pytest"]

        # Test selection
        if test_type == "unit":
            cmd.extend(["tests/unit/"])
        elif test_type == "integration":
            cmd.extend(["tests/integration/"])
        elif test_type == "security":
            cmd.extend(["-m", "security"])
        else:
            cmd.extend(["tests/"])

        # Add common options
        cmd.extend(
            [
                "-v",  # Verbose output
                "--tb=short",  # Short traceback format
                "--strict-markers",  # Strict marker checking
                "--durations=10",  # Show 10 slowest tests
                "--cov=manim_bridge",  # Coverage for main module
                "--cov-report=term-missing",  # Show missing lines
                "--cov-report=json:coverage.json",  # JSON report for parsing
            ]
        )

        start_time = time.time()

        try:
            result = subprocess.run(
                cmd,
                cwd=self.project_root,
                capture_output=True,
                text=True,
                timeout=300,  # 5 minute timeout
            )

            duration = time.time() - start_time

            # Parse pytest output
            passed, failed, skipped = self._parse_pytest_output(result.stdout)

            # Parse coverage
            coverage = self._parse_coverage_json()

            test_result = TestResult(
                suite_name=f"Python ({test_type})",
                passed=passed,
                failed=failed,
                skipped=skipped,
                duration=duration,
                coverage=coverage,
                exit_code=result.returncode,
            )

            if result.returncode != 0:
                self.logger.error(f"Python tests failed:\n{result.stdout}\n{result.stderr}")
            else:
                self.logger.info(
                    f"Python tests passed: {passed} passed, {failed} failed, {skipped} skipped"
                )

            return test_result

        except subprocess.TimeoutExpired:
            self.logger.error("Python tests timed out after 5 minutes")
            return TestResult(
                suite_name=f"Python ({test_type})",
                passed=0,
                failed=0,
                skipped=0,
                duration=300,
                exit_code=1,
            )

    def run_react_tests(self, test_type: str = "all") -> Optional[TestResult]:
        """Run React/Jest test suite"""
        self.logger.info(f"Running React tests ({test_type})...")

        # Check if we're in the React app directory
        react_dir = self.project_root / "remotion-app"
        if not react_dir.exists():
            self.logger.warning("React app directory not found, skipping React tests")
            return None

        # Check if package.json exists
        package_json = react_dir / "package.json"
        if not package_json.exists():
            self.logger.warning("package.json not found, skipping React tests")
            return None

        # Build Jest command
        cmd = ["npm", "test"]

        # Jest options
        jest_args = [
            "--coverage",
            "--watchAll=false",
            "--verbose",
            "--testTimeout=30000",
            "--maxWorkers=2",
        ]

        # Test selection
        if test_type == "components":
            jest_args.extend(["--testPathPattern=components"])
        elif test_type == "hooks":
            jest_args.extend(["--testPathPattern=hooks"])
        elif test_type == "integration":
            jest_args.extend(["--testPathPattern=integration"])

        # Add Jest args to npm command
        cmd.append("--")
        cmd.extend(jest_args)

        start_time = time.time()

        try:
            result = subprocess.run(
                cmd,
                cwd=react_dir,
                capture_output=True,
                text=True,
                timeout=180,  # 3 minute timeout
            )

            duration = time.time() - start_time

            # Parse Jest output
            passed, failed, skipped = self._parse_jest_output(result.stdout)

            # Parse coverage from Jest coverage report
            coverage = self._parse_jest_coverage(react_dir)

            test_result = TestResult(
                suite_name=f"React ({test_type})",
                passed=passed,
                failed=failed,
                skipped=skipped,
                duration=duration,
                coverage=coverage,
                exit_code=result.returncode,
            )

            if result.returncode != 0:
                self.logger.error(f"React tests failed:\n{result.stdout}\n{result.stderr}")
            else:
                self.logger.info(
                    f"React tests passed: {passed} passed, {failed} failed, {skipped} skipped"
                )

            return test_result

        except subprocess.TimeoutExpired:
            self.logger.error("React tests timed out after 3 minutes")
            return TestResult(
                suite_name=f"React ({test_type})",
                passed=0,
                failed=0,
                skipped=0,
                duration=180,
                exit_code=1,
            )

    def run_security_tests(self) -> TestResult:
        """Run security-specific tests"""
        self.logger.info("Running security tests...")

        cmd = [
            sys.executable,
            "-m",
            "pytest",
            "-m",
            "security",
            "-v",
            "--tb=short",
            "tests/",
        ]

        start_time = time.time()

        try:
            result = subprocess.run(
                cmd,
                cwd=self.project_root,
                capture_output=True,
                text=True,
                timeout=120,  # 2 minute timeout
            )

            duration = time.time() - start_time

            passed, failed, skipped = self._parse_pytest_output(result.stdout)

            test_result = TestResult(
                suite_name="Security",
                passed=passed,
                failed=failed,
                skipped=skipped,
                duration=duration,
                exit_code=result.returncode,
            )

            if result.returncode != 0:
                self.logger.error(f"Security tests failed:\n{result.stdout}\n{result.stderr}")
            else:
                self.logger.info(f"Security tests passed: {passed} passed, {failed} failed")

            return test_result

        except subprocess.TimeoutExpired:
            self.logger.error("Security tests timed out")
            return TestResult(
                suite_name="Security",
                passed=0,
                failed=0,
                skipped=0,
                duration=120,
                exit_code=1,
            )

    def run_performance_tests(self) -> TestResult:
        """Run performance and load tests"""
        self.logger.info("Running performance tests...")

        cmd = [
            sys.executable,
            "-m",
            "pytest",
            "-m",
            "slow",
            "-v",
            "--tb=short",
            "tests/",
        ]

        start_time = time.time()

        try:
            result = subprocess.run(
                cmd,
                cwd=self.project_root,
                capture_output=True,
                text=True,
                timeout=600,  # 10 minute timeout for slow tests
            )

            duration = time.time() - start_time

            passed, failed, skipped = self._parse_pytest_output(result.stdout)

            test_result = TestResult(
                suite_name="Performance",
                passed=passed,
                failed=failed,
                skipped=skipped,
                duration=duration,
                exit_code=result.returncode,
            )

            if result.returncode != 0:
                self.logger.error(f"Performance tests failed:\n{result.stdout}\n{result.stderr}")
            else:
                self.logger.info(f"Performance tests passed: {passed} passed, {failed} failed")

            return test_result

        except subprocess.TimeoutExpired:
            self.logger.error("Performance tests timed out")
            return TestResult(
                suite_name="Performance",
                passed=0,
                failed=0,
                skipped=0,
                duration=600,
                exit_code=1,
            )

    def _parse_pytest_output(self, output: str) -> Tuple[int, int, int]:
        """Parse pytest output to extract test counts"""
        passed = failed = skipped = 0

        # Look for the final summary line
        for line in output.split("\n"):
            line = line.strip()
            if "passed" in line or "failed" in line or "error" in line:
                # Parse patterns like "5 passed, 1 failed, 2 skipped"
                import re

                passed_match = re.search(r"(\d+) passed", line)
                failed_match = re.search(r"(\d+) (?:failed|error)", line)
                skipped_match = re.search(r"(\d+) skipped", line)

                if passed_match:
                    passed = int(passed_match.group(1))
                if failed_match:
                    failed = int(failed_match.group(1))
                if skipped_match:
                    skipped = int(skipped_match.group(1))

        return passed, failed, skipped

    def _parse_jest_output(self, output: str) -> Tuple[int, int, int]:
        """Parse Jest output to extract test counts"""
        passed = failed = skipped = 0

        # Jest output patterns
        for line in output.split("\n"):
            line = line.strip()
            if "Tests:" in line:
                import re

                failed_match = re.search(r"(\d+) failed", line)
                passed_match = re.search(r"(\d+) passed", line)
                skipped_match = re.search(r"(\d+) (?:skipped|pending)", line)

                if failed_match:
                    failed = int(failed_match.group(1))
                if passed_match:
                    passed = int(passed_match.group(1))
                if skipped_match:
                    skipped = int(skipped_match.group(1))
                break

        return passed, failed, skipped

    def _parse_coverage_json(self) -> Optional[float]:
        """Parse Python coverage from JSON report"""
        coverage_file = self.project_root / "coverage.json"

        if not coverage_file.exists():
            return None

        try:
            with open(coverage_file) as f:
                coverage_data = json.load(f)

            total_coverage = coverage_data.get("totals", {}).get("percent_covered")
            return float(total_coverage) if total_coverage is not None else None

        except (json.JSONDecodeError, KeyError, ValueError):
            return None

    def _parse_jest_coverage(self, react_dir: Path) -> Optional[float]:
        """Parse React/Jest coverage"""
        coverage_file = react_dir / "coverage" / "coverage-summary.json"

        if not coverage_file.exists():
            return None

        try:
            with open(coverage_file) as f:
                coverage_data = json.load(f)

            total_coverage = coverage_data.get("total", {}).get("lines", {}).get("pct")
            return float(total_coverage) if total_coverage is not None else None

        except (json.JSONDecodeError, KeyError, ValueError):
            return None

    def generate_report(self) -> int:
        """Generate comprehensive test report"""
        self.logger.info("Generating test report...")

        total_passed = sum(r.passed for r in self.results)
        total_failed = sum(r.failed for r in self.results)
        total_skipped = sum(r.skipped for r in self.results)
        total_duration = sum(r.duration for r in self.results)

        print("\n" + "=" * 80)
        print("MANIM-REMOTION BRIDGE TEST REPORT")
        print("=" * 80)
        print(f"Total Tests: {total_passed + total_failed + total_skipped}")
        print(f"Passed: {total_passed}")
        print(f"Failed: {total_failed}")
        print(f"Skipped: {total_skipped}")
        print(f"Total Duration: {total_duration:.2f} seconds")
        print()

        # Detailed breakdown
        for result in self.results:
            status = "✅ PASS" if result.exit_code == 0 else "❌ FAIL"
            print(f"{status} {result.suite_name}")
            print(
                f"  Tests: {result.passed} passed, {result.failed} failed, {result.skipped} skipped"
            )
            print(f"  Duration: {result.duration:.2f}s")
            if result.coverage is not None:
                print(f"  Coverage: {result.coverage:.1f}%")
            print()

        # Overall status
        overall_success = all(r.exit_code == 0 for r in self.results)
        if overall_success:
            print("🎉 ALL TESTS PASSED!")
            exit_code = 0
        else:
            print("💥 SOME TESTS FAILED")
            exit_code = 1

        print("=" * 80)

        return exit_code

    def run_all_tests(self, test_suites: List[str]) -> int:
        """Run all specified test suites"""
        if not self.setup_environments():
            return 1

        start_time = time.time()

        # Run Python tests
        if "python" in test_suites or "all" in test_suites:
            self.results.append(self.run_python_tests("all"))

        if "python-unit" in test_suites:
            self.results.append(self.run_python_tests("unit"))

        if "python-integration" in test_suites:
            self.results.append(self.run_python_tests("integration"))

        # Run React tests
        if "react" in test_suites or "all" in test_suites:
            react_result = self.run_react_tests("all")
            if react_result:
                self.results.append(react_result)

        if "react-components" in test_suites:
            react_result = self.run_react_tests("components")
            if react_result:
                self.results.append(react_result)

        if "react-hooks" in test_suites:
            react_result = self.run_react_tests("hooks")
            if react_result:
                self.results.append(react_result)

        # Run specialized tests
        if "security" in test_suites or "all" in test_suites:
            self.results.append(self.run_security_tests())

        if "performance" in test_suites:
            self.results.append(self.run_performance_tests())

        total_time = time.time() - start_time
        self.logger.info(f"All tests completed in {total_time:.2f} seconds")

        return self.generate_report()


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Run comprehensive tests for Manim-Remotion Bridge"
    )

    parser.add_argument(
        "suites",
        nargs="*",
        default=["all"],
        choices=[
            "all",
            "python",
            "python-unit",
            "python-integration",
            "react",
            "react-components",
            "react-hooks",
            "security",
            "performance",
        ],
        help="Test suites to run",
    )

    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")

    parser.add_argument("--no-coverage", action="store_true", help="Skip coverage analysis")

    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    # Find project root
    script_dir = Path(__file__).parent
    project_root = script_dir

    # Verify we're in the right directory
    if not (project_root / "manim_bridge_secure.py").exists():
        print("Error: Could not find project files. Run from project root.")
        return 1

    runner = TestRunner(project_root)
    return runner.run_all_tests(args.suites)


if __name__ == "__main__":
    sys.exit(main())
