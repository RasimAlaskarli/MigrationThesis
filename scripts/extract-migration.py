import pandas as pd
import json

# European destination country ISO-3 codes (you can adjust this list if needed)
EUROPEAN_COUNTRIES = [
    'AUT', 'BEL', 'BGR', 'HRV', 'CYP', 'CZE', 'DNK', 'EST', 'FIN', 'FRA',
    'DEU', 'GRC', 'HUN', 'IRL', 'ITA', 'LVA', 'LTU', 'LUX', 'MLT', 'NLD',
    'POL', 'PRT', 'ROU', 'SVK', 'SVN', 'ESP', 'SWE', 'GBR', 'NOR', 'CHE',
    'ISL', 'ALB', 'MKD', 'SRB', 'BIH', 'MNE'
]

# Map a subset of ISO-3 codes to nice display names.
# For non-European origins, we keep the ISO-3 code (e.g., USA, CHN) unless you extend this mapping.
ISO_TO_NAME = {
    'DEU': 'Germany', 'FRA': 'France', 'BEL': 'Belgium', 'NLD': 'Netherlands',
    'ITA': 'Italy', 'ESP': 'Spain', 'POL': 'Poland', 'AUT': 'Austria',
    'GBR': 'United Kingdom', 'SWE': 'Sweden', 'NOR': 'Norway', 'DNK': 'Denmark',
    'FIN': 'Finland', 'PRT': 'Portugal', 'GRC': 'Greece', 'CHE': 'Switzerland',
    'CZE': 'Czech Republic', 'HUN': 'Hungary', 'ROU': 'Romania', 'BGR': 'Bulgaria',
    'HRV': 'Croatia', 'SVK': 'Slovakia', 'SVN': 'Slovenia', 'IRL': 'Ireland',
    'LTU': 'Lithuania', 'LVA': 'Latvia', 'EST': 'Estonia', 'LUX': 'Luxembourg',
    'CYP': 'Cyprus', 'MLT': 'Malta', 'ISL': 'Iceland', 'ALB': 'Albania',
    'MKD': 'North Macedonia', 'SRB': 'Serbia', 'BIH': 'Bosnia and Herzegovina',
    'MNE': 'Montenegro'
}

INPUT_CSV = "gf_imr.csv"
OUTPUT_JSON = "migration_data_worldwide_to_europe_1960_2010.json"

TARGET_INTERVAL = 5
VALID_DEMOS = {"wpp2012", "wpp2010"}
DEMO_PRIORITY = {"wpp2012": 2, "wpp2010": 1}

print("Starting migration data extraction...")
print(f"Input: {INPUT_CSV}")
print("Filters: DEST in Europe, ORIG any, sex='b', demo in {wpp2012,wpp2010}, interval=5, years 1960-2010")
print("-" * 60)

chunk_size = 100000
filtered_chunks = []

for i, chunk in enumerate(pd.read_csv(INPUT_CSV, chunksize=chunk_size)):
    print(f"Processing chunk {i+1}... (rows processed: {(i+1) * chunk_size})")

    # Your CSV uses:
    # - 'dest' and 'orig' as ISO-3 strings
    # - 'dest_code'/'orig_code' as numeric codes
    interval = pd.to_numeric(chunk["interval"], errors="coerce")

    filtered = chunk[
        (chunk["sex"].astype(str) == "b") &
        (interval == TARGET_INTERVAL) &
        (chunk["dest"].astype(str).isin(EUROPEAN_COUNTRIES)) &
        (chunk["demo"].astype(str).isin(VALID_DEMOS)) &
        (chunk["year0"] >= 1960) &
        (chunk["year0"] <= 2010)
    ]

    if len(filtered) > 0:
        filtered_chunks.append(filtered)
        print(f"  → Found {len(filtered)} matching rows in this chunk")

if not filtered_chunks:
    print("\n❌ No matching data found!")
    print("Double-check: does gf_imr.csv contain interval=5 rows with demo=wpp2010/wpp2012 and European destinations?")
    raise SystemExit(1)

df = pd.concat(filtered_chunks, ignore_index=True)
print(f"\n✅ Total rows after filtering: {len(df)}")

print("\nSelecting best source per (orig, dest, year0, interval) with non-zero fallback...")

# Fallback rule:
# - Prefer wpp2012 over wpp2010
# - BUT if preferred has flow==0 and alternative has >0 for same key, take the >0 row.
df["_demo_priority"] = df["demo"].map(DEMO_PRIORITY).fillna(0).astype(int)
df["_nonzero_flow"] = pd.to_numeric(df["flow"], errors="coerce").fillna(0).gt(0).astype(int)

# Sort so non-zero wins first, then higher demo priority wins
df_sorted = df.sort_values(["_nonzero_flow", "_demo_priority"], ascending=False)

# Deduplicate within the same interval (important even though we filtered to 5 — keeps logic correct)
df_dedup = df_sorted.drop_duplicates(
    subset=["orig", "dest", "year0", "interval"],
    keep="first"
).copy()

df_dedup.drop(columns=["_demo_priority", "_nonzero_flow"], inplace=True)

print(f"After deduplication: {len(df_dedup)} rows")

print("\nAggregating flows...")
result = (
    df_dedup
    .groupby(["orig", "dest", "year0"], as_index=False)["flow"]
    .sum()
)

print("\nBuilding JSON (year -> destination -> origin -> flow)...")
migration_by_year = {}

for _, row in result.iterrows():
    year = int(row["year0"])
    orig_iso = str(row["orig"])
    dest_iso = str(row["dest"])
    flow = int(pd.to_numeric(row["flow"], errors="coerce") or 0)

    # Destination: pretty names for Europe
    dest_name = ISO_TO_NAME.get(dest_iso, dest_iso)
    # Origin: pretty name if known, otherwise keep ISO-3
    orig_name = ISO_TO_NAME.get(orig_iso, orig_iso)

    migration_by_year.setdefault(year, {}).setdefault(dest_name, {})[orig_name] = flow

with open(OUTPUT_JSON, "w") as f:
    json.dump(migration_by_year, f, indent=2)

print(f"\n✅ SUCCESS! Data saved to: {OUTPUT_JSON}")
print(f"Years included: {min(migration_by_year.keys())}..{max(migration_by_year.keys())} ({len(migration_by_year)} years)")
print("Done.")