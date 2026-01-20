"use server";

import { revalidatePath } from "next/cache";
import { query } from "@/lib/db/db";
import { getCurrentUser } from "@/lib/auth/auth";
import type { MandateDecision, MandateComment, MandateState } from "@/types";

// Return type for actions
type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

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
  decision_reason: string | null;
  other_reason: string | null;
  user_email: string;
  user_entity: string | null;
  created_at: string;
  approved_by: string | null;
  approved_by_entity: string | null;
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
  resolved_at: string | null;
  resolved_by: string | null;
}

const toDecision = (row: DecisionRow): MandateDecision => ({
  id: row.id,
  documentSymbol: row.document_symbol,
  entity: row.entity,
  subprogramme: row.subprogramme,
  decision: row.decision as MandateDecision["decision"],
  newSymbol: row.new_symbol,
  manualMetadata: row.manual_metadata,
  decisionReason: row.decision_reason,
  otherReason: row.other_reason,
  userEmail: row.user_email,
  userEntity: row.user_entity,
  createdAt: row.created_at,
  approvedBy: row.approved_by,
  approvedByEntity: row.approved_by_entity,
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
  resolvedAt: row.resolved_at,
  resolvedBy: row.resolved_by,
});

/**
 * Get current user's role information
 */
export async function getUserRoleAction(): Promise<
  ActionResult<{
    email: string;
    entity: string | null;
    isReviewer: boolean;
    canReviewAnyEntity: boolean;
  }>
> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "unauthorized" };
  }

  return {
    success: true,
    data: {
      email: user.email,
      entity: user.entity,
      isReviewer: user.isReviewer,
      canReviewAnyEntity: user.canReviewAnyEntity || false,
    },
  };
}

/**
 * Get all decisions and comments for a specific entity
 */
export async function getEntityDecisionsAction(entity: string): Promise<
  ActionResult<{
    states: MandateState[];
    totalComments: Record<string, number>;
  }>
> {
  if (!entity) {
    return { success: false, error: "entity required" };
  }

  // Get all decisions, comments, and total comment counts per document
  const [decisionRows, commentRows, totalCommentRows] = await Promise.all([
    query<DecisionRow>(
      `SELECT d.*, u.entity as user_entity, approver.entity as approved_by_entity
       FROM mandates_housekeeping.mandate_decisions d
       LEFT JOIN mandates_housekeeping.users u ON d.user_email = u.email
       LEFT JOIN mandates_housekeeping.users approver ON d.approved_by = approver.email
       WHERE d.entity = $1
       ORDER BY d.created_at`,
      [entity],
    ),
    query<CommentRow>(
      `SELECT c.*, u.entity as user_entity
       FROM mandates_housekeeping.mandate_comments c
       LEFT JOIN mandates_housekeeping.users u ON c.user_email = u.email
       WHERE c.entity = $1 
       ORDER BY c.created_at`,
      [entity],
    ),
    query<{ document_symbol: string; count: string }>(
      `SELECT document_symbol, COUNT(*)::text as count 
       FROM mandates_housekeeping.mandate_comments 
       GROUP BY document_symbol`,
      [],
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
        decision: null,
        decisions: [],
        comments: [],
      };
    }
    const decision = toDecision(row);
    stateMap[key].decisions.push(decision);
    // Track latest decision (overwrites as we iterate, results are ORDER BY created_at)
    stateMap[key].decision = decision;
  }

  for (const row of commentRows) {
    const key = `${row.document_symbol}:${row.subprogramme || ""}`;
    if (!stateMap[key]) {
      stateMap[key] = {
        documentSymbol: row.document_symbol,
        entity: row.entity,
        subprogramme: row.subprogramme,
        decision: null,
        decisions: [],
        comments: [],
      };
    }
    stateMap[key].comments.push(toComment(row));
  }

  return {
    success: true,
    data: {
      states: Object.values(stateMap),
      totalComments: totalCommentsMap,
    },
  };
}

/**
 * Get all decisions and comments for a specific document across all entities
 */
export async function getDocumentDecisionsAction(
  symbol: string,
): Promise<
  ActionResult<{ decisions: MandateDecision[]; comments: MandateComment[] }>
