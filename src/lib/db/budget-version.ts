/**
 * Budget version scoping for source_document_citations.
 *
 * The shared ppb2026.source_document_citations table holds citations for
 * multiple budget cycles (ppb2026 = PPB 2026 + PKM 2025/26, ppb2027 = PPB
 * 2027 + PKM 2026/27). This housekeeping app reviews the ppb2026 cycle to
 * produce input for ppb2027, so every citation query must scope to ppb2026
 * — otherwise PPB 2027 rows leak into the UI (e.g. each entity appears
 * twice in the budget-part tree under "Other").
 *
 * Membership: a citation belongs to version V iff its origin_document
 * matches the regex of any budget_documents row that has a
 * budget_document_versions row for version V.
 */

export const CURRENT_BUDGET_VERSION = "ppb2026";

/**
 * EXISTS predicate restricting a citation row (`alias.origin_document`) to
 * the current budget version. Inline this with `AND` in WHERE clauses.
 */
export function versionPredicateSql(citationAlias: string): string {
  return `EXISTS (
    SELECT 1 FROM ppb2026.budget_documents bd
    JOIN ppb2026.budget_document_versions bdv ON bdv.doc_slug = bd.slug
    WHERE bdv.version_slug = '${CURRENT_BUDGET_VERSION}'
      AND ${citationAlias}.origin_document ~ bd.match_pattern
  )`;
}
