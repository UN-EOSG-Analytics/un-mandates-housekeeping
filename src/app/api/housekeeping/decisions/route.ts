import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import type { MandateDecision, MandateComment, MandateState, UserRole } from "@/types";

interface ManualMetadata {
  title?: string;
  body?: string;
  year?: number;
  link?: string;
}

interface DecisionRow {
  id: string;
  document_symbol: string;
  entity: string;
  subprogramme: string | null;
  decision: string;
  new_symbol: string | null;
  manual_metadata: ManualMetadata | null;
  user_email: string;
  created_at: string;
  role: UserRole;
}

interface CommentRow {
  id: string;
  document_symbol: string;
  entity: string;
  subprogramme: string | null;
  comment: string;
  user_email: string;
  created_at: string;
}

const toDecision = (row: DecisionRow): MandateDecision => ({
  id: row.id,
  documentSymbol: row.document_symbol,
  entity: row.entity,
  subprogramme: row.subprogramme,
  decision: row.decision as MandateDecision["decision"],
  newSymbol: row.new_symbol,
  manualMetadata: row.manual_metadata,
  userEmail: row.user_email,
  createdAt: row.created_at,
  role: row.role,
});

const toComment = (row: CommentRow): MandateComment => ({
  id: row.id,
  documentSymbol: row.document_symbol,
  entity: row.entity,
  subprogramme: row.subprogramme,
  comment: row.comment,
  userEmail: row.user_email,
  createdAt: row.created_at,
});

export async function GET(req: NextRequest) {
  const entity = req.nextUrl.searchParams.get("entity");
  if (!entity) return NextResponse.json({ error: "entity required" }, { status: 400 });

  // Get all decisions, comments, and total comment counts per document
  const [decisionRows, commentRows, totalCommentRows] = await Promise.all([
    query<DecisionRow>(
      `SELECT d.*, CASE WHEN p.email IS NOT NULL THEN 'ppbd' ELSE 'focal' END as role
       FROM mandates_housekeeping.mandate_decisions d
       LEFT JOIN mandates_housekeeping.ppbd_reviewers p ON d.user_email = p.email
       WHERE d.entity = $1
       ORDER BY d.created_at`,
      [entity]
    ),
    query<CommentRow>(
      `SELECT * FROM mandates_housekeeping.mandate_comments WHERE entity = $1 ORDER BY created_at`,
      [entity]
    ),
    query<{ document_symbol: string; count: string }>(
      `SELECT document_symbol, COUNT(*)::text as count 
       FROM mandates_housekeeping.mandate_comments 
       GROUP BY document_symbol`,
      []
    ),
  ]);

  // Build total comments lookup
  const totalCommentsMap: Record<string, number> = {};
  for (const row of totalCommentRows) {
    totalCommentsMap[row.document_symbol] = parseInt(row.count);
  }

  // Group into MandateState objects
  const stateMap: Record<string, MandateState> = {};
  
  for (const row of decisionRows) {
    const key = `${row.document_symbol}:${row.subprogramme || ""}`;
    if (!stateMap[key]) {
      stateMap[key] = {
        documentSymbol: row.document_symbol,
        entity: row.entity,
        subprogramme: row.subprogramme,
        focal: null,
        ppbd: null,
        decisions: [],
        comments: [],
      };
    }
    const decision = toDecision(row);
    stateMap[key].decisions.push(decision);
    // Track latest per role
    stateMap[key][row.role] = decision;
  }

  for (const row of commentRows) {
    const key = `${row.document_symbol}:${row.subprogramme || ""}`;
    if (!stateMap[key]) {
      stateMap[key] = {
        documentSymbol: row.document_symbol,
        entity: row.entity,
        subprogramme: row.subprogramme,
        focal: null,
        ppbd: null,
        decisions: [],
        comments: [],
      };
    }
    stateMap[key].comments.push(toComment(row));
  }

  return NextResponse.json({
    states: Object.values(stateMap),
    totalComments: totalCommentsMap,
  });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const { documentSymbol, entity, subprogramme, decision, newSymbol, manualMetadata } = body;

  if (!documentSymbol || !entity || !decision) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  if (!["retain", "remove", "add", "update", "cancel"].includes(decision)) {
    return NextResponse.json({ error: "invalid decision" }, { status: 400 });
  }

  if (decision === "update" && !newSymbol) {
    return NextResponse.json({ error: "newSymbol required for update" }, { status: 400 });
  }

  // Validate manual metadata link if provided
  if (manualMetadata?.link && !/^https?:\/\/.+/.test(manualMetadata.link)) {
    return NextResponse.json({ error: "invalid link format" }, { status: 400 });
  }

  // Insert new decision event
  const rows = await query<DecisionRow>(
    `WITH inserted AS (
      INSERT INTO mandates_housekeeping.mandate_decisions 
        (document_symbol, entity, subprogramme, decision, new_symbol, manual_metadata, user_email)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    )
    SELECT i.*, 
           CASE WHEN p.email IS NOT NULL THEN 'ppbd' ELSE 'focal' END as role
    FROM inserted i
    LEFT JOIN mandates_housekeeping.ppbd_reviewers p ON i.user_email = p.email`,
    [documentSymbol, entity, subprogramme || null, decision, newSymbol || null, manualMetadata ? JSON.stringify(manualMetadata) : null, user.email]
  );

  return NextResponse.json(toDecision(rows[0]));
}

