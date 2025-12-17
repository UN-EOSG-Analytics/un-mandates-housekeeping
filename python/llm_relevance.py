"""
LLM-based paragraph relevance analysis using OpenAI gpt-5-mini.

Identifies which paragraphs in mandate documents are explicitly relevant
to each entity's PPB-described work (objectives, deliverables, strategy).
"""

import argparse
import asyncio
import json
import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from joblib import Memory
from openai import AsyncAzureOpenAI
from pydantic import BaseModel
from tqdm.asyncio import tqdm_asyncio

# Load environment variables
load_dotenv()

# Paths
DATA_DIR = Path(__file__).parent.parent / "data"
PPB_ENTITIES_DIR = DATA_DIR / "intermediate" / "ppb2026" / "json_by_entity"
PARAGRAPHS_DIR = Path(__file__).parent.parent / "public" / "data" / "paragraphs"
CACHE_DIR = DATA_DIR / "intermediate" / "llm_cache"
OUTPUT_DIR = DATA_DIR / "intermediate" / "llm_relevance"

# Ensure directories exist
CACHE_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Setup joblib cache
memory = Memory(CACHE_DIR, verbose=0)


# Pydantic models for structured output
class RelevantParagraph(BaseModel):
    """A paragraph identified as relevant to the entity's work."""

    paragraph_index: int
    relevance_comment: str


class EntityRelevanceResult(BaseModel):
    """Result of LLM analysis for an entity-mandate pair."""

    relevant_paragraphs: list[RelevantParagraph]  # Can be empty!


def flatten_ppb_content(ppb_data: dict[str, Any]) -> str:
    """Flatten PPB JSON content to plain text, preserving heading structure."""
    lines: list[str] = []

    def extract_text(node: dict[str, Any], depth: int = 0) -> None:
        block_type = node.get("block_type", "")
        text = node.get("text", "")
        table_content = node.get("table_content")

        if text:
            indent = "  " * depth
            if block_type in ("heading", "heading-sub", "heading-x", "a/b"):
                lines.append(f"\n{indent}## {text}")
            else:
                lines.append(f"{indent}{text}")

        if table_content:
            lines.append(f"{'  ' * depth}[Table content present]")

        for child in node.get("children", []):
            extract_text(child, depth + 1)

    for item in ppb_data.get("content", []):
        extract_text(item)

    return "\n".join(lines)


def format_paragraphs_for_prompt(paragraphs: list[dict[str, Any]]) -> str:
    """Format paragraphs as numbered list for LLM prompt."""
    lines = []
    for i, para in enumerate(paragraphs):
        text = para.get("text", "")
        para_type = para.get("paragraph_type", "")
        prefix = para.get("prefix", "")

        if not text:
            continue

        type_hint = f" [{para_type}]" if para_type else ""
        prefix_hint = f" {prefix}" if prefix else ""
        lines.append(f"[{i}]{prefix_hint}{type_hint}: {text}")

    return "\n\n".join(lines)


SYSTEM_PROMPT = """You are an expert analyst for United Nations mandate documents and programme budget proposals (PPB).

Your task is to identify paragraphs that GIVE A MANDATE to a specific UN entity - i.e., paragraphs that create obligations, tasks, or responsibilities that the entity is expected to implement.

WHAT COUNTS AS A MANDATE-GIVING PARAGRAPH:
1. Paragraphs that EXPLICITLY direct the entity to do something (e.g., "CTED shall...", "requests the Executive Directorate to...", "the Committee will...")
2. Paragraphs that direct the UN, Secretary-General, or a parent body to do something that the entity's PPB shows THEY are responsible for implementing (e.g., resolution says "the UN shall monitor X" and the entity's PPB says they do monitoring of X)
3. Paragraphs that establish obligations that the entity's PPB explicitly claims as their work

WHAT DOES NOT COUNT:
1. Paragraphs that are merely topically related to the entity's area of work
2. General statements about terrorism/peacekeeping/etc. that don't create specific obligations
3. Paragraphs directing Member States or other actors (unless the entity is tasked with supporting/facilitating that)
4. Background/context paragraphs that don't contain actionable mandates
5. Preambular paragraphs (these typically don't create mandates)

CRITICAL: It is completely valid and EXPECTED to return ZERO paragraphs. Most mandate documents have few or no paragraphs that actually mandate a specific entity's work. Be STRICT - only include paragraphs that clearly give this entity something to do.

When a paragraph IS mandate-giving, explain:
- What specific task/obligation it creates
- How this connects to what the entity says they do in their PPB"""


# Global client (initialized once)
_client: AsyncAzureOpenAI | None = None


def get_client() -> AsyncAzureOpenAI:
    global _client
    if _client is None:
        _client = AsyncAzureOpenAI(
            api_key=os.getenv("AZURE_OPENAI_API_KEY"),
            api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-10-21"),
            azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
        )
    return _client


@memory.cache
async def call_llm(
    entity: str,
    entity_long: str,
    ppb_text: str,
    paragraphs_text: str,
    symbol: str,
) -> dict[str, Any]:
    """Cached LLM call. Returns dict representation of EntityRelevanceResult."""
    client = get_client()

    user_prompt = f"""Entity: {entity} ({entity_long})

=== ENTITY'S PPB CONTENT (what they say they do) ===
{ppb_text}

=== MANDATE DOCUMENT PARAGRAPHS ({symbol}) ===
Each paragraph is numbered [index]. Identify ONLY paragraphs that give this entity a mandate (direct them or the UN/SG to do something the entity implements).

{paragraphs_text}

Remember: Most paragraphs will NOT be mandate-giving. Return an empty list if no paragraphs actually mandate this entity's work."""

    response = await client.beta.chat.completions.parse(
        model=os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-5-mini"),
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        response_format=EntityRelevanceResult,
    )

    return response.choices[0].message.parsed.model_dump()


