/**
 * Pure (client-safe) types and helpers for the co-citation matrix. Kept free
 * of server-only imports (no `pg` pool) so client components can import them.
 */

export interface MatrixData {
  /** Entity codes present in this matrix (sorted). */
  entities: string[];
  /** Shared-mandate count keyed by `pairKey(a, b)`. Missing key = 0. */
  pairs: Record<string, number>;
  /** Per-entity distinct symbol count (the diagonal). */
  totals: Record<string, number>;
}

/** Canonical, order-independent key for an entity pair. */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}
