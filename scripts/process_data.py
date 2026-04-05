"""
Process Abel's bilateral migration CSV + demographic CSVs into JSON.

OUTPUT:
  migrationData_5yr.json   — one entry per period, overlap periods have wb/un sub-keys
  migrationData_10yr.json  — same structure for 10-year intervals
  chartData.json           — unemployment, urbanization, median age

SOURCE LOGIC:
  1960-1985 (5yr) / 1960-1980 (10yr):  wb11 + wpp2015 only
  1990-1995 (5yr) / 1990 (10yr):        both wb11 and un15 (user can toggle)
  2000-2005 (5yr) / 2000 (10yr):        un15 + wpp2015 only

USAGE:
  python process_data.py
  cp migrationData_5yr.json migrationData_10yr.json chartData.json ../src/data/
"""

import pandas as pd
import numpy as np
import json, os, sys

YEARS_ALL = [1960, 1965, 1970, 1975, 1980, 1985, 1990, 1995, 2000, 2005, 2010]

# which source to use for each period
# periods not listed here won't appear in output
PERIOD_SOURCES_5YR = {
    1960: ["wb"], 1965: ["wb"], 1970: ["wb"], 1975: ["wb"],
    1980: ["wb"], 1985: ["wb"],
    1990: ["wb", "un"], 1995: ["wb", "un"],   # overlap
    2000: ["un"], 2005: ["un"],
}
PERIOD_SOURCES_10YR = {
    1960: ["wb"], 1970: ["wb"], 1980: ["wb"],
    1990: ["wb", "un"],   # overlap
    2000: ["un"],
}

SOURCE_FILTERS = {
    "wb": ("wb11", "wpp2015"),
    "un": ("un15", "wpp2015"),
}


def build_period_data(df, interval, year):
    """Build {country: {ti, to, ai, ao}} for one period from a pre-filtered df."""
    chunk = df[(df["interval"] == interval) & (df["year0"] == year)].copy()
    chunk["flow"] = pd.to_numeric(chunk["flow"], errors="coerce").fillna(0)
    chunk = chunk[chunk["flow"] > 0]
    if len(chunk) == 0:
        return {}

    result = {}
    countries = set(chunk["orig"].unique()) | set(chunk["dest"].unique())

    for c in countries:
        inc = chunk[chunk["dest"] == c]
        out = chunk[chunk["orig"] == c]
        ti = int(inc["flow"].sum())
        to = int(out["flow"].sum())

        ai = {}
        for _, r in inc.iterrows():
            f = int(r["flow"])
            if r["orig"] != c and f >= 5:
                ai[r["orig"]] = ai.get(r["orig"], 0) + f
        ao = {}
        for _, r in out.iterrows():
            f = int(r["flow"])
            if r["dest"] != c and f >= 5:
                ao[r["dest"]] = ao.get(r["dest"], 0) + f

        if ti > 0 or to > 0:
            entry = {}
            if ti > 0: entry["ti"] = ti; entry["ai"] = ai
            if to > 0: entry["to"] = to; entry["ao"] = ao
            result[c] = entry

    return result


def build_migration_json(raw_df, interval, period_sources):
    """Build the full migration JSON for one interval length."""
    output = {}

    for year, sources in sorted(period_sources.items()):
        yr_key = str(year)

        if len(sources) == 1:
            # single source — flat structure
            stock, demo = SOURCE_FILTERS[sources[0]]
            filtered = raw_df[(raw_df["stock"] == stock) & (raw_df["demo"] == demo)]
            data = build_period_data(filtered, interval, year)
            if data:
                output[yr_key] = data
                print(f"    {yr_key}: {len(data)} countries ({sources[0]})")
        else:
            # overlap — nested {wb: {...}, un: {...}}
            nested = {}
            for src in sources:
                stock, demo = SOURCE_FILTERS[src]
                filtered = raw_df[(raw_df["stock"] == stock) & (raw_df["demo"] == demo)]
                data = build_period_data(filtered, interval, year)
                if data:
                    nested[src] = data
                    print(f"    {yr_key}/{src}: {len(data)} countries")
            if nested:
                output[yr_key] = nested

    return output


