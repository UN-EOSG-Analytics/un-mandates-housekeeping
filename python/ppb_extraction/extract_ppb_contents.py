import csv
import json
import re
from pathlib import Path

from natsort import natsorted
from tqdm import tqdm


def load_section_to_entity_mapping(csv_path: str) -> dict[str, str]:
    """Load section title to entity long name mapping from CSV."""
    mapping = {}
    try:
        with open(csv_path, "r") as f:
            reader = csv.DictReader(f)
            for row in reader:
                mapping[row["section_title"]] = row["entity_long"]
    except FileNotFoundError:
        print(f"Warning: Mapping file not found: {csv_path}")
    return mapping


def load_entity_abbreviations(csv_path: str) -> dict[str, str]:
    """Load entity long name to abbreviation mapping from CSV."""
    mapping = {}
    try:
        with open(csv_path, "r") as f:
            reader = csv.DictReader(f)
            for row in reader:
                entity = row["entity_long"]
                abbrev = row["entity_abbrev"]
                if entity and abbrev:
                    mapping[entity] = abbrev
    except FileNotFoundError:
        print(f"Warning: Abbreviations file not found: {csv_path}")
    return mapping


def normalize_entity_name(name: str) -> str:
    """Normalize entity name (clean up whitespace and special chars)."""
    if not name:
        return "unknown"
    # Remove leading roman numerals and numbers (e.g., "I.\tOffice..." or "1.\tGeneral Assembly")
    name = re.sub(r"^[IVXLCDM]+\.\s*", "", name)
    name = re.sub(r"^[0-9]+\.\s*", "", name)
    # Replace tabs and multiple spaces with single space
    name = re.sub(r"\s+", " ", name).strip()
    return name


def normalize_apostrophes(s: str) -> str:
    """Normalize various apostrophe characters to straight apostrophe."""
    # Replace curly apostrophes (U+2019, U+2018) with straight apostrophe
    return s.replace("\u2019", "'").replace("\u2018", "'")


def get_entity_abbreviation(entity_name: str, abbreviations: dict[str, str]) -> str:
    """Get abbreviation for entity name, for use as filename."""
    # Normalize apostrophes for lookup
    normalized = normalize_apostrophes(entity_name)
    
    # Check abbreviations mapping
    if normalized in abbreviations:
        return abbreviations[normalized]
    if entity_name in abbreviations:
        return abbreviations[entity_name]
    
    # Fallback: make filename-safe version of entity name
    safe_name = re.sub(r'[<>:"/\\|?*]', "_", entity_name)
    return safe_name


def has_entity_children(block: dict) -> bool:
    """Check if a block has direct entity children."""
    for child in block.get("children", []):
        if child["block_type"] == "entity":
            return True
    return False


def find_entities_in_document(data: list[dict]) -> list[tuple[str, dict]]:
    """
    Find all entity blocks in a document.
    Returns list of (entity_name, entity_block) tuples.
    
    Note: Non-entity headers (like "Resource overview") are now filtered
    during parsing in parse_ppb_docs.py, so entity-group blocks here are real entities.
    """
    entities = []
    for block in data:
        if block["block_type"] == "entity":
            entities.append((block["text"], block))
        elif block["block_type"] == "entity-group":
            if has_entity_children(block):
                # Container with entity children - extract the children
                for child in block.get("children", []):
                    if child["block_type"] == "entity":
                        entities.append((child["text"], child))
            else:
                # This entity-group IS an entity (e.g., "I. Office of Legal Affairs")
                entities.append((block["text"], block))
        elif block.get("children"):
            entities.extend(find_entities_in_block(block))
    return entities


def find_entities_in_block(block: dict) -> list[tuple[str, dict]]:
    """Recursively find entity blocks within a block."""
    entities = []
    for child in block.get("children", []):
        if child["block_type"] == "entity":
            entities.append((child["text"], child))
        elif child["block_type"] == "entity-group":
            if has_entity_children(child):
                for subchild in child.get("children", []):
                    if subchild["block_type"] == "entity":
                        entities.append((subchild["text"], subchild))
            else:
                entities.append((child["text"], child))
        elif child.get("children"):
            entities.extend(find_entities_in_block(child))
    return entities


def get_section_title_from_frontmatter(data: list[dict]) -> str | None:
    """Extract section title from frontmatter."""
    for block in data:
        if block["block_type"] == "frontmatter":
            for child in block.get("children", []):
                if child["block_type"] == "heading" and child["text"].startswith("Section"):
                    for subchild in child.get("children", []):
                        if subchild["block_type"] == "heading-x":
                            # Normalize non-breaking spaces and other whitespace
                            title = re.sub(r"\s+", " ", subchild["text"]).strip()
                            return title
    return None


