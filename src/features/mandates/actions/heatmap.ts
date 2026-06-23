"use server";

import { query } from "@/lib/db/db";
import { excludePlanOutlineSql } from "@/lib/db/budget-version";
import { fetchDocumentMetadata } from "@/features/mandates/services/documents/metadata";

export interface SharedMandate {
  symbol: string;
  title: string | null;
  year: number | null;
  link: string | null;
  in2026: boolean;
  in2027: boolean;
}

interface PairRow {
  symbol: string;
  in26: boolean;
  in27: boolean;
}

/**
 * Document symbols cross-cited by BOTH entities (the cell behind a co-citation
 * matrix square), with per-version presence and resolved title/year/link.
 * Plan Outline citations are excluded to match the matrix.
 */
export async function fetchPairMandates(
  entityA: string,
  entityB: string,
): Promise<SharedMandate[]> {
  const rows = await query<PairRow>(
    `WITH ent_sym AS (
       SELECT DISTINCT c.entity,
         REGEXP_REPLACE(c.ppb_full_document_symbol, '(\\d) ([A-Z])$', '\\1\\2') AS symbol,
         bdv.version_slug
       FROM ppb2026.source_document_citations c
       JOIN ppb2026.budget_documents bd ON c.origin_document ~ bd.match_pattern
       JOIN ppb2026.budget_document_versions bdv ON bdv.doc_slug = bd.slug
       WHERE c.entity = ANY($1)
         AND bdv.version_slug IN ('ppb2026', 'ppb2027')
         AND ${excludePlanOutlineSql("c")}
     )
     SELECT symbol,
       bool_or(entity = $2 AND version_slug = 'ppb2026')
         AND bool_or(entity = $3 AND version_slug = 'ppb2026') AS in26,
       bool_or(entity = $2 AND version_slug = 'ppb2027')
         AND bool_or(entity = $3 AND version_slug = 'ppb2027') AS in27
     FROM ent_sym
     GROUP BY symbol`,
    [[entityA, entityB], entityA, entityB],
  );

  const shared = rows.filter((r) => r.in26 || r.in27);
  if (shared.length === 0) return [];

  const meta = await fetchDocumentMetadata(shared.map((s) => s.symbol));

  return shared
    .map<SharedMandate>((s) => ({
      symbol: s.symbol,
      in2026: s.in26,
      in2027: s.in27,
      title: meta[s.symbol]?.title ?? null,
      year: meta[s.symbol]?.year ?? null,
      link: meta[s.symbol]?.link ?? null,
    }))
    .sort(
      (a, b) => (b.year ?? 0) - (a.year ?? 0) || a.symbol.localeCompare(b.symbol),
    );
}
