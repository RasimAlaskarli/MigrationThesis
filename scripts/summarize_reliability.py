#!/usr/bin/env python3
"""Summarize reliability label counts across every (year, origin, destination)
flow in a definitive_flows.json file.

Reads the output of finalize_reliability_json.py and reports:
- counts per label (high / moderate / low / insufficient)
- a breakdown by year
- an optional CSV dump of every flow with its label

Usage:
    python summarize_reliability.py --input definitive_flows.json
    python summarize_reliability.py --input definitive_flows.json --csv out.csv
"""

from __future__ import annotations

import argparse
import csv
import json
from collections import Counter, defaultdict
from pathlib import Path


LABEL_ORDER = [
    "high_confidence",
    "moderate_confidence",
    "low_confidence",
    "insufficient_evidence",
]

DISPLAY = {
    "high_confidence": "High confidence",
    "moderate_confidence": "Moderate confidence",
    "low_confidence": "Low confidence",
    "insufficient_evidence": "Insufficient evidence",
}


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--input", required=True, help="Path to definitive_flows.json")
    p.add_argument("--csv", help="Optional path to write per-flow CSV dump")
    p.add_argument("--by-year", action="store_true", help="Also show breakdown by year")
    return p.parse_args()


def iter_flows(payload):
    """Yield (year, orig, dest, entry) tuples from a definitive_flows.json payload."""
    flows = payload.get("flows", {})
    for year, year_block in flows.items():
        if not isinstance(year_block, dict):
            continue
        for orig, orig_block in year_block.items():
            if not isinstance(orig_block, dict):
                continue
            for dest, entry in orig_block.items():
                if not isinstance(entry, dict):
                    continue
                yield year, orig, dest, entry


def format_row(label_counts, total):
    lines = []
    for label in LABEL_ORDER:
        n = label_counts.get(label, 0)
        pct = (n / total * 100) if total else 0
        lines.append(f"  {DISPLAY[label]:<22} {n:>8,}  ({pct:5.1f}%)")
    return "\n".join(lines)


def main() -> None:
    args = parse_args()
    path = Path(args.input)
    if not path.exists():
        raise FileNotFoundError(f"Input not found: {path}")

    with path.open("r", encoding="utf-8") as f:
        payload = json.load(f)

    total = 0
    overall = Counter()
    by_year = defaultdict(Counter)
    unlabeled = 0

    csv_rows = []

    for year, orig, dest, entry in iter_flows(payload):
        label = entry.get("confidence")
        if label is None:
            unlabeled += 1
            continue
        overall[label] += 1
        by_year[year][label] += 1
        total += 1

        if args.csv:
            csv_rows.append({
                "year": year,
                "orig": orig,
                "dest": dest,
                "value": entry.get("final_value"),
                "confidence": label,
                "retained_count": entry.get("retained_count"),
                "ratio": entry.get("ratio"),
                "median": entry.get("median"),
                "q1": entry.get("q1"),
                "q3": entry.get("q3"),
            })

    # overall summary
    print(f"\nReliability summary for {path}")
    print(f"{'=' * 60}")
    print(f"Total labeled flows: {total:,}")
    if unlabeled:
        print(f"Entries with no confidence label: {unlabeled:,}")
    print()
    print(format_row(overall, total))

    if args.by_year and by_year:
        print(f"\n{'=' * 60}")
        print("Breakdown by year")
        print(f"{'=' * 60}")
        header = f"{'Year':<6} {'Total':>8} " + " ".join(f"{DISPLAY[l][:4]:>8}" for l in LABEL_ORDER)
        print(header)
        print("-" * len(header))
        for year in sorted(by_year.keys(), key=lambda x: int(x) if x.isdigit() else -1):
            counts = by_year[year]
            year_total = sum(counts.values())
            row = f"{year:<6} {year_total:>8,} " + " ".join(
                f"{counts.get(l, 0):>8,}" for l in LABEL_ORDER
            )
            print(row)

    if args.csv:
        csv_path = Path(args.csv)
        csv_path.parent.mkdir(parents=True, exist_ok=True)
        with csv_path.open("w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(
                f,
                fieldnames=["year", "orig", "dest", "value", "confidence",
                            "retained_count", "ratio", "median", "q1", "q3"]
            )
            writer.writeheader()
            writer.writerows(csv_rows)
        print(f"\n[OK] wrote per-flow CSV: {csv_path} ({len(csv_rows):,} rows)")


if __name__ == "__main__":
    main()
