"""
Add confidence tags to migration data JSON files — PER PERIOD, PER CORRIDOR.

For each period that has multiple sources, compares IMS 2024 against the
closest of WB 2011 / UN 2015 for every corridor individually.

STRUCTURE in JSON:
  "_confidence": {
    "1990": { "DEU-USA": "unreliable", "FRA-DZA": "uncertain", ... },
    "1995": { ... },
    ...
  }
  Only non-reliable corridors are stored (to keep size down).
  If a corridor is absent for a period, it's reliable or below the min flow.

LEVELS:
  reliable:   ratio < 5x  (not stored — absence = reliable)
  uncertain:  ratio 5-10x
  unreliable: ratio >= 10x

USAGE:
  python add_confidence.py
  cp migrationData_5yr.json migrationData_10yr.json ../src/data/
"""

import json
import csv
import os
import sys

RATIO_RELIABLE = 5
RATIO_UNCERTAIN = 10
MIN_FLOW_FOR_TAG = 100

IMS_KEY = "ims"
OTHER_KEYS = ["wb", "un"]


def extract_corridors(year_data):
    corridors = {}
    for country, info in year_data.items():
        for partner, flow in info.get("ai", {}).items():
            key = f"{partner}-{country}"
            corridors[key] = corridors.get(key, 0) + flow
    return corridors


def classify_period(year_data):
    """
    For a single period, compare IMS against closest other source per corridor.
    Returns:
      flagged: { "DEU-USA": "unreliable", ... }  (only non-reliable)
      evidence: { "DEU-USA": { ims, closest_src, closest_val, ratio }, ... }
      stats: { reliable, uncertain, unreliable, reliable_flow, total_flow, ... }
    """
    if IMS_KEY not in year_data:
        return {}, {}, None

    available_others = [k for k in OTHER_KEYS if k in year_data]
    if not available_others:
        return {}, {}, None

    ims_corridors = extract_corridors(year_data[IMS_KEY])
    other_corridors = {
        k: extract_corridors(year_data[k]) for k in available_others
    }

    flagged = {}
    evidence = {}
    counts = {"reliable": 0, "uncertain": 0, "unreliable": 0}
    flows = {"reliable": 0, "uncertain": 0, "unreliable": 0}
    total_flow = 0

    for key, ims_val in ims_corridors.items():
        if ims_val < MIN_FLOW_FOR_TAG:
            continue

        total_flow += ims_val

        # gather other source values
        other_vals = {}
        for src in available_others:
            v = other_corridors[src].get(key, 0)
            if v > 0:
                other_vals[src] = v

        if not other_vals:
            # no reference — treat as reliable (absence of evidence)
            counts["reliable"] += 1
            flows["reliable"] += ims_val
            continue

        # find closest other source
        closest_src = min(other_vals, key=lambda s: max(ims_val / other_vals[s], other_vals[s] / ims_val))
        closest_val = other_vals[closest_src]
        ratio = max(ims_val / closest_val, closest_val / ims_val)

        if ratio < RATIO_RELIABLE:
            level = "reliable"
        elif ratio < RATIO_UNCERTAIN:
            level = "uncertain"
        else:
            level = "unreliable"

        counts[level] += 1
        flows[level] += ims_val

        if level != "reliable":
            flagged[key] = level
            evidence[key] = {
                "ims": ims_val,
                "closest_src": closest_src,
                "closest_val": closest_val,
                "ratio": round(ratio, 1),
                "all_sources": {IMS_KEY: ims_val, **other_vals}
            }

    stats = {
        "counts": counts,
        "flows": flows,
        "total_flow": total_flow,
        "total_corridors": sum(counts.values())
    }
    return flagged, evidence, stats


