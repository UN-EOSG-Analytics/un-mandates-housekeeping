import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!user.isPpbd)
    return NextResponse.json(
      { error: "only PPBD can approve" },
      { status: 403 },
    );

  const { decisionId, approved } = await req.json();
  if (!decisionId)
    return NextResponse.json({ error: "decisionId required" }, { status: 400 });

  const rows = await query<{
    id: string;
    approved_by: string | null;
    approved_at: string | null;
  }>(
    approved
      ? `UPDATE mandates_housekeeping.mandate_decisions 
         SET approved_by = $2, approved_at = NOW()
         WHERE id = $1
         RETURNING id, approved_by, approved_at`
      : `UPDATE mandates_housekeeping.mandate_decisions 
         SET approved_by = NULL, approved_at = NULL
         WHERE id = $1
         RETURNING id, approved_by, approved_at`,
    approved ? [decisionId, user.email] : [decisionId],
  );

  if (!rows[0])
    return NextResponse.json({ error: "decision not found" }, { status: 404 });
  return NextResponse.json({
    id: rows[0].id,
    approvedBy: rows[0].approved_by,
    approvedAt: rows[0].approved_at,
  });
}
