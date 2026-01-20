/**
 * Service for fetching all versions of a document
 * Based on normalized_title within the same issuing_body
 */

import { query } from "../db/db";

export interface DocumentVersion {
  symbol: string;
  title: string | null;
  year: number;
  body: string | null;
}

interface DocumentVersionRow {
  symbol: string;
  proper_title: string | null;
  date_year: number;
  issuing_body: string | null;
}

/**
 * Fetch all versions of a document (all documents with same normalized_title and issuing_body)
 * Returns array sorted by year ascending (oldest first)
 */
export async function fetchAllVersions(
  symbol: string,
): Promise<DocumentVersion[]> {
  // First, get the normalized_title and issuing_body for the current document
  const currentDoc = await query<{
    normalized_title: string;
    issuing_body: string;
  }>(
    `SELECT normalized_title, issuing_body
     FROM public.documents
     WHERE symbol = $1
       AND normalized_title IS NOT NULL
       AND issuing_body IS NOT NULL
     LIMIT 1`,
    [symbol],
  );

  if (currentDoc.length === 0) {
    // Document doesn't have normalized_title or issuing_body
    return [];
  }

  const { normalized_title, issuing_body } = currentDoc[0];

  // Now find all documents with the same normalized_title and issuing_body
  const rows = await query<DocumentVersionRow>(
    `SELECT 
      symbol,
      proper_title,
      date_year,
      issuing_body
    FROM public.documents
    WHERE normalized_title = $1
      AND issuing_body = $2
      AND date_year IS NOT NULL
    ORDER BY date_year ASC, symbol ASC`,
    [normalized_title, issuing_body],
  );

  return rows.map((row) => ({
    symbol: row.symbol,
    title: row.proper_title,
    year: row.date_year,
    body: row.issuing_body,
  }));
}
