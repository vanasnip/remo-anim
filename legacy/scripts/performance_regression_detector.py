#!/usr/bin/env python3
"""
Performance regression detection script for continuous integration.

This script can be used in CI/CD pipelines to detect performance regressions
by comparing current performance against established baselines.
"""

import argparse
import json
import sys
import time
from pathlib import Path
from typing import Dict, List, Optional

# Add the parent directory to the path so we can import from manim_bridge
sys.path.insert(0, str(Path(__file__).parent.parent))

from tests.performance.benchmark_suite import PerformanceBenchmarkSuite


class RegressionDetector:
    """Detects performance regressions by comparing against baselines"""

    def __init__(
        self,
        regression_threshold: float = 1.3,  # 30% slower = regression
        improvement_threshold: float = 1.2,  # 20% faster = improvement
        critical_operations: Optional[List[str]] = None
    ):
        self.regression_threshold = regression_threshold
        self.improvement_threshold = improvement_threshold
        self.critical_operations = critical_operations or [
            "manifest_read_cached",
            "manifest_read_direct",
            "manifest_write",
            "hash_calculation_sha256",
            "hash_calculation_md5",
            "video_metadata_extraction",
            "video_validation"
        ]

    def detect_regressions(
        self,
        baseline_path: Path,
        current_results: Optional[Dict] = None,
        output_path: Optional[Path] = None
    ) -> Dict:
        """
        Detect performance regressions by comparing current vs baseline results.

        Args:
            baseline_path: Path to baseline performance results JSON
            current_results: Current results dict, or None to run new benchmarks
            output_path: Optional path to save regression report

        Returns:
            Dictionary containing regression analysis results
        """
        if not baseline_path.exists():
            raise FileNotFoundError(f"Baseline file not found: {baseline_path}")

        # Load baseline results
        with open(baseline_path) as f:
            baseline = json.load(f)

        # Get current results (either provided or run fresh benchmarks)
        if current_results is None:
            print("🚀 Running current performance benchmarks...")
            benchmark_suite = PerformanceBenchmarkSuite()
            current_results = benchmark_suite.run_full_benchmark_suite()

        # Perform regression analysis
        print("🔍 Analyzing performance changes...")
        analysis = self._analyze_performance_changes(baseline, current_results)

        # Generate report
        report = self._generate_regression_report(analysis, baseline, current_results)

        # Save report if requested
        if output_path:
            with open(output_path, 'w') as f:
                json.dump(report, f, indent=2, default=str)
            print(f"📄 Regression report saved to {output_path}")

        return report

    def _analyze_performance_changes(self, baseline: Dict, current: Dict) -> Dict:
        """Analyze performance changes between baseline and current results"""
        changes = {
            "regressions": [],
            "improvements": [],
            "stable": [],
            "missing_operations": [],
            "new_operations": []
        }

        # Extract performance data from both results
        baseline_perf = self._extract_performance_data(baseline)
        current_perf = self._extract_performance_data(current)

        # Find missing and new operations
        baseline_ops = set(baseline_perf.keys())
        current_ops = set(current_perf.keys())

        changes["missing_operations"] = list(baseline_ops - current_ops)
        changes["new_operations"] = list(current_ops - baseline_ops)

        # Compare common operations
        common_ops = baseline_ops & current_ops

        for operation in common_ops:
            baseline_stats = baseline_perf[operation]
            current_stats = current_perf[operation]

            # Compare mean duration (primary metric)
            baseline_mean = baseline_stats.get("mean_duration", 0)
            current_mean = current_stats.get("mean_duration", 0)

            if baseline_mean <= 0 or current_mean <= 0:
                continue

            change_ratio = current_mean / baseline_mean

            change_info = {
                "operation": operation,
                "baseline_mean": baseline_mean,
                "current_mean": current_mean,
                "change_ratio": change_ratio,
                "change_percent": (change_ratio - 1) * 100,
                "is_critical": operation in self.critical_operations,
                "baseline_samples": baseline_stats.get("sample_count", 0),
                "current_samples": current_stats.get("sample_count", 0)
            }

            if change_ratio >= self.regression_threshold:
                changes["regressions"].append(change_info)
            elif change_ratio <= (1 / self.improvement_threshold):
                changes["improvements"].append(change_info)
            else:
                changes["stable"].append(change_info)

        return changes

    def _extract_performance_data(self, results: Dict) -> Dict:
        """Extract performance statistics from benchmark results"""
        performance_data = {}

        # Extract from performance report if available
        perf_report = results.get("performance_report", {})
        operations = perf_report.get("operations", {})

        for operation, stats in operations.items():
            duration_stats = stats.get("duration_stats", {})
            if duration_stats:
                performance_data[operation] = {
                    "mean_duration": duration_stats.get("mean", 0),
                    "median_duration": duration_stats.get("median", 0),
                    "p95_duration": duration_stats.get("p95", 0),
                    "sample_count": stats.get("sample_count", 0),
                    "success_rate": stats.get("success_rate", 0)
                }

        return performance_data

    def _generate_regression_report(
        self,
        analysis: Dict,
        baseline: Dict,
        current: Dict
    ) -> Dict:
        """Generate comprehensive regression report"""
        report = {
            "regression_analysis": {
                "timestamp": time.time(),
                "baseline_timestamp": baseline.get("timestamp"),
                "current_timestamp": current.get("timestamp"),
                "regression_threshold": self.regression_threshold,
                "improvement_threshold": self.improvement_threshold,
                "critical_operations": self.critical_operations,
            },
            "summary": {
                "total_regressions": len(analysis["regressions"]),
                "critical_regressions": len([
                    r for r in analysis["regressions"]
                    if r["is_critical"]
                ]),
                "total_improvements": len(analysis["improvements"]),
                "stable_operations": len(analysis["stable"]),
                "missing_operations": len(analysis["missing_operations"]),
                "new_operations": len(analysis["new_operations"])
            },
            "regressions": analysis["regressions"],
            "improvements": analysis["improvements"],
            "stable_operations": analysis["stable"],
            "missing_operations": analysis["missing_operations"],
            "new_operations": analysis["new_operations"],
            "system_comparison": {
                "baseline_system": baseline.get("system_info", {}),
                "current_system": current.get("system_info", {})
            }
        }

        # Add severity assessment
        report["severity_assessment"] = self._assess_severity(analysis)

        return report

    def _assess_severity(self, analysis: Dict) -> Dict:
        """Assess severity of performance changes"""
        critical_regressions = [
            r for r in analysis["regressions"]
            if r["is_critical"]
        ]

        # Calculate severity score (higher = worse)
        severity_score = 0
        max_regression = 0

        for regression in analysis["regressions"]:
            weight = 2.0 if regression["is_critical"] else 1.0
            regression_severity = (regression["change_ratio"] - 1) * weight
            severity_score += regression_severity
            max_regression = max(max_regression, regression["change_ratio"])

        # Determine overall severity
        if len(critical_regressions) > 0 or max_regression > 2.0:
            severity_level = "CRITICAL"
        elif len(analysis["regressions"]) > 3 or max_regression > 1.5:
            severity_level = "HIGH"
        elif len(analysis["regressions"]) > 0:
            severity_level = "MEDIUM"
        else:
            severity_level = "LOW"

        return {
            "level": severity_level,
            "score": severity_score,
            "max_regression_ratio": max_regression,
            "critical_operations_affected": len(critical_regressions),
            "recommendation": self._get_severity_recommendation(severity_level)
        }

    def _get_severity_recommendation(self, severity_level: str) -> str:
        """Get recommendation based on severity level"""
        recommendations = {
            "CRITICAL": "🚨 BLOCK DEPLOYMENT: Critical performance regressions detected. Investigate immediately.",
            "HIGH": "⚠️ REVIEW REQUIRED: Significant performance regressions. Consider blocking deployment.",
            "MEDIUM": "📊 MONITOR: Performance regressions detected. Review and monitor closely.",
            "LOW": "✅ ACCEPTABLE: No significant performance regressions detected."
        }
        return recommendations.get(severity_level, "Unknown severity level")

    def print_regression_summary(self, report: Dict) -> None:
        """Print human-readable regression summary"""
        summary = report["summary"]
        severity = report["severity_assessment"]

        print(f"\n{'='*60}")
        print(f"📊 PERFORMANCE REGRESSION ANALYSIS REPORT")
        print(f"{'='*60}")

        print(f"\n🎯 SUMMARY:")
        print(f"   • Regressions: {summary['total_regressions']} ({summary['critical_regressions']} critical)")
        print(f"   • Improvements: {summary['total_improvements']}")
        print(f"   • Stable operations: {summary['stable_operations']}")
        print(f"   • Missing operations: {summary['missing_operations']}")
        print(f"   • New operations: {summary['new_operations']}")

        print(f"\n🚨 SEVERITY: {severity['level']}")
        print(f"   {severity['recommendation']}")

        if report["regressions"]:
            print(f"\n⬇️ PERFORMANCE REGRESSIONS:")
            for regression in sorted(report["regressions"], key=lambda x: x["change_ratio"], reverse=True):
                critical_marker = "🔴" if regression["is_critical"] else "🟡"
                print(f"   {critical_marker} {regression['operation']}: "
                      f"{regression['change_percent']:+.1f}% slower "
                      f"({regression['baseline_mean']:.3f}s → {regression['current_mean']:.3f}s)")

        if report["improvements"]:
            print(f"\n⬆️ PERFORMANCE IMPROVEMENTS:")
            for improvement in sorted(report["improvements"], key=lambda x: x["change_ratio"]):
                print(f"   🟢 {improvement['operation']}: "
                      f"{improvement['change_percent']:+.1f}% faster "
                      f"({improvement['baseline_mean']:.3f}s → {improvement['current_mean']:.3f}s)")

        print(f"\n{'='*60}")


