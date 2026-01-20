/**
 * Decision reasons for mandate housekeeping
 * Maps each decision type to its available reason options
 */

export interface DecisionReason {
  id: string;
  label: string;
}

export const RETAIN_REASONS: DecisionReason[] = [
  {
    id: "action_applicable",
    label:
      "Request for action remains applicable to the programme/subprogramme",
  },
  {
    id: "ongoing_lt_5y",
    label: "Mandated activity or service is ongoing (less than 5 years old)",
  },
  {
    id: "foundational",
    label: "Foundational mandate establishing the entity or core function",
  },
  {
    id: "continuing_no_end",
    label:
      "Continuing mandate with no end date (e.g. recurring reporting requirement)",
  },
  {
    id: "recent_relevant",
    label: "Mandate adopted within the last five years and remains relevant",
  },
  {
    id: "ongoing_gt_5y",
    label:
      "Mandated activity or service is ongoing (more than 5 years old) and not superseded or reflected by a more recent resolution",
  },
  {
    id: "comparative_advantage",
    label:
      "Entity has a demonstrable comparative advantage in implementing the mandate",
  },
  { id: "other", label: "Other" },
];

export const UPDATE_REASONS: DecisionReason[] = [
  {
    id: "superseded",
    label:
      "Superseded by a more recent resolution with identical or similar requests",
  },
  {
    id: "updated_citation",
    label:
      "Updated citation needed to reflect current mandate language or scope",
  },
  { id: "other", label: "Other" },
];

export const REMOVE_REASONS: DecisionReason[] = [
  {
    id: "consolidated",
    label:
      "Duplicate citation consolidated across multiple subprogrammes to programme level",
  },
  {
    id: "activity_concluded",
    label: "Mandated activity or service has concluded",
  },
  {
    id: "completed_process",
    label:
      "Mandate linked to a completed intergovernmental process or one-off event",
  },
  {
    id: "delivered",
    label:
      "Mandated activity/service/report etc has been delivered and no further action is required",
  },
  {
    id: "old_not_foundational",
    label:
      "Mandate is older than five years and is neither foundational nor continuing",
  },
  {
    id: "no_action_request",
    label: "No current request for action relevant to the programme of work",
  },
  {
    id: "subsidiary_removed",
    label:
      "Subsidiary body mandate removed in favour of a principal organ resolution",
  },
  {
    id: "no_comparative_advantage",
    label:
      "Entity no longer has a comparative advantage in implementing the mandate",
  },
  { id: "other", label: "Other" },
];

export type DecisionType = "retain" | "update" | "remove";

export function getReasonsForDecision(
  decision: DecisionType,
): DecisionReason[] {
  switch (decision) {
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
