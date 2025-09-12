"""
Log parsing utilities for the Manim Bridge logging system.
Provides tools for analyzing, searching, and aggregating log data.
"""

import json
import re
from collections import defaultdict, Counter
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Union
import gzip


class LogEntry:
    """Represents a single log entry with parsing capabilities."""

    def __init__(self, data: Dict[str, Any]):
        self.raw_data = data
        self.timestamp = datetime.fromisoformat(data.get('timestamp', '').replace('Z', '+00:00'))
        self.level = data.get('level', 'UNKNOWN')
        self.component = data.get('component', 'unknown')
        self.module = data.get('module', '')
        self.function = data.get('function', '')
        self.message = data.get('message', '')
        self.action = data.get('action', '')
        self.data = data.get('data', {})
        self.performance = data.get('performance', {})
        self.error = data.get('error', {})

    def __str__(self) -> str:
        return f"[{self.timestamp}] {self.level} {self.component}: {self.message}"

    def matches_filter(self, filters: Dict[str, Any]) -> bool:
        """Check if this log entry matches the given filters."""
        for key, value in filters.items():
            if key == 'level' and self.level != value:
                return False
            elif key == 'component' and self.component != value:
                return False
            elif key == 'module' and self.module != value:
                return False
            elif key == 'action' and self.action != value:
                return False
            elif key == 'after' and self.timestamp < value:
                return False
            elif key == 'before' and self.timestamp > value:
                return False
            elif key == 'text' and value.lower() not in self.message.lower():
                return False
        return True


