import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import type { MandateDecision, MandateComment, UserRole } from "@/types";

interface DecisionRow {
  id: string;
  document_symbol: string;
  entity: string;
  subprogramme: string | null;
  decision: string;
  new_symbol: string | null;
  user_email: string;
  user_entity: string | null;
  created_at: string;
  role: UserRole;
  approved_by: string | null;
  approved_at: string | null;
}

interface CommentRow {
  id: string;
  document_symbol: string;
  entity: string;
  subprogramme: string | null;
  comment: string;
  user_email: string;
  user_entity: string | null;
  created_at: string;
}

const toDecision = (row: DecisionRow): MandateDecision => ({
  id: row.id,
  documentSymbol: row.document_symbol,
  entity: row.entity,
  subprogramme: row.subprogramme,
  decision: row.decision as MandateDecision["decision"],
  newSymbol: row.new_symbol,
  userEmail: row.user_email,
  userEntity: row.user_entity,
  createdAt: row.created_at,
  role: row.role,
  approvedBy: row.approved_by,
  approvedAt: row.approved_at,
});

const toComment = (row: CommentRow): MandateComment => ({
  id: row.id,
  documentSymbol: row.document_symbol,
  entity: row.entity,
  subprogramme: row.subprogramme,
  comment: row.comment,
  userEmail: row.user_email,
  userEntity: row.user_entity,
  createdAt: row.created_at,
});

// Get all decisions and comments for a document across all entities
export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol");
  if (!symbol)
    return NextResponse.json({ error: "symbol required" }, { status: 400 });

  const [decisionRows, commentRows] = await Promise.all([
    query<DecisionRow>(
      `SELECT d.*, u.entity as user_entity,
              CASE WHEN u.entity = 'DMSPC' THEN 'ppbd' ELSE 'focal' END as role
       FROM mandates_housekeeping.mandate_decisions d
       LEFT JOIN mandates_housekeeping.users u ON d.user_email = u.email
       WHERE d.document_symbol = $1
       ORDER BY d.created_at`,
      [symbol],
    ),
    query<CommentRow>(
      `SELECT c.*, u.entity as user_entity
       FROM mandates_housekeeping.mandate_comments c
       LEFT JOIN mandates_housekeeping.users u ON c.user_email = u.email
       WHERE c.document_symbol = $1 
       ORDER BY c.created_at`,
      [symbol],
    ),
  ]);

  return NextResponse.json({
    decisions: decisionRows.map(toDecision),
    comments: commentRows.map(toComment),
  });
}
