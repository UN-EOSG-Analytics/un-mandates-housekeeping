/**
 * Service for detecting newer versions of documents
 * Based on normalized_title within the same issuing_body
 */

import { query } from "@/lib/db/db";
import type { NewerVersion } from "@/types";

interface NewerVersionRow {
  current_symbol: string;
  newer_symbol: string;
  newer_title: string | null;
  newer_year: number;
  newer_body: string | null;
  all_newer: { symbol: string; year: number }[];
}

/**
 * Fetch newer versions for a batch of document symbols
 * Returns a map of current symbol -> newer version info
 */
export async function fetchNewerVersions(
  symbols: string[],
): Promise<Map<string, NewerVersion>> {
  if (symbols.length === 0) {
    return new Map();
  }

  // Query to find the latest version for each symbol that has a newer document
  // with the same normalized_title and issuing_body, plus all newer version symbols
  const rows = await query<NewerVersionRow>(
    `WITH current_docs AS (
      SELECT 
        symbol,
        normalized_title,
        issuing_body,
        date_year
      FROM public.documents
      WHERE symbol = ANY($1)
        AND normalized_title IS NOT NULL
        AND issuing_body IS NOT NULL
        AND date_year IS NOT NULL
    ),
    all_newer AS (
      SELECT
        c.symbol AS current_symbol,
        d.symbol AS newer_symbol,
        d.proper_title AS newer_title,
        d.date_year AS newer_year,
        d.issuing_body AS newer_body
      FROM current_docs c
      JOIN public.documents d
        ON c.normalized_title = d.normalized_title
        AND c.issuing_body = d.issuing_body
        AND d.date_year > c.date_year
    ),
    latest_versions AS (
      SELECT DISTINCT ON (current_symbol)
        current_symbol,
        newer_symbol,
        newer_title,
        newer_year,
        newer_body,
        ARRAY(
          SELECT jsonb_build_object('symbol', an.newer_symbol, 'year', an.newer_year)
          FROM all_newer an 
          WHERE an.current_symbol = all_newer.current_symbol
        ) AS all_newer
      FROM all_newer
      ORDER BY current_symbol, newer_year DESC
    )
    SELECT * FROM latest_versions`,
    [symbols],
  );

  const result = new Map<string, NewerVersion>();
  for (const row of rows) {
    result.set(row.current_symbol, {
      symbol: row.newer_symbol,
      title: row.newer_title,
      year: row.newer_year,
      body: row.newer_body,
      allNewer: row.all_newer || [],
    });
  }

  return result;
}

/**
 * Check if a single document has a newer version
 */
export async function hasNewerVersion(
  symbol: string,
): Promise<NewerVersion | null> {
  const versions = await fetchNewerVersions([symbol]);
  return versions.get(symbol) || null;
}
