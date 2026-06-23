/**
 * Excel export of the Entity × Entity co-citation data (the input behind the
 * heatmap figure). Three sheets: a 2026 matrix, a 2027 matrix, and a tidy
 * Entity × Symbol sheet with per-version presence/counts so the matrices can be
 * rebuilt externally.
 */

import ExcelJS from "exceljs";
import { query } from "@/lib/db/db";
import { excludePlanOutlineSql } from "@/lib/db/budget-version";
import {
  fetchVersionMatrix,
  pairKey,
  type MatrixData,
} from "@/features/mandates/services/heatmap/co-citation-service";
import {
  CURATED_ENTITIES,
  getCuratedEntity,
} from "@/features/mandates/heatmap/entity-sections";

interface TidyRow {
  entity: string;
  symbol: string;
  count_2026: number;
  count_2027: number;
}

async function fetchTidyRows(): Promise<TidyRow[]> {
  return query<TidyRow>(
    `WITH tagged AS (
       SELECT c.entity,
              REGEXP_REPLACE(c.ppb_full_document_symbol, '(\\d) ([A-Z])$', '\\1\\2') AS symbol,
              bdv.version_slug
       FROM ppb2026.source_document_citations c
       JOIN ppb2026.budget_documents bd ON c.origin_document ~ bd.match_pattern
       JOIN ppb2026.budget_document_versions bdv ON bdv.doc_slug = bd.slug
       WHERE c.entity IS NOT NULL AND c.entity != 'NA'
         AND bdv.version_slug IN ('ppb2026', 'ppb2027')
         AND ${excludePlanOutlineSql("c")}
     )
     SELECT entity, symbol,
            COUNT(*) FILTER (WHERE version_slug = 'ppb2026')::int AS count_2026,
            COUNT(*) FILTER (WHERE version_slug = 'ppb2027')::int AS count_2027
     FROM tagged
     GROUP BY entity, symbol
     ORDER BY entity, symbol`,
  );
}

/** Square Entity × Entity matrix sheet, using the curated figure order. */
function addMatrixSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  matrix: MatrixData,
) {
  const sheet = workbook.addWorksheet(name);
  const labels = CURATED_ENTITIES.map((e) => e.label);

  // Header row: blank corner + entity labels.
  const header = ["", ...labels];
  sheet.addRow(header).font = { bold: true };

  for (const rowE of CURATED_ENTITIES) {
    const cells: (string | number)[] = [rowE.label];
    for (const colE of CURATED_ENTITIES) {
      if (rowE.code === colE.code) {
        cells.push(matrix.totals[rowE.code] ?? 0); // diagonal = own total
      } else {
        cells.push(matrix.pairs[pairKey(rowE.code, colE.code)] ?? 0);
      }
    }
    const r = sheet.addRow(cells);
    r.getCell(1).font = { bold: true };
  }

  sheet.getColumn(1).width = 12;
  for (let i = 2; i <= labels.length + 1; i++) sheet.getColumn(i).width = 7;
  sheet.views = [{ state: "frozen", ySplit: 1, xSplit: 1 }];
}

export async function exportHeatmapXlsx(): Promise<Buffer> {
  const [m2026, m2027, tidy] = await Promise.all([
    fetchVersionMatrix("ppb2026"),
    fetchVersionMatrix("ppb2027"),
    fetchTidyRows(),
  ]);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "UN Mandates Housekeeping";
  workbook.created = new Date();

  // Cover
  const cover = workbook.addWorksheet("Cover");
  cover.getCell("A1").value = "Overlapping mandate citations — 2026 vs 2027";
  cover.getCell("A1").font = { bold: true, size: 16 };
  cover.getCell("A3").value = `Generated: ${new Date().toISOString()}`;
  cover.getCell("A5").value =
    "Cell = number of distinct document symbols (mandates) cited by both entities in that budget version. Diagonal = the entity's own distinct mandate count.";
  cover.getCell("A6").value =
    "Matrices use the 41 curated Secretariat entities from the Mandate Implementation Review figure (p.42). The Entity × Symbol sheet covers all entities.";
  cover.getColumn(1).width = 120;

  addMatrixSheet(workbook, "Matrix 2026", m2026);
  addMatrixSheet(workbook, "Matrix 2027", m2027);

  // Tidy Entity × Symbol input
  const tidySheet = workbook.addWorksheet("Entity x Symbol");
  const headers = [
    "Entity",
    "Entity (long)",
    "Symbol",
    "in_2026",
    "in_2027",
    "count_2026",
    "count_2027",
    "status",
  ];
  tidySheet.addRow(headers).font = { bold: true };
  for (const row of tidy) {
    const in26 = row.count_2026 > 0;
    const in27 = row.count_2027 > 0;
    const status =
      in26 && in27 ? "both" : in26 ? "only_2026" : "only_2027";
    tidySheet.addRow([
      row.entity,
      getCuratedEntity(row.entity)?.label ?? row.entity,
      row.symbol,
      in26 ? 1 : 0,
      in27 ? 1 : 0,
      row.count_2026,
      row.count_2027,
      status,
    ]);
  }
  [22, 24, 22, 9, 9, 12, 12, 12].forEach((w, i) => {
    tidySheet.getColumn(i + 1).width = w;
  });
  tidySheet.views = [{ state: "frozen", ySplit: 1, xSplit: 1 }];
  tidySheet.autoFilter = { from: "A1", to: "H1" };

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