def process_file(data_path, overlap_years, label, report_lines, script_dir):
    if not os.path.exists(data_path):
        print(f"  Error: {data_path} not found")
        return False

    with open(data_path) as f:
        data = json.load(f)

    data.pop("_confidence", None)

    confidence_by_year = {}
    all_evidence = {}  # for CSV: { "1990|DEU-USA": {...} }
    grand_counts = {"reliable": 0, "uncertain": 0, "unreliable": 0}
    grand_flows = {"reliable": 0, "uncertain": 0, "unreliable": 0}
    grand_total_flow = 0

    for yr in overlap_years:
        year_data = data.get(yr, {})
        flagged, evidence, stats = classify_period(year_data)

        if flagged:
            confidence_by_year[yr] = flagged

        for key, ev in evidence.items():
            all_evidence[f"{yr}|{key}"] = {"year": yr, "corridor": key, **ev}

        if stats:
            for level in ["reliable", "uncertain", "unreliable"]:
                grand_counts[level] += stats["counts"][level]
                grand_flows[level] += stats["flows"][level]
            grand_total_flow += stats["total_flow"]

    # print report
    header = f"\n{'='*65}\n  {label.upper()}\n{'='*65}"
    print(header)
    report_lines.append(header)

    grand_total_corridors = sum(grand_counts.values())

    sub = f"\n  Corridor-period counts (across all overlap years):"
    print(sub); report_lines.append(sub)
    for level in ["reliable", "uncertain", "unreliable"]:
        c = grand_counts[level]
        pct = c / max(grand_total_corridors, 1) * 100
        line = f"    {level:<13} {c:>6}  ({pct:.1f}%)"
        print(line); report_lines.append(line)
    line = f"    {'TOTAL':<13} {grand_total_corridors:>6}"
    print(line); report_lines.append(line)

    sub = f"\n  Flow-weighted breakdown:"
    print(sub); report_lines.append(sub)
    for level in ["reliable", "uncertain", "unreliable"]:
        flow = grand_flows[level]
        pct = flow / max(grand_total_flow, 1) * 100
        line = f"    {level:<13} {flow:>14,}  ({pct:.1f}%)"
        print(line); report_lines.append(line)
    line = f"    {'TOTAL':<13} {grand_total_flow:>14,}"
    print(line); report_lines.append(line)

    reliable_pct = grand_flows["reliable"] / max(grand_total_flow, 1) * 100
    flagged_pct = 100 - reliable_pct
    summary = f"\n  Summary: {reliable_pct:.1f}% of migration flow is reliable, {flagged_pct:.1f}% is flagged"
    print(summary); report_lines.append(summary)

    # per-year breakdown
    sub = f"\n  Per-year flagged corridors:"
    print(sub); report_lines.append(sub)
    for yr in overlap_years:
        flagged = confidence_by_year.get(yr, {})
        from collections import Counter
        c = Counter(flagged.values())
        n_unc = c.get("uncertain", 0)
        n_sus = c.get("unreliable", 0)
        total = n_unc + n_sus
        line = f"    {yr}: {total:>4} flagged  (uncertain={n_unc}, unreliable={n_sus})"
        print(line); report_lines.append(line)

    # write flagged CSV
    basename = os.path.basename(data_path).replace("migrationData_", "flagged_corridors_").replace(".json", ".csv")
    csv_path = os.path.join(script_dir, basename)
    write_flagged_csv(csv_path, all_evidence)
    n_flagged = len(all_evidence)
    line = f"\n  Flagged corridor-periods: {n_flagged} → {basename}"
    print(line); report_lines.append(line)

    # patch JSON
    data["_confidence"] = confidence_by_year
    with open(data_path, "w") as f:
        json.dump(data, f, separators=(",", ":"))

    size = os.path.getsize(data_path)
    unit = f"{size / 1024 / 1024:.1f} MB" if size > 1024 * 1024 else f"{size / 1024:.0f} KB"
    line = f"  Patched: {os.path.basename(data_path)} ({unit})"
    print(line); report_lines.append(line)

    return True


def write_flagged_csv(path, all_evidence):
    rows = []
    for compound_key, ev in all_evidence.items():
        orig, dest = ev["corridor"].split("-", 1)
        sources = ev.get("all_sources", {})
        rows.append({
            "year": ev["year"],
            "corridor": ev["corridor"],
            "origin": orig,
            "destination": dest,
            "confidence": "unreliable" if ev["ratio"] >= RATIO_UNCERTAIN else "uncertain",
            "ims_value": sources.get("ims", ""),
            "wb_value": sources.get("wb", ""),
            "un_value": sources.get("un", ""),
            "closest_source": ev.get("closest_src", ""),
            "closest_value": ev.get("closest_val", ""),
            "ratio": ev.get("ratio", ""),
        })

    rows.sort(key=lambda x: (
        x["year"],
        {"unreliable": 0, "uncertain": 1}.get(x["confidence"], 2),
        -(x["ims_value"] or 0)
    ))

    fieldnames = ["year", "corridor", "origin", "destination", "confidence",
                  "ims_value", "wb_value", "un_value", "closest_source", "closest_value", "ratio"]

    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def main():
    d = os.path.dirname(os.path.abspath(__file__))
    report_lines = []

    header = [
        "=" * 65,
        "  CONFIDENCE REPORT (per-period, per-corridor)",
        f"  Method: compare IMS 2024 against closest of WB 2011 / UN 2015",
        f"  Reliable < {RATIO_RELIABLE}x | Uncertain {RATIO_RELIABLE}-{RATIO_UNCERTAIN}x | Unreliable >= {RATIO_UNCERTAIN}x",
        f"  Min flow to tag: {MIN_FLOW_FOR_TAG}",
        "=" * 65,
    ]
    for line in header:
        print(line); report_lines.append(line)

    ok5 = process_file(
        os.path.join(d, "migrationData_5yr.json"),
        overlap_years=["1990", "1995", "2000", "2005"],
        label="5-year intervals",
        report_lines=report_lines,
        script_dir=d
    )

    ok10 = process_file(
        os.path.join(d, "migrationData_10yr.json"),
        overlap_years=["1990", "2000"],
        label="10-year intervals",
        report_lines=report_lines,
        script_dir=d
    )

    report_path = os.path.join(d, "confidence_report.txt")
    with open(report_path, "w") as f:
        f.write("\n".join(report_lines) + "\n")
    print(f"\n  Report saved: confidence_report.txt")

    if ok5 or ok10:
        print(f"\n  Next: cp migrationData_5yr.json migrationData_10yr.json ../src/data/")


if __name__ == "__main__":
    main()