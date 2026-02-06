/**
 * Mandate data service for PPB 2026/2027
 * Fetches PPB records from database and transforms into hierarchical structure
 */

import { query } from "@/lib/db/db";
import type {
  PPBRecord,
  CitationInfo,
  BudgetPartMeta,
  PartData,
  Mandate,
  MandateAction,
  NewerVersion,
} from "@/types";
import { BUDGET_PARTS_META } from "@/lib/constants";
import {
  resolveMetadata,
  type DocumentMetadataRow,
} from "./documents/metadata";

export interface EntityOption {
  entity: string;
  entity_long: string | null;
}

interface DBCitationRow extends DocumentMetadataRow {
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
  // Additional field specific to PPB data
  ppb_link: string | null;
  // Add doc_symbol for consistency with queries
  doc_symbol: string | null;
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
    LEFT JOIN mandates_housekeeping.entities e
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
      // Use shared metadata resolution utility
      const resolved = resolveMetadata(
        {
          symbol: row.doc_symbol || symbol,
          doc_proper_title: row.doc_proper_title,
          doc_date_year: row.doc_date_year,
          doc_issuing_body: row.doc_issuing_body,
          doc_document_type: row.doc_document_type,
          meta_title: row.meta_title,
          meta_proper_title: row.meta_proper_title,
          meta_date_year: row.meta_date_year,
          meta_issuing_body: row.meta_issuing_body,
          meta_document_type: row.meta_document_type,
          ppb_description: row.ppb_description,
          ppb_year: row.ppb_year,
          ppb_body: row.ppb_body,
          ppb_type: row.ppb_type,
          ppb_link: row.ppb_link,
        },
        symbol,
      );