def get_content_blocks(data: list[dict]) -> list[dict]:
    """Extract content blocks from a document, excluding frontmatter."""
    content_blocks = []
    for block in data:
        if block["block_type"] in ("frontmatter", "annex"):
            continue
        content_blocks.append(block)
    return content_blocks


# Mapping for single-mission SPM files that don't have entity blocks
FILENAME_TO_ENTITY = {
    "UNAMA": "United Nations Assistance Mission in Afghanistan",
    "UNAMI": "United Nations Assistance Mission for Iraq",
}


def is_skip_file(file_name: str) -> bool:
    """Check if file should be skipped."""
    skip_indicators = ["PLANOUTLINE", "INCOMESECT", "CHAPEAU", "CORR"]
    return any(ind in file_name.upper() for ind in skip_indicators)


def get_entity_from_filename(file_name: str) -> str | None:
    """Extract entity name from filename for single-mission SPM files."""
    for acronym, entity_name in FILENAME_TO_ENTITY.items():
        if f"_{acronym}_" in file_name.upper() or f"_{acronym}." in file_name.upper():
            return entity_name
    return None


def extract_content_by_entity(year: int):
    """Extract PPB content grouped by entity."""
    input_dir = Path(f"data/intermediate/ppb{year}/json_by_document")
    output_dir = Path(f"data/intermediate/ppb{year}/json_by_entity")
    output_dir.mkdir(parents=True, exist_ok=True)

    # Load mappings from CSVs
    section_to_entity = load_section_to_entity_mapping(
        "data/references/section_to_entity_mapping.csv"
    )
    abbreviations = load_entity_abbreviations(
        "data/references/entity_abbreviations.csv"
    )

    # Collect all content by entity (keyed by abbreviation)
    entity_content: dict[str, dict] = {}

    files = list(input_dir.glob("*.json"))
    q = tqdm(natsorted(files), desc="Processing files")

    for file in q:
        q.set_description(f"Processing: {file.name}")

        if is_skip_file(file.name):
            print(f"Skipping: {file.name}")
            continue

        with open(file, "r") as f:
            data = json.load(f)

        entities = find_entities_in_document(data)

        if entities:
            # Document has explicit entity blocks
            for entity_name, entity_block in entities:
                normalized_name = normalize_entity_name(entity_name)
                abbrev = get_entity_abbreviation(normalized_name, abbreviations)
                if abbrev not in entity_content:
                    entity_content[abbrev] = {
                        "entity": normalized_name,
                        "entity_abbrev": abbrev,
                        "entity_raw_name": entity_name,
                        "source_file": file.name,
                        "content": entity_block["children"],
                    }
        else:
            # Single-entity document - try filename first, then section title
            entity_name = get_entity_from_filename(file.name)
            section_title = get_section_title_from_frontmatter(data)
            
            if not entity_name:
                if not section_title:
                    section_title = file.stem
                    print(f"Warning: No section title in {file.name}")
                entity_name = section_to_entity.get(section_title, section_title)
            
            content_blocks = get_content_blocks(data)

            normalized_name = normalize_entity_name(entity_name)
            abbrev = get_entity_abbreviation(normalized_name, abbreviations)
            if abbrev not in entity_content:
                entity_content[abbrev] = {
                    "entity": normalized_name,
                    "entity_abbrev": abbrev,
                    "entity_raw_name": entity_name,
                    "section_title": section_title,
                    "source_file": file.name,
                    "content": content_blocks,
                }

    # Write output files (filename = abbreviation)
    print(f"\nFound {len(entity_content)} unique entities")
    for abbrev, entity_data in tqdm(
        entity_content.items(), desc="Writing entity files"
    ):
        output_file = output_dir / f"{abbrev}.json"
        with open(output_file, "w") as f:
            json.dump(entity_data, f, indent=2, ensure_ascii=False)

    print(f"Output written to: {output_dir}")
    return entity_content


