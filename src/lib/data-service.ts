/**
 * Data service for PPB 2026 mandate data
 * Fetches data from PostgreSQL database
 */

import { query } from "./db";
import type {
  PPBRecord,
  CitationInfo,
  BudgetPartMeta,
} from "@/types";

// Budget parts metadata (static - matches budget_parts.json)
export const BUDGET_PARTS_META: BudgetPartMeta[] = [
  { numeral: "I", order: 1, name: "Overall policymaking, direction and coordination" },
  { numeral: "II", order: 2, name: "Political affairs" },
  { numeral: "III", order: 3, name: "International justice and law" },
  { numeral: "IV", order: 4, name: "International cooperation and development" },
  { numeral: "V", order: 5, name: "Regional cooperation and development" },
  { numeral: "VI", order: 6, name: "Human rights and humanitarian affairs" },
  { numeral: "VII", order: 7, name: "Global communications" },
  { numeral: "VIII", order: 8, name: "Common support services" },
  { numeral: "IX", order: 9, name: "Internal oversight" },
  { numeral: "X", order: 10, name: "Jointly financed administrative activities and special expenses" },
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
  // Joined from source_documents_metadata_clean
  symbol: string | null;
  uniform_title: string | null;
  proper_title: string | null;
  title: string | null;
  publication_date: string | null;
  date_year: number | null;
  issuing_body: string | null;
  // Joined from source_documents
  ppb_link: string | null;
  ppb_year: number | null;
  ppb_body: string | null;
  ppb_type: string | null;
  ppb_description: string | null;
}

/**
 * Fetch all PPB records from database
 * Joins source_document_citations, source_documents, and source_documents_metadata_clean
 */
export async function fetchPPBRecords(): Promise<PPBRecord[]> {
  const rows = await query<DBCitationRow>(`
    SELECT 
      c.ppb_full_document_symbol,
      c.entity,
      c.entity_long,
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
      m.symbol,
      m.uniform_title,
      m.proper_title,
      m.title,
      m.publication_date,
      m.date_year,
      m.issuing_body,
      d.ppb_link,
      d.ppb_year,
      d.ppb_body,
      d.ppb_type,
      d.ppb_description
    FROM ppb2026.source_document_citations c
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
      // Determine document title from available fields
      let uniformTitle: string | null = null;
      if (row.uniform_title) {
        // uniform_title is stored as JSON array string like "{...}"
        try {
          const parsed = row.uniform_title.replace(/^\{|\}$/g, '').split(',')[0]?.replace(/^"|"$/g, '');
          uniformTitle = parsed || null;
        } catch {
          uniformTitle = row.uniform_title;
        }
      }

      recordsMap.set(symbol, {
        full_document_symbol: symbol,
        num_citations: 0,
        num_entities: 0,
        entities: [],
        link: row.ppb_link,
        priority_area: row.priority_area,
        year: row.ppb_year,
        body: row.ppb_body,
        pillar: row.pillar,
        entity_long: row.entity_long,
        description: row.ppb_description || row.proper_title || row.title,
        type: row.ppb_type,
        citation_info: [],
        document_symbol: row.symbol,
        uniform_title: uniformTitle,
        // These fields are computed from external data, not in DB yet
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

/**
 * Fetch budget parts metadata
 * Returns static data (could be moved to DB in future)
 */
export function getBudgetPartsMeta(): BudgetPartMeta[] {
  return BUDGET_PARTS_META;
}
