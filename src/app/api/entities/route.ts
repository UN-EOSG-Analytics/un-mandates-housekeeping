import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  const rows = await query<{ entity: string }>(
    `SELECT DISTINCT entity FROM ppb2026.source_document_citations WHERE entity IS NOT NULL ORDER BY entity`,
  );
  const entities = rows.map((r) => r.entity);
  return NextResponse.json({ entities });
}
