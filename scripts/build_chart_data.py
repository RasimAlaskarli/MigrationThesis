"""
Build chartData.json from demographic source CSVs.

Inputs expected in the same directory:
- unemployment.csv   (World Bank format, skip first 4 rows)
- urbanization.csv   (World Bank format, skip first 4 rows)
- population.csv     (World Bank format, skip first 4 rows)
- median_age.csv     (Our World in Data / UN style)

Output:
- chartData.json
"""

import json
import os
from typing import Dict, Any

import pandas as pd


YEARS_ALL = [1960, 1965, 1970, 1975, 1980, 1985, 1990, 1995, 2000, 2005, 2010, 2015]


def load_world_bank_series(path: str, field_name: str, as_int: bool = False) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    if not os.path.exists(path):
        print(f"    Skipping missing file: {os.path.basename(path)}")
        return out

    df = pd.read_csv(path, skiprows=4)
    count = 0

    for _, row in df.iterrows():
        code = row.get("Country Code", "")
        if not isinstance(code, str) or len(code) != 3:
            continue

        vals = {}
        for yr in YEARS_ALL:
            v = row.get(str(yr))
            if pd.notna(v):
                try:
                    num = float(v)
                    vals[str(yr)] = int(round(num)) if as_int else round(num, 1)
                except Exception:
                    pass

        if vals:
            out.setdefault(code, {})[field_name] = vals
            count += 1

    print(f"    {field_name}: {count} countries")
    return out


def load_median_age(path: str) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    if not os.path.exists(path):
        print(f"    Skipping missing file: {os.path.basename(path)}")
        return out

    df = pd.read_csv(path)
    est_cols = [c for c in df.columns if "estimate" in c.lower()]
    est_col = est_cols[0] if est_cols else df.columns[-1]
    count = 0

    for code, group in df.groupby("Code"):
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
            out.setdefault(code, {})["medianAge"] = vals
            count += 1

    print(f"    medianAge: {count} countries")
    return out


def merge_series(*parts: Dict[str, Any]) -> Dict[str, Any]:
    merged: Dict[str, Any] = {}
    for part in parts:
        for code, data in part.items():
            merged.setdefault(code, {}).update(data)
    return merged


def main() -> None:
    d = os.path.dirname(os.path.abspath(__file__))

    print("Building chartData.json...")
    unemployment = load_world_bank_series(os.path.join(d, "unemployment.csv"), "unemployment")
    urbanization = load_world_bank_series(os.path.join(d, "urbanization.csv"), "urbanization")
    population = load_world_bank_series(os.path.join(d, "population.csv"), "population", as_int=True)
    median_age = load_median_age(os.path.join(d, "median_age.csv"))

    chart_data = merge_series(unemployment, urbanization, population, median_age)

    out_path = os.path.join(d, "chartData.json")
    with open(out_path, "w", encoding="utf-8") as f:
      json.dump(chart_data, f, separators=(",", ":"), ensure_ascii=False)

    print(f"    Final: {len(chart_data)} countries")
    print(f"    Wrote {out_path}")


if __name__ == "__main__":
    main()
