/**
 * Decision reasons for mandate housekeeping
 * Maps each decision type to its available reason options
 */

// LAST UPDATED
// 23 – Jan – 2025

export interface DecisionReason {
  id: string;
  label: string;
}

export const ADD_REASONS: DecisionReason[] = [
  {
    id: "direct_request",
    label:
      "**Direct request for action** to the programme/subprogramme",
  },
  {
    id: "influences_work",
    label:
      "**Influences the programme of work** without constituting a direct request for action for the entity.",
  },
  {
    id: "foundational_amend",
    label:
      "**Foundational mandate** establishing or amending the entity or core function.",
  },
  { id: "other", label: "Other." },
];

export const RETAIN_REASONS: DecisionReason[] = [
  {
    id: "direct_request",
    label:
      "**Direct request for action** remains applicable to the programme/subprogramme.",
  },
  {
    id: "influences_work",
    label:
      "**Influences the programme of work** without constituting a direct request for action for the entity.",
  },
  {
    id: "foundational",
    label: "**Foundational mandate** establishing the entity or core function.",
  },
  { id: "other", label: "Other." },
];

export const UPDATE_REASONS: DecisionReason[] = [
  {
    id: "superseded_identical",
    label:
      "**Superseded** by a more recent resolution with identical or **similar requests**.",
  },
  {
    id: "superseded_different",
    label:
      "**Superseded** by a more recent resolution with **different requests**.",
  },
  { id: "other", label: "Other." },
];

export const REMOVE_REASONS: DecisionReason[] = [
  {
    id: "delivered",
    label:
      "Mandated activity and service has been **delivered** and no further action is required.",
  },
  {
    id: "other_entity_advantage",
    label:
      "**Other entity** has comparative advantage in implementing the mandate.",
  },
  {
    id: "subsidiary_removed",
    label:
      "**Subsidiary body** mandate removed in favour of a principal organ resolution.",
  },
  {
    id: "consolidated",
    label:
      "**Duplicate citation** consolidated across multiple subprogrammes to programme level.",
  },
  { id: "other", label: "Other." },
];

export type DecisionType = "add" | "retain" | "update" | "remove";

export function getReasonsForDecision(
  decision: DecisionType,
): DecisionReason[] {
  switch (decision) {
    case "add":
      return ADD_REASONS;
    case "retain":
      return RETAIN_REASONS;
    case "update":
      return UPDATE_REASONS;
    case "remove":
      return REMOVE_REASONS;
    default:
      return [];
  }
}

export function getReasonLabel(
  decision: DecisionType,
  reasonId: string,
): string | null {
  const reasons = getReasonsForDecision(decision);
  const reason = reasons.find((r) => r.id === reasonId);
  return reason?.label ?? null;
}