def generate_section_mapping(input_json: str, output_csv: str):
    """Generate section to entity mapping CSV from mandates metadata."""
    with open(input_json, "r") as f:
        data = json.load(f)

    section_to_entity = {}
    for item in data:
        for citation in item.get("citation_info", []):
            section_title = citation.get("section_title")
            entity = citation.get("entity")
            entity_long = citation.get("entity_long")
            if section_title and entity_long:
                # Normalize whitespace in section title
                section_title = re.sub(r"\s+", " ", section_title).strip()
                if section_title not in section_to_entity:
                    section_to_entity[section_title] = set()
                section_to_entity[section_title].add((entity, entity_long))

    # Filter to only sections with a single entity
    single_entity_sections = {}
    for section, entities in section_to_entity.items():
        if len(entities) == 1:
            entity_short, entity_long = list(entities)[0]
            single_entity_sections[section] = (entity_short, entity_long)

    Path(output_csv).parent.mkdir(parents=True, exist_ok=True)
    with open(output_csv, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["section_title", "entity_short", "entity_long"])
        for section in sorted(single_entity_sections.keys()):
            entity_short, entity_long = single_entity_sections[section]
            writer.writerow([section, entity_short, entity_long])

    print(f"Wrote {len(single_entity_sections)} mappings to {output_csv}")


def generate_entity_abbreviations(year: int, output_csv: str):
    """Generate entity abbreviations CSV by extracting all unique entities from parsed documents."""
    input_dir = Path(f"data/intermediate/ppb{year}/json_by_document")
    
    # Load existing section mapping for section-based entities
    section_to_entity = load_section_to_entity_mapping(
        "data/references/section_to_entity_mapping.csv"
    )
    
    # Also load entity_short from section mapping
    section_entity_abbrevs = {}
    try:
        with open("data/references/section_to_entity_mapping.csv", "r") as f:
            reader = csv.DictReader(f)
            for row in reader:
                section_entity_abbrevs[row["entity_long"]] = row["entity_short"]
    except FileNotFoundError:
        pass
    
    # Collect all unique entity names
    all_entities = set()
    
    files = list(input_dir.glob("*.json"))
    print(f"Scanning {len(files)} files for entity names...")
    
    for file in tqdm(natsorted(files), desc="Extracting entities"):
        if is_skip_file(file.name):
            continue
            
        with open(file, "r") as f:
            data = json.load(f)
        
        # Get entities from entity blocks
        entities = find_entities_in_document(data)
        for entity_name, _ in entities:
            normalized = normalize_entity_name(entity_name)
            # Also normalize apostrophes for consistent lookup
            normalized = normalize_apostrophes(normalized)
            all_entities.add(normalized)
        
        # If no entity blocks, get from section title
        if not entities:
            entity_name = get_entity_from_filename(file.name)
            section_title = get_section_title_from_frontmatter(data)
            
            if not entity_name:
                if section_title:
                    entity_name = section_to_entity.get(section_title, section_title)
                else:
                    entity_name = file.stem
            
            normalized = normalize_entity_name(entity_name)
            normalized = normalize_apostrophes(normalized)
            all_entities.add(normalized)
    
    # Load existing abbreviations if file exists
    existing_abbrevs = {}
    try:
        existing_abbrevs = load_entity_abbreviations(output_csv)
    except Exception:
        pass
    
    # Generate output
    Path(output_csv).parent.mkdir(parents=True, exist_ok=True)
    with open(output_csv, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["entity_long", "entity_abbrev"])
        
        for entity in sorted(all_entities):
            # Use existing abbreviation if available
            if entity in existing_abbrevs:
                abbrev = existing_abbrevs[entity]
            elif entity in section_entity_abbrevs:
                abbrev = section_entity_abbrevs[entity]
            else:
                # Default: use entity name (can be manually edited later)
                abbrev = ""
            writer.writerow([entity, abbrev])
    
    print(f"Wrote {len(all_entities)} entities to {output_csv}")
    print(f"Please review and fill in missing abbreviations in the CSV file.")


if __name__ == "__main__":
    import os
    import sys

    year = int(os.getenv("YEAR", "2026"))

    if len(sys.argv) > 1:
        if sys.argv[1] == "--generate-mapping":
            generate_section_mapping(
                f"data/input/ppb{year}_unique_mandates_with_metadata.json",
                "data/references/section_to_entity_mapping.csv",
            )
        elif sys.argv[1] == "--generate-abbreviations":
            generate_entity_abbreviations(
                year,
                "data/references/entity_abbreviations.csv",
            )
        elif sys.argv[1].isdigit():
            year = int(sys.argv[1])
            print(f"Extracting PPB content by entity for year {year}...")
            extract_content_by_entity(year)
        else:
            print(f"Unknown argument: {sys.argv[1]}")
            print("Usage: extract_ppb_contents.py [year]")
            print("       extract_ppb_contents.py --generate-mapping")
            print("       extract_ppb_contents.py --generate-abbreviations")
    else:
        print(f"Extracting PPB content by entity for year {year}...")
        extract_content_by_entity(year)
