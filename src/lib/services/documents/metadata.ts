/**
 * Document metadata service with smart caching
 * Provides unified document metadata fetching for both server and client components
 */

import { unstable_cache } from "next/cache";
import { query } from "@/lib/db/db";
import {
  type DocumentMetadataRow,
  normalizeSymbol,
  resolveMetadata,
  buildPlaceholders,
} from "./metadata-utils";

export interface DocumentMetadata {
  title: string | null;
  year: number | null;
  body: string | null;
  docType: string | null;
  link: string | null;
}

/**
 * Fetch document metadata from database with three-tier fallback:
 * 1. public.documents (doc_*) - preferred for new/updated documents
 * 2. source_documents_metadata_clean (meta_*) - existing citations
 * 3. source_documents (ppb_*) - final fallback
 *
 * Uses Next.js unstable_cache for smart caching with 1-hour TTL
 */
export const fetchDocumentMetadata = unstable_cache(
  async (
    symbols: string[],
  ): Promise<Record<string, DocumentMetadata | null>> => {
    if (symbols.length === 0) {
      return {};
    }

    // Build map of normalized -> original symbols
    const normalizedMap: Record<string, string> = {};
    const allSymbols: string[] = [];
    for (const sym of symbols) {
      const norm = normalizeSymbol(sym);
      normalizedMap[sym] = sym;
      normalizedMap[norm] = sym;
      allSymbols.push(sym);
      if (norm !== sym) allSymbols.push(norm);
    }
    const uniqueSymbols = [...new Set(allSymbols)];

    const placeholders1 = buildPlaceholders(uniqueSymbols.length, 1);
    const placeholders2 = buildPlaceholders(
      uniqueSymbols.length,
      uniqueSymbols.length + 1,
    );
    const placeholders3 = buildPlaceholders(
      uniqueSymbols.length,
      uniqueSymbols.length * 2 + 1,
    );

    // Query both source_documents and public.documents to handle:
    // 1. Documents in PPB source data (with optional metadata enrichment)
    // 2. Documents only in public.documents (new resolutions not yet in PPB)
    const rows = await query<DocumentMetadataRow>(
      `SELECT 
         COALESCE(doc.symbol, sd.ppb_full_document_symbol) as symbol,
         -- public.documents (preferred for new/updated)
         doc.proper_title as doc_proper_title,
         doc.date_year as doc_date_year,
         doc.issuing_body as doc_issuing_body,
         doc.document_type as doc_document_type,
         -- source_documents_metadata_clean (existing citations)
         m.title as meta_title,
         m.proper_title as meta_proper_title,
         m.date_year::integer as meta_date_year,
         m.issuing_body as meta_issuing_body,
         m.document_type as meta_document_type,
         -- source_documents ppb_ fields (final fallback)
         sd.ppb_description,
         sd.ppb_year,
         sd.ppb_body,
         sd.ppb_type
       FROM ppb2026.source_documents sd
       LEFT JOIN public.documents doc 
         ON REGEXP_REPLACE(sd.ppb_full_document_symbol, '(\\d) ([A-Z])$', '\\1\\2') = doc.symbol
       LEFT JOIN ppb2026.source_documents_metadata_clean m
         ON sd.ppb_full_document_symbol = m.ppb_full_document_symbol
       WHERE sd.ppb_full_document_symbol IN (${placeholders1})
          OR doc.symbol IN (${placeholders2})
       
       UNION ALL
       
       -- Also query public.documents directly for documents not in source_documents
       SELECT 
         doc.symbol,
         doc.proper_title as doc_proper_title,
         doc.date_year as doc_date_year,
         doc.issuing_body as doc_issuing_body,
         doc.document_type as doc_document_type,
         NULL as meta_title,
         NULL as meta_proper_title,
         NULL as meta_date_year,
         NULL as meta_issuing_body,
         NULL as meta_document_type,
         NULL as ppb_description,
         NULL as ppb_year,
         NULL as ppb_body,
         NULL as ppb_type
       FROM public.documents doc
       WHERE doc.symbol IN (${placeholders3})
         AND NOT EXISTS (
           SELECT 1 FROM ppb2026.source_documents sd 
           WHERE REGEXP_REPLACE(sd.ppb_full_document_symbol, '(\\d) ([A-Z])$', '\\1\\2') = doc.symbol
         )`,
      [...uniqueSymbols, ...uniqueSymbols, ...uniqueSymbols],
    );

    const result: Record<string, DocumentMetadata | null> = {};
    for (const row of rows) {
      const originalSymbol = normalizedMap[row.symbol];
      if (originalSymbol && !(originalSymbol in result)) {
        const resolved = resolveMetadata(row, originalSymbol);
        result[originalSymbol] = {
          title: resolved.title,
          year: resolved.year,
          body: resolved.body,
          docType: resolved.docType,
          link: resolved.link,
        };
      }
    }

    // Add null entries for symbols not found
    for (const symbol of symbols) {
      if (!(symbol in result)) {
        result[symbol] = null;
      }
    }

    return result;
  },
  ["document-metadata"], // Cache key base
  {
    revalidate: 3600, // 1 hour cache
    tags: ["document-metadata"], // Tag for selective invalidation
  },
);
