import json
import re
from pathlib import Path

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
        rows.append(
            {
                "Entity": ci.get("entity") or "N/A",
                "Entity-Long": ci.get("entity_long"),
                "Full Document Symbol": r["full_document_symbol"],
                "Description": r.get("description"),
            }
        )

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


def find_mentioning_paragraph_indices(paras, entity_short, entity_long):
    """Find indices of paragraphs mentioning entity."""
    if not paras:
        return []
    patterns = []
    if entity_short:
        patterns.append(
            re.compile(r"\b" + re.escape(entity_short) + r"\b", re.IGNORECASE)
        )
    if entity_long:
        patterns.append(
            re.compile(r"\b" + re.escape(entity_long) + r"\b", re.IGNORECASE)
        )
    if not patterns:
        return []
    return [
        i
        for i, p in enumerate(paras)
        if p.get("text") and p.get("type") != "heading" and any(pat.search(p["text"]) for pat in patterns)
    ]


# Create paragraphs directory
paras_dir = Path("public/data/paragraphs")
paras_dir.mkdir(parents=True, exist_ok=True)


def load_paragraphs(symbol):
    """Load paragraphs from saved file."""
    safe_symbol = symbol.replace("/", "_").replace(" ", "_")
    para_file = paras_dir / f"{safe_symbol}.json"
    if para_file.exists():
        with open(para_file) as f:
            return json.load(f)
    return []

# Augment ppb records
action_count = 0
mentions_count = 0
docs_with_paras = 0

for record in ppb:
    symbol = record.get("full_document_symbol")
    entities = record.get("entities") or []
    paras = record.get("paragraphs") or []

    # Save paragraphs to separate file if they exist
    if paras:
        safe_symbol = symbol.replace("/", "_").replace(" ", "_")
        with open(paras_dir / f"{safe_symbol}.json", "w") as f:
            json.dump(paras, f, ensure_ascii=False)
        docs_with_paras += 1

    # Recurrence actions
    recurrence_actions = []
    for entity in entities:
        key = (symbol, entity)
        if key in recurrence_lookup:
            recurrence_actions.append({"entity": entity, **recurrence_lookup[key]})
    if recurrence_actions:
        record["recurrence_actions"] = recurrence_actions
        action_count += 1

    # Remove paragraphs from main data (they're now in separate files)
    if "paragraphs" in record:
        del record["paragraphs"]

print(f"Records with recurrence actions: {action_count}")
print(f"Documents with paragraphs saved: {docs_with_paras}")

# Load LLM relevance data
llm_relevance_dir = Path("data/intermediate/llm_relevance")
llm_data_by_symbol = {}
if llm_relevance_dir.exists():
    for llm_file in llm_relevance_dir.glob("*.json"):
        with open(llm_file) as f:
            llm_data_by_symbol[llm_file.stem] = json.load(f)

print(f"\n=== BUILDING UNIFIED RELEVANCE ===")
print(f"LLM relevance files loaded: {len(llm_data_by_symbol)}")

# Build unified entity_relevance: combines mentions + LLM into one structure
relevance_count = 0
for record in ppb:
    symbol = record.get("full_document_symbol")
    safe_symbol = symbol.replace("/", "_").replace(" ", "_")
    entities = record.get("entities") or []
    paras = load_paragraphs(symbol)
    llm_data = llm_data_by_symbol.get(safe_symbol, {})

    entity_relevance = {}
    for entity in entities:
        entity_long = entity_long_lookup.get(entity, "")
        
        # Get mention indices
        mention_indices = set(find_mentioning_paragraph_indices(paras, entity, entity_long))
        
        # Get LLM relevance for this entity
        llm_items = llm_data.get(entity, [])
        llm_indices = {item["paragraph_index"] for item in llm_items}
        llm_comments = {item["paragraph_index"]: item["relevance_comment"] for item in llm_items}
        
        # Combine indices
        all_indices = sorted(mention_indices | llm_indices)
        
        if all_indices:
            entity_relevance[entity] = {
                "indices": all_indices,
                "ai_comments": llm_comments,  # Only for LLM-identified ones
            }
    
    if entity_relevance:
        record["entity_relevance"] = entity_relevance
        relevance_count += 1

print(f"Records with entity relevance: {relevance_count}")

with open("public/data/ppb2026_augmented.json", "w") as f:
    json.dump(ppb, f, indent=2, ensure_ascii=False)
