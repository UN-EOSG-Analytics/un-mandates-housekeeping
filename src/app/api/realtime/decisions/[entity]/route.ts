/**
 * Polling endpoint for real-time decision/comment updates
 * 
 * Returns changes since `since` timestamp for efficient polling.
 * Designed for Vercel serverless (no long-lived connections).
 */

import { getCurrentUser } from "@/lib/auth/auth";
import { query } from "@/lib/db/db";
import { NextResponse } from "next/server";

// Vercel serverless config
export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // Required for pg database driver
export const maxDuration = 10; // 10 second timeout (default is 10s on Hobby, 60s on Pro)

interface ChangeRecord {
  id: string;
  table: "mandate_decisions" | "mandate_comments";
  document_symbol: string;
  subprogramme: string | null;
  created_at: string;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ entity: string }> },
) {
  const { entity } = await params;

  // Auth check
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Validate entity parameter
  if (!entity || typeof entity !== "string") {
    return NextResponse.json({ error: "Entity required" }, { status: 400 });
  }

  // Get `since` timestamp from query params (ISO string or epoch ms)
  const url = new URL(request.url);
  const sinceParam = url.searchParams.get("since");
  
  // Default to 30 seconds ago if no timestamp provided
  const since = sinceParam 
    ? new Date(isNaN(Number(sinceParam)) ? sinceParam : Number(sinceParam))
    : new Date(Date.now() - 30000);

  try {
    // Query for recent decisions and comments since the timestamp
    // Uses indexed created_at column with TIMESTAMPTZ comparison
    const [decisions, comments] = await Promise.all([
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
        [entity, since.toISOString()],
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
        [entity, since.toISOString()],
      ),
    ]);

    // Dedupe by document_symbol + subprogramme, keeping most recent
    const changesMap = new Map<string, ChangeRecord>();
    
    for (const record of [...decisions, ...comments]) {
      const key = `${record.document_symbol}:${record.subprogramme || ""}`;
      const existing = changesMap.get(key);
      
      // Keep the most recent change for each document
      if (!existing || new Date(record.created_at) > new Date(existing.created_at)) {
        changesMap.set(key, record);
      }
    }

    const changes = Array.from(changesMap.values());
    const serverTime = new Date().toISOString();

    return NextResponse.json(
      {
        changes,
        serverTime,
        hasChanges: changes.length > 0,
      },
      {
        headers: {
          // Prevent any caching for real-time data
          "Cache-Control": "private, no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      },
    );
  } catch (error) {
    console.error("[Realtime] Poll error:", error);
    return NextResponse.json(
      { error: "Failed to fetch changes" },
      { status: 500 },
    );
  }
}