async def process_pair(
    entity: str,
    entity_long: str,
    ppb_text: str,
    symbol: str,
    paragraphs: list[dict[str, Any]],
) -> tuple[str, str, dict[str, Any]]:
    """Process a single entity-mandate pair."""
    paragraphs_text = format_paragraphs_for_prompt(paragraphs)
    result = await call_llm(entity, entity_long, ppb_text, paragraphs_text, symbol)
    return entity, symbol, result


def load_ppb_data() -> dict[str, tuple[str, str]]:
    """Load PPB data for all entities. Returns entity_abbrev -> (entity_long, ppb_text)"""
    ppb_data = {}
    for json_file in PPB_ENTITIES_DIR.glob("*.json"):
        with open(json_file) as f:
            data = json.load(f)

        entity = data.get("entity_abbrev", json_file.stem)
        entity_long = data.get("entity", "")
        ppb_text = flatten_ppb_content(data)
        ppb_data[entity] = (entity_long, ppb_text)

    return ppb_data


def load_mandate_paragraphs(symbol: str) -> list[dict[str, Any]] | None:
    """Load paragraphs for a mandate document."""
    safe_symbol = symbol.replace("/", "_").replace(" ", "_")
    para_file = PARAGRAPHS_DIR / f"{safe_symbol}.json"

    if not para_file.exists():
        return None

    with open(para_file) as f:
        return json.load(f)


def get_entity_mandates(ppb_augmented_path: Path) -> dict[str, list[str]]:
    """Get mapping of entity -> list of mandate symbols they cite."""
    with open(ppb_augmented_path) as f:
        records = json.load(f)

    entity_mandates: dict[str, list[str]] = {}
    for record in records:
        symbol = record.get("full_document_symbol")
        entities = record.get("entities", [])

        for entity in entities:
            if entity:
                if entity not in entity_mandates:
                    entity_mandates[entity] = []
                if symbol not in entity_mandates[entity]:
                    entity_mandates[entity].append(symbol)

    return entity_mandates


async def run_analysis(
    entities_filter: list[str] | None = None,
) -> dict[str, dict[str, list[dict[str, Any]]]]:
    """Run LLM relevance analysis on entity-mandate pairs."""
    print("Loading PPB data...")
    ppb_data = load_ppb_data()
    print(f"  Loaded {len(ppb_data)} entities")

    ppb_augmented_path = (
        Path(__file__).parent.parent / "public" / "data" / "ppb2026_augmented.json"
    )
    print("Loading entity-mandate mappings...")
    entity_mandates = get_entity_mandates(ppb_augmented_path)

    # Filter to specific entities if requested
    if entities_filter:
        entity_mandates = {e: s for e, s in entity_mandates.items() if e in entities_filter}
        print(f"  Filtering to entities: {', '.join(entities_filter)}")

    # Build list of pairs to process
    pairs_to_process = []
    for entity, symbols in entity_mandates.items():
        if entity not in ppb_data:
            continue
        for symbol in symbols:
            paragraphs = load_mandate_paragraphs(symbol)
            if paragraphs:
                entity_long, ppb_text = ppb_data[entity]
                pairs_to_process.append((entity, entity_long, ppb_text, symbol, paragraphs))

    print(f"  Found {len(pairs_to_process)} entity-mandate pairs with paragraph data")

    print(f"\nProcessing {len(pairs_to_process)} pairs...")
    tasks = [process_pair(*pair) for pair in pairs_to_process]
    results = await tqdm_asyncio.gather(*tasks)

    # Organize results by symbol -> entity
    organized: dict[str, dict[str, list[dict[str, Any]]]] = {}
    for entity, symbol, result in results:
        if symbol not in organized:
            organized[symbol] = {}
        organized[symbol][entity] = result["relevant_paragraphs"]

    return organized


def save_results(results: dict[str, dict[str, list[dict[str, Any]]]]) -> None:
    """Save results to individual JSON files per mandate."""
    for symbol, entity_results in results.items():
        safe_symbol = symbol.replace("/", "_").replace(" ", "_")
        output_file = OUTPUT_DIR / f"{safe_symbol}.json"
        with open(output_file, "w") as f:
            json.dump(entity_results, f, indent=2, ensure_ascii=False)

    print(f"\nSaved results for {len(results)} mandate documents to {OUTPUT_DIR}")


async def main():
    parser = argparse.ArgumentParser(
        description="Run LLM relevance analysis on entity-mandate pairs"
    )
    parser.add_argument(
        "--entities",
        type=str,
        help="Comma-separated list of entity abbreviations to process (e.g., DGACM,OIOS)",
    )
    args = parser.parse_args()

    entities_filter = [e.strip() for e in args.entities.split(",")] if args.entities else None
    results = await run_analysis(entities_filter=entities_filter)

    save_results(results)

    # Print summary
    total_pairs = sum(len(entities) for entities in results.values())
    total_relevant = sum(
        len(paras)
        for entities in results.values()
        for paras in entities.values()
    )
    print(f"\nSummary:")
    print(f"  Processed {total_pairs} entity-mandate pairs")
    print(f"  Found {total_relevant} relevant paragraphs total")


if __name__ == "__main__":
    asyncio.run(main())
