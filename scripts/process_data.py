"""
Process raw data files into JSON for the World Migration Atlas app.

INPUT FILES (place in same directory):
  - gf_imr_reduced.csv     (Abel bilateral migration, reduced — both 5yr and 10yr)
  - unemployment.csv        (World Bank)
  - urbanization.csv        (World Bank)
  - median_age.csv          (UN/Our World in Data)

OUTPUT FILES:
  - migrationData_5yr.json  (bilateral flows, 5-year intervals, 1960-2005)
  - migrationData_10yr.json (bilateral flows, 10-year intervals, 1960-2000)
  - chartData.json          (unemployment, urbanization, median age)

USAGE:
  python process_data.py

METHODOLOGY:
  Migration data uses percentage-based filtering across multiple source estimates.
  For each origin-destination-year flow:
    - Drop any source estimate below 5% of the maximum estimate for that corridor
    - Average the remaining non-zero estimates
  This filters out sources that clearly missed a flow while adapting to the
  scale of each corridor (unlike a fixed threshold).
"""

import pandas as pd
import numpy as np
import json
import os
import sys

YEARS_5YR = [1960, 1965, 1970, 1975, 1980, 1985, 1990, 1995, 2000, 2005]
YEARS_10YR = [1960, 1970, 1980, 1990, 2000]
YEARS_ALL = [1960, 1965, 1970, 1975, 1980, 1985, 1990, 1995, 2000, 2005, 2010]
FILTER_PCT = 0.05  # drop sources below 5% of the max estimate for each corridor


def smart_avg(values):
    """Average migration flow values with percentage-based filtering.
    
    Drops any value below 5% of the maximum value in the group,
    then averages the remaining non-zero values.
    """
    values = [v for v in values if v > 0]
    if not values:
        return 0
    max_val = max(values)
    threshold = max_val * FILTER_PCT
    filtered = [v for v in values if v >= threshold]
    if filtered:
        return int(round(np.mean(filtered)))
    else:
        return int(round(np.mean(values)))


def process_migration(csv_path, interval, years):
    """Process Abel's bilateral migration CSV into JSON for a given interval."""
    label = f"{interval}-YEAR"
    print(f"\n{'='*50}")
    print(f"PROCESSING MIGRATION DATA ({label})")
    print(f"{'='*50}")

    df = pd.read_csv(csv_path)
    df["flow"] = pd.to_numeric(df["flow"], errors="coerce").fillna(0)
    
    # Filter to the requested interval
    df = df[df["interval"] == interval]
    print(f"  Rows for {label} interval: {len(df):,}")
    
    if len(df) == 0:
        print(f"  WARNING: No {label} data found!")
        return {}

    print(f"  Years: {sorted(df['year0'].unique())}")
    print(f"  Sources: {df.groupby(['stock','demo']).ngroups}")

    # Group by (orig, dest, year) and collect all source values
    grouped = df.groupby(["orig", "dest", "year0"])["flow"].apply(list).reset_index()
    print(f"  Unique flows: {len(grouped):,}")

    # Apply smart averaging
    grouped["avg_flow"] = grouped["flow"].apply(smart_avg)
    grouped = grouped[grouped["avg_flow"] > 0]
    print(f"  Non-zero averaged flows: {len(grouped):,}")

    # Build JSON structure: { year: { country: { ti, to, ai, ao } } }
    migration = {}

    for yr in sorted(grouped["year0"].unique()):
        yr_int = int(yr)
        if yr_int not in years:
            continue
        yr_key = str(yr_int)
        yr_data = grouped[grouped["year0"] == yr]
        migration[yr_key] = {}

        all_countries = set(yr_data["orig"].unique()) | set(yr_data["dest"].unique())

        for country in all_countries:
            incoming = yr_data[yr_data["dest"] == country]
            outgoing = yr_data[yr_data["orig"] == country]

            ti = int(incoming["avg_flow"].sum())
            to_val = int(outgoing["avg_flow"].sum())

            ai = {}
            for _, r in incoming.iterrows():
                if r["orig"] != country and r["avg_flow"] >= 5:
                    ai[r["orig"]] = r["avg_flow"]

            ao = {}
            for _, r in outgoing.iterrows():
                if r["dest"] != country and r["avg_flow"] >= 5:
                    ao[r["dest"]] = r["avg_flow"]

            if ti > 0 or to_val > 0:
                entry = {}
                if ti > 0:
                    entry["ti"] = ti
                    entry["ai"] = ai
                if to_val > 0:
                    entry["to"] = to_val
                    entry["ao"] = ao
                migration[yr_key][country] = entry

    # Sanity checks
    print(f"\n  Sanity checks:")
    checks = [
        ("SVK", "CZE", "Slovakia -> Czech Republic"),
        ("KAZ", "DEU", "Kazakhstan -> Germany"),
        ("TUR", "DEU", "Turkey -> Germany"),
        ("MAR", "FRA", "Morocco -> France"),
        ("MEX", "USA", "Mexico -> USA"),
        ("DEU", "CZE", "Germany -> Czech Republic"),
    ]
    for orig, dest, label in checks:
        for yr_key in sorted(migration.keys()):
            val = migration.get(yr_key, {}).get(dest, {}).get("ai", {}).get(orig, 0)
            if val > 0:
                print(f"    {label} ({yr_key}): {val:,}")

    return migration


