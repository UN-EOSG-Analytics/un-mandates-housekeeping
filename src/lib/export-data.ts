import ExcelJS from "exceljs";
import { fetchPPBRecords } from "./data-service";

interface MandateRow {
  symbol: string;
  title: string;
  body: string;
  year: number | null;
  link: string | null;
  entity: string;
  entityLong: string | null;
  subprogramme: string | null;
  part: string | null;
}

async function getMandateRows(entityFilter?: string): Promise<MandateRow[]> {
  const records = await fetchPPBRecords();
  const rows: MandateRow[] = [];
  const seen = new Set<string>();

  for (const rec of records) {
    for (const ci of rec.citation_info) {
      if (entityFilter && ci.entity !== entityFilter) continue;
      
      const key = `${ci.entity}:${rec.full_document_symbol}:${ci["sub-programme"] || ""}`;
      if (seen.has(key)) continue;
      seen.add(key);

      rows.push({
        symbol: rec.full_document_symbol,
        title: rec.description || rec.uniform_title || "",
        body: rec.body || "",
        year: rec.year,
        link: rec.link,
        entity: ci.entity || "",
        entityLong: ci.entity_long,
        subprogramme: ci["sub-programme"] || ci.component || null,
        part: ci.part_in_document,
      });
    }
  }

  if (entityFilter && rows.length === 0) {
    throw new Error(`No mandates found for entity: ${entityFilter}`);
  }

  return rows.sort((a, b) => a.symbol.localeCompare(b.symbol));
}

export async function exportToCsv(entity?: string): Promise<string> {
  const rows = await getMandateRows(entity);
  
  const headers = ["Symbol", "Title", "Body", "Year", "Link", "Entity", "Entity Long", "Subprogramme", "Part"];
  const csvRows = [headers.join(",")];
  
  for (const r of rows) {
    csvRows.push([
      quote(r.symbol),
      quote(r.title),
      quote(r.body),
      r.year?.toString() || "",
      quote(r.link || ""),
      quote(r.entity),
      quote(r.entityLong || ""),
      quote(r.subprogramme || ""),
      quote(r.part || ""),
    ].join(","));
  }
  
  return csvRows.join("\n");
}

function quote(s: string): string {
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const COLUMN_INFO = [
  { key: "symbol", header: "Symbol", width: 20, desc: "Official UN document symbol (e.g., A/RES/78/123)" },
  { key: "title", header: "Title", width: 60, desc: "Document title or description" },
  { key: "body", header: "Body", width: 12, desc: "Issuing body: GA (General Assembly), SC (Security Council), ECOSOC, etc." },
  { key: "year", header: "Year", width: 8, desc: "Year of adoption" },
  { key: "link", header: "Link", width: 40, desc: "URL to the official document" },
  { key: "entity", header: "Entity", width: 15, desc: "Entity abbreviation (e.g., DESA, UNOCT)" },
  { key: "entityLong", header: "Entity Full Name", width: 40, desc: "Full entity name" },
  { key: "subprogramme", header: "Subprogramme", width: 30, desc: "Subprogramme or component within the entity" },
  { key: "part", header: "Part", width: 20, desc: "Section type: Legislative mandates or Mandates and background" },
] as const;

export async function exportToXlsx(entity?: string): Promise<Buffer> {
  const rows = await getMandateRows(entity);
  
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "UN Mandates Housekeeping";
  workbook.created = new Date();

  // Cover sheet
  const cover = workbook.addWorksheet("Cover");
  const title = entity ? `Mandates for ${entity}` : "All PPB 2026 Mandates";
  const baseUrl = "https://un-mandates-housekeeping.vercel.app/un-mandates-housekeeping";
  const sourceUrl = entity ? `${baseUrl}/entity/${entity}/` : `${baseUrl}/`;

  cover.getCell("A1").value = title;
  cover.getCell("A1").font = { bold: true, size: 16 };
  cover.getCell("A2").value = `Generated: ${new Date().toISOString().split("T")[0]}`;
  cover.getCell("A3").value = `Total records: ${rows.length}`;
  cover.getCell("A4").value = "Source:";
  cover.getCell("B4").value = { text: sourceUrl, hyperlink: sourceUrl };
  cover.getCell("B4").font = { color: { argb: "FF0000FF" }, underline: true };

  cover.getCell("A6").value = "Column Descriptions";
  cover.getCell("A6").font = { bold: true, size: 12 };

  COLUMN_INFO.forEach((col, i) => {
    cover.getCell(`A${7 + i}`).value = col.header;
    cover.getCell(`A${7 + i}`).font = { bold: true };
    cover.getCell(`B${7 + i}`).value = col.desc;
  });

  cover.getColumn("A").width = 20;
  cover.getColumn("B").width = 60;

  // Data sheet
  const data = workbook.addWorksheet("Mandates");
  
  // Headers
  const headerRow = data.getRow(1);
  COLUMN_INFO.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.header;
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } };
    cell.border = { bottom: { style: "thin" } };
  });
  
  // Freeze header row
  data.views = [{ state: "frozen", ySplit: 1 }];

  // Data rows
  rows.forEach((r, rowIdx) => {
    const row = data.getRow(rowIdx + 2);
    row.getCell(1).value = r.symbol;
    row.getCell(2).value = r.title;
    row.getCell(3).value = r.body;
    row.getCell(4).value = r.year;
    if (r.link) {
      row.getCell(5).value = { text: r.link, hyperlink: r.link };
      row.getCell(5).font = { color: { argb: "FF0000FF" }, underline: true };
    }
    row.getCell(6).value = r.entity;
    row.getCell(7).value = r.entityLong;
    row.getCell(8).value = r.subprogramme;
    row.getCell(9).value = r.part;
    row.alignment = { wrapText: true, vertical: "top" };
  });

  // Set column widths
  COLUMN_INFO.forEach((col, i) => {
    data.getColumn(i + 1).width = col.width;
  });

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