      recordsMap.set(symbol, {
        full_document_symbol: symbol,
        num_citations: 0,
        num_entities: 0,
        entities: [],
        link: resolved.link,
        priority_area: row.priority_area,
        year: resolved.year,
        body: resolved.body,
        pillar: row.pillar,
        entity_long: row.entity_long,
        description: resolved.title,
        type: resolved.docType,
        citation_info: [],
        document_symbol: row.doc_symbol,
        uniform_title: null,
        metadata_from_db: resolved.hasDbMetadata,
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
 * Fetch entities that are referenced in PPB 2026 citations
 * Only returns entities actually used in the current budget cycle
 */
export async function fetchEntities(): Promise<EntityOption[]> {
  const rows = await query<EntityOption>(
    `SELECT DISTINCT e.entity, e.entity_long
     FROM mandates_housekeeping.entities e
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

// ============================================================================
// Data Transformation Functions
// ============================================================================

/**
 * Determine the suggested action for a mandate within an entity
 * Returns UPDATE with latest symbol, or DROP if newer version is already cited
 */
function getActionForEntity(
  rec: PPBRecord,
  entity: string,
): MandateAction | null {
  const action = rec.recurrence_actions?.find((a) => a.entity === entity);
  if (!action) return null;

  if (action.newer_cited_symbols.length > 0) {
    return { type: "DROP", newerSymbol: action.newer_cited_symbols[0] };
  }
  return { type: "UPDATE", newerSymbol: action.latest_symbol };
}

/** Check if a part should be classified as background (vs. legislative mandate) */
function isBackgroundPart(part: string | null): boolean {
  return part === "Mandates and background";
}

/** Remove trailing colons from titles for consistency */
function cleanTitle(title: string): string {
  return title.replace(/\s*:\s*$/, "").trim();
}

/**
 * Transform raw PPB records into hierarchical structure
 * @param records Raw database records from PPB extraction
 * @param budgetPartsMeta Metadata for budget parts (labels, order, numerals)
 * @param newerVersions Map of document symbols to their newer versions
 * @returns Structured data organized by parts → entities → mandates
 */
export function transformPPBData(
  records: PPBRecord[],
  budgetPartsMeta: BudgetPartMeta[],
  newerVersions?: Map<string, NewerVersion>,
): PartData[] {
  // Build lookup from key (database budget_part value) to meta
  const metaByKey: Record<string, BudgetPartMeta> = {};
  for (const meta of budgetPartsMeta) {
    metaByKey[meta.key.toLowerCase()] = meta;
  }

  const structure: Record<
    string,
    {
      meta: BudgetPartMeta | null;
      entities: Record<
        string,
        {
          entityLong: string | null;
          section: string | null;
          sectionTitle: string | null;
          backgroundMandates: Mandate[];
          legislativeMandates: Record<string, Mandate[]>;
        }
      >;
    }
  > = {};

  for (const rec of records) {
    const symbol = rec.full_document_symbol;
    const title = cleanTitle(rec.description || rec.uniform_title || "");
    const link = rec.link;
    const year = rec.year;
    const body = rec.body;
    const docType = rec.type;
    const metadataFromDb = rec.metadata_from_db ?? false;

    // Build entity -> entityLong map and entity -> subprogrammes from all citation_info
    const entityLongMap: Record<string, string> = {};
    const entitySubprogrammes: Record<string, string[]> = {};
    for (const ci of rec.citation_info) {
      if (ci.entity && ci.entity_long) {
        entityLongMap[ci.entity] = ci.entity_long;
      }
      if (ci.entity) {
        const subprog = ci["sub-programme"] || ci.component || null;
        if (!entitySubprogrammes[ci.entity])
          entitySubprogrammes[ci.entity] = [];
        if (subprog && !entitySubprogrammes[ci.entity].includes(subprog)) {
          entitySubprogrammes[ci.entity].push(subprog);
        }
      }
    }

    for (const ci of rec.citation_info) {
      const budgetPart = ci.budget_part || "Other";
      const entity = ci.entity;
      const entityLong = ci.entity_long;
      const partInDoc = ci.part_in_document;
      const isBackground = isBackgroundPart(partInDoc);
      const subprog = ci["sub-programme"] || ci.component || null;

      if (!entity) continue;

      const action = getActionForEntity(rec, entity);
      const relevance = rec.entity_relevance?.[entity];
      const relevanceIndices = relevance?.indices || [];
      const aiComments = relevance?.ai_comments || {};

      const mandate: Mandate = {
        symbol,
        title,
        link,
        year,
        body,
        docType,
        action,
        relevanceCount: relevanceIndices.length,
        relevanceIndices,
        aiComments,
        entity,
        entityLong,
        isBackground,
        otherEntitiesCount: Math.max(0, rec.num_entities - 1),
        allEntities: (rec.entities || []).filter(
          (e): e is string => e !== null,
        ),
        entitySubprogrammes,
        entityLongMap,
        allEntityRelevance: rec.entity_relevance || {},
        metadataFromDb,
        newerVersion: rec.document_symbol
          ? newerVersions?.get(rec.document_symbol)
          : undefined,
      };

      const meta = metaByKey[budgetPart.toLowerCase()] || null;

      if (!structure[budgetPart]) {
        structure[budgetPart] = { meta, entities: {} };
      }

      if (!structure[budgetPart].entities[entity]) {
        structure[budgetPart].entities[entity] = {
          entityLong,
          section: ci.section,
          sectionTitle: ci.section_title,
          backgroundMandates: [],
          legislativeMandates: {},
        };
      }

      const entityData = structure[budgetPart].entities[entity];

      if (isBackground) {
        if (!entityData.backgroundMandates.some((m) => m.symbol === symbol)) {
          entityData.backgroundMandates.push(mandate);
        }
      } else {
        const key = subprog || "Legislative mandates";
        if (!entityData.legislativeMandates[key]) {
          entityData.legislativeMandates[key] = [];
        }
        if (
          !entityData.legislativeMandates[key].some((m) => m.symbol === symbol)
        ) {
          entityData.legislativeMandates[key].push(mandate);
        }
      }
    }
  }

  // Sort by order (roman numeral order), unknown parts at end
  const parts: PartData[] = Object.entries(structure)
    .sort(([, a], [, b]) => {
      const aOrder = a.meta?.order ?? 999;
      const bOrder = b.meta?.order ?? 999;
      return aOrder - bOrder;
    })
    .map(([part, data]) => ({
      part: data.meta?.label || part,
      numeral: data.meta?.numeral || "",
      order: data.meta?.order ?? 999,
      entities: Object.entries(data.entities)
        .sort(([, a], [, b]) => {
          // Sort by section first (nulls last), then by entity name
          const sectionA = a.section ?? "\uffff";
          const sectionB = b.section ?? "\uffff";
          if (sectionA !== sectionB) return sectionA.localeCompare(sectionB);
          return 0; // Keep original order within section
        })
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([entity, entityData]) => ({
          entity,
          entityLong: entityData.entityLong,
          section: entityData.section,
          sectionTitle: entityData.sectionTitle,
          backgroundMandates: entityData.backgroundMandates,
          legislativeMandates: entityData.legislativeMandates,
        })),
    }));

  return parts;
}
