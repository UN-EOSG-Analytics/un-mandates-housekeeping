/**
 * Shared utility functions for document metadata handling
 * Provides three-tier fallback logic for metadata fields
 */

/**
 * Document row structure from database queries
 * Contains data from multiple sources: public.documents, metadata_clean, and source_documents
 */
export interface DocumentMetadataRow {
  symbol: string;
  // public.documents (preferred for new/updated)
  doc_proper_title: string | null;
  doc_date_year: number | null;
  doc_issuing_body: string | null;
  doc_document_type: string | null;
  // source_documents_metadata_clean (existing citations)
  meta_title: string | null;
  meta_proper_title: string | null;
  meta_date_year: number | null;
  meta_issuing_body: string | null;
  meta_document_type: string | null;
  // source_documents ppb_ fields (final fallback)
  ppb_description: string | null;
  ppb_year: number | null;
  ppb_body: string | null;
  ppb_type: string | null;
  ppb_link?: string | null; // Optional, not always queried
}

/**
 * Resolved document metadata after applying fallback logic
 */
export interface ResolvedMetadata {
  title: string | null;
  year: number | null;
  body: string | null;
  docType: string | null;
  link: string | null;
  hasDbMetadata: boolean;
}

/**
 * Clean title by removing trailing colons and whitespace
 */
export function cleanTitle(title: string | null): string | null {
  return title?.replace(/\s*:\s*$/, "").trim() || null;
}

/**
 * Normalize document symbol by removing spaces before part letters
 * E.g., "A/RES/283 B" -> "A/RES/283B"
 */
export function normalizeSymbol(symbol: string): string {
  return symbol.replace(/(\d) ([A-Z])$/, "$1$2");
}

/**
 * Apply three-tier fallback logic to extract the best available metadata
 * Priority: public.documents > source_documents_metadata_clean > source_documents (ppb_)
 *
 * @param row Database row containing metadata from multiple sources
 * @param originalSymbol Original document symbol for link construction
 * @returns Resolved metadata with fallback applied
 */
export function resolveMetadata(
  row: DocumentMetadataRow,
  originalSymbol?: string,
): ResolvedMetadata {
  // Check if we have DB metadata (from public.documents or metadata_clean)
  const hasDbMetadata =
    row.doc_proper_title !== null ||
    row.meta_title !== null ||
    row.meta_proper_title !== null;

  // Title: doc.proper_title > meta.title > meta.proper_title > ppb_description
  const title =
    cleanTitle(row.doc_proper_title) ||
    row.meta_title ||
    row.meta_proper_title ||
    row.ppb_description ||
    null;

  // Year: doc_date_year > meta_date_year > ppb_year
  const year = row.doc_date_year ?? row.meta_date_year ?? row.ppb_year ?? null;

  // Body: doc_issuing_body > meta_issuing_body > ppb_body
  const body =
    row.doc_issuing_body || row.meta_issuing_body || row.ppb_body || null;

  // Type: doc_document_type > meta_document_type > ppb_type
  const docType =
    row.doc_document_type || row.meta_document_type || row.ppb_type || null;

  // Link construction with fallback
  let link: string | null = null;
  const symbolForLink = originalSymbol || row.symbol;

  if (row.doc_proper_title !== null) {
    // Document is in public.documents - construct link
    link = `https://docs.un.org/en/${symbolForLink.toUpperCase()}`;
  } else if (row.meta_title !== null || row.meta_proper_title !== null) {
    // Document is in metadata_clean - construct link
    link = `https://docs.un.org/en/${symbolForLink.toUpperCase()}`;
  } else if (row.ppb_link) {
    // Fall back to original ppb_link if available
    link = row.ppb_link;
  }

  return {
    title,
    year,
    body,
    docType,
    link,
    hasDbMetadata,
  };
}

/**
 * Build SQL placeholders for parameterized queries
 * @param count Number of parameters
 * @param offset Starting index (default: 1)
 * @returns Comma-separated placeholder string like "$1,$2,$3"
 */
export function buildPlaceholders(count: number, offset = 1): string {
  return Array.from({ length: count }, (_, i) => `$${i + offset}`).join(",");
}
