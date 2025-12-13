import json
import re

import pandas as pd


def normalize_symbol(s):
    if pd.isna(s) or not s:
        return s
    s = str(s)
    s = re.sub(r"\s+\(", "(", s)
    s = s.replace("–", "-").replace("—", "-")
    s = re.sub(r"\s+([A-C])$", r"\1", s)
    s = re.sub(r"\s+([A-C]-[A-C])$", r"\1", s)
    return s


# Load ppb2026 and expand to one row per citation
# TODO generate fresh version of this data via un80-docs-processing
with open("data/input/ppb2026_unique_mandates_with_metadata.json") as f:
    ppb = json.load(f)

rows = []
for r in ppb:
    for ci in r.get("citation_info", []):
        rows.append({
            "Entity": ci.get("entity") or "N/A",
            "Entity-Long": ci.get("entity_long"),
            "Full Document Symbol": r["full_document_symbol"],
            "Description": r.get("description"),
        })

df = pd.DataFrame(rows)


recurrence = pd.read_csv("data/input/all_resolutions_recurrence.csv")

# Normalize symbols
df["symbol_normalized"] = df["Full Document Symbol"].apply(normalize_symbol)
recurrence["symbol_normalized"] = recurrence["original_symbol"].apply(normalize_symbol)

# Join with recurrence data
merged = df.merge(
    recurrence[
        [
            "symbol_normalized",
            "group_title",
            "year",
            "is_recurring",
            "series_symbol_count",
        ]
    ],
    on="symbol_normalized",
    how="left",
)
print(
    f"Merged: {len(merged)} rows, {merged['group_title'].notna().sum()} with recurrence data"
)

# Add latest year/symbol per group
latest_per_group = (
    recurrence.sort_values("year", ascending=False)
    .groupby("group_title")
    .first()[["year", "symbol_normalized"]]
    .rename(columns={"year": "latest_year", "symbol_normalized": "latest_symbol"})
)
merged = merged.merge(latest_per_group, on="group_title", how="left")

# Add entity's max year and newest symbol per group
entity_stats = (
    merged[merged["group_title"].notna()]
    .sort_values("year", ascending=False)
    .groupby(["Entity", "group_title"])
    .agg(
        entity_max_year=("year", "max"),
        entity_newest_symbol=("symbol_normalized", "first"),
    )
    .reset_index()
)
merged = merged.merge(entity_stats, on=["Entity", "group_title"], how="left")

# Flags
merged["is_recurrent"] = merged["is_recurring"] | (merged["series_symbol_count"] > 1)
merged["has_newer_available"] = merged["year"] < merged["latest_year"]
merged["entity_cites_newer"] = merged["year"] < merged["entity_max_year"]

# Analysis
recurrent = merged[merged["is_recurrent"] == True]
not_latest = merged[(merged["is_recurrent"]) & (merged["has_newer_available"])]
b1 = merged[
    (merged["is_recurrent"])
    & (merged["has_newer_available"])
    & (merged["entity_cites_newer"])
]
b2 = merged[
    (merged["is_recurrent"])
    & (merged["has_newer_available"])
    & (~merged["entity_cites_newer"])
]

print(f"\n=== RECURRENCE ANALYSIS ===")
print(
    f"a) Recurrent citations: {len(recurrent)} ({recurrent['symbol_normalized'].nunique()} unique)"
)
print(
    f"b) Not latest: {len(not_latest)} ({not_latest['symbol_normalized'].nunique()} unique)"
)
print(
    f"b1) Entity cites newer (DROP): {len(b1)} ({b1['symbol_normalized'].nunique()} unique)"
)
print(
    f"b2) Newer available (UPDATE): {len(b2)} ({b2['symbol_normalized'].nunique()} unique)"
)


# Build export with newer_cited_symbols and latest_symbol
# For each (entity, cited_symbol), collect all newer symbols cited by the same entity in same group
def get_newer_cited_symbols(df, entity, group, year):
    """Get all symbols cited by entity in same group that are newer than year"""
    newer = df[
        (df["Entity"] == entity) & (df["group_title"] == group) & (df["year"] > year)
    ]
    return newer["symbol_normalized"].tolist()


export_rows = []
for _, row in not_latest.iterrows():
    newer_cited = get_newer_cited_symbols(
        merged, row["Entity"], row["group_title"], row["year"]
    )
    export_rows.append(
        {
            "entity": row["Entity"],
            "entity_long": row["Entity-Long"],
            "cited_symbol": row["Full Document Symbol"],
            "cited_year": row["year"],
            "group_title": row["group_title"],
            "newer_cited_symbols": newer_cited,  # List of newer symbols already cited by entity
            "latest_symbol": row["latest_symbol"],  # The latest in the recurrence group
            "description": row["Description"],
        }
    )

export = pd.DataFrame(export_rows)
export = export.sort_values(["entity", "group_title"])

export.to_json(
    "data/output/ppb_outdated_citations.json",
    orient="records",
    indent=2,
    force_ascii=False,
)
print(f"\n{len(export)} outdated citations")
print(
    f"  - With newer already cited: {(export['newer_cited_symbols'].apply(len) > 0).sum()}"
)
print(
    f"  - Without newer cited: {(export['newer_cited_symbols'].apply(len) == 0).sum()}"
)


print("\n=== AUGMENTING PPB JSON ===")

# Build lookup for recurrence info by (symbol, entity)
recurrence_lookup = {}
for _, row in export.iterrows():
    key = (row["cited_symbol"], row["entity"])
    recurrence_lookup[key] = {
        "newer_cited_symbols": row["newer_cited_symbols"],
        "latest_symbol": row["latest_symbol"],
        "group_title": row["group_title"],
    }

# Entity long lookup
entity_long_lookup = dict(zip(df["Entity"], df["Entity-Long"]))


def find_mentioning_paragraphs(paras, entity_short, entity_long):
    """Find paragraphs mentioning entity using word boundary matching."""
    if not paras:
        return None
    patterns = []
    if entity_short:
        patterns.append(re.compile(r"\b" + re.escape(entity_short) + r"\b", re.IGNORECASE))
    if entity_long:
        patterns.append(re.compile(r"\b" + re.escape(entity_long) + r"\b", re.IGNORECASE))
    if not patterns:
        return None
    matches = [p for p in paras if p.get("text") and any(pat.search(p["text"]) for pat in patterns)]
    return matches or None


# Augment ppb records with recurrence_actions and entity_mentioning_paragraphs
action_count = 0
mentions_count = 0
for record in ppb:
    symbol = record.get("full_document_symbol")
    entities = record.get("entities") or []
    paras = record.get("paragraphs") or []

    # Recurrence actions
    recurrence_actions = []
    for entity in entities:
        key = (symbol, entity)
        if key in recurrence_lookup:
            recurrence_actions.append({"entity": entity, **recurrence_lookup[key]})
    if recurrence_actions:
        record["recurrence_actions"] = recurrence_actions
        action_count += 1

    # Entity mentioning paragraphs
    entity_mentions = {}
    for entity in entities:
        entity_long = entity_long_lookup.get(entity, "")
        mentioning = find_mentioning_paragraphs(paras, entity, entity_long)
        if mentioning:
            entity_mentions[entity] = mentioning
    if entity_mentions:
        record["entity_mentioning_paragraphs"] = entity_mentions
        mentions_count += 1

print(f"Records with recurrence actions: {action_count}")
print(f"Records with entity mentions: {mentions_count}")

with open("public/data/ppb2026_augmented.json", "w") as f:
    json.dump(ppb, f, indent=2, ensure_ascii=False)