def process_demographics(unemp_path, urban_path, median_path, migration_codes):
    """Process World Bank and UN demographic CSVs into JSON."""
    print(f"\n{'='*50}")
    print("PROCESSING DEMOGRAPHICS")
    print(f"{'='*50}")

    chart_data = {}

    # 1. Unemployment (World Bank format, 4 header rows to skip)
    if os.path.exists(unemp_path):
        unemp = pd.read_csv(unemp_path, skiprows=4)
        unemp_data = {}
        for _, row in unemp.iterrows():
            code = row.get("Country Code", "")
            if not isinstance(code, str) or len(code) != 3:
                continue
            vals = {}
            for yr in YEARS_ALL:
                v = row.get(str(yr))
                if pd.notna(v):
                    try:
                        vals[str(yr)] = round(float(v), 1)
                    except:
                        pass
            if vals:
                unemp_data[code] = vals
        print(f"  Unemployment: {len(unemp_data)} countries")
        for code, vals in unemp_data.items():
            if code not in chart_data:
                chart_data[code] = {}
            chart_data[code]["unemployment"] = vals
    else:
        print(f"  Unemployment: {unemp_path} not found, skipping")

    # 2. Urbanization (World Bank format)
    if os.path.exists(urban_path):
        urban = pd.read_csv(urban_path, skiprows=4)
        urban_data = {}
        for _, row in urban.iterrows():
            code = row.get("Country Code", "")
            if not isinstance(code, str) or len(code) != 3:
                continue
            vals = {}
            for yr in YEARS_ALL:
                v = row.get(str(yr))
                if pd.notna(v):
                    try:
                        vals[str(yr)] = round(float(v), 1)
                    except:
                        pass
            if vals:
                urban_data[code] = vals
        print(f"  Urbanization: {len(urban_data)} countries")
        for code, vals in urban_data.items():
            if code not in chart_data:
                chart_data[code] = {}
            chart_data[code]["urbanization"] = vals
    else:
        print(f"  Urbanization: {urban_path} not found, skipping")

    # 3. Median age (Our World in Data / UN format)
    if os.path.exists(median_path):
        med = pd.read_csv(median_path)
        est_col = [c for c in med.columns if "estimates" in c.lower()]
        est_col = est_col[0] if est_col else med.columns[3]
        med_data = {}
        for code, group in med.groupby("Code"):
            if not isinstance(code, str) or len(code) != 3:
                continue
            vals = {}
            for yr in YEARS_ALL:
                row = group[group["Year"] == yr]
                if len(row) > 0:
                    v = row[est_col].iloc[0]
                    if pd.notna(v):
                        vals[str(yr)] = round(float(v), 1)
            if vals:
                med_data[code] = vals
        print(f"  Median age: {len(med_data)} countries")
        for code, vals in med_data.items():
            if code not in chart_data:
                chart_data[code] = {}
            chart_data[code]["medianAge"] = vals
    else:
        print(f"  Median age: {median_path} not found, skipping")

    # Filter to real countries (those in migration data or UN median age data)
    real_codes = migration_codes | set(med_data.keys() if os.path.exists(median_path) else [])
    chart_data = {k: v for k, v in chart_data.items() if k in real_codes}

    has3 = sum(1 for c in chart_data.values() if len(c) == 3)
    has2 = sum(1 for c in chart_data.values() if len(c) == 2)
    has1 = sum(1 for c in chart_data.values() if len(c) == 1)
    print(f"\n  Final: {len(chart_data)} countries ({has3} with all 3 metrics, {has2} with 2, {has1} with 1)")

    return chart_data


