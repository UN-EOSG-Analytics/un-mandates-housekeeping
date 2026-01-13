/**
 * Centralized mandate warning system
 * Define all warning conditions and messages here for easy maintenance
 */

import type { Mandate } from "@/types";

export interface MandateWarning {
  id: string;
  message: string;
  severity: "error" | "warning" | "info";
  /** For newer-available warning: the symbol to pre-select for update */
  suggestedUpdate?: string;
}

interface WarningDefinition {
  id: string;
  message: string | ((mandate: Mandate) => string);
  severity: "error" | "warning" | "info";
  condition: (mandate: Mandate) => boolean;
  /** Extract suggested update symbol from mandate */
  getSuggestedUpdate?: (mandate: Mandate) => string | undefined;
}

/**
 * All warning definitions
 * Add new warnings here with their conditions
 */
const WARNING_DEFINITIONS: WarningDefinition[] = [
  {
    id: "missing-link",
    message: "Missing link to document fulltext. Please consider updating.",
    severity: "warning",
    condition: (mandate) => !mandate.link && !mandate.metadataFromDb,
  },
  {
    id: "newer-available",
    message: (mandate) => {
      const nv = mandate.newerVersion;
      return nv
        ? `Newer version available: ${nv.symbol} (${nv.year})`
        : "Newer version available";
    },
    severity: "info",
    condition: (mandate) => !!mandate.newerVersion,
    getSuggestedUpdate: (mandate) => mandate.newerVersion?.symbol,
  },
];

/**
 * Get all active warnings for a given mandate
 */
export function getMandateWarnings(mandate: Mandate): MandateWarning[] {
  return WARNING_DEFINITIONS.filter((def) => def.condition(mandate)).map(
    (def) => ({
      id: def.id,
      message:
        typeof def.message === "function" ? def.message(mandate) : def.message,
      severity: def.severity,
      suggestedUpdate: def.getSuggestedUpdate?.(mandate),
    }),
  );
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
export function getWarningIcon(severity: MandateWarning["severity"]): string {
  switch (severity) {
    case "error":
      return "❌";
    case "warning":
      return "⚠";
    case "info":
      return "ℹ";
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
