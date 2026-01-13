import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db/db";

interface DocumentRow {
  symbol: string;
  // public.documents (preferred for new/updated)
  doc_proper_title: string | null;
  doc_date_year: number | null;
  doc_issuing_body: string | null;
  doc_document_type: string | null;
  // source_documents_metadata_clean (existing citations)
  meta_title: string | null;
  meta_proper_title: string | null;
  meta_date_year: number | null;
  meta_issuing_body: string | null;
  meta_document_type: string | null;
  // source_documents ppb_ fields (final fallback)
  ppb_description: string | null;
  ppb_year: number | null;
  ppb_body: string | null;
  ppb_type: string | null;
}

function cleanTitle(title: string | null): string | null {
  return title?.replace(/\s*:\s*$/, "").trim() || null;
}

// Normalize "283 B" -> "283B" (part letters)
function normalizeSymbol(s: string): string {
  return s.replace(/(\d) ([A-Z])$/, "$1$2");
}

export async function GET(req: NextRequest) {
  const symbols = req.nextUrl.searchParams.get("symbols");
  if (!symbols) return NextResponse.json({});

  const symbolList = symbols
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (symbolList.length === 0) return NextResponse.json({});

  // Build map of normalized -> original symbols
  const normalizedMap: Record<string, string> = {};
  const allSymbols: string[] = [];
  for (const sym of symbolList) {
    const norm = normalizeSymbol(sym);
    normalizedMap[sym] = sym;
    normalizedMap[norm] = sym;
    allSymbols.push(sym);
    if (norm !== sym) allSymbols.push(norm);
  }
  const uniqueSymbols = [...new Set(allSymbols)];

  const placeholders = uniqueSymbols.map((_, i) => `$${i + 1}`).join(",");
  const rows = await query<DocumentRow>(
    `SELECT 
       COALESCE(doc.symbol, sd.ppb_full_document_symbol) as symbol,
       -- public.documents (preferred for new/updated)
       doc.proper_title as doc_proper_title,
       doc.date_year as doc_date_year,
       doc.issuing_body as doc_issuing_body,
       doc.document_type as doc_document_type,
       -- source_documents_metadata_clean (existing citations)
       m.title as meta_title,
       m.proper_title as meta_proper_title,
       m.date_year::integer as meta_date_year,
       m.issuing_body as meta_issuing_body,
       m.document_type as meta_document_type,
       -- source_documents ppb_ fields (final fallback)
       sd.ppb_description,
       sd.ppb_year,
       sd.ppb_body,
       sd.ppb_type
     FROM ppb2026.source_documents sd
     LEFT JOIN public.documents doc 
       ON REGEXP_REPLACE(sd.ppb_full_document_symbol, '(\\d) ([A-Z])$', '\\1\\2') = doc.symbol
     LEFT JOIN ppb2026.source_documents_metadata_clean m
       ON sd.ppb_full_document_symbol = m.ppb_full_document_symbol
     WHERE sd.ppb_full_document_symbol IN (${placeholders})
        OR doc.symbol IN (${placeholders})`,
    [...uniqueSymbols, ...uniqueSymbols],
  );

  const result: Record<
    string,
    {
      title: string | null;
      year: number | null;
      body: string | null;
      docType: string | null;
    }
  > = {};
  for (const row of rows) {
    const originalSymbol = normalizedMap[row.symbol];
    if (originalSymbol && !result[originalSymbol]) {
      // Three-tier fallback for each field:
      // 1. public.documents (doc_*) - for new/updated documents
      // 2. source_documents_metadata_clean (meta_*) - for existing citations
      // 3. source_documents (ppb_*) - final fallback
      const title =
        cleanTitle(row.doc_proper_title) ||
        row.meta_title ||
        row.meta_proper_title ||
        row.ppb_description ||
        null;

      const year =
        row.doc_date_year ?? row.meta_date_year ?? row.ppb_year ?? null;

      const body =
        row.doc_issuing_body || row.meta_issuing_body || row.ppb_body || null;

      const docType =
        row.doc_document_type || row.meta_document_type || row.ppb_type || null;

      result[originalSymbol] = {
        title,
        year,
        body,
        docType,
      };
    }
  }

  return NextResponse.json(result);
}
