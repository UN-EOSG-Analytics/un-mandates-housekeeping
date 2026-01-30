/**
 * Pure utility functions for warning calculations
 * These can be safely used on both client and server (no DB imports)
 */

import type { NewerVersion, NewerVersionInfo } from "@/types";

/**
 * Find the newest version among those that are already cited
 * @param newerVersion The newer version info for a mandate
 * @param citedSymbols Set of all symbols currently cited in the entity
 * @returns The newest cited version info, or null if none are cited
 */
export function findNewestCitedVersion(
  newerVersion: NewerVersion | undefined,
  citedSymbols: Set<string> | undefined,
): NewerVersionInfo | null {
  if (!newerVersion?.allNewer || !citedSymbols) return null;

  const citedVersions = newerVersion.allNewer.filter((v) =>
    citedSymbols.has(v.symbol),
  );

  if (citedVersions.length === 0) return null;

  return citedVersions.reduce((newest, v) =>
    v.year > newest.year ? v : newest,
  );
}
