/**
 * Application constants
 */

import type { BudgetPartMeta } from "@/types";

/**
 * Budget parts metadata (static)
 * Defines the 14 UN budget parts (I-XIV) with their roman numeral, display order, and descriptive name
 */
export const BUDGET_PARTS_META: BudgetPartMeta[] = [
  {
    key: "Overall policymaking, direction and coordination",
    numeral: "I",
    order: 1,
    label: "Overall policymaking, direction and coordination",
  },
  {
    key: "Political affairs",
    numeral: "II",
    order: 2,
    label: "Political affairs",
  },
  {
    key: "International justice and law",
    numeral: "III",
    order: 3,
    label: "International justice and law",
  },
  {
    key: "International cooperation and development",
    numeral: "IV",
    order: 4,
    label: "International cooperation and development",
  },
  {
    key: "Regional cooperation and development",
    numeral: "V",
    order: 5,
    label: "Regional cooperation and development",
  },
  {
    key: "Human rights and humanitarian affairs",
    numeral: "VI",
    order: 6,
    label: "Human rights and humanitarian affairs",
  },
  {
    key: "Global communications",
    numeral: "VII",
    order: 7,
    label: "Global communications",
  },
  {
    key: "Common support services",
    numeral: "VIII",
    order: 8,
    label: "Common support services",
  },
  {
    key: "Internal oversight",
    numeral: "IX",
    order: 9,
    label: "Internal oversight",
  },
  {
    key: "Jointly financed administrative activities and special expenses",
    numeral: "X",
    order: 10,
    label: "Jointly financed administrative activities and special expenses",
  },
  {
    key: "Capital expenditure",
    numeral: "XI",
    order: 11,
    label: "Capital expenditure",
  },
  {
    key: "Safety and security",
    numeral: "XII",
    order: 12,
    label: "Safety and security",
  },
  {
    key: "Development account",
    numeral: "XIII",
    order: 13,
    label: "Development account",
  },
  {
    key: "Staff assessment",
    numeral: "XIV",
    order: 14,
    label: "Staff assessment",
  },
];
