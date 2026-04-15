"""
Process migration and demographic data into JSON for the World Migration Atlas.

SOURCES
1. gf_imr.csv
   Abel original dataset
   We use sex=b and demo=wpp2015, with two stock inputs:
     - wb11
     - un15

2. bilat_mig.csv
   Abel IMS2024 + WPP2024 update
   We use da_min_closed.

OUTPUT
- migrationData_5yr.json
- migrationData_10yr.json
- chartData.json

STRUCTURE
- 1960-1985: wb11 only
- 1990-2000: wb11 + un15 + ims2024
- 2000-2010: un15 + ims2024
- later periods: ims2024 only
"""

import json
import os
import sys
from typing import Dict, Any, Set

import pandas as pd


YEARS_ALL = [1960, 1965, 1970, 1975, 1980, 1985, 1990, 1995, 2000, 2005, 2010, 2015]

WB_ONLY_5YR = [1960, 1965, 1970, 1975, 1980, 1985]
THREE_SOURCE_5YR = [1990, 1995]
UN_IMS_5YR = [2000, 2005]
IMS_ONLY_5YR = [2010, 2015]

WB_ONLY_10YR = [1960, 1970, 1980]
THREE_SOURCE_10YR = [1990]
UN_IMS_10YR = [2000]
IMS_ONLY_10YR = [2010]

MIN_CORRIDOR_FLOW = 5


def to_int_series(series: pd.Series) -> pd.Series:
    return pd.to_numeric(series, errors="coerce").fillna(0).round().astype(int)


def build_country_view_from_corridors(chunk: pd.DataFrame, flow_col: str) -> Dict[str, Dict[str, Any]]:
    if chunk.empty:
        return {}

    chunk = chunk.copy()
    chunk[flow_col] = to_int_series(chunk[flow_col])
    chunk = chunk[chunk[flow_col] > 0]

    if chunk.empty:
        return {}

    countries = set(chunk["orig"].dropna().unique()) | set(chunk["dest"].dropna().unique())
    result: Dict[str, Dict[str, Any]] = {}

    for country in countries:
        incoming = chunk[chunk["dest"] == country]
        outgoing = chunk[chunk["orig"] == country]

        total_in = int(incoming[flow_col].sum())
        total_out = int(outgoing[flow_col].sum())

        ai = {}
        for _, row in incoming.iterrows():
            origin = row["orig"]
            flow = int(row[flow_col])
            if origin != country and flow >= MIN_CORRIDOR_FLOW:
                ai[origin] = ai.get(origin, 0) + flow

        ao = {}
        for _, row in outgoing.iterrows():
            dest = row["dest"]
            flow = int(row[flow_col])
            if dest != country and flow >= MIN_CORRIDOR_FLOW:
                ao[dest] = ao.get(dest, 0) + flow

        if total_in > 0 or total_out > 0:
            entry = {}
            if total_in > 0:
                entry["ti"] = total_in
                entry["ai"] = ai
            if total_out > 0:
                entry["to"] = total_out
                entry["ao"] = ao
            result[country] = entry

    return result


def build_from_old_csv(df: pd.DataFrame, interval: int, year: int, stock: str) -> Dict[str, Dict[str, Any]]:
    chunk = df[
        (df["interval"] == interval) &
        (df["year0"] == year) &
        (df["stock"] == stock)
    ].copy()
    return build_country_view_from_corridors(chunk, "flow")


def build_from_new_csv(df: pd.DataFrame, year: int) -> Dict[str, Dict[str, Any]]:
    chunk = df[df["year0"] == year].copy()
    return build_country_view_from_corridors(chunk, "da_min_closed")


def merge_country_views(a: Dict[str, Any], b: Dict[str, Any]) -> Dict[str, Any]:
    countries = set(a.keys()) | set(b.keys())
    merged: Dict[str, Any] = {}

    for country in countries:
        x = a.get(country, {})
        y = b.get(country, {})

        ti = int(x.get("ti", 0)) + int(y.get("ti", 0))
        to = int(x.get("to", 0)) + int(y.get("to", 0))

        ai = dict(x.get("ai", {}))
        for k, v in y.get("ai", {}).items():
            ai[k] = ai.get(k, 0) + int(v)

        ao = dict(x.get("ao", {}))
        for k, v in y.get("ao", {}).items():
            ao[k] = ao.get(k, 0) + int(v)

        if ti > 0 or to > 0:
            entry = {}
            if ti > 0:
                entry["ti"] = ti
                entry["ai"] = ai
            if to > 0:
                entry["to"] = to
                entry["ao"] = ao
            merged[country] = entry

    return merged


def build_10yr_from_new(df: pd.DataFrame, year: int) -> Dict[str, Dict[str, Any]]:
    first = build_from_new_csv(df, year)
    second = build_from_new_csv(df, year + 5)
    return merge_country_views(first, second)


