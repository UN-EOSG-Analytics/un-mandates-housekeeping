/**
 * Client-side data fetching utilities
 * Functions that can be used in client components
 */

// FIXME TODO

import type { Paragraph } from "@/types";

/**
 * Fetch paragraphs for a specific document
 * Returns paragraph data from static JSON files
 */
export async function fetchParagraphs(
  symbol: string,
): Promise<Paragraph[] | null> {
  const safeSymbol = symbol.replace(/\//g, "_").replace(/ /g, "_");

  try {
    const res = await fetch(`/data/paragraphs/${safeSymbol}.json`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
