import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import type { MandateComment } from "@/types";

interface DbRow {
  id: string;
  document_symbol: string;
  entity: string;
  subprogramme: string | null;
  comment: string;
  user_email: string;
  user_entity: string | null;
  created_at: string;
}

const toComment = (row: DbRow): MandateComment => ({
  id: row.id,
  documentSymbol: row.document_symbol,
  entity: row.entity,
  subprogramme: row.subprogramme,
  comment: row.comment,
  userEmail: row.user_email,
  userEntity: row.user_entity,
  createdAt: row.created_at,
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const { documentSymbol, entity, subprogramme, comment } = body;

  if (!documentSymbol || !entity || !comment?.trim()) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const rows = await query<DbRow>(
    `WITH inserted AS (
      INSERT INTO mandates_housekeeping.mandate_comments 
        (document_symbol, entity, subprogramme, comment, user_email)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    )
    SELECT i.*, u.entity as user_entity
    FROM inserted i
    LEFT JOIN mandates_housekeeping.users u ON i.user_email = u.email`,
    [documentSymbol, entity, subprogramme || null, comment.trim(), user.email],
  );

  return NextResponse.json(toComment(rows[0]));
}
