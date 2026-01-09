import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import type { MandateEntry } from "@/types";

interface DbRow {
  id: string;
  document_symbol: string;
  entity: string;
  subprogramme: string | null;
  added_by: string | null;
  added_at: string | null;
  focal_decision: string | null;
  focal_new_symbol: string | null;
  focal_decided_by: string | null;
  focal_decided_at: string | null;
  ppbd_decision: string | null;
  ppbd_new_symbol: string | null;
  ppbd_decided_by: string | null;
  ppbd_decided_at: string | null;
}

const toEntry = (row: DbRow): MandateEntry => ({
  id: row.id,
  documentSymbol: row.document_symbol,
  entity: row.entity,
  subprogramme: row.subprogramme,
  addedBy: row.added_by,
  addedAt: row.added_at,
  focalDecision: row.focal_decision as MandateEntry["focalDecision"],
  focalNewSymbol: row.focal_new_symbol,
  focalDecidedBy: row.focal_decided_by,
  focalDecidedAt: row.focal_decided_at,
  ppbdDecision: row.ppbd_decision as MandateEntry["ppbdDecision"],
  ppbdNewSymbol: row.ppbd_new_symbol,
  ppbdDecidedBy: row.ppbd_decided_by,
  ppbdDecidedAt: row.ppbd_decided_at,
});

export async function GET(req: NextRequest) {
  const entity = req.nextUrl.searchParams.get("entity");
  if (!entity) return NextResponse.json({ error: "entity required" }, { status: 400 });

  const rows = await query<DbRow>(
    `SELECT * FROM mandates_housekeeping.mandate_entries WHERE entity = $1`,
    [entity]
  );
  return NextResponse.json(rows.map(toEntry));
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const { documentSymbol, entity, subprogramme, action } = body;

  if (!documentSymbol || !entity || !action) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const sub = subprogramme || "";

  if (action.type === "add") {
    // Add new entry
    const rows = await query<DbRow>(
      `INSERT INTO mandates_housekeeping.mandate_entries 
         (document_symbol, entity, subprogramme, added_by, added_at)
       VALUES ($1, $2, NULLIF($3, ''), $4, NOW())
       ON CONFLICT (document_symbol, entity, COALESCE(subprogramme, ''))
       DO UPDATE SET added_by = COALESCE(mandates_housekeeping.mandate_entries.added_by, $4),
                     added_at = COALESCE(mandates_housekeeping.mandate_entries.added_at, NOW())
       RETURNING *`,
      [documentSymbol, entity, sub, user.email]
    );
    return NextResponse.json(toEntry(rows[0]));
  }

  if (action.type === "focal" || action.type === "ppbd") {
    const col = action.type;
    const rows = await query<DbRow>(
      `INSERT INTO mandates_housekeeping.mandate_entries 
         (document_symbol, entity, subprogramme, ${col}_decision, ${col}_new_symbol, ${col}_decided_by, ${col}_decided_at)
       VALUES ($1, $2, NULLIF($3, ''), $4, $5, $6, NOW())
       ON CONFLICT (document_symbol, entity, COALESCE(subprogramme, ''))
       DO UPDATE SET 
         ${col}_decision = EXCLUDED.${col}_decision,
         ${col}_new_symbol = EXCLUDED.${col}_new_symbol,
         ${col}_decided_by = EXCLUDED.${col}_decided_by,
         ${col}_decided_at = NOW()
       RETURNING *`,
      [documentSymbol, entity, sub, action.decision || null, action.newSymbol || null, user.email]
    );
    return NextResponse.json(toEntry(rows[0]));
  }

  return NextResponse.json({ error: "invalid action type" }, { status: 400 });
}

