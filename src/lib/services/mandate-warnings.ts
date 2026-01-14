/**
 * Centralized mandate warning system
 * Define all warning conditions and messages here for easy maintenance
 */

import type { Mandate } from "@/types";

export interface MandateWarning {
  id: string;
  message: string;
  severity: "error" | "warning" | "info";
  /** For update warnings: the symbol to pre-select for update */
  suggestedUpdate?: string;
  /** Action type: 'update' (opens search) or 'remove' (direct action) */
  action?: "update" | "remove";
  /** Icon to display for this warning */
  icon?: string;
  /** Button color scheme */
  colorScheme?: "blue" | "red" | "amber";
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
  icon?: string;
  /** Button color scheme */
  colorScheme?: "blue" | "red" | "amber";
}

/**
 * All warning definitions
 * Add new warnings here with their conditions
 */
const WARNING_DEFINITIONS: WarningDefinition[] = [
  {
    id: "missing-link",
    message:
      "This citation is missing a link to the document's fulltext – please consider updating with the correct document symbol or manually add with the correct link.",
    severity: "warning",
    condition: (mandate) => !mandate.link,
    getSuggestedUpdate: (mandate) => mandate.symbol,
    action: "update",
    icon: "⚠",
    colorScheme: "amber",
  },
  {
    id: "newer-available",
    message: (mandate) => {
      const nv = mandate.newerVersion;
      return nv
        ? `Newer version available from ${nv.year}: ${nv.symbol}`
        : "Newer version available";
    },
    severity: "info",
    condition: (mandate) => !!mandate.newerVersion,
    getSuggestedUpdate: (mandate) => mandate.newerVersion?.symbol,
    action: "update",
    icon: "↑",
    colorScheme: "blue",
  },
];

/**
 * Get all active warnings for a given mandate
 * @param mandate The mandate to check
 * @param allSymbols Optional set of all symbols in current list (to check if newer version is already cited)
 */
export function getMandateWarnings(
  mandate: Mandate,
  allSymbols?: Set<string>,
): MandateWarning[] {
  // Check if newer version is already in the list
  const newerAlreadyCited =
    mandate.newerVersion?.symbol &&
    allSymbols?.has(mandate.newerVersion.symbol);

  // If newer version is already cited, add special remove warning
  if (newerAlreadyCited) {
    return [
      {
        id: "newer-already-cited",
        message: `Newer version ${mandate.newerVersion?.symbol || ""} is already cited — consider removing this older version`,
        severity: "warning",
        action: "remove",
        icon: "×",
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
      })),
    ];
  }

  return WARNING_DEFINITIONS.filter((def) => def.condition(mandate)).map(
    (def) => ({
      id: def.id,
      message:
        typeof def.message === "function" ? def.message(mandate) : def.message,
      severity: def.severity,
      suggestedUpdate: def.getSuggestedUpdate?.(mandate),
      action: def.action,
      icon: def.icon,
      colorScheme: def.colorScheme,
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