def process_demographics(unemp_path: str, urban_path: str, median_path: str, migration_codes: Set[str]) -> Dict[str, Any]:
    chart_data: Dict[str, Any] = {}

    print("\n  DEMOGRAPHICS")

    if os.path.exists(unemp_path):
        unemp = pd.read_csv(unemp_path, skiprows=4)
        count = 0
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
                    except Exception:
                        pass
            if vals:
                chart_data.setdefault(code, {})["unemployment"] = vals
                count += 1
        print(f"    Unemployment: {count} countries")

    if os.path.exists(urban_path):
        urban = pd.read_csv(urban_path, skiprows=4)
        count = 0
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
                    except Exception:
                        pass
            if vals:
                chart_data.setdefault(code, {})["urbanization"] = vals
                count += 1
        print(f"    Urbanization: {count} countries")

    if os.path.exists(median_path):
        med = pd.read_csv(median_path)
        est_cols = [c for c in med.columns if "estimate" in c.lower()]
        est_col = est_cols[0] if est_cols else med.columns[-1]
        count = 0

        for code, group in med.groupby("Code"):
            if not isinstance(code, str) or len(code) != 3:
                continue
            vals = {}
            for yr in YEARS_ALL:
                row = group[group["Year"] == yr]
                if not row.empty:
                    v = row[est_col].iloc[0]
                    if pd.notna(v):
                        try:
                            vals[str(yr)] = round(float(v), 1)
                        except Exception:
                            pass
            if vals:
                chart_data.setdefault(code, {})["medianAge"] = vals
                count += 1
        print(f"    Median age: {count} countries")

    chart_data = {k: v for k, v in chart_data.items() if k in migration_codes}
    print(f"    Final: {len(chart_data)} countries")
    return chart_data


def save_json(data: Dict[str, Any], path: str) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, separators=(",", ":"), ensure_ascii=False)
    size = os.path.getsize(path)
    unit = f"{size / 1024 / 1024:.1f} MB" if size > 1024 * 1024 else f"{size / 1024:.0f} KB"
    print(f"    {os.path.basename(path)} ({unit})")


def sanity_check(data: Dict[str, Any], label: str) -> None:
    checks = [
        ("SVK", "CZE", "SVK→CZE"),
        ("MEX", "USA", "MEX→USA"),
        ("TUR", "DEU", "TUR→DEU"),
    ]
    print(f"    Checks ({label}):")
    for orig, dest, name in checks:
        for yr in sorted(k for k in data.keys() if not k.startswith("_")):
            year_block = data[yr]
            if isinstance(year_block, dict) and any(src in year_block for src in ["wb", "un", "ims"]):
                for src in ["wb", "un", "ims"]:
                    val = year_block.get(src, {}).get(dest, {}).get("ai", {}).get(orig, 0)
                    if val:
                        print(f"      {name} {yr}/{src}: {val:,}")
            else:
                val = year_block.get(dest, {}).get("ai", {}).get(orig, 0)
                if val:
                    print(f"      {name} {yr}: {val:,}")


