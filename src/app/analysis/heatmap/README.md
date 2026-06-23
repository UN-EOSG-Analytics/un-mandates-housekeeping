# Co-citation Heatmap (`/analysis/heatmap`)

Recreates the appendix figure from the Mandate Implementation Review
(`docs/UN_MIR_2025_2144.pdf`, p.42): a symmetric **Entity × Entity** matrix where
cell(i,j) = number of distinct document symbols (mandates) cited by **both**
entity i and entity j, within one budget version. Reviewer-gated; linked from the
analysis dashboard.

## Files

- `page.tsx` — server component, fetches all layers and passes them to the client.
- `HeatmapMatrix.tsx` — `"use client"` matrix grid + controls (layer selector, "show all", export link)
  and the click-to-inspect detail panel.
- `src/features/mandates/actions/heatmap.ts` — `"use server"` `fetchPairMandates(a, b)`: the symbols
  cross-cited by a clicked pair, with per-version (2026/2027) presence + resolved title/year/link.
  Lazy-loaded on cell click (one small query per click) rather than shipping every pair's list upfront.
- `src/features/mandates/heatmap/entity-sections.ts` — curated 41-entity config (order, sections, colours).
- `src/features/mandates/heatmap/matrix-utils.ts` — client-safe `MatrixData` type + `pairKey` (kept free of the `pg` import so the client bundle stays clean).
- `src/features/mandates/heatmap/color-scale.ts` — sqrt sequential + diverging colour scales.
- `src/features/mandates/services/heatmap/co-citation-service.ts` — the SQL (server only).
- `src/features/mandates/services/export/heatmap-export.ts` + `src/app/api/export/heatmap/route.ts` — Excel export.

## Data model & version scoping

- Both budget cycles live in the **same** `ppb2026.source_document_citations` table,
  separated only by the version predicate in `src/lib/db/budget-version.ts`
  (`origin_document` regex → `budget_documents` → `budget_document_versions.version_slug`).
  Use `versionPredicateSqlFor(alias, 'ppb2026' | 'ppb2027')`.
- A pair's count = `|symbols(A) ∩ symbols(B)|`. Symbols are normalized with the same
  `REGEXP_REPLACE(.., '(\d) ([A-Z])$', '\1\2')` as `services/documents/metadata.ts`.
- This matches the official "Cited Active Mandates" membership predicate on mandates.un.org
  **by construction**. We read `source_document_citations` (not `public.unified_documents`)
  because it is the only source carrying **entity attribution**, required for an entity×entity matrix.

### Plan Outline exclusion (important)

`plan-outline-a80-6` ("Plan Outline 2026-2028") is tagged to **both** version groups in
the DB, but its citations are **not attributed to specific entities** and it is outside the
official two-document definition (PPB + PKM only). It is excluded via
`excludePlanOutlineSql()` so it doesn't pollute the matrix (≈191 symbols / 205 rows per cycle).
After exclusion: `ppb2027` = PPB 2027 + PKM 26/27 only. NB: the raw `budget_document_versions`
row still maps it under both versions, so other callers using the bare version predicate
(e.g. the analysis page totals) still count it — the exclusion is scoped to the heatmap/export.

## Entities

- Curated 41 Secretariat entities in the figure's order/grouping; `systemchart.entities` has
  **no** section column, so the grouping is hand-maintained in `entity-sections.ts`.
- 8 figure labels differ from entity codes (Habitat→UN-Habitat, Women→UN Women, OHRLLS→UN-OHRLLS,
  UNYO→UN Youth, SVC→SRSG-SVC, VAC→SRSG-VAC, CAAC→SRSG-CAAC, VRA→OVRA).
- **`RCS → DCO` is a best guess** (RCS ≈ Resident Coordinator System, run by DCO); confirm with data owners.
- "Show all entities" expands beyond the curated 41; unmapped entities fall into a gray "Other" band.

## Rendering

- Colour = section hue when both entities share a section, else gray (cross-section); diagonal blank.
- **Sequential intensity is normalized per colour group** (each section block + the cross-section
  group against its own max), not globally — otherwise Development's large counts (max ≈130) wash
  out the smaller clusters. Trade-off: intensity is not directly comparable across sections.
- Section hues come from the theme palette in `src/app/globals.css` (`un-blue`, `au-chico`,
  `smoky`, `pale-oyster`, `trout`, `faded-jade`, `dusty-gray`).

## Layers (extensible — edit the `LAYERS` array in `HeatmapMatrix.tsx`)

`2026` · `2027` · `Δ 2027−2026` (diverging: green = overlap reduced) · `After decisions`
(2026 + housekeeping decisions) · `Δ decisions`. The "improvement" metric is still being chosen,
so adding/removing layers is intentionally a one-line change.

## Verification snapshot

`pnpm typecheck` / `lint` / `build` green. Ground-truth cross-check: 2026 `DESA↔ECLAC = 130`,
`ECLAC↔ESCAP = 91`. Rendered authed and compared to figure p.42.
