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

  // Reviewers (DMSPC entity + in allowed_reviewers list) can edit any entity
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

  // Check if entity is under review (blocks non-reviewers)
  const reviewBlock = await checkReviewModeBlock(
    entity,
    user.email,
    user.isReviewer,
  );
  if (reviewBlock) {
    return { success: false, error: reviewBlock };
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

  // Reviewers (DMSPC entity + in allowed_reviewers list) can comment on any entity
  if (!user.canReviewAnyEntity && user.entity !== entity) {
    return { success: false, error: "You can only comment on your own entity" };
  }

  if (!user.entity && !user.canReviewAnyEntity) {
    return { success: false, error: "You must have an entity assigned" };
  }

  // Note: Comments are always allowed, even during review mode
  // Only decisions are blocked during review

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

  // Check if entity is under review (blocks non-reviewers)
  const reviewBlock = await checkReviewModeBlock(
    existing.entity,
    user.email,
    user.isReviewer,
  );
  if (reviewBlock) {
    return { success: false, error: reviewBlock };
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

// Document versions
import { fetchAllVersions, type DocumentVersion } from "./document-versions";

export async function getDocumentVersionsAction(
  symbol: string,
): Promise<ActionResult<DocumentVersion[]>> {
  try {
    const versions = await fetchAllVersions(symbol);
    return { success: true, data: versions };
  } catch (error) {
    console.error("Error fetching document versions:", error);
    return { success: false, error: "Failed to fetch document versions" };
  }
}

// Document diff using undifferent library
import { fetchUNDocument } from "undifferent/un-fetcher";
import { diff, type DiffResult } from "undifferent/core";

/**
 * Strip resolution suffix (A, B, etc.) from symbol if present
 * E.g. "A/RES/49/222A" -> "A/RES/49/222"
 */
function stripResolutionSuffix(symbol: string): string | null {
  // Match symbols ending with a letter suffix like A/RES/49/222A or A/RES/49/222 A
  const match = symbol.match(/^(.+\/RES\/\d+\/\d+)\s*[A-Z]$/);
  return match ? match[1] : null;
}

/**
 * Try to fetch a UN document, with fallback to stripped suffix
 */
async function fetchDocumentWithFallback(symbol: string) {
  try {
    return await fetchUNDocument(symbol);
  } catch (error) {
    // If failed, try without suffix (e.g., A/RES/49/222A -> A/RES/49/222)
    const stripped = stripResolutionSuffix(symbol);
    if (stripped) {
      console.log(`[Diff] Retrying ${symbol} as ${stripped}`);
      return await fetchUNDocument(stripped);
    }
    throw error;
  }
}

export async function computeDocumentDiffAction(
  originalSymbol: string,
  compareSymbol: string,
): Promise<ActionResult<DiffResult>> {
  try {
    const [originalDoc, compareDoc] = await Promise.all([
      fetchDocumentWithFallback(originalSymbol),
      fetchDocumentWithFallback(compareSymbol),
    ]);

    if (!originalDoc || !originalDoc.lines.length) {
      return {
        success: false,
        error: `Could not fetch document: ${originalSymbol}`,
      };
    }
    if (!compareDoc || !compareDoc.lines.length) {
      return {
        success: false,
        error: `Could not fetch document: ${compareSymbol}`,
      };
    }

    const diffResult = diff(originalDoc.lines, compareDoc.lines, {
      threshold: 0.8,
    });
    return { success: true, data: diffResult };
  } catch (error) {
    console.error("Error computing document diff:", error);
    const errorMsg =
      error instanceof Error
        ? error.message
        : "Failed to compute document diff";
    // Provide more helpful error message
    if (errorMsg.includes("No available format")) {
      return {
        success: false,
        error:
          "Document not available on UN ODS. Older or variant resolutions may not have downloadable files.",
      };
    }
    return { success: false, error: errorMsg };
  }
}

// ============================================
// Review Mode Actions
// ============================================

export interface ReviewModeStatus {
  isUnderReview: boolean;
  startedBy: string | null;
  startedByEntity: string | null;
  startedAt: string | null;
}

/**
 * Check if an entity is currently under review
 */
export async function getReviewModeStatusAction(
  entity: string,
): Promise<ActionResult<ReviewModeStatus>> {
  if (!entity) {
    return { success: false, error: "entity required" };
  }

  const rows = await query<{
    started_by: string;
    started_at: string;
    user_entity: string | null;
  }>(
    `SELECT r.started_by, r.started_at, u.entity as user_entity
     FROM mandates_housekeeping.entity_review_mode r
     LEFT JOIN mandates_housekeeping.users u ON r.started_by = u.email
     WHERE r.entity = $1 AND r.ended_at IS NULL`,
    [entity],
  );

  if (rows.length === 0) {
    return {
      success: true,
      data: {
        isUnderReview: false,
        startedBy: null,
        startedByEntity: null,
        startedAt: null,
      },
    };
  }

  return {
    success: true,
    data: {
      isUnderReview: true,
      startedBy: rows[0].started_by,
      startedByEntity: rows[0].user_entity,
      startedAt: rows[0].started_at,
    },
  };
}

/**
 * Start review mode for an entity (reviewers only)
 */
export async function startReviewModeAction(
  entity: string,
): Promise<ActionResult<ReviewModeStatus>> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "unauthorized" };
  }

  if (!user.isReviewer) {
    return { success: false, error: "Only reviewers can start review mode" };
  }

  if (!entity) {
    return { success: false, error: "entity required" };
  }

  // Check if already under review
  const existingRows = await query<{ started_by: string }>(
    `SELECT started_by FROM mandates_housekeeping.entity_review_mode 
     WHERE entity = $1 AND ended_at IS NULL`,
    [entity],
  );

  if (existingRows.length > 0) {
    return {
      success: false,
      error: `Entity is already under review by ${existingRows[0].started_by}`,
    };
  }

  // Start review mode (upsert - end any previous review and start new)
  await query(
    `INSERT INTO mandates_housekeeping.entity_review_mode (entity, started_by)
     VALUES ($1, $2)
     ON CONFLICT (entity) DO UPDATE SET 
       started_by = EXCLUDED.started_by,
       started_at = NOW(),
       ended_at = NULL,
       ended_by = NULL`,
    [entity, user.email],
  );

  revalidatePath(`/entity/${encodeURIComponent(entity)}`);

  return {
    success: true,
    data: {
      isUnderReview: true,
      startedBy: user.email,
      startedByEntity: user.entity,
      startedAt: new Date().toISOString(),
    },
  };
}

/**
 * End review mode for an entity (reviewers only)
 */
export async function endReviewModeAction(
  entity: string,
): Promise<ActionResult<ReviewModeStatus>> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "unauthorized" };
  }

  if (!user.isReviewer) {
    return { success: false, error: "Only reviewers can end review mode" };
  }

  if (!entity) {
    return { success: false, error: "entity required" };
  }

  await query(
    `UPDATE mandates_housekeeping.entity_review_mode 
     SET ended_at = NOW(), ended_by = $2
     WHERE entity = $1 AND ended_at IS NULL`,
    [entity, user.email],
  );

  revalidatePath(`/entity/${encodeURIComponent(entity)}`);

  return {
    success: true,
    data: {
      isUnderReview: false,
      startedBy: null,
      startedByEntity: null,
      startedAt: null,
    },
  };
}

/**
 * Check if entity is under review - for use in decision actions
 * Returns error string if blocked, null if allowed
 */
async function checkReviewModeBlock(
  entity: string,
  userEmail: string,
  isReviewer: boolean,
): Promise<string | null> {
  // Reviewers can always make changes
  if (isReviewer) {
    return null;
  }

  const rows = await query<{ started_by: string }>(
    `SELECT started_by FROM mandates_housekeeping.entity_review_mode 
     WHERE entity = $1 AND ended_at IS NULL`,
    [entity],
  );

  if (rows.length > 0) {
    return "review_mode_blocked";
  }

  return null;
}
