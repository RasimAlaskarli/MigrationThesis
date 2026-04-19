#!/usr/bin/env python3
import argparse
import json
import math
from statistics import median


def median_of_sorted(values):
    n = len(values)
    if n == 0:
        return None
    mid = n // 2
    if n % 2 == 1:
        return values[mid]
    return (values[mid - 1] + values[mid]) / 2.0


def quartiles_median_of_halves(values):
    vals = sorted(values)
    n = len(vals)
    if n == 0:
        return None, None, None

    med = median_of_sorted(vals)
    if n == 1:
        return vals[0], vals[0], vals[0]

    mid = n // 2
    if n % 2 == 0:
        lower = vals[:mid]
        upper = vals[mid:]
    else:
        lower = vals[:mid]
        upper = vals[mid + 1:]

    q1 = median_of_sorted(lower) if lower else vals[0]
    q3 = median_of_sorted(upper) if upper else vals[-1]
    return q1, med, q3


def confidence_label(ratio, retained_count):
    if retained_count < 2:
        return "insufficient_evidence"
    if ratio < 0.75:
        return "high_confidence"
    if ratio < 1.5:
        return "moderate_confidence"
    return "low_confidence"


def safe_float(x):
    try:
        if x is None:
            return None
        return float(x)
    except (TypeError, ValueError):
        return None


def retained_values_for_entry(entry, threshold):
    retained = []

    old_values = entry.get("old_values", [])
    for item in old_values:
        if isinstance(item, dict):
            # build_combined_json.py writes these under the "flow" key
            v = safe_float(item.get("flow"))
        else:
            v = safe_float(item)
        if v is not None and v >= threshold:
            retained.append(v)

    new_values = entry.get("new_values", {})
    if isinstance(new_values, dict):
        for _, raw in new_values.items():
            v = safe_float(raw)
            if v is not None and v >= threshold:
                retained.append(v)

    return sorted(retained)


def finalize_entry(year, orig, dest, entry, threshold):
    retained = retained_values_for_entry(entry, threshold)
    retained_count = len(retained)

    result = {
        "year": str(year),
        "orig": orig,
        "dest": dest,
        "threshold": threshold,
        "retained_count": retained_count,
        "retained_values": retained,
    }

    if retained_count == 0:
        result.update({
            "final_value": 0,
            "q1": None,
            "median": None,
            "q3": None,
            "iqr": None,
            "ratio": None,
            "confidence": "insufficient_evidence",
        })
        return result

    q1, med, q3 = quartiles_median_of_halves(retained)
    iqr = q3 - q1 if q1 is not None and q3 is not None else None
    ratio = (iqr / med) if (iqr is not None and med not in (None, 0)) else None
    label = confidence_label(ratio if ratio is not None else math.inf, retained_count)

    result.update({
        "final_value": med if med is not None else 0,
        "q1": q1,
        "median": med,
        "q3": q3,
        "iqr": iqr,
        "ratio": ratio,
        "confidence": label,
    })
    return result


def main():
    parser = argparse.ArgumentParser(description="Finalize combined migration JSON into definitive flow values and confidence labels.")
    parser.add_argument("--input", required=True, help="Path to combined_flows.json")
    parser.add_argument("--output", required=True, help="Path to write definitive_flows.json")
    parser.add_argument("--threshold", type=float, default=100.0, help="Minimum retained value threshold (default: 100)")
    args = parser.parse_args()

    with open(args.input, "r", encoding="utf-8") as f:
        data = json.load(f)

    definitive = {
        "_meta": {
            "threshold": args.threshold,
            "confidence_rule": {
                "high_confidence": "IQR/median < 0.75",
                "moderate_confidence": "0.75 <= IQR/median < 1.5",
                "low_confidence": "IQR/median >= 1.5",
                "insufficient_evidence": "fewer than 2 retained values"
            }
        },
        "flows": {}
    }

    total = 0
    flows_in = data.get("flows", data)  # support both wrapped and raw input
    for year, year_block in flows_in.items():
        if isinstance(year, str) and year.startswith("_"):
            continue
        if not isinstance(year_block, dict):
            continue

        definitive["flows"][str(year)] = {}
        for orig, orig_block in year_block.items():
            if not isinstance(orig_block, dict):
                continue
            definitive["flows"][str(year)][orig] = {}
            for dest, entry in orig_block.items():
                if not isinstance(entry, dict):
                    continue
                definitive["flows"][str(year)][orig][dest] = finalize_entry(year, orig, dest, entry, args.threshold)
                total += 1

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(definitive, f, ensure_ascii=False, separators=(",", ":"))

    print(f"[OK] wrote {args.output} ({total} flows)")


if __name__ == "__main__":
    main()