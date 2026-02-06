"use server";

import { revalidatePath } from "next/cache";
import { query } from "@/lib/db/db";
import { getCurrentUser } from "@/features/auth/auth";

// Return type for actions
type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

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
export async function checkReviewModeBlock(
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