def main():
    """Command-line interface for regression detection"""
    parser = argparse.ArgumentParser(description="Detect performance regressions")
    parser.add_argument(
        "baseline",
        type=Path,
        help="Path to baseline performance results JSON file"
    )
    parser.add_argument(
        "--output", "-o",
        type=Path,
        help="Path to save regression analysis report"
    )
    parser.add_argument(
        "--threshold", "-t",
        type=float,
        default=1.3,
        help="Regression threshold (default: 1.3 = 30%% slower)"
    )
    parser.add_argument(
        "--improvement-threshold",
        type=float,
        default=1.2,
        help="Improvement threshold (default: 1.2 = 20%% faster)"
    )
    parser.add_argument(
        "--fail-on-regression",
        action="store_true",
        help="Exit with error code if regressions detected"
    )
    parser.add_argument(
        "--critical-only",
        action="store_true",
        help="Only fail on critical operation regressions"
    )

    args = parser.parse_args()

    # Create detector
    detector = RegressionDetector(
        regression_threshold=args.threshold,
        improvement_threshold=args.improvement_threshold
    )

    try:
        # Detect regressions
        report = detector.detect_regressions(
            baseline_path=args.baseline,
            output_path=args.output
        )

        # Print summary
        detector.print_regression_summary(report)

        # Exit with error if regressions detected and --fail-on-regression specified
        if args.fail_on_regression:
            regressions = report["regressions"]

            if args.critical_only:
                critical_regressions = [r for r in regressions if r["is_critical"]]
                if critical_regressions:
                    print(f"\n❌ CRITICAL regressions detected, exiting with error code 1")
                    sys.exit(1)
            else:
                if regressions:
                    print(f"\n❌ Performance regressions detected, exiting with error code 1")
                    sys.exit(1)

        print(f"\n✅ Regression analysis completed successfully")

    except Exception as e:
        print(f"❌ Regression detection failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