class LogParser:
    """Main log parsing and analysis utility."""

    def __init__(self, log_directory: Union[str, Path] = "logs/python"):
        self.log_directory = Path(log_directory)
        self.entries: List[LogEntry] = []
        self.load_logs()

    def load_logs(self) -> None:
        """Load all log files from the log directory."""
        self.entries = []

        if not self.log_directory.exists():
            print(f"Warning: Log directory {self.log_directory} does not exist")
            return

        # Load current log files
        for log_file in self.log_directory.glob("*.log"):
            try:
                self._parse_log_file(log_file)
            except Exception as e:
                print(f"Error parsing {log_file}: {e}")

        # Load rotated log files
        for log_file in self.log_directory.glob("*.log.*"):
            try:
                if log_file.suffix == '.gz':
                    self._parse_gzipped_log_file(log_file)
                else:
                    self._parse_log_file(log_file)
            except Exception as e:
                print(f"Error parsing {log_file}: {e}")

        # Sort entries by timestamp
        self.entries.sort(key=lambda x: x.timestamp)

    def _parse_log_file(self, file_path: Path) -> None:
        """Parse a single log file."""
        with open(file_path, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue

                try:
                    log_data = json.loads(line)
                    entry = LogEntry(log_data)
                    self.entries.append(entry)
                except json.JSONDecodeError:
                    print(f"Warning: Invalid JSON in {file_path}:{line_num}")
                    continue

    def _parse_gzipped_log_file(self, file_path: Path) -> None:
        """Parse a gzipped log file."""
        with gzip.open(file_path, 'rt', encoding='utf-8') as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue

                try:
                    log_data = json.loads(line)
                    entry = LogEntry(log_data)
                    self.entries.append(entry)
                except json.JSONDecodeError:
                    print(f"Warning: Invalid JSON in {file_path}:{line_num}")
                    continue

    def search(self, **filters) -> List[LogEntry]:
        """
        Search logs with various filters.

        Args:
            level: Log level to filter by
            component: Component name to filter by
            module: Module name to filter by
            action: Action name to filter by
            after: Datetime after which to search
            before: Datetime before which to search
            text: Text to search in messages

        Returns:
            List of matching log entries
        """
        return [entry for entry in self.entries if entry.matches_filter(filters)]

    def search_text(self, pattern: str, case_sensitive: bool = False) -> List[LogEntry]:
        """
        Search for text patterns in log messages.

        Args:
            pattern: Text pattern to search for (supports regex)
            case_sensitive: Whether search should be case sensitive

        Returns:
            List of matching log entries
        """
        flags = 0 if case_sensitive else re.IGNORECASE
        regex = re.compile(pattern, flags)

        results = []
        for entry in self.entries:
            if regex.search(entry.message) or regex.search(json.dumps(entry.data)):
                results.append(entry)

        return results

    def get_errors(self, since: Optional[datetime] = None) -> List[LogEntry]:
        """Get all error and critical level entries."""
        results = []
        for entry in self.entries:
            if entry.level not in ['ERROR', 'CRITICAL']:
                continue
            if since:
                # Handle timezone comparison
                entry_time = entry.timestamp.replace(tzinfo=None) if entry.timestamp.tzinfo else entry.timestamp
                since_time = since.replace(tzinfo=None) if since.tzinfo else since
                if entry_time < since_time:
                    continue
            results.append(entry)
        return results

    def get_performance_stats(self, action: Optional[str] = None) -> Dict[str, Any]:
        """
        Analyze performance metrics from logs.

        Args:
            action: Specific action to analyze (optional)

        Returns:
            Dictionary with performance statistics
        """
        performance_entries = [
            entry for entry in self.entries
            if entry.performance and (not action or entry.action == action)
        ]

        if not performance_entries:
            return {}

        durations = [
            entry.performance.get('duration_seconds', 0)
            for entry in performance_entries
        ]

        return {
            'count': len(performance_entries),
            'total_duration': sum(durations),
            'average_duration': sum(durations) / len(durations),
            'min_duration': min(durations),
            'max_duration': max(durations),
            'actions': Counter(entry.action for entry in performance_entries),
        }

    def get_component_stats(self) -> Dict[str, Dict[str, int]]:
        """Get statistics by component and log level."""
        stats = defaultdict(lambda: defaultdict(int))

        for entry in self.entries:
            stats[entry.component][entry.level] += 1
            stats[entry.component]['total'] += 1

        return dict(stats)

    def get_hourly_activity(self, days: int = 7) -> Dict[str, int]:
        """Get hourly activity statistics for the last N days."""
        # Make sure we're comparing timezone-aware datetimes
        since = datetime.now().replace(tzinfo=None) - timedelta(days=days)
        recent_entries = [
            entry for entry in self.entries
            if entry.timestamp.replace(tzinfo=None) >= since
        ]

        hourly_counts = defaultdict(int)
        for entry in recent_entries:
            hour_key = entry.timestamp.strftime('%Y-%m-%d %H:00')
            hourly_counts[hour_key] += 1

        return dict(hourly_counts)

    def get_error_patterns(self) -> Dict[str, int]:
        """Analyze common error patterns."""
        error_entries = self.get_errors()
        error_messages = [entry.message for entry in error_entries]

        # Simple pattern extraction - group similar error messages
        patterns = defaultdict(int)
        for message in error_messages:
            # Remove dynamic parts like timestamps, file paths, etc.
            normalized = re.sub(r'\b\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}', '<timestamp>', message)
            normalized = re.sub(r'/[^\s]+', '<path>', normalized)
            normalized = re.sub(r'\b\d+\b', '<number>', normalized)

            patterns[normalized] += 1

        return dict(patterns)

    def generate_report(self, output_file: Optional[Path] = None) -> str:
        """
        Generate a comprehensive log analysis report.

        Args:
            output_file: Optional file path to save the report

        Returns:
            Report content as string
        """
        if not self.entries:
            return "No log entries found."

        report_lines = []
        report_lines.append("=== LOG ANALYSIS REPORT ===")
        report_lines.append(f"Generated: {datetime.now()}")
        report_lines.append(f"Total entries: {len(self.entries)}")
        report_lines.append(f"Date range: {self.entries[0].timestamp} to {self.entries[-1].timestamp}")
        report_lines.append("")

        # Level distribution
        level_counts = Counter(entry.level for entry in self.entries)
        report_lines.append("=== LOG LEVEL DISTRIBUTION ===")
        for level, count in level_counts.most_common():
            percentage = (count / len(self.entries)) * 100
            report_lines.append(f"{level}: {count} ({percentage:.1f}%)")
        report_lines.append("")

        # Component statistics
        component_stats = self.get_component_stats()
        report_lines.append("=== COMPONENT ACTIVITY ===")
        for component, stats in component_stats.items():
            total = stats.pop('total', 0)
            report_lines.append(f"{component}: {total} total")
            for level, count in stats.items():
                if count > 0:
                    report_lines.append(f"  {level}: {count}")
        report_lines.append("")

        # Error analysis
        errors = self.get_errors()
        if errors:
            report_lines.append(f"=== ERRORS ({len(errors)} total) ===")
            error_patterns = self.get_error_patterns()
            for pattern, count in sorted(error_patterns.items(), key=lambda x: x[1], reverse=True)[:10]:
                report_lines.append(f"{count}x: {pattern}")
            report_lines.append("")

        # Performance statistics
        perf_stats = self.get_performance_stats()
        if perf_stats:
            report_lines.append("=== PERFORMANCE STATISTICS ===")
            report_lines.append(f"Operations with timing: {perf_stats['count']}")
            report_lines.append(f"Total time: {perf_stats['total_duration']:.3f}s")
            report_lines.append(f"Average time: {perf_stats['average_duration']:.3f}s")
            report_lines.append(f"Min time: {perf_stats['min_duration']:.3f}s")
            report_lines.append(f"Max time: {perf_stats['max_duration']:.3f}s")
            report_lines.append("")

            report_lines.append("Top actions by frequency:")
            for action, count in perf_stats['actions'].most_common(10):
                report_lines.append(f"  {action}: {count}")
            report_lines.append("")

        # Recent activity
        recent_activity = self.get_hourly_activity(days=1)
        if recent_activity:
            report_lines.append("=== RECENT ACTIVITY (Last 24 hours) ===")
            for hour, count in sorted(recent_activity.items())[-24:]:
                report_lines.append(f"{hour}: {count} entries")

        report_content = "\n".join(report_lines)

        if output_file:
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(report_content)
            print(f"Report saved to {output_file}")

        return report_content

    def export_csv(self, output_file: Path, filters: Optional[Dict[str, Any]] = None) -> None:
        """Export filtered logs to CSV format."""
        import csv

        entries = self.search(**filters) if filters else self.entries

        with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
            fieldnames = ['timestamp', 'level', 'component', 'module', 'function', 'message', 'action', 'data']
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)

            writer.writeheader()
            for entry in entries:
                writer.writerow({
                    'timestamp': entry.timestamp.isoformat(),
                    'level': entry.level,
                    'component': entry.component,
                    'module': entry.module,
                    'function': entry.function,
                    'message': entry.message,
                    'action': entry.action,
                    'data': json.dumps(entry.data) if entry.data else '',
                })


