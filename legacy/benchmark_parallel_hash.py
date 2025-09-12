#!/usr/bin/env python3
"""Benchmark script to validate ParallelHashCalculator performance improvements"""

import hashlib
import tempfile
import time
from pathlib import Path
import sys
import os

# Add the project root to the Python path
sys.path.insert(0, str(Path(__file__).parent))

from manim_bridge.processing.hash_calculator import HashCalculator
from manim_bridge.processing.parallel_hash_calculator import ParallelHashCalculator


def create_test_file(size_mb: int, temp_dir: Path) -> Path:
    """Create a test file of specified size in MB"""
    test_file = temp_dir / f"benchmark_file_{size_mb}mb.dat"

    # Create file with realistic content (not just zeros)
    chunk_size = 1024 * 1024  # 1MB chunks
    chunk_data = b"benchmark test data content " * (chunk_size // 28)  # Fill 1MB

    print(f"Creating {size_mb}MB test file...")
    with open(test_file, 'wb') as f:
        for _ in range(size_mb):
            f.write(chunk_data[:chunk_size])

    actual_size = test_file.stat().st_size
    print(f"Created test file: {actual_size:,} bytes ({actual_size / 1024 / 1024:.1f} MB)")

    return test_file


def benchmark_hash_calculator(file_path: Path, algorithm: str = "sha256", runs: int = 3):
    """Benchmark the original hash calculator"""
    print(f"\n🔍 Benchmarking HashCalculator with {algorithm.upper()}")

    calc = HashCalculator(chunk_size=64*1024, enable_logging=False)  # 64KB chunks
    times = []

    for run in range(runs):
        print(f"  Run {run + 1}/{runs}...", end="", flush=True)
        start_time = time.perf_counter()
        result = calc.calculate_hash(file_path, algorithm)
        elapsed = time.perf_counter() - start_time
        times.append(elapsed)
        print(f" {elapsed:.4f}s")

    avg_time = sum(times) / len(times)
    min_time = min(times)
    max_time = max(times)

    print(f"  📊 Results: avg={avg_time:.4f}s, min={min_time:.4f}s, max={max_time:.4f}s")
    print(f"  📝 Hash: {result[:16]}...")

    return {
        "algorithm": algorithm,
        "avg_time": avg_time,
        "min_time": min_time,
        "max_time": max_time,
        "hash": result
    }


def benchmark_parallel_hash_calculator(file_path: Path, algorithm: str = "sha256", runs: int = 3):
    """Benchmark the parallel hash calculator"""
    print(f"\n⚡ Benchmarking ParallelHashCalculator with {algorithm.upper()}")

    calc = ParallelHashCalculator(
        chunk_size=64*1024,
        max_workers=4,
        enable_logging=False,
        use_memory_mapping=True
    )

    times = []

    for run in range(runs):
        print(f"  Run {run + 1}/{runs}...", end="", flush=True)
        start_time = time.perf_counter()
        result = calc.calculate_hash(file_path, algorithm)
        elapsed = time.perf_counter() - start_time
        times.append(elapsed)
        print(f" {elapsed:.4f}s")

    avg_time = sum(times) / len(times)
    min_time = min(times)
    max_time = max(times)

    print(f"  📊 Results: avg={avg_time:.4f}s, min={min_time:.4f}s, max={max_time:.4f}s")
    print(f"  📝 Hash: {result[:16]}...")

    # Get performance stats
    stats = calc.get_performance_stats()
    print(f"  ⚙️  Config: {stats['max_workers']} workers, chunk_size={stats['chunk_size']}")

    return {
        "algorithm": algorithm,
        "avg_time": avg_time,
        "min_time": min_time,
        "max_time": max_time,
        "hash": result,
        "stats": stats
    }


def calculate_performance_improvement(sequential_time: float, parallel_time: float) -> dict:
    """Calculate performance improvement statistics"""
    if parallel_time < sequential_time:
        improvement_pct = ((sequential_time - parallel_time) / sequential_time) * 100
        speedup = sequential_time / parallel_time
        status = "✅ FASTER"
    else:
        degradation_pct = ((parallel_time - sequential_time) / sequential_time) * 100
        slowdown = parallel_time / sequential_time
        status = "❌ SLOWER"
        improvement_pct = -degradation_pct
        speedup = 1 / slowdown

    return {
        "improvement_pct": improvement_pct,
        "speedup": speedup,
        "status": status
    }


def validate_hash_correctness(seq_hash: str, par_hash: str) -> bool:
    """Validate that both implementations produce the same hash"""
    return seq_hash == par_hash


def main():
    """Run comprehensive performance benchmarks"""
    print("🚀 ParallelHashCalculator Performance Benchmark")
    print("=" * 60)

    # Test different file sizes
    test_sizes = [10, 50, 100, 200]  # MB
    algorithms = ["md5", "sha256"]

    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)

        results_summary = []

        for size_mb in test_sizes:
            print(f"\n{'=' * 60}")
            print(f"📁 TESTING {size_mb}MB FILE")
            print('=' * 60)

            # Create test file
            test_file = create_test_file(size_mb, temp_path)

            for algorithm in algorithms:
                print(f"\n🧪 Algorithm: {algorithm.upper()}")
                print("-" * 40)

                # Benchmark sequential
                seq_result = benchmark_hash_calculator(test_file, algorithm)

                # Benchmark parallel
                par_result = benchmark_parallel_hash_calculator(test_file, algorithm)

                # Validate correctness
                hash_correct = validate_hash_correctness(seq_result["hash"], par_result["hash"])

                # Calculate performance improvement
                perf = calculate_performance_improvement(
                    seq_result["avg_time"],
                    par_result["avg_time"]
                )

                # Print results
                print(f"\n📋 COMPARISON RESULTS:")
                print(f"  Hash Correctness: {'✅ PASS' if hash_correct else '❌ FAIL'}")
                print(f"  Performance: {perf['status']}")
                print(f"  Sequential Time: {seq_result['avg_time']:.4f}s")
                print(f"  Parallel Time: {par_result['avg_time']:.4f}s")
                print(f"  Improvement: {perf['improvement_pct']:+.1f}%")
                print(f"  Speedup: {perf['speedup']:.2f}x")

                # Store results
                results_summary.append({
                    "file_size_mb": size_mb,
                    "algorithm": algorithm,
                    "sequential_time": seq_result["avg_time"],
                    "parallel_time": par_result["avg_time"],
                    "improvement_pct": perf["improvement_pct"],
                    "speedup": perf["speedup"],
                    "hash_correct": hash_correct,
                    "status": perf["status"]
                })

        # Print final summary
        print(f"\n{'=' * 60}")
        print("📊 FINAL PERFORMANCE SUMMARY")
        print('=' * 60)

        target_reduction = 80  # 80% reduction target
        achieved_target = False

        print(f"{'File Size':<10} {'Algorithm':<10} {'Sequential':<12} {'Parallel':<12} {'Improvement':<12} {'Status'}")
        print("-" * 70)

        for result in results_summary:
            status_icon = "✅" if result["improvement_pct"] > 0 else "❌"
            print(f"{result['file_size_mb']:>7}MB {result['algorithm']:<10} "
                  f"{result['sequential_time']:>9.4f}s {result['parallel_time']:>9.4f}s "
                  f"{result['improvement_pct']:>+9.1f}% {status_icon}")

            if result["improvement_pct"] >= target_reduction:
                achieved_target = True

        # Best performance summary
        best_result = max(results_summary, key=lambda x: x["improvement_pct"])
        worst_result = min(results_summary, key=lambda x: x["improvement_pct"])

        print(f"\n🏆 BEST PERFORMANCE:")
        print(f"   File: {best_result['file_size_mb']}MB, Algorithm: {best_result['algorithm']}")
        print(f"   Improvement: {best_result['improvement_pct']:+.1f}% ({best_result['speedup']:.2f}x speedup)")

        print(f"\n⚠️  WORST PERFORMANCE:")
        print(f"   File: {worst_result['file_size_mb']}MB, Algorithm: {worst_result['algorithm']}")
        print(f"   Change: {worst_result['improvement_pct']:+.1f}% ({worst_result['speedup']:.2f}x)")

        print(f"\n🎯 TARGET ACHIEVEMENT:")
        target_status = "✅ ACHIEVED" if achieved_target else "❌ NOT ACHIEVED"
        print(f"   Target: {target_reduction}% reduction in hash calculation time")
        print(f"   Status: {target_status}")

        if achieved_target:
            qualifying_results = [r for r in results_summary if r["improvement_pct"] >= target_reduction]
            print(f"   Qualifying scenarios: {len(qualifying_results)}/{len(results_summary)}")

        # Recommendations
        print(f"\n💡 RECOMMENDATIONS:")
        if best_result["improvement_pct"] > 0:
            print(f"   • Parallel processing shows benefits for larger files ({best_result['file_size_mb']}MB+)")
            print(f"   • Best algorithm for parallelization: {best_result['algorithm'].upper()}")
        else:
            print("   • Consider increasing file size thresholds for parallel processing")
            print("   • Thread pool overhead may dominate for smaller files")

        print("   • Use memory mapping for files > 10MB")
        print("   • Consider CPU count when setting max_workers")

        # Cleanup
        test_file.unlink()


if __name__ == "__main__":
    main()