> {
  if (!symbol) {
    return { success: false, error: "symbol required" };
  }

  const [decisionRows, commentRows] = await Promise.all([
    query<DecisionRow>(
      `SELECT d.*, u.entity as user_entity, approver.entity as approved_by_entity
       FROM mandates_housekeeping.mandate_decisions d
       LEFT JOIN mandates_housekeeping.users u ON d.user_email = u.email
       LEFT JOIN mandates_housekeeping.users approver ON d.approved_by = approver.email
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

  return {
    success: true,
    data: {
      decisions: decisionRows.map(toDecision),
      comments: commentRows.map(toComment),
    },
  };
}

/**
 * Create a new mandate decision
 */
export async function createDecisionAction(params: {
  documentSymbol: string;
  entity: string;
  subprogramme: string | null;
  decision: string;
  newSymbol?: string | null;
  manualMetadata?: ManualMetadata | null;
}): Promise<ActionResult<MandateDecision>> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "unauthorized" };
  }

  const {
    documentSymbol,
    entity,
    subprogramme,
    decision,
    newSymbol,
    manualMetadata,
  } = params;

  if (!documentSymbol || !entity || !decision) {
    return { success: false, error: "invalid request" };
  }

  // DMSPC users can review/edit any entity, others can only edit their own entity
  if (!user.canReviewAnyEntity && user.entity !== entity) {
    return {
      success: false,
      error: "You can only make decisions for your own entity",
    };
  }

  if (!user.entity && !user.canReviewAnyEntity) {
    return { success: false, error: "You must have an entity assigned" };
  }

  if (!["retain", "remove", "add", "update", "cancel"].includes(decision)) {
    return { success: false, error: "invalid decision" };
  }

  if (decision === "update" && !newSymbol) {
    return { success: false, error: "newSymbol required for update" };
  }

  // Validate manual metadata link if provided
  if (manualMetadata?.link && !/^https?:\/\/.+/.test(manualMetadata.link)) {
    return { success: false, error: "invalid link format" };
  }

  // Insert new decision event
  const rows = await query<DecisionRow>(
    `WITH inserted AS (
      INSERT INTO mandates_housekeeping.mandate_decisions 
        (document_symbol, entity, subprogramme, decision, new_symbol, manual_metadata, decision_reason, other_reason, user_email)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    )
    SELECT i.*, u.entity as user_entity, NULL::text as approved_by_entity
    FROM inserted i
    LEFT JOIN mandates_housekeeping.users u ON i.user_email = u.email`,
    [
      documentSymbol,
      entity,
      subprogramme || null,
      decision,
      newSymbol || null,
      manualMetadata ? JSON.stringify(manualMetadata) : null,
      null, // decision_reason - set later via updateDecisionReasonAction
      null, // other_reason - set later via updateDecisionReasonAction
      user.email,
    ],
  );

  revalidatePath(`/entity/${entity}`);

  return { success: true, data: toDecision(rows[0]) };
}

/**
 * Create a new comment
 */
export async function createCommentAction(params: {
  documentSymbol: string;
  entity: string;
  subprogramme: string | null;
  comment: string;
}): Promise<ActionResult<MandateComment>> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "unauthorized" };
  }

  const { documentSymbol, entity, subprogramme, comment } = params;

  if (!documentSymbol || !entity || !comment?.trim()) {
    return { success: false, error: "invalid request" };
  }

  // DMSPC users can comment on any entity, others can only comment on their own entity
  if (!user.canReviewAnyEntity && user.entity !== entity) {
    return { success: false, error: "You can only comment on your own entity" };
  }

  if (!user.entity && !user.canReviewAnyEntity) {
    return { success: false, error: "You must have an entity assigned" };
  }

  const rows = await query<CommentRow>(
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

  revalidatePath(`/entity/${entity}`);

  return { success: true, data: toComment(rows[0]) };
}

/**
 * Resolve or unresolve a comment
 */
export async function resolveCommentAction(
  commentId: string,
  resolved: boolean,
): Promise<ActionResult<MandateComment>> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "unauthorized" };
  }

  if (!commentId) {
    return { success: false, error: "commentId required" };
  }

  // Get the comment to check permissions
  const existingRows = await query<CommentRow>(
    `SELECT c.*, u.entity as user_entity
     FROM mandates_housekeeping.mandate_comments c
     LEFT JOIN mandates_housekeeping.users u ON c.user_email = u.email
     WHERE c.id = $1`,
    [commentId],
  );

  if (existingRows.length === 0) {
    return { success: false, error: "Comment not found" };
  }

  const existing = existingRows[0];

  // Only DMSPC (reviewers) can resolve comments, or the entity can resolve their own comments
  if (!user.canReviewAnyEntity && user.entity !== existing.entity) {
    return { success: false, error: "Not authorized to resolve this comment" };
  }

  const rows = await query<CommentRow>(
    `WITH updated AS (
      UPDATE mandates_housekeeping.mandate_comments 
      SET resolved_at = $2, resolved_by = $3
      WHERE id = $1
      RETURNING *
    )
    SELECT u2.*, users.entity as user_entity
    FROM updated u2
    LEFT JOIN mandates_housekeeping.users users ON u2.user_email = users.email`,
    [
      commentId,
      resolved ? new Date().toISOString() : null,
      resolved ? user.email : null,
    ],
  );

  revalidatePath(`/entity/${existing.entity}`);

  return { success: true, data: toComment(rows[0]) };
}

/**
 * Approve or unapprove a decision (reviewer only)
 */
export async function approveDecisionAction(
  decisionId: string,
  approved: boolean,
): Promise<
  ActionResult<{
    id: string;
    approvedBy: string | null;
    approvedAt: string | null;
  }>
> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "unauthorized" };
  }

  if (!user.isReviewer) {
    return { success: false, error: "only reviewers can approve" };
  }

  if (!decisionId) {
    return { success: false, error: "decisionId required" };
  }

  const rows = await query<{
    id: string;
    entity: string;
    approved_by: string | null;
    approved_at: string | null;
  }>(
    approved
      ? `UPDATE mandates_housekeeping.mandate_decisions 
         SET approved_by = $2, approved_at = NOW()
         WHERE id = $1
         RETURNING id, entity, approved_by, approved_at`
      : `UPDATE mandates_housekeeping.mandate_decisions 
         SET approved_by = NULL, approved_at = NULL
         WHERE id = $1
         RETURNING id, entity, approved_by, approved_at`,
    approved ? [decisionId, user.email] : [decisionId],
  );

  if (!rows[0]) {
    return { success: false, error: "decision not found" };
  }

  revalidatePath(`/entity/${rows[0].entity}`);

  return {
    success: true,
    data: {
      id: rows[0].id,
      approvedBy: rows[0].approved_by,
      approvedAt: rows[0].approved_at,
    },
  };
}

/**
 * Update the reason for an existing decision
 */
export async function updateDecisionReasonAction(params: {
  decisionId: string;
  decisionReason: string | null;
  otherReason: string | null;
}): Promise<ActionResult<MandateDecision>> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "unauthorized" };
  }

  const { decisionId, decisionReason, otherReason } = params;

  if (!decisionId) {
    return { success: false, error: "decisionId required" };
  }

  // Get the existing decision to check permissions
  const existingRows = await query<DecisionRow>(
    `SELECT d.*, u.entity as user_entity, approver.entity as approved_by_entity
     FROM mandates_housekeeping.mandate_decisions d
     LEFT JOIN mandates_housekeeping.users u ON d.user_email = u.email
     LEFT JOIN mandates_housekeeping.users approver ON d.approved_by = approver.email
     WHERE d.id = $1`,
    [decisionId],
  );

  if (existingRows.length === 0) {
    return { success: false, error: "Decision not found" };
  }

  const existing = existingRows[0];

  // DMSPC users can update any entity, others can only update their own entity
  if (!user.canReviewAnyEntity && user.entity !== existing.entity) {
    return {
      success: false,
      error: "You can only update reasons for your own entity",
    };
  }

  // Update the decision reason
  const rows = await query<DecisionRow>(
    `WITH updated AS (
      UPDATE mandates_housekeeping.mandate_decisions 
      SET decision_reason = $2, other_reason = $3
      WHERE id = $1
      RETURNING *
    )
    SELECT u.*, users.entity as user_entity, approver.entity as approved_by_entity
    FROM updated u
    LEFT JOIN mandates_housekeeping.users users ON u.user_email = users.email
    LEFT JOIN mandates_housekeeping.users approver ON u.approved_by = approver.email`,
    [
      decisionId,
      decisionReason,
      decisionReason === "other" ? otherReason : null,
    ],
  );

  revalidatePath(`/entity/${existing.entity}`);

  return { success: true, data: toDecision(rows[0]) };
}
