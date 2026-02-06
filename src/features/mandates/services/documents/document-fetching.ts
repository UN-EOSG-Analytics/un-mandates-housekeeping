"use server";

import {
  fetchAllVersions,
  type DocumentVersion,
} from "./document-versions";
import {
  fetchDocumentMetadata,
  type DocumentMetadata,
} from "./metadata";
import { fetchUNDocument } from "undifferent/un-fetcher";
import { diff, type DiffResult } from "undifferent/core";

// Return type for actions
type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

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

/**
 * Fetch metadata for multiple document symbols
 * Uses smart caching with 1-hour TTL
 */
export async function getDocumentMetadataAction(
  symbols: string[],
): Promise<ActionResult<Record<string, DocumentMetadata | null>>> {
  try {
    const result = await fetchDocumentMetadata(symbols);
    return { success: true, data: result };
  } catch (error) {
    console.error("Error fetching document metadata:", error);
    return { success: false, error: "Failed to fetch document metadata" };
  }
}

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
