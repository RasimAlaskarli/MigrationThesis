#!/usr/bin/env python3
"""Build an intermediate JSON dataset from gf_imr and bilat_mig CSV files.

The output JSON groups all raw estimates by (year0, orig, dest) so a second
script can compute a single flow value and a reliability label.

Usage:
    python build_combined_json.py \
        --gf-imr /path/to/gf_imr.csv \
        --bilat-mig /path/to/bilat_mig.csv \
        --output /path/to/combined_flows.json

Design notes:
- Streams both CSVs row-by-row; does not load them entirely into memory first.
- Keeps only gf_imr rows where sex == 'b'.
- Stores all gf_imr estimates under "old_values".
- Stores all bilat_mig method columns under "new_values".
- The schema is deliberately verbose and human-readable so it is easy to debug.
"""

from __future__ import annotations

import argparse
import csv
import json
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, Iterable


GF_EXPECTED_COLUMNS = {
    "stock",
    "demo",
    "sex",
    "year0",
    "interval",
    "orig",
    "dest",
    "orig_code",
    "dest_code",
    "flow",
}

BILAT_EXPECTED_COLUMNS = {
    "year0",
    "orig",
    "dest",
    "sd_drop_neg",
    "sd_rev_neg",
    "mig_rate",
    "da_min_open",
    "da_min_closed",
    "da_pb_closed",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--gf-imr", required=True, help="Path to gf_imr CSV")
    parser.add_argument("--bilat-mig", required=True, help="Path to bilat_mig CSV")
    parser.add_argument("--output", required=True, help="Path to output JSON")
    parser.add_argument(
        "--indent",
        type=int,
        default=2,
        help="JSON indentation level (default: 2)",
    )
    return parser.parse_args()


FlowRecord = Dict[str, Any]
FlowMap = Dict[str, Dict[str, Dict[str, FlowRecord]]]



def make_flow_record() -> FlowRecord:
    return {
        "old_values": [],
        "new_values": {},
    }



def safe_float(value: str | None) -> float | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        return None



def nested_flow_map() -> FlowMap:
    return defaultdict(lambda: defaultdict(lambda: defaultdict(make_flow_record)))



def validate_columns(path: Path, reader_fieldnames: Iterable[str] | None, expected: set[str]) -> None:
    if reader_fieldnames is None:
        raise ValueError(f"{path} does not appear to have a header row.")
    missing = expected - set(reader_fieldnames)
    if missing:
        raise ValueError(
            f"{path} is missing expected columns: {', '.join(sorted(missing))}"
        )



def ingest_gf_imr(gf_path: Path, flows: FlowMap) -> dict[str, int]:
    stats = {
        "rows_seen": 0,
        "rows_kept": 0,
        "rows_skipped_non_b": 0,
        "rows_skipped_bad_key": 0,
    }

    with gf_path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        validate_columns(gf_path, reader.fieldnames, GF_EXPECTED_COLUMNS)

        for row in reader:
            stats["rows_seen"] += 1

            if (row.get("sex") or "").strip().lower() != "b":
                stats["rows_skipped_non_b"] += 1
                continue

            year = (row.get("year0") or "").strip()
            orig = (row.get("orig") or "").strip().upper()
            dest = (row.get("dest") or "").strip().upper()
            if not year or not orig or not dest:
                stats["rows_skipped_bad_key"] += 1
                continue

            flow_value = safe_float(row.get("flow"))

            source_key = {
                "stock": (row.get("stock") or "").strip(),
                "demo": (row.get("demo") or "").strip(),
                "interval": (row.get("interval") or "").strip(),
                "sex": "b",
                "orig_code": (row.get("orig_code") or "").strip(),
                "dest_code": (row.get("dest_code") or "").strip(),
                "flow": flow_value,
            }

            flows[year][orig][dest]["old_values"].append(source_key)
            stats["rows_kept"] += 1

    return stats



def ingest_bilat_mig(bilat_path: Path, flows: FlowMap) -> dict[str, int]:
    stats = {
        "rows_seen": 0,
        "rows_kept": 0,
        "rows_skipped_bad_key": 0,
    }

    method_columns = [
        "sd_drop_neg",
        "sd_rev_neg",
        "mig_rate",
        "da_min_open",
        "da_min_closed",
        "da_pb_closed",
    ]

    with bilat_path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        validate_columns(bilat_path, reader.fieldnames, BILAT_EXPECTED_COLUMNS)

        for row in reader:
            stats["rows_seen"] += 1

            year = (row.get("year0") or "").strip()
            orig = (row.get("orig") or "").strip().upper()
            dest = (row.get("dest") or "").strip().upper()
            if not year or not orig or not dest:
                stats["rows_skipped_bad_key"] += 1
                continue

            entry = flows[year][orig][dest]["new_values"]
            for col in method_columns:
                entry[col] = safe_float(row.get(col))

            stats["rows_kept"] += 1

    return stats



def freeze_flows(flows: FlowMap) -> dict[str, Any]:
    frozen: dict[str, Any] = {}
    for year, year_map in flows.items():
        frozen[year] = {}
        for orig, orig_map in year_map.items():
            frozen[year][orig] = dict(orig_map)
    return frozen



def main() -> None:
    args = parse_args()
    gf_path = Path(args.gf_imr)
    bilat_path = Path(args.bilat_mig)
    output_path = Path(args.output)

    if not gf_path.exists():
        raise FileNotFoundError(f"gf_imr file not found: {gf_path}")
    if not bilat_path.exists():
        raise FileNotFoundError(f"bilat_mig file not found: {bilat_path}")

    flows = nested_flow_map()
    gf_stats = ingest_gf_imr(gf_path, flows)
    bilat_stats = ingest_bilat_mig(bilat_path, flows)

    payload = {
        "meta": {
            "description": "Intermediate migration flow dataset created from gf_imr and bilat_mig.",
            "gf_imr_source": str(gf_path),
            "bilat_mig_source": str(bilat_path),
            "gf_imr_filter": {"sex": "b"},
            "new_value_columns": [
                "sd_drop_neg",
                "sd_rev_neg",
                "mig_rate",
                "da_min_open",
                "da_min_closed",
                "da_pb_closed",
            ],
            "stats": {
                "gf_imr": gf_stats,
                "bilat_mig": bilat_stats,
            },
        },
        "flows": freeze_flows(flows),
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=args.indent)

    print(f"[OK] wrote {output_path}")


if __name__ == "__main__":
    main()
