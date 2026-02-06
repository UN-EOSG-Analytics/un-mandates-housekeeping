/**
 * Centralized mandate warning system
 * Define all warning conditions and messages here for easy maintenance
 */

import type { Mandate, NewerVersion, NewerVersionInfo } from "@/types";
import type { WarningIconType } from "@/components/WarningIcon";

export interface MandateWarning {
  id: string;
  message: string;
  /** Optional suffix to display after linkedSymbol */
  messageSuffix?: string;
  severity: "error" | "warning" | "info";
  /** For update warnings: the symbol to pre-select for update */
  suggestedUpdate?: string;
  /** Action type: 'update' (opens search) or 'remove' (direct action) */
  action?: "update" | "remove";
  /** Icon to display for this warning */
  icon?: WarningIconType;
  /** Button color scheme */
  colorScheme?: "blue" | "red" | "amber";
  /** Document symbol to display as external link */
  linkedSymbol?: string;
  /** Year of the linked symbol (for diff comparisons) */
  linkedYear?: number;
}

interface WarningDefinition {
  id: string;
  message: string | ((mandate: Mandate) => string);
  severity: "error" | "warning" | "info";
  condition: (mandate: Mandate) => boolean;
  /** Extract suggested update symbol from mandate */
  getSuggestedUpdate?: (mandate: Mandate) => string | undefined;
  /** Action type for this warning */
  action?: "update" | "remove";
  /** Icon to display */
  icon?: WarningIconType;
  /** Button color scheme */
  colorScheme?: "blue" | "red" | "amber";
  /** Extract symbol to display as external link */
  getLinkedSymbol?: (mandate: Mandate) => string | undefined;
  /** Extract year of linked symbol */
  getLinkedYear?: (mandate: Mandate) => number | undefined;
}

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

/**
 * All warning definitions
 * Add new warnings here with their conditions
 */
const WARNING_DEFINITIONS: WarningDefinition[] = [
  {
    id: "no-metadata",
    message:
      "Document symbol not found in UN Library metadata – data may be incomplete or symbol may be incorrect. Consider updating with the correct symbol.",
    severity: "warning",
    condition: (mandate) => mandate.metadataFromDb === false,
    getSuggestedUpdate: (mandate) => mandate.symbol,
    action: "update",
    icon: "file-question",
    colorScheme: "amber",
  },
  {
    id: "missing-link",
    message:
      "This citation is missing a link to the document's fulltext – please consider updating with the correct document symbol or manually add again with the fulltext link included.",
    severity: "warning",
    condition: (mandate) => !mandate.link,
    getSuggestedUpdate: (mandate) => mandate.symbol,
    action: "update",
    icon: "file",
    colorScheme: "amber",
  },
  {
    id: "newer-available",
    message: "Newer version available from",
    severity: "info",
    condition: (mandate) => !!mandate.newerVersion,
    getSuggestedUpdate: (mandate) => mandate.newerVersion?.symbol,
    getLinkedSymbol: (mandate) => mandate.newerVersion?.symbol,
    getLinkedYear: (mandate) => mandate.newerVersion?.year,
    action: "update",
    icon: "arrow-up",
    colorScheme: "blue",
  },
];

/**
 * Get all active warnings for a given mandate
 * @param mandate The mandate to check
 * @param allSymbols Optional set of all symbols in current list (to check if newer version is already cited)
 * @param isNewestWithNewerVersion Whether this is the most recent citation among those with the same newer version
 */
export function getMandateWarnings(
  mandate: Mandate,
  allSymbols?: Set<string>,
  isNewestWithNewerVersion?: boolean,
): MandateWarning[] {
  // Check if any newer version is already cited (find the newest among cited)
  const citedNewer = findNewestCitedVersion(mandate.newerVersion, allSymbols);

  // If a newer version is already cited, add special remove warning
  if (citedNewer) {
    return [
      {
        id: "newer-already-cited",
        message: "Newer version from",
        messageSuffix: "already cited:",
        severity: "warning",
        linkedSymbol: citedNewer.symbol,
        linkedYear: citedNewer.year,
        action: "remove",
        icon: "x",
        colorScheme: "red",
      },
      // Include other warnings that aren't newer-available
      ...WARNING_DEFINITIONS.filter(
        (def) => def.id !== "newer-available" && def.condition(mandate),
      ).map((def) => ({
        id: def.id,
        message:
          typeof def.message === "function"
            ? def.message(mandate)
            : def.message,
        severity: def.severity,
        suggestedUpdate: def.getSuggestedUpdate?.(mandate),
        action: def.action,
        icon: def.icon,
        colorScheme: def.colorScheme,
        linkedSymbol: def.getLinkedSymbol?.(mandate),
        linkedYear: def.getLinkedYear?.(mandate),
      })),
    ];
  }

  // Filter warnings: only show "newer-available" if this is the most recent citation with that newer version
  const shouldShowNewerAvailable = isNewestWithNewerVersion !== false;

  return WARNING_DEFINITIONS.filter((def) => {
    if (!def.condition(mandate)) return false;
    // Only show "newer-available" warning for the most recent citation
    if (def.id === "newer-available" && !shouldShowNewerAvailable) return false;
    return true;
  }).map((def) => ({
    id: def.id,
    message:
      typeof def.message === "function" ? def.message(mandate) : def.message,
    severity: def.severity,
    suggestedUpdate: def.getSuggestedUpdate?.(mandate),
    action: def.action,
    icon: def.icon,
    colorScheme: def.colorScheme,
    linkedSymbol: def.getLinkedSymbol?.(mandate),
    linkedYear: def.getLinkedYear?.(mandate),
  }));
}

/**
 * Check if a mandate has any warnings
 */
export function hasWarnings(mandate: Mandate): boolean {
  return WARNING_DEFINITIONS.some((def) => def.condition(mandate));
}

/**
 * Get warning icon based on severity
 */
export function getWarningIcon(
  severity: MandateWarning["severity"],
): WarningIconType {
  switch (severity) {
    case "error":
      return "x-circle";
    case "warning":
      return "alert";
    case "info":
      return "info";
  }
}

/**
 * Get warning color class based on severity
 */
export function getWarningColorClass(
  severity: MandateWarning["severity"],
): string {
  switch (severity) {
    case "error":
      return "text-red-500";
    case "warning":
      return "text-amber-500";
    case "info":
      return "text-blue-500";
  }
}
