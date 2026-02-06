"use server";

/**
 * Realtime change polling for multi-user collaboration
 *
 * Tracks new decisions and comments to show updates from other users.
 * Designed for polling pattern (hooks call this every few seconds).
 * Future: Can extend to track approvals, metadata updates, etc.
 */

import { getCurrentUser } from "@/features/auth/auth";
import { query } from "@/lib/db/db";

// Return type for actions
type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

export interface RealtimeChange {
  id: string;
  table: "mandate_decisions" | "mandate_comments";
  document_symbol: string;
  subprogramme: string | null;
  created_at: string;
}

export interface ReviewModeStatus {
  isUnderReview: boolean;
  reviewStartedBy: string | null;
}

export interface RealtimeChangesData {
  changes: RealtimeChange[];
  serverTime: string;
  hasChanges: boolean;
  reviewMode: ReviewModeStatus;
}

/**
 * Get realtime changes for an entity since a specific timestamp
 * Returns new decisions, comments, and review mode status
 *
 * @param entity Entity to query
 * @param since ISO timestamp or epoch ms to query changes after
 * @returns Recent changes and current review mode status
 */
export async function getRealtimeChangesAction(
  entity: string,
  since?: string,
): Promise<ActionResult<RealtimeChangesData>> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  if (!entity) {
    return { success: false, error: "Entity required" };
  }

  // Parse since timestamp - default to 30 seconds ago if not provided
  const sinceDate = since
    ? new Date(isNaN(Number(since)) ? since : Number(since))
    : new Date(Date.now() - 30000);

  try {
    interface ChangeRecord {
      id: string;
      table: "mandate_decisions" | "mandate_comments";
      document_symbol: string;
      subprogramme: string | null;
      created_at: string;
    }

    // Query for recent decisions, comments, and review mode status in parallel
    const [decisions, comments, reviewModeResult] = await Promise.all([
      query<ChangeRecord>(
        `SELECT 
          id, 
          'mandate_decisions'::text as table,
          document_symbol,
          subprogramme,
          created_at::text
        FROM mandates_housekeeping.mandate_decisions
        WHERE entity = $1 AND created_at > $2::timestamptz
        ORDER BY created_at DESC
        LIMIT 50`,
        [entity, sinceDate.toISOString()],
      ),
      query<ChangeRecord>(
        `SELECT 
          id,
          'mandate_comments'::text as table,
          document_symbol,
          subprogramme,
          created_at::text
        FROM mandates_housekeeping.mandate_comments
        WHERE entity = $1 AND created_at > $2::timestamptz
        ORDER BY created_at DESC
        LIMIT 50`,
        [entity, sinceDate.toISOString()],
      ),
      query<{ started_by: string | null; ended_at: string | null }>(
        `SELECT started_by, ended_at
        FROM mandates_housekeeping.entity_review_mode
        WHERE entity = $1 AND ended_at IS NULL`,
        [entity],
      ),
    ]);

    // Dedupe by document_symbol + subprogramme, keeping most recent
    const changesMap = new Map<string, ChangeRecord>();

    for (const record of [...decisions, ...comments]) {
      const key = `${record.document_symbol}:${record.subprogramme || ""}`;
      const existing = changesMap.get(key);

      // Keep the most recent change for each document
      if (
        !existing ||
        new Date(record.created_at) > new Date(existing.created_at)
      ) {
        changesMap.set(key, record);
      }
    }

    const changes = Array.from(changesMap.values());
    const serverTime = new Date().toISOString();

    // Extract review mode status
    const reviewMode: ReviewModeStatus = {
      isUnderReview: reviewModeResult.length > 0,
      reviewStartedBy: reviewModeResult[0]?.started_by ?? null,
    };

    return {
      success: true,
      data: {
        changes,
        serverTime,
        hasChanges: changes.length > 0,
        reviewMode,
      },
    };
  } catch (error) {
    console.error("[Realtime] Poll error:", error);
    return {
      success: false,
      error: "Failed to fetch changes",
    };
  }
}