def main():
    """CLI interface for log parsing utilities."""
    import argparse

    parser = argparse.ArgumentParser(description='Analyze Manim Bridge logs')
    parser.add_argument('--log-dir', default='logs/python', help='Log directory path')
    parser.add_argument('--report', action='store_true', help='Generate analysis report')
    parser.add_argument('--search', help='Search for text in logs')
    parser.add_argument('--errors', action='store_true', help='Show recent errors')
    parser.add_argument('--level', help='Filter by log level')
    parser.add_argument('--component', help='Filter by component')
    parser.add_argument('--since', help='Show logs since date (YYYY-MM-DD)')
    parser.add_argument('--export-csv', help='Export to CSV file')
    parser.add_argument('--output', help='Output file for report')

    args = parser.parse_args()

    # Initialize parser
    log_parser = LogParser(args.log_dir)

    if not log_parser.entries:
        print("No log entries found.")
        return

    print(f"Loaded {len(log_parser.entries)} log entries")

    # Build filters
    filters = {}
    if args.level:
        filters['level'] = args.level.upper()
    if args.component:
        filters['component'] = args.component
    if args.since:
        try:
            filters['after'] = datetime.fromisoformat(args.since)
        except ValueError:
            print(f"Invalid date format: {args.since}")
            return

    if args.search:
        results = log_parser.search_text(args.search)
        print(f"\nFound {len(results)} entries matching '{args.search}':")
        for entry in results[-20:]:  # Show last 20 matches
            print(entry)

    elif args.errors:
        errors = log_parser.get_errors()
        print(f"\nFound {len(errors)} error entries:")
        for entry in errors[-10:]:  # Show last 10 errors
            print(entry)

    elif args.report:
        output_file = Path(args.output) if args.output else None
        report = log_parser.generate_report(output_file)
        if not output_file:
            print(report)

    elif args.export_csv:
        log_parser.export_csv(Path(args.export_csv), filters)
        print(f"Exported to {args.export_csv}")

    else:
        # Show recent entries with filters
        entries = log_parser.search(**filters)
        print(f"\nShowing last 10 entries (filtered: {len(entries)} total):")
        for entry in entries[-10:]:
            print(entry)


if __name__ == "__main__":
    main()
