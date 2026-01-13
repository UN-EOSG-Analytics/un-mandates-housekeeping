/**
 * Centralized mandate warning system
 * Define all warning conditions and messages here for easy maintenance
 */

import type { Mandate } from "@/types";

export interface MandateWarning {
  id: string;
  message: string;
  severity: "error" | "warning" | "info";
}

interface WarningDefinition {
  id: string;
  message: string;
  severity: "error" | "warning" | "info";
  condition: (mandate: Mandate) => boolean;
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
  // Add more warnings here as needed, for example:
  // {
  //   id: "missing-year",
  //   message: "Missing year information",
  //   severity: "info",
  //   condition: (mandate) => !mandate.year,
  // },
  // {
  //   id: "outdated",
  //   message: "Document older than 20 years",
  //   severity: "warning",
  //   condition: (mandate) =>
  //     mandate.year !== null && new Date().getFullYear() - mandate.year > 20,
  // },
];

/**
 * Get all active warnings for a given mandate
 */
export function getMandateWarnings(mandate: Mandate): MandateWarning[] {
  return WARNING_DEFINITIONS.filter((def) => def.condition(mandate)).map(
    (def) => ({
      id: def.id,
      message: def.message,
      severity: def.severity,
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