def main():
    # Find input files - look in same directory as script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    migration_csv = os.path.join(script_dir, "gf_imr_reduced.csv")
    unemp_csv = os.path.join(script_dir, "unemployment.csv")
    urban_csv = os.path.join(script_dir, "urbanization.csv")
    median_csv = os.path.join(script_dir, "median_age.csv")

    if not os.path.exists(migration_csv):
        print(f"Error: {migration_csv} not found")
        print("Run reduce_abel.py first to generate the reduced migration CSV.")
        sys.exit(1)

    # Process 5-year migration
    migration_5yr = process_migration(migration_csv, interval=5, years=YEARS_5YR)

    # Process 10-year migration
    migration_10yr = process_migration(migration_csv, interval=10, years=YEARS_10YR)

    # Collect all country codes from both datasets
    migration_codes = set()
    for yr in migration_5yr:
        migration_codes.update(migration_5yr[yr].keys())
    for yr in migration_10yr:
        migration_codes.update(migration_10yr[yr].keys())

    # Process demographics
    chart_data = process_demographics(unemp_csv, urban_csv, median_csv, migration_codes)

    # Save outputs
    print(f"\n{'='*50}")
    print("SAVING OUTPUT FILES")
    print(f"{'='*50}")

    out_dir = script_dir

    # 5-year migration
    mig5_path = os.path.join(out_dir, "migrationData_5yr.json")
    with open(mig5_path, "w") as f:
        json.dump(migration_5yr, f, separators=(",", ":"))
    mig5_size = os.path.getsize(mig5_path) / (1024 * 1024)
    print(f"  {mig5_path} ({mig5_size:.1f} MB)")

    # 10-year migration
    mig10_path = os.path.join(out_dir, "migrationData_10yr.json")
    with open(mig10_path, "w") as f:
        json.dump(migration_10yr, f, separators=(",", ":"))
    mig10_size = os.path.getsize(mig10_path) / (1024 * 1024)
    print(f"  {mig10_path} ({mig10_size:.1f} MB)")

    # Also save combined as migrationData.json for backward compatibility
    mig_path = os.path.join(out_dir, "migrationData.json")
    with open(mig_path, "w") as f:
        json.dump(migration_5yr, f, separators=(",", ":"))
    print(f"  {mig_path} (copy of 5yr, for backward compatibility)")

    # Chart data
    chart_path = os.path.join(out_dir, "chartData.json")
    with open(chart_path, "w") as f:
        json.dump(chart_data, f, separators=(",", ":"))
    chart_size = os.path.getsize(chart_path) / 1024
    print(f"  {chart_path} ({chart_size:.0f} KB)")

    print(f"\nDone!")


if __name__ == "__main__":
    main()