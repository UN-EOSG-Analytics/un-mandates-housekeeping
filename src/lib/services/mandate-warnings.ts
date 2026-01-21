/**
 * Centralized mandate warning system
 * Define all warning conditions and messages here for easy maintenance
 */

import type { Mandate } from "@/types";
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
    icon: "help",
    colorScheme: "amber",
  },
  {
    id: "missing-link",
    message:
      "This citation is missing a link to the document's fulltext – please consider updating with the correct document symbol or manually add with the correct link.",
    severity: "warning",
    condition: (mandate) => !mandate.link,
    getSuggestedUpdate: (mandate) => mandate.symbol,
    action: "update",
    icon: "alert",
    colorScheme: "amber",
  },
  {
    id: "newer-available",
    message: (mandate) => {
      const nv = mandate.newerVersion;
      return nv
        ? `Newer version available from ${nv.year}:`
        : "Newer version available";
    },
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
        message: "Newer version",
        messageSuffix: "already cited.",
        severity: "warning",
        linkedSymbol: mandate.newerVersion?.symbol,
        linkedYear: mandate.newerVersion?.year,
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
      linkedSymbol: def.getLinkedSymbol?.(mandate),
      linkedYear: def.getLinkedYear?.(mandate),
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
export function getWarningIcon(severity: MandateWarning["severity"]): WarningIconType {
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
