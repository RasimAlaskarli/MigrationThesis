#!/usr/bin/env python3
"""Convert definitive flow-level JSON into the app's country-centric JSON format.

Input shape (from finalize_reliability_json.py):
  {
    "flows": {
      "1990": {
        "USA": {
          "MEX": {
            "value": 114491,
            "reliability_label": "moderate_confidence",
            ...
          }
        }
      }
    }
  }

Output shape (for the React app):
  {
    "1990": {
      "USA": {"ti": ..., "ai": {...}, "to": ..., "ao": {...}},
      ...
    },
    "_confidence": {
      "USA-MEX": "moderate_confidence",
      ...
    },
    "_confidence_meta": {
      "evidence": {
        "USA-MEX": {"method": "iqr_over_median", ...}
      }
    },
    "_meta": {...}
  }

Writes both a 5-year and a 10-year file.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--input", required=True, help="Path to definitive_flows.json")
    p.add_argument("--out-5yr", required=True, help="Path to app-compatible 5-year JSON")
    p.add_argument("--out-10yr", required=True, help="Path to app-compatible 10-year JSON")
    p.add_argument("--include-zero-countries", action="store_true", help="Keep countries with zero ti/to")
    p.add_argument("--indent", type=int, default=2)
    return p.parse_args()


def make_country_record() -> Dict[str, Any]:
    return {"ti": 0.0, "ai": {}, "to": 0.0, "ao": {}}


def make_period_dataset() -> Dict[str, Any]:
    return {}


def add_flow(dataset: Dict[str, Any], orig: str, dest: str, value: float) -> None:
    if orig not in dataset:
        dataset[orig] = make_country_record()
    if dest not in dataset:
        dataset[dest] = make_country_record()

    # Outflow from origin
    dataset[orig]["to"] += value
    dataset[orig]["ao"][dest] = dataset[orig]["ao"].get(dest, 0.0) + value

    # Inflow to destination
    dataset[dest]["ti"] += value
    dataset[dest]["ai"][orig] = dataset[dest]["ai"].get(orig, 0.0) + value


def prune_zeros(dataset: Dict[str, Any]) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    for code, rec in dataset.items():
        ai = {k: v for k, v in rec.get("ai", {}).items() if v}
        ao = {k: v for k, v in rec.get("ao", {}).items() if v}
        ti = rec.get("ti", 0)
        to = rec.get("to", 0)
        if ti or to or ai or ao:
            out[code] = {"ti": ti, "ai": ai, "to": to, "ao": ao}
    return out


def round_nested(obj: Any) -> Any:
    if isinstance(obj, float):
        if obj.is_integer():
            return int(obj)
        return round(obj, 2)
    if isinstance(obj, dict):
        return {k: round_nested(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [round_nested(v) for v in obj]
    return obj


def build_app_dataset(payload: Dict[str, Any], years: set[str], include_zero_countries: bool) -> Dict[str, Any]:
    flows = payload.get("flows", {})
    app: Dict[str, Any] = {
        "_confidence": {},   # { period: { "ORIG-DEST": label } } — labels only for non-zero flows
        "_meta": {
            "dataset_kind": "definitive_median_iqr",
        },
    }

    for year in sorted(years, key=int):
        year_map = flows.get(year, {})
        period_dataset: Dict[str, Any] = make_period_dataset()

        period_confidence: Dict[str, Any] = {}

        for orig, orig_map in year_map.items():
            for dest, result in orig_map.items():
                # finalize step writes: final_value, confidence, ratio
                # Floor to integer — you can't migrate half a person.
                raw_value = float(result.get("final_value", 0) or 0)
                value = int(raw_value)

                if value <= 0:
                    # Zero-flow corridors never appear in the UI — no need
                    # to carry confidence labels or metadata for them.
                    continue

                label = result.get("confidence")
                key = f"{orig}-{dest}"
                if label is not None:
                    period_confidence[key] = label

                add_flow(period_dataset, orig, dest, value)

        app["_confidence"][year] = period_confidence
        app[year] = period_dataset if include_zero_countries else prune_zeros(period_dataset)

    return round_nested(app)


def main() -> None:
    args = parse_args()
    input_path = Path(args.input)
    if not input_path.exists():
        raise FileNotFoundError(f"Input not found: {input_path}")

    with input_path.open("r", encoding="utf-8") as f:
        payload = json.load(f)

    # Drop the 2010 window — out of thesis scope.
    all_years = {str(y) for y in payload.get("flows", {}).keys() if str(y).isdigit() and int(y) < 2010}
    years_5 = {y for y in all_years if int(y) % 5 == 0}
    years_10 = {y for y in all_years if int(y) % 10 == 0}

    out5 = build_app_dataset(payload, years_5, args.include_zero_countries)
    out10 = build_app_dataset(payload, years_10, args.include_zero_countries)

    out5_path = Path(args.out_5yr)
    out10_path = Path(args.out_10yr)
    out5_path.parent.mkdir(parents=True, exist_ok=True)
    out10_path.parent.mkdir(parents=True, exist_ok=True)

    with out5_path.open("w", encoding="utf-8") as f:
        json.dump(out5, f, ensure_ascii=False, indent=args.indent)
    with out10_path.open("w", encoding="utf-8") as f:
        json.dump(out10, f, ensure_ascii=False, indent=args.indent)

    print(f"[OK] wrote {out5_path}")
    print(f"[OK] wrote {out10_path}")


if __name__ == "__main__":
    main()