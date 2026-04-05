"""
Reduce gf_imr.csv — keep only the two stock/demo combos used by the app.

Keeps: sex=b, interval=5 or 10, year0 1960-2010
       wb11 + wpp2015 (World Bank source)
       un15 + wpp2015 (UN 2015 source)

USAGE:  python reduce_abel.py gf_imr.csv
OUTPUT: gf_imr_reduced.csv
"""

import pandas as pd
import sys, os

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

        mask = (
            (chunk["sex"] == "b") &
            (chunk["interval"].isin([5, 10])) &
            (chunk["year0"].isin(KEEP_YEARS)) &
            (
                ((chunk["stock"] == "wb11") & (chunk["demo"] == "wpp2015")) |
                ((chunk["stock"] == "un15") & (chunk["demo"] == "wpp2015"))
            )
        )
        filtered = chunk[mask]

        if len(filtered) > 0:
            chunks.append(filtered)
            kept += len(filtered)

    print(f"\n  Total rows read: {total:,}")
    print(f"  Kept: {kept:,}")

    if not chunks:
        print("\nERROR: No rows matched!")
        sys.exit(1)

    df = pd.concat(chunks, ignore_index=True)

    print(f"\n  Sources:")
    for (stock, demo), group in df.groupby(["stock", "demo"]):
        n5 = len(group[group["interval"] == 5])
        n10 = len(group[group["interval"] == 10])
        print(f"    {stock} + {demo}: {n5:,} (5yr) + {n10:,} (10yr)")

    print(f"  Years: {sorted(df['year0'].unique())}")

    out = "gf_imr_reduced.csv"
    df.to_csv(out, index=False)
    size_mb = os.path.getsize(out) / (1024 * 1024)
    print(f"\n  Saved: {out} ({len(df):,} rows, {size_mb:.1f} MB)")

if __name__ == "__main__":
    main()