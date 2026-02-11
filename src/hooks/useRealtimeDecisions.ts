"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getRealtimeChangesAction,
  type RealtimeChange,
  type ReviewModeStatus,
} from "@/features/mandates/actions/realtime";

// Re-export types for convenience
export type { RealtimeChange, ReviewModeStatus };

interface UseRealtimeDecisionsOptions {
  /** Entity to subscribe to */
  entity: string;
  /** Called when a change is received from another user */
  onRemoteChange?: (change: RealtimeChange) => void;
  /** Called when review mode status changes */
  onReviewModeChange?: (status: ReviewModeStatus) => void;
  /** Whether the hook is enabled (default: true) */
  enabled?: boolean;
  /** Polling interval in ms (default: 3000 = 3 seconds) */
  pollIntervalMs?: number;
}

interface UseRealtimeDecisionsReturn {
  /** Whether polling is active */
  isConnected: boolean;
  /** Last error message, if any */
  error: string | null;
  /** Current review mode status */
  reviewModeStatus: ReviewModeStatus | null;
  /** Manually trigger a poll */
  refresh: () => void;
}

/**
 * Hook for real-time decision/comment sync and review mode status via polling
 *
 * Polls the server every few seconds for changes and review mode updates.
 * Designed to work with Vercel serverless functions.
 *
 * Changes made by the current user are filtered out via timestamp comparison.
 */
export function useRealtimeDecisions({
  entity,
  onRemoteChange,
  onReviewModeChange,
  enabled = true,
  pollIntervalMs = 3000,
}: UseRealtimeDecisionsOptions): UseRealtimeDecisionsReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewModeStatus, setReviewModeStatus] =
    useState<ReviewModeStatus | null>(null);

  // Track last poll time to only fetch new changes
  const lastPollTimeRef = useRef<string>(new Date().toISOString());
  // Track IDs we've already processed to avoid duplicates
  const processedIdsRef = useRef<Set<string>>(new Set());
  // Polling interval ref
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Callback refs to avoid stale closures
  const onRemoteChangeRef = useRef(onRemoteChange);
  const onReviewModeChangeRef = useRef(onReviewModeChange);

  // Keep callback refs updated
  useEffect(() => {
    onRemoteChangeRef.current = onRemoteChange;
  }, [onRemoteChange]);

  useEffect(() => {
    onReviewModeChangeRef.current = onReviewModeChange;
  }, [onReviewModeChange]);

  const poll = useCallback(async () => {
    if (!enabled || !entity) return;

    try {
      const result = await getRealtimeChangesAction(
        entity,
        lastPollTimeRef.current,
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      const data = result.data;
      if (!data) {
        throw new Error("No data returned");
      }

      // Update last poll time from server
      if (data.serverTime) {
        lastPollTimeRef.current = data.serverTime;
      }

      setIsConnected(true);
      setError(null);

      // Update review mode status if present
      if (data.reviewMode) {
        const newStatus: ReviewModeStatus = {
          isUnderReview: data.reviewMode.isUnderReview,
          reviewSessionId: data.reviewMode.reviewSessionId,
          reviewStartedBy: data.reviewMode.reviewStartedBy,
        };
        setReviewModeStatus(newStatus);
        onReviewModeChangeRef.current?.(newStatus);
      }

      // Process changes
      if (data.hasChanges && data.changes?.length > 0) {
        for (const change of data.changes) {
          // Skip if already processed
          if (processedIdsRef.current.has(change.id)) continue;

          // Mark as processed
          processedIdsRef.current.add(change.id);

          // Prune processed set if it grows too large
          if (processedIdsRef.current.size > 500) {
            const arr = Array.from(processedIdsRef.current);
            processedIdsRef.current = new Set(arr.slice(-250));
          }

          // Notify callback
          onRemoteChangeRef.current?.(change);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Poll failed");
      setIsConnected(false);
    }
  }, [enabled, entity]);

  const refresh = useCallback(() => {
    poll();
  }, [poll]);

  // Start polling on mount
  useEffect(() => {
    if (!enabled || !entity) return;

    // Initial poll
    poll();

    // Set up interval
    pollIntervalRef.current = setInterval(poll, pollIntervalMs);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [enabled, entity, poll, pollIntervalMs]);

  return {
    isConnected,
    error,
    reviewModeStatus,
    refresh,
  };
}