def process_demographics(unemp_path, urban_path, median_path, migration_codes):
    """Same as before — build chartData.json from demographic CSVs."""
    print(f"\n  DEMOGRAPHICS")
    chart_data = {}

    if os.path.exists(unemp_path):
        unemp = pd.read_csv(unemp_path, skiprows=4)
        count = 0
        for _, row in unemp.iterrows():
            code = row.get("Country Code", "")
            if not isinstance(code, str) or len(code) != 3: continue
            vals = {}
            for yr in YEARS_ALL:
                v = row.get(str(yr))
                if pd.notna(v):
                    try: vals[str(yr)] = round(float(v), 1)
                    except: pass
            if vals:
                chart_data.setdefault(code, {})["unemployment"] = vals
                count += 1
        print(f"    Unemployment: {count} countries")

    if os.path.exists(urban_path):
        urban = pd.read_csv(urban_path, skiprows=4)
        count = 0
        for _, row in urban.iterrows():
            code = row.get("Country Code", "")
            if not isinstance(code, str) or len(code) != 3: continue
            vals = {}
            for yr in YEARS_ALL:
                v = row.get(str(yr))
                if pd.notna(v):
                    try: vals[str(yr)] = round(float(v), 1)
                    except: pass
            if vals:
                chart_data.setdefault(code, {})["urbanization"] = vals
                count += 1
        print(f"    Urbanization: {count} countries")

    med_data = {}
    if os.path.exists(median_path):
        med = pd.read_csv(median_path)
        est_col = [c for c in med.columns if "estimates" in c.lower()]
        est_col = est_col[0] if est_col else med.columns[3]
        count = 0
        for code, group in med.groupby("Code"):
            if not isinstance(code, str) or len(code) != 3: continue
            vals = {}
            for yr in YEARS_ALL:
                row = group[group["Year"] == yr]
                if len(row) > 0:
                    v = row[est_col].iloc[0]
                    if pd.notna(v): vals[str(yr)] = round(float(v), 1)
            if vals:
                chart_data.setdefault(code, {})["medianAge"] = vals
                med_data[code] = vals
                count += 1
        print(f"    Median age: {count} countries")

    real_codes = migration_codes | set(med_data.keys())
    chart_data = {k: v for k, v in chart_data.items() if k in real_codes}
    print(f"    Final: {len(chart_data)} countries")
    return chart_data


def save_json(data, path):
    with open(path, "w") as f:
        json.dump(data, f, separators=(",", ":"))
    size = os.path.getsize(path)
    unit = f"{size / 1024 / 1024:.1f} MB" if size > 1024 * 1024 else f"{size / 1024:.0f} KB"
    print(f"    {os.path.basename(path)}  ({unit})")


def main():
    d = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(d, "gf_imr_reduced.csv")

    if not os.path.exists(csv_path):
        print(f"Error: {csv_path} not found — run reduce_abel.py first")
        sys.exit(1)

    raw = pd.read_csv(csv_path)
    print(f"Loaded {len(raw):,} rows")
    print(f"Stocks: {sorted(raw['stock'].unique())}")
    print(f"Demos: {sorted(raw['demo'].unique())}")

    print(f"\n  5-YEAR INTERVALS")
    mig5 = build_migration_json(raw, 5, PERIOD_SOURCES_5YR)

    print(f"\n  10-YEAR INTERVALS")
    mig10 = build_migration_json(raw, 10, PERIOD_SOURCES_10YR)

    # collect all country codes for filtering demographics
    all_codes = set()
    for yr_data in mig5.values():
        if "wb" in yr_data or "un" in yr_data:
            for src_data in yr_data.values():
                all_codes.update(src_data.keys())
        else:
            all_codes.update(yr_data.keys())
    for yr_data in mig10.values():
        if "wb" in yr_data or "un" in yr_data:
            for src_data in yr_data.values():
                all_codes.update(src_data.keys())
        else:
            all_codes.update(yr_data.keys())

    chart_data = process_demographics(
        os.path.join(d, "unemployment.csv"),
        os.path.join(d, "urbanization.csv"),
        os.path.join(d, "median_age.csv"),
        all_codes
    )

    print(f"\n  SAVING")
    save_json(mig5, os.path.join(d, "migrationData_5yr.json"))
    save_json(mig10, os.path.join(d, "migrationData_10yr.json"))
    save_json(chart_data, os.path.join(d, "chartData.json"))

    print(f"\nDone! Copy to src/data/:")
    print(f"  cp migrationData_5yr.json migrationData_10yr.json chartData.json ../src/data/")


if __name__ == "__main__":
    main()