/**
 * Data service for PPB 2027 mandate data
 * Fetches data from PostgreSQL database
 */

import { query } from "../db/db";
import type { PPBRecord, CitationInfo, BudgetPartMeta } from "@/types";

export interface EntityOption {
  entity: string;
  entity_long: string | null;
}

// Budget parts metadata (static - matches budget_parts.json)
export const BUDGET_PARTS_META: BudgetPartMeta[] = [
  {
    numeral: "I",
    order: 1,
    name: "Overall policymaking, direction and coordination",
  },
  { numeral: "II", order: 2, name: "Political affairs" },
  { numeral: "III", order: 3, name: "International justice and law" },
  {
    numeral: "IV",
    order: 4,
    name: "International cooperation and development",
  },
  { numeral: "V", order: 5, name: "Regional cooperation and development" },
  { numeral: "VI", order: 6, name: "Human rights and humanitarian affairs" },
  { numeral: "VII", order: 7, name: "Global communications" },
  { numeral: "VIII", order: 8, name: "Common support services" },
  { numeral: "IX", order: 9, name: "Internal oversight" },
  {
    numeral: "X",
    order: 10,
    name: "Jointly financed administrative activities and special expenses",
  },
  { numeral: "XI", order: 11, name: "Capital expenditure" },
  { numeral: "XII", order: 12, name: "Safety and security" },
  { numeral: "XIII", order: 13, name: "Development account" },
  { numeral: "XIV", order: 14, name: "Staff assessment" },
];

interface DBCitationRow {
  ppb_full_document_symbol: string;
  entity: string;
  entity_long: string | null;
  origin_document: string | null;
  part_in_document: string | null;
  section: string | null;
  section_title: string | null;
  priority_area: string | null;
  sub_programme: string | null;
  pillar: string | null;
  budget_part: string | null;
  programme: number | null;
  programme_title: string | null;
  component: string | null;
  // Joined from public.documents (preferred source for new/updated)
  doc_symbol: string | null;
  doc_proper_title: string | null;
  doc_date_year: number | null;
  doc_issuing_body: string | null;
  doc_document_type: string | null;
  // Joined from source_documents_metadata_clean (existing citations)
  meta_title: string | null;
  meta_proper_title: string | null;
  meta_date_year: number | null;
  meta_issuing_body: string | null;
  meta_document_type: string | null;
  // Joined from source_documents (ppb_ fallback fields)
  ppb_link: string | null;
  ppb_description: string | null;
  ppb_year: number | null;
  ppb_body: string | null;
  ppb_type: string | null;
}

/**
 * Fetch all PPB records from database
 * Joins with public.documents for authoritative metadata,
 * falls back to source_documents_metadata_clean, then to ppb_ fields
 */
export async function fetchPPBRecords(): Promise<PPBRecord[]> {
  const rows = await query<DBCitationRow>(`
    SELECT 
      c.ppb_full_document_symbol,
      c.entity,
      e.entity_long,
      c.origin_document,
      c.part_in_document,
      c.section,
      c.section_title,
      c.priority_area,
      c.sub_programme,
      c.pillar,
      c.budget_part,
      c.programme,
      c.programme_title,
      c.component,
      doc.symbol as doc_symbol,
      doc.proper_title as doc_proper_title,
      doc.date_year as doc_date_year,
      doc.issuing_body as doc_issuing_body,
      doc.document_type as doc_document_type,
      m.title as meta_title,
      m.proper_title as meta_proper_title,
      m.date_year::integer as meta_date_year,
      m.issuing_body as meta_issuing_body,
      m.document_type as meta_document_type,
      d.ppb_link,
      d.ppb_description,
      d.ppb_year,
      d.ppb_body,
      d.ppb_type
    FROM ppb2026.source_document_citations c
    LEFT JOIN systemchart.entities e
      ON c.entity = e.entity
    LEFT JOIN public.documents doc 
      ON REGEXP_REPLACE(c.ppb_full_document_symbol, '(\\d) ([A-Z])$', '\\1\\2') = doc.symbol
    LEFT JOIN ppb2026.source_documents_metadata_clean m
      ON c.ppb_full_document_symbol = m.ppb_full_document_symbol
    LEFT JOIN ppb2026.source_documents d 
      ON c.ppb_full_document_symbol = d.ppb_full_document_symbol
    ORDER BY c.ppb_full_document_symbol, c.entity
  `);

  // Group rows by document symbol to build PPBRecord structure
  const recordsMap = new Map<string, PPBRecord>();
  const entitiesMap = new Map<string, Set<string>>();

  for (const row of rows) {
    const symbol = row.ppb_full_document_symbol;

    if (!recordsMap.has(symbol)) {
      // Three-tier fallback:
      // 1. public.documents (doc_*) - for new/updated documents
      // 2. source_documents_metadata_clean (meta_*) - for existing citations
      // 3. source_documents (ppb_*) - final fallback
      const hasDbMetadata =
        row.doc_symbol !== null ||
        row.meta_title !== null ||
        row.meta_proper_title !== null;

      // Title: doc.proper_title > meta.title > meta.proper_title > ppb_description
      const title =
        row.doc_proper_title ||
        row.meta_title ||
        row.meta_proper_title ||
        row.ppb_description ||
        null;

      // Year: doc_date_year > meta_date_year > ppb_year
      const year =
        row.doc_date_year ?? row.meta_date_year ?? row.ppb_year ?? null;

      // Body: doc_issuing_body > meta_issuing_body > ppb_body
      const body =
        row.doc_issuing_body || row.meta_issuing_body || row.ppb_body || null;

      // Type: doc_document_type > meta_document_type > ppb_type
      const docType =
        row.doc_document_type || row.meta_document_type || row.ppb_type || null;

      recordsMap.set(symbol, {
        full_document_symbol: symbol,
        num_citations: 0,
        num_entities: 0,
        entities: [],
        link: row.ppb_link,
        priority_area: row.priority_area,
        year,
        body,
        pillar: row.pillar,
        entity_long: row.entity_long,
        description: title,
        type: docType,
        citation_info: [],
        document_symbol: row.doc_symbol,
        uniform_title: null,
        metadata_from_db: hasDbMetadata,
        recurrence_actions: undefined,
        entity_relevance: undefined,
      });
      entitiesMap.set(symbol, new Set());
    }

    const record = recordsMap.get(symbol)!;
    const entities = entitiesMap.get(symbol)!;

    // Build CitationInfo for this row
    const citationInfo: CitationInfo = {
      origin_document: row.origin_document || "",
      budget_part: row.budget_part,
      section: row.section,
      section_title: row.section_title,
      entity_long: row.entity_long,
      entity: row.entity,
      programme: row.programme,
      programme_title: row.programme_title,
      "sub-programme": row.sub_programme,
      component: row.component,
      part_in_document: row.part_in_document,
    };

    record.citation_info.push(citationInfo);
    record.num_citations++;

    // Track unique entities
    if (row.entity && !entities.has(row.entity)) {
      entities.add(row.entity);
      record.entities.push(row.entity);
    }
  }

  // Update num_entities for all records
  for (const [symbol, record] of recordsMap) {
    record.num_entities = entitiesMap.get(symbol)?.size || 0;
  }

  return Array.from(recordsMap.values());
}

export interface EntityOption {
  entity: string;
  entity_long: string | null;
}

/**
 * Fetch entities that are referenced in PPB 2026 citations
 * Only returns entities actually used in the current budget cycle
 */
export async function fetchEntities(): Promise<EntityOption[]> {
  const rows = await query<EntityOption>(
    `SELECT DISTINCT e.entity, e.entity_long
     FROM systemchart.entities e
     INNER JOIN ppb2026.source_document_citations c ON e.entity = c.entity
     ORDER BY e.entity`,
  );
  return rows;
}

/**
 * Fetch budget parts metadata
 * Returns static data (could be moved to DB in future)
 */
export function getBudgetPartsMeta(): BudgetPartMeta[] {
  return BUDGET_PARTS_META;
}
