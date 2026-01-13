import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db/db";

interface DocumentRow {
  symbol: string;
  proper_title: string | null;
  document_type: string | null;
  date_year: number | null;
  issuing_body: string | null;
}

function cleanTitle(title: string | null): string | null {
  return title?.replace(/\s*:\s*$/, "").trim() || null;
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json([]);
  }

  // Search by symbol first (exact prefix match), then by title
  const rows = await query<DocumentRow>(
    `SELECT symbol, proper_title, document_type, date_year, issuing_body
     FROM public.documents
     WHERE symbol ILIKE $1 || '%'
        OR proper_title ILIKE '%' || $1 || '%'
     ORDER BY 
       CASE WHEN UPPER(symbol) = UPPER($1) THEN 0 ELSE 1 END,
       CASE WHEN symbol ILIKE $1 || '%' THEN 0 ELSE 1 END,
       LENGTH(symbol),
       date_year DESC NULLS LAST
     LIMIT 20`,
    [q],
  );

  return NextResponse.json(
    rows.map((r) => ({
      symbol: r.symbol,
      title: cleanTitle(r.proper_title),
      type: r.document_type,
      year: r.date_year,
      body: r.issuing_body,
    })),
  );
}
