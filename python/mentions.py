
# Find paragraphs mentioning entity using word boundary matching
def find_mentioning_paragraphs(paras, entity_short, entity_long):
    if not paras:
        return None
    
    # Build regex patterns with word boundaries
    # For short names (acronyms), require word boundaries on both sides
    # For long names, also use word boundaries to avoid partial matches
    patterns = []
    if entity_short:
        # Use word boundary \b to avoid matching "DESA" in "desalination"
        patterns.append(re.compile(r'\b' + re.escape(entity_short) + r'\b', re.IGNORECASE))
    if entity_long:
        # Also use word boundaries for long names
        patterns.append(re.compile(r'\b' + re.escape(entity_long) + r'\b', re.IGNORECASE))
    
    if not patterns:
        return None
    
    matches = []
    for p in paras:
        text = p.get('text') or ''
        if not text:
            continue
        # Check if any pattern matches
        if any(pattern.search(text) for pattern in patterns):
            matches.append(p)
    
    return matches if matches else None

# Build entity_long lookup from airtable
entity_long_lookup = dict(zip(df['Entity'], df['Entity-Long']))

# Augment each record
action_count = 0
mentions_count = 0
for record in ppb:
    symbol = normalize_symbol(record.get('document_symbol'))
    entities = record.get('entities') or []
    paras = record.get('paragraphs') or []
    
    # Add entity_mentioning_paragraphs for ALL records (per entity)
    entity_mentions = {}
    for entity in entities:
        entity_long = entity_long_lookup.get(entity, '')
        mentioning = find_mentioning_paragraphs(paras, entity, entity_long)
        if mentioning:
            entity_mentions[entity] = mentioning
    if entity_mentions:
        record['entity_mentioning_paragraphs'] = entity_mentions
        mentions_count += 1
    
    # Add recurrence_actions only for outdated citations
    recurrence_actions = []
    for entity in entities:
        key = (symbol, entity)
        if key in recurrence_lookup:
            recurrence_actions.append({'entity': entity, **recurrence_lookup[key]})
    if recurrence_actions:
        record['recurrence_actions'] = recurrence_actions
        action_count += 1

print(f"Records with recurrence actions: {action_count}")
print(f"Records with entity mentions: {mentions_count}")

# Save
output_path = DATA_DIR / "output/ppb2026_unique_mandates_with_metadata.json"
with open(output_path, 'w') as f:
    json.dump(ppb, f, indent=2, ensure_ascii=False)
print(f"Saved to {output_path}")

# Copy to dashboard
dashboard_path = DATA_DIR.parent / "../un80-dashboard/data/ppb2026_unique_mandates_with_metadata.json"
try:
    shutil.copy(output_path, dashboard_path)
    print(f"Copied to {dashboard_path}")
except Exception as e:
    print(f"Could not copy to dashboard: {e}")