def main() -> None:
    d = os.path.dirname(os.path.abspath(__file__))

    old_csv = os.path.join(d, "gf_imr.csv")
    new_csv = os.path.join(d, "bilat_mig.csv")

    if not os.path.exists(old_csv):
        print(f"Error: missing {old_csv}")
        sys.exit(1)
    if not os.path.exists(new_csv):
        print(f"Error: missing {new_csv}")
        sys.exit(1)

    print("Loading old dataset (gf_imr.csv)...")
    old_chunks = []
    total = 0
    for chunk in pd.read_csv(old_csv, chunksize=500_000):
        total += len(chunk)
        print(f"  scanned {total:,} rows...", end="\r")
        filtered = chunk[
            (chunk["stock"].isin(["wb11", "un15"])) &
            (chunk["demo"] == "wpp2015") &
            (chunk["sex"] == "b")
        ].copy()
        if not filtered.empty:
            old_chunks.append(filtered)

    old_df = pd.concat(old_chunks, ignore_index=True) if old_chunks else pd.DataFrame()
    if old_df.empty:
        print("Error: filtered old dataset is empty")
        sys.exit(1)

    print(f"  Old dataset: {len(old_df):,} filtered rows")

    print("Loading new dataset (bilat_mig.csv)...")
    new_df = pd.read_csv(new_csv)
    if "da_min_closed" not in new_df.columns:
        print("Error: bilat_mig.csv must contain da_min_closed")
        sys.exit(1)
    print(f"  New dataset: {len(new_df):,} rows")

    all_codes: Set[str] = set()

    print("\n  5-YEAR INTERVALS")
    mig5: Dict[str, Any] = {}

    for yr in WB_ONLY_5YR:
        data = build_from_old_csv(old_df, 5, yr, "wb11")
        if data:
            mig5[str(yr)] = data
            all_codes.update(data.keys())
            print(f"    {yr}: {len(data)} countries (wb11)")

    for yr in THREE_SOURCE_5YR:
        wb_data = build_from_old_csv(old_df, 5, yr, "wb11")
        un_data = build_from_old_csv(old_df, 5, yr, "un15")
        ims_data = build_from_new_csv(new_df, yr)
        block = {}
        if wb_data:
            block["wb"] = wb_data
            all_codes.update(wb_data.keys())
        if un_data:
            block["un"] = un_data
            all_codes.update(un_data.keys())
        if ims_data:
            block["ims"] = ims_data
            all_codes.update(ims_data.keys())
        if block:
            mig5[str(yr)] = block
            print(f"    {yr}: wb11={len(wb_data)} / un15={len(un_data)} / ims2024={len(ims_data)} countries")

    for yr in UN_IMS_5YR:
        un_data = build_from_old_csv(old_df, 5, yr, "un15")
        ims_data = build_from_new_csv(new_df, yr)
        block = {}
        if un_data:
            block["un"] = un_data
            all_codes.update(un_data.keys())
        if ims_data:
            block["ims"] = ims_data
            all_codes.update(ims_data.keys())
        if block:
            mig5[str(yr)] = block
            print(f"    {yr}: un15={len(un_data)} / ims2024={len(ims_data)} countries")

    for yr in IMS_ONLY_5YR:
        data = build_from_new_csv(new_df, yr)
        if data:
            mig5[str(yr)] = data
            all_codes.update(data.keys())
            print(f"    {yr}: {len(data)} countries (ims2024)")

    mig5["_meta"] = {
        "interval": 5,
        "source_labels": {
            "wb": "WB 2011 stock tables",
            "un": "UN 2015 stock tables",
            "ims": "IMS 2024 (da_min_closed)"
        },
        "year_source_options": {
            "1990": ["wb", "un", "ims"],
            "1995": ["wb", "un", "ims"],
            "2000": ["un", "ims"],
            "2005": ["un", "ims"],
            "2010": ["ims"],
            "2015": ["ims"]
        },
        "min_corridor_flow": MIN_CORRIDOR_FLOW
    }

    sanity_check(mig5, "5yr")

    print("\n  10-YEAR INTERVALS")
    mig10: Dict[str, Any] = {}

    for yr in WB_ONLY_10YR:
        data = build_from_old_csv(old_df, 10, yr, "wb11")
        if data:
            mig10[str(yr)] = data
            all_codes.update(data.keys())
            print(f"    {yr}: {len(data)} countries (wb11)")

    for yr in THREE_SOURCE_10YR:
        wb_data = build_from_old_csv(old_df, 10, yr, "wb11")
        un_data = build_from_old_csv(old_df, 10, yr, "un15")
        ims_data = build_10yr_from_new(new_df, yr)
        block = {}
        if wb_data:
            block["wb"] = wb_data
            all_codes.update(wb_data.keys())
        if un_data:
            block["un"] = un_data
            all_codes.update(un_data.keys())
        if ims_data:
            block["ims"] = ims_data
            all_codes.update(ims_data.keys())
        if block:
            mig10[str(yr)] = block
            print(f"    {yr}: wb11={len(wb_data)} / un15={len(un_data)} / ims2024={len(ims_data)} countries")

    for yr in UN_IMS_10YR:
        un_data = build_from_old_csv(old_df, 10, yr, "un15")
        ims_data = build_10yr_from_new(new_df, yr)
        block = {}
        if un_data:
            block["un"] = un_data
            all_codes.update(un_data.keys())
        if ims_data:
            block["ims"] = ims_data
            all_codes.update(ims_data.keys())
        if block:
            mig10[str(yr)] = block
            print(f"    {yr}: un15={len(un_data)} / ims2024={len(ims_data)} countries")

    for yr in IMS_ONLY_10YR:
        data = build_10yr_from_new(new_df, yr)
        if data:
            mig10[str(yr)] = data
            all_codes.update(data.keys())
            print(f"    {yr}: {len(data)} countries (ims2024)")

    mig10["_meta"] = {
        "interval": 10,
        "source_labels": {
            "wb": "WB 2011 stock tables",
            "un": "UN 2015 stock tables",
            "ims": "IMS 2024 (da_min_closed, aggregated from two 5-year periods)"
        },
        "year_source_options": {
            "1990": ["wb", "un", "ims"],
            "2000": ["un", "ims"],
            "2010": ["ims"]
        },
        "min_corridor_flow": MIN_CORRIDOR_FLOW
    }

    sanity_check(mig10, "10yr")

    chart_data = process_demographics(
        os.path.join(d, "unemployment.csv"),
        os.path.join(d, "urbanization.csv"),
        os.path.join(d, "median_age.csv"),
        all_codes
    )

    print("\n  SAVING")
    save_json(mig5, os.path.join(d, "migrationData_5yr.json"))
    save_json(mig10, os.path.join(d, "migrationData_10yr.json"))
    save_json(chart_data, os.path.join(d, "chartData.json"))

    print("\nDone.")
    print("Copy outputs into src/data/ if that is still your workflow.")


if __name__ == "__main__":
    main()
