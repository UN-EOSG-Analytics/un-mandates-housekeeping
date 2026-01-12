import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

interface DocumentRow {
  symbol: string;
  proper_title: string | null;
  date_year: number | null;
  issuing_body: string | null;
  document_type: string | null;
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
    `SELECT symbol, proper_title, date_year, issuing_body, document_type
     FROM public.documents
     WHERE symbol IN (${placeholders})`,
    uniqueSymbols,
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
      result[originalSymbol] = {
        title: cleanTitle(row.proper_title),
        year: row.date_year,
        body: row.issuing_body,
        docType: row.document_type,
      };
    }
  }

  return NextResponse.json(result);
}
