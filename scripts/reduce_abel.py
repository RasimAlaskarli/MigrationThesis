"""
Reduce gf_imr.csv — keep ALL sources for both 5-year and 10-year intervals.

Keeps: sex=b, interval=5 or 10, year0 1960-2010, ALL stock/demo combos

USAGE:  python reduce_abel.py gf_imr.csv
OUTPUT: gf_imr_reduced.csv (contains both 5-year and 10-year data)
"""

import pandas as pd
import sys
import os

KEEP_YEARS = {1960, 1965, 1970, 1975, 1980, 1985, 1990, 1995, 2000, 2005, 2010}

def main():
    if len(sys.argv) < 2:
        print("Usage: python reduce_abel.py gf_imr.csv")
        sys.exit(1)

    f = sys.argv[1]
    print(f"Reading {f}...")

    chunks = []
    total = 0
    kept = 0

    for chunk in pd.read_csv(f, chunksize=500_000):
        total += len(chunk)
        print(f"  Read {total:,} rows...", end="\r")

        chunk = chunk[
            (chunk["sex"] == "b") &
            (chunk["interval"].isin([5, 10])) &
            (chunk["year0"].isin(KEEP_YEARS))
        ]

        if len(chunk) > 0:
            chunks.append(chunk)
            kept += len(chunk)

    print(f"\n  Total rows: {total:,}")
    print(f"  Kept: {kept:,}")

    if not chunks:
        print("\nERROR: No rows matched!")
        sys.exit(1)

    df = pd.concat(chunks, ignore_index=True)

    combos = df.groupby(["stock", "demo", "interval"]).size().reset_index(name="n")
    print(f"\n  All stock/demo/interval combos:")
    for _, r in combos.iterrows():
        print(f"    {r['stock']}/{r['demo']}/interval={r['interval']}: {r['n']:,} rows")

    print(f"  Years: {sorted(df['year0'].unique())}")
    print(f"  5-year rows: {len(df[df['interval'] == 5]):,}")
    print(f"  10-year rows: {len(df[df['interval'] == 10]):,}")

    out_file = "gf_imr_reduced.csv"
    df.to_csv(out_file, index=False)
    size_mb = os.path.getsize(out_file) / (1024 * 1024)
    print(f"\n  Saved: {out_file} ({len(df):,} rows, {size_mb:.1f} MB)")

if __name__ == "__main__":
    main()