"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useRealtimeDecisions,
  type RealtimeChange,
} from "@/hooks/useRealtimeDecisions";
import { BODY_ABBREVS } from "@/lib/constants";
import { abbreviateBody } from "@/lib/utils";
import { getAgeIndicator } from "@/lib/services/mandates/age-indicator";
import {
  approveDecisionAction,
  clearAllEntityDecisionsAction,
  createCommentAction,
  createDecisionAction,
  endReviewModeAction,
  getDocumentMetadataAction,
  getEntityDecisionsAction,
  getReviewModeStatusAction,
  getSingleMandateStateAction,
  getUserRoleAction,
  startReviewModeAction,
  updateDecisionReasonAction,
} from "@/lib/services/housekeeping-actions";
import {
  getMandateWarnings,
  getWarningIcon,
} from "@/lib/services/mandates/mandate-warnings";
import type {
  Decision,
  Mandate,
  MandateComment,
  MandateDecision,
  MandateState,
} from "@/types";
import {
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  MessageSquare,
  Pencil,
  Search,
  Star,
  X,
} from "lucide-react";
import { orderBy } from "natural-orderby";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReadOnlyNoticeBanner,
  ReviewerModeBanner,
  ReviewInProgressBanner,
} from "./Banner";
import { ClearAllDecisionsDialog } from "./ClearAllDecisionsDialog";
import { DecisionDropdown } from "./DecisionDropdown";
import { DiffModal } from "./DiffModal";
import { DocumentSymbol } from "./DocumentModal";
import { DocumentSearchInput } from "../features/mandates/ui/DocumentSearchInput";
import { ManualDocumentForm } from "../features/mandates/ui/ManualDocumentForm";
import { EntityHeader } from "./EntityHeader";
import type { ManualEntryData } from "../features/mandates/ui/ManualDocumentForm";
import { ReviewBlockedDialog } from "./ReviewBlockedDialog";
import { Tooltip } from "./Tooltip";
import { WarningIcon } from "./WarningIcon";
import { WarningTooltip } from "./WarningTooltip";

interface Props {
  entity: string;
  entityLong: string | null;
  partName: string | null;
  backgroundMandates: Mandate[];
  legislativeMandates: Record<string, Mandate[]>;
}

// Transform subprogramme name for display
function formatSubprogrammeName(subprog: string): string {
  if (subprog.toLowerCase().includes("all subprogramme")) {
    return "PROGRAMME LEVEL";
  }
  return subprog;
}

// PhaseTracker component commented out - for future use
// function PhaseTracker() {
//   const phases = [
//     { id: 1, name: "Internal Review", type: "internal" },
//     { id: 2, name: "OPPFB Review", type: "ppbd" },
//     { id: 3, name: "Internal Review", type: "internal" },
//     { id: 4, name: "OPPFB Review", type: "ppbd" },
//   ];
//   const currentPhase = 1; // Mockup: always phase 1
//
//   return (
//     <div className="rounded-lg border border-gray-200 bg-white px-6 py-3 shadow-sm">
//       <div className="flex items-center gap-6">
//         <span className="text-xs font-medium text-gray-500 uppercase">
//           Review phases
//         </span>
//         <div className="flex flex-1 items-center gap-1">
//           {phases.map((phase, i) => (
//             <div key={phase.id} className="flex items-center">
//               {i > 0 && <div className="mx-1 h-px w-6 bg-gray-200" />}
//               <div
//                 className={`flex items-center gap-1.5 rounded-full ${i === 0 ? "pr-3 pl-5" : "px-3"} py-1 text-xs font-medium transition-colors ${
//                   phase.id < currentPhase
//                     ? "bg-green-100 text-green-700"
//                     : phase.id === currentPhase
//                       ? phase.type === "internal"
//                         ? "bg-un-blue text-white"
//                         : "bg-amber-500 text-white"
//                       : "bg-gray-100 text-gray-400"
//                 }`}
//               >
//                 {phase.id < currentPhase && <Check className="h-3 w-3" />}
//                 <span className="tabular-nums">{phase.id}.</span>
//                 {phase.name}
//               </div>
//             </div>
//           ))}
//         </div>
//         {currentPhase <= phases.length && (
//           <button
//             onClick={() => alert("Phase completion not yet implemented")}
//             className="rounded bg-un-blue px-3 py-1 text-xs font-medium text-white hover:bg-un-blue/90"
//           >
//             Complete Phase {currentPhase}
//           </button>
//         )}
//       </div>
//     </div>
//   );
// }

const GRID_COLS =
  "grid-cols-[140px_1fr_50px_50px_45px_25px_30px_70px_120px_35px_45px]";

type SortColumn = "symbol" | "title" | "body" | "year" | "others";
type SortDirection = "asc" | "desc";

function SortableHeader({
  column,
  label,
  sortColumn,
  sortDirection,
  onSort,
}: {
  column: SortColumn;
  label: string;
  sortColumn: SortColumn | null;
  sortDirection: SortDirection;
  onSort: (column: SortColumn) => void;
}) {
  const isActive = sortColumn === column;
  return (
    <button
      onClick={() => onSort(column)}
      className="flex items-center gap-0.5 uppercase transition-colors hover:text-gray-600"
    >
      <span>{label}</span>
      {isActive ? (
        sortDirection === "asc" ? (
          <ChevronUp className="h-2.5 w-2.5" />
        ) : (
          <ChevronDown className="h-2.5 w-2.5" />
        )
      ) : (
        <ChevronDown className="h-2.5 w-2.5 opacity-30 hover:opacity-60" />
      )}
    </button>
  );
}

function ColumnHeaders({
  sortColumn,
  sortDirection,
  onSort,
  isReviewer,
  onApproveAll,
}: {
  sortColumn: SortColumn | null;
  sortDirection: SortDirection;
  onSort: (column: SortColumn) => void;
  isReviewer?: boolean;
  onApproveAll?: () => void;
}) {
  return (
    <div
      className={`grid ${GRID_COLS} items-center gap-x-2 py-1.5 text-[10px] font-medium tracking-wider text-gray-400 uppercase`}
    >
      <div className="pl-3">
        <SortableHeader
          column="symbol"
          label="Symbol"
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={onSort}
        />
      </div>
      <div className="pl-6">
        <SortableHeader
          column="title"
          label="Title"
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={onSort}
        />
      </div>
      <SortableHeader
        column="body"
        label="Body"
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={onSort}
      />
      <SortableHeader
        column="year"
        label="Year"
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={onSort}
      />
      <span>Age</span>
      <SortableHeader
        column="others"
        label="Others"
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={onSort}
      />
      <span></span>
      <span>Notes</span>
      <span>Decision</span>
      <span>
        <MessageSquare className="h-3 w-3" />
      </span>
      <div className="flex items-center justify-center">
        {isReviewer && onApproveAll ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onApproveAll();
            }}
            className="text-[10px] font-medium tracking-wider text-gray-400 uppercase transition-colors hover:text-emerald-600"
            title="Approve all decisions in this section"
          >
            OK <Check className="inline h-3 w-3" />
          </button>
        ) : (
          <span>OK</span>
        )}
      </div>
    </div>
  );
}

// Inner row content (shared between normal and update target rows)
function MandateRowContent({
  mandate,
  state,
  commentCount,
  isReviewer,
  isUpdateTarget,
  readOnly,
  isFoundational,
  allSymbols,
  allEntitySymbols,
  newestWithNewerVersion,
  onOpenSidebar,
  onOpenActivityTab,
  onDecision,
  onReasonChange,
  onApprove,
  onUpdateClick,
  showReasonPopup,
  onReasonPopupClose,
  onDiff,
  onEdit,
}: {
  mandate: Mandate;
  state?: MandateState;
  commentCount: number;
  isReviewer: boolean;
  isUpdateTarget?: boolean; // True for the "new" row in update view (no dropdowns)
  readOnly?: boolean; // True for background section (no interactivity)
  isFoundational?: boolean; // True if mandate is also in background mandates
  allSymbols?: Set<string>; // All symbols in current section for warning system
  allEntitySymbols?: Set<string>; // All symbols across entire entity for newer-already-cited detection
  newestWithNewerVersion?: Set<string>; // Symbols that are newest among those with same newer version
  onOpenSidebar?: () => void;
  onOpenActivityTab?: () => void;
  onDecision: (decision: Decision, newSymbol?: string) => void;
  onReasonChange?: (reason: string | null, otherReason: string | null) => void;
  onApprove?: (decisionId: string, approved: boolean) => void;
  onUpdateClick?: (prefillSymbol?: string) => void;
  showReasonPopup?: boolean;
  onReasonPopupClose?: () => void;
  onDiff?: (
    originalSymbol: string,
    originalYear: number,
    compareSymbol: string,
    compareYear: number,
  ) => void;
  onEdit?: () => void;
}) {
  const ageInfo = getAgeIndicator(mandate.year);
  const currentDecision = state?.decision;

  // Check if this row has an update or remove decision (to grey out content)
  const hasUpdate = currentDecision?.decision === "update";
  const hasRemove = currentDecision?.decision === "remove";
  const contentGreyed = (hasUpdate || hasRemove) && !isUpdateTarget;

  // Approval state - only reviewers can approve, and only if there's a decision
  const hasDecision = !!currentDecision;
  const isApproved = !!currentDecision?.approvedBy;
  const canApprove =
    isReviewer && onApprove && hasDecision && currentDecision?.id;

  // Determine background color based on decision
  let bgColorClass = "";
  if (isUpdateTarget) {
    bgColorClass = "bg-amber-50/50";
  } else if (currentDecision?.decision === "remove") {
    bgColorClass = "bg-red-50/30";
  } else if (currentDecision?.decision === "update") {
    bgColorClass = "bg-amber-50/40";
  } else if (currentDecision?.decision === "add") {
    bgColorClass = "bg-emerald-50/30";
  } else if (currentDecision?.decision === "retain") {
    bgColorClass = "bg-blue-50/20";
  }

  return (
    <div
      className={`grid ${GRID_COLS} cursor-pointer items-center gap-x-2 gap-y-1.5 py-2.5 text-sm transition-colors ${
        bgColorClass || "hover:bg-gray-50"
      } ${readOnly ? "opacity-60" : ""} ${!isUpdateTarget && !bgColorClass ? "hover:bg-gray-50" : ""}`}
      onClick={onOpenSidebar}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex items-center gap-1 pl-3"
      >
        {isUpdateTarget && (
          <span className="mr-1 text-xs text-amber-500">↳</span>
        )}
        <a
          href={mandate.link || "#"}
          target="_blank"
          rel="noopener noreferrer"
          title={mandate.symbol.length > 18 ? mandate.symbol : undefined}
          className={`inline-block rounded px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-colors ${
            contentGreyed
              ? "bg-gray-100 text-gray-400"
              : "bg-blue-50 text-un-blue hover:bg-blue-100"
          }`}
          onClick={(e) => !mandate.link && e.preventDefault()}
        >
          {mandate.symbol.length > 18
            ? `${mandate.symbol.slice(0, 18)}…`
            : mandate.symbol}
        </a>
      </div>
      <div
        className={`flex min-w-0 cursor-help items-center gap-1.5 ${contentGreyed ? "text-gray-400" : "text-gray-600"}`}
        title={mandate.title || undefined}
      >
        <span className="inline-flex w-4 shrink-0 items-center justify-center">
          {isFoundational && (
            <Tooltip
              content={
                readOnly
                  ? "Foundational mandate"
                  : "Foundational mandate — also cited in Mandates and Background"
              }
            >
              <Star
                className="h-4 w-4 fill-un-blue text-un-blue"
                strokeWidth={0.5}
              />
            </Tooltip>
          )}
        </span>
        <span className="min-w-0 flex-1 truncate">
          {mandate.title || (
            <span className="text-gray-400 italic">No title</span>
          )}
        </span>
      </div>
      <div
        className={`text-xs ${contentGreyed ? "text-gray-300" : "text-gray-400"}`}
        title={mandate.body ?? undefined}
      >
        {abbreviateBody(mandate.body, BODY_ABBREVS) ?? "—"}
      </div>
      <div
        className={`text-xs ${contentGreyed ? "text-gray-300" : "text-gray-400"}`}
      >
        {mandate.year ?? "—"}
      </div>
      <Tooltip content={ageInfo.tooltip}>
        <span
          className={`cursor-help rounded px-1.5 py-0.5 text-xs font-medium ${contentGreyed ? "opacity-50" : ""} ${ageInfo.color} ${ageInfo.bgColor}`}
        >
          {ageInfo.label}
        </span>
      </Tooltip>
      <Tooltip
        content={
          mandate.otherEntitiesCount > 0
            ? `${mandate.otherEntitiesCount} other entit${mandate.otherEntitiesCount !== 1 ? "ies" : "y"} also cite${mandate.otherEntitiesCount === 1 ? "s" : ""} ${mandate.symbol}`
            : `No other entities cite ${mandate.symbol}`
        }
      >
        <span
          className={`cursor-help text-xs ${contentGreyed ? "text-gray-300" : "text-gray-400"}`}
        >
          {mandate.otherEntitiesCount > 0
            ? `+${mandate.otherEntitiesCount}`
            : "—"}
        </span>
      </Tooltip>
      <div></div>
      <div className="flex items-center justify-start pr-2">
        {!isUpdateTarget &&
          (() => {
            const isNewestWithNewerVersion = newestWithNewerVersion?.has(
              mandate.symbol,
            );
            const warnings = getMandateWarnings(
              mandate,
              allEntitySymbols || allSymbols,
              isNewestWithNewerVersion,
            );
            if (warnings.length === 0) return null;

            const actionableWarnings = warnings.filter((w) => w.action);
            const isAddressed =
              currentDecision?.decision != null &&
              currentDecision.decision !== "cancel";

            const primaryWarning = actionableWarnings[0] || warnings[0];
            const icon =
              primaryWarning.icon || getWarningIcon(primaryWarning.severity);
            const colorScheme = primaryWarning.colorScheme || "amber";

            const colorClasses = {
              blue: "bg-un-blue/10 text-un-blue hover:bg-un-blue/20",
              red: "bg-red-50 text-red-600 hover:bg-red-100",
              amber: "bg-amber-50 text-amber-600 hover:bg-amber-100",
            };

            const handleAction = (warning: typeof primaryWarning) => {
              if (warning.action === "remove") {
                onDecision("remove");
              } else if (warning.action === "update" && onUpdateClick) {
                onUpdateClick();
              }
            };

            const handlePrimaryClick = () => {
              if (primaryWarning.action === "remove") {
                onDecision("remove");
              } else if (primaryWarning.action === "update" && onUpdateClick) {
                onUpdateClick();
              }
            };

            return (
              <WarningTooltip
                warnings={warnings}
                onAction={handleAction}
                onPrimaryClick={handlePrimaryClick}
                disabled={isAddressed}
                currentSymbol={mandate.symbol}
                currentYear={mandate.year ?? undefined}
                onDiff={onDiff}
              >
                <button
                  className={`group relative inline-flex h-6 min-w-6 items-center justify-center rounded-full transition-all ${
                    isAddressed
                      ? "cursor-default bg-gray-100 text-gray-400"
                      : colorClasses[colorScheme]
                  }`}
                >
                  <span className="px-1">
                    <WarningIcon icon={icon} />
                  </span>
                  {warnings.length > 1 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-medium text-white shadow-sm">
                      {warnings.length}
                    </span>
                  )}
                </button>
              </WarningTooltip>
            );
          })()}
      </div>
      <div onClick={(e) => e.stopPropagation()} className="relative flex items-center">
        {!isUpdateTarget &&
          !readOnly &&
          currentDecision?.decision === "add" &&
          currentDecision?.manualMetadata &&
          onEdit && (
            <Tooltip content="Edit manual entry">
              <button
                onClick={onEdit}
                className="absolute -left-7 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded border border-emerald-200 bg-emerald-50 text-emerald-700 transition-colors hover:border-emerald-300 hover:bg-emerald-100"
              >
                <FileText className="h-3.5 w-3.5" />
              </button>
            </Tooltip>
          )}
        {isUpdateTarget || readOnly ? (
          <span className="text-xs text-gray-400">—</span>
        ) : (
          <DecisionDropdown
            decision={currentDecision?.decision ?? null}
            userEmail={currentDecision?.userEmail ?? null}
            createdAt={currentDecision?.createdAt ?? null}
            onChange={onDecision}
            onUpdateClick={onUpdateClick}
            disabled={false}
            reason={currentDecision?.decisionReason}
            otherReason={currentDecision?.otherReason}
            onReasonChange={onReasonChange}
            symbol={mandate.symbol}
            showReasonPopup={showReasonPopup}
            onReasonPopupClose={onReasonPopupClose}
          />
        )}
      </div>
      <Tooltip
        content={
          commentCount > 0 ? "Click to view comments" : "Click to add a comment"
        }
      >
        <span
          onClick={(e) => {
            e.stopPropagation();
            onOpenActivityTab?.();
          }}
          className={`cursor-pointer text-xs ${commentCount > 0 ? "font-medium text-un-blue" : "text-gray-400"} ${contentGreyed ? "opacity-50" : ""}`}
        >
          {commentCount > 0 ? commentCount : "—"}
        </span>
      </Tooltip>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex items-center justify-center"
      >
        {isUpdateTarget || readOnly ? (
          <span className="inline-flex h-6 w-6 items-center justify-center text-xs text-gray-400">
            —
          </span>
        ) : hasDecision ? (
          <button
            onClick={() =>
              canApprove &&
              currentDecision?.id &&
              onApprove(currentDecision.id, !isApproved)
            }
            disabled={!canApprove}
            title={
              isApproved
                ? `Approved by ${currentDecision?.approvedBy}`
                : canApprove
                  ? "Click to approve"
                  : "No decision to approve"
            }
            className={`inline-flex h-6 w-6 items-center justify-center rounded border transition-colors ${
              isApproved
                ? "border-emerald-600 bg-emerald-600 text-white"
                : canApprove
                  ? "border-gray-300 bg-white hover:border-emerald-400 hover:bg-emerald-50"
                  : "border-gray-200 bg-gray-50"
            } ${!canApprove ? "cursor-default" : "cursor-pointer"}`}
          >
            <Check className={`h-4 w-4 ${isApproved ? "" : "invisible"}`} />
          </button>
        ) : (
          <span className="inline-flex h-6 w-6 items-center justify-center text-xs text-gray-300">
            —
          </span>
        )}
      </div>
    </div>
  );
}

function MandateRow({
  mandate,
  state,
  commentCount,
  isReviewer,
  canReviewAnyEntity,
  userEmail,
  userEntity,
  onDecision,
  onReasonChange,
  onApprove,
  onUpdateWithManual,
  onEditManual,
  onComment,
  readOnly,
  isFoundational,
  updateTargetMetadata,
  allSymbols,
  allEntitySymbols,
  newestWithNewerVersion,
}: {
  mandate: Mandate;
  state?: MandateState;
  commentCount: number;
  isReviewer: boolean;
  canReviewAnyEntity?: boolean;
  userEmail: string | null;
  userEntity: string | null;
  onDecision: (decision: Decision, newSymbol?: string) => void;
  onReasonChange: (reason: string | null, otherReason: string | null) => void;
  onApprove: (decisionId: string, approved: boolean) => void;
  onUpdateWithManual: (newSymbol: string, manualData: ManualEntryData) => void;
  onEditManual?: (data: ManualEntryData) => void;
  onComment: (comment: string) => void;
  onOpenActivityTab?: () => void;
  isAdded?: boolean;
  readOnly?: boolean;
  isFoundational?: boolean;
  updateTargetMetadata?: {
    title: string | null;
    year: number | null;
    body: string | null;
  } | null;
  allSymbols?: Set<string>;
  allEntitySymbols?: Set<string>;
  newestWithNewerVersion?: Set<string>;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarInitialTab, setSidebarInitialTab] = useState<
    "info" | "decisions" | "activity" | "paragraphs" | undefined
  >(undefined);
  const [newDocSidebarOpen, setNewDocSidebarOpen] = useState(false);
  const [showUpdateSearch, setShowUpdateSearch] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  // Reason popup should only open when user actively makes a decision, not on mount
  const [showReasonPopup, setShowReasonPopup] = useState(false);
  const [updatePrefillSymbol, setUpdatePrefillSymbol] = useState<
    string | undefined
  >(undefined);
  const [diffModalOpen, setDiffModalOpen] = useState(false);
  const [diffParams, setDiffParams] = useState<{
    originalSymbol: string;
    originalYear: number;
    compareSymbol: string;
    compareYear: number;
  } | null>(null);

  const handleDiff = (
    originalSymbol: string,
    originalYear: number,
    compareSymbol: string,
    compareYear: number,
  ) => {
    setDiffParams({ originalSymbol, originalYear, compareSymbol, compareYear });
    setDiffModalOpen(true);
  };

  // Get suggested update symbol from warnings (for newer-available)
  const isNewestForNewerVersion = newestWithNewerVersion?.has(mandate.symbol);
  const warnings = getMandateWarnings(
    mandate,
    allEntitySymbols || allSymbols,
    isNewestForNewerVersion,
  );
  const suggestedUpdateSymbol = warnings.find(
    (w) => w.suggestedUpdate,
  )?.suggestedUpdate;

  // Check if there's a completed update (has newSymbol)
  const currentDecision = state?.decision;

  const hasCompletedUpdate =
    currentDecision?.decision === "update" && currentDecision?.newSymbol;
  const newSymbol = currentDecision?.newSymbol;

  // Create a fake mandate object for the "new" row in update view
  const newMandate: Mandate | null =
    hasCompletedUpdate && newSymbol
      ? {
          ...mandate,
          symbol: newSymbol,
          title: updateTargetMetadata?.title || "",
          year: updateTargetMetadata?.year || null,
          body: updateTargetMetadata?.body || null,
          link: null,
          metadataFromDb: !!updateTargetMetadata,
          isAdded: false,
        }
      : null;

  const handleUpdateSelect = (symbol: string) => {
    onDecision("update", symbol);
    setShowUpdateSearch(false);
    setShowReasonPopup(true);
    setUpdatePrefillSymbol(undefined);
  };

  const handleUpdateManual = (data: ManualEntryData) => {
    onUpdateWithManual(data.symbol, data);
    setShowUpdateSearch(false);
    setShowReasonPopup(true);
    setUpdatePrefillSymbol(undefined);
  };

  const handleCancelUpdate = () => {
    // Just close the update search UI - don't make any server call
    // User's prior decision state (if any) remains unchanged
    setShowUpdateSearch(false);
    setUpdatePrefillSymbol(undefined);
  };

  const handleEdit = () => {
    setShowEditModal(true);
  };

  const handleEditSubmit = (data: ManualEntryData) => {
    if (onEditManual) {
      onEditManual(data);
    }
    setShowEditModal(false);
  };

  const handleEditCancel = () => {
    setShowEditModal(false);
  };

  return (
    <div className="rounded-lg bg-white shadow-sm">
      {/* Original row */}
      <MandateRowContent
        mandate={mandate}
        state={state}
        commentCount={commentCount}
        isReviewer={isReviewer}
        readOnly={readOnly}
        isFoundational={isFoundational}
        allSymbols={allSymbols}
        allEntitySymbols={allEntitySymbols}
        newestWithNewerVersion={newestWithNewerVersion}
        onOpenSidebar={() => {
          setSidebarInitialTab(undefined);
          setSidebarOpen(true);
        }}
        onOpenActivityTab={() => {
          setSidebarInitialTab("activity");
          setSidebarOpen(true);
        }}
        onDecision={onDecision}
        onReasonChange={onReasonChange}
        onApprove={onApprove}
        onUpdateClick={(prefillSymbol) => {
          setUpdatePrefillSymbol(prefillSymbol);
          setShowUpdateSearch(true);
        }}
        showReasonPopup={showReasonPopup}
        onReasonPopupClose={() => setShowReasonPopup(false)}
        onDiff={handleDiff}
        onEdit={handleEdit}
      />

      {/* Update search input (shown when user selects "update" from dropdown) */}
      {!readOnly && showUpdateSearch && !hasCompletedUpdate && (
        <div className="border-t border-gray-100 bg-amber-50/30 px-4 py-3">
          <div className="mb-3 text-xs font-medium text-amber-600">
            Select replacement document:
          </div>
          <DocumentSearchInput
            onSelect={handleUpdateSelect}
            onManualSubmit={handleUpdateManual}
            onCancel={handleCancelUpdate}
            placeholder="Search for replacement document..."
            submitLabel="Update"
            formTitle="Enter replacement document manually"
            compact
            initialQuery={updatePrefillSymbol || suggestedUpdateSymbol}
            originalTitle={mandate.title}
            originalSymbol={mandate.symbol}
          />
        </div>
      )}

      {/* Edit manual entry form (shown when user clicks edit button) */}
      {!readOnly &&
        showEditModal &&
        state?.decision?.decision === "add" &&
        state?.decision?.manualMetadata && (
          <div className="border-t border-gray-100 bg-emerald-50/30 px-4 py-3">
            <div className="mb-3 text-xs font-medium text-emerald-600">
              Edit manual entry:
            </div>
            <ManualDocumentForm
              onSubmit={handleEditSubmit}
              onCancel={handleEditCancel}
              initialSymbol={mandate.symbol}
              initialTitle={state.decision.manualMetadata.title || ""}
              initialBody={state.decision.manualMetadata.body || ""}
              initialYear={state.decision.manualMetadata.year?.toString() || ""}
              initialLink={state.decision.manualMetadata.link || ""}
              submitLabel="Save Changes"
              formTitle=""
              hideDescription
            />
          </div>
        )}

      {/* New document row (shown when update is complete) */}
      {hasCompletedUpdate && newMandate && (
        <MandateRowContent
          mandate={newMandate}
          state={undefined}
          commentCount={0}
          isReviewer={false}
          isUpdateTarget
          allEntitySymbols={allEntitySymbols}
          newestWithNewerVersion={newestWithNewerVersion}
          onOpenSidebar={() => setNewDocSidebarOpen(true)}
          onDecision={() => {}}
        />
      )}

      {/* Sidebar (reuse DocumentSymbol for full sidebar) */}
      <div onClick={(e) => e.stopPropagation()}>
        <DocumentSymbol
          symbol={mandate.symbol}
          link={mandate.link}
          title={mandate.title}
          year={mandate.year}
          body={mandate.body}
          otherEntitiesCount={mandate.otherEntitiesCount}
          relevanceCount={mandate.relevanceCount}
          relevanceIndices={mandate.relevanceIndices}
          aiComments={mandate.aiComments}
          entity={mandate.entity}
          entityLong={mandate.entityLong}
          allEntities={mandate.allEntities}
          entitySubprogrammes={mandate.entitySubprogrammes}
          entityLongMap={mandate.entityLongMap}
          allEntityRelevance={mandate.allEntityRelevance}
          isOpen={sidebarOpen}
          onOpenChange={(open) => {
            setSidebarOpen(open);
            if (!open) setSidebarInitialTab(undefined);
          }}
          state={state}
          isReviewer={isReviewer}
          canReviewAnyEntity={canReviewAnyEntity}
          userEmail={userEmail}
          userEntity={userEntity}
          isFoundational={isFoundational}
          onDecision={onDecision}
          onApprove={onApprove}
          onComment={onComment}
          onUpdateClick={(prefillSymbol) => {
            setSidebarOpen(false);
            setUpdatePrefillSymbol(prefillSymbol);
            setShowUpdateSearch(true);
          }}
          metadataFromDb={mandate.metadataFromDb}
          docType={mandate.docType}
          initialTab={sidebarInitialTab}
        />
        {/* Sidebar for replacement document */}
        {hasCompletedUpdate && newMandate && (
          <DocumentSymbol
            symbol={newMandate.symbol}
            link={newMandate.link}
            title={newMandate.title}
            year={newMandate.year}
            body={newMandate.body}
            otherEntitiesCount={newMandate.otherEntitiesCount}
            relevanceCount={newMandate.relevanceCount}
            relevanceIndices={newMandate.relevanceIndices}
            aiComments={newMandate.aiComments}
            entity={newMandate.entity}
            entityLong={newMandate.entityLong}
            allEntities={newMandate.allEntities}
            entitySubprogrammes={newMandate.entitySubprogrammes}
            entityLongMap={newMandate.entityLongMap}
            allEntityRelevance={newMandate.allEntityRelevance}
            isOpen={newDocSidebarOpen}
            onOpenChange={setNewDocSidebarOpen}
            state={state}
            isReviewer={isReviewer}
            canReviewAnyEntity={canReviewAnyEntity}
            userEmail={userEmail}
            userEntity={userEntity}
            onDecision={onDecision}
            onApprove={onApprove}
            onComment={onComment}
            metadataFromDb={newMandate.metadataFromDb}
            docType={newMandate.docType}
          />
        )}
      </div>

      {/* Diff Modal */}
      {diffParams && (
        <DiffModal
          isOpen={diffModalOpen}
          onClose={() => {
            setDiffModalOpen(false);
            setDiffParams(null);
          }}
          originalSymbol={diffParams.originalSymbol}
          originalYear={diffParams.originalYear}
          compareSymbol={diffParams.compareSymbol}
          compareYear={diffParams.compareYear}
        />
      )}

    </div>
  );
}

// Wrapper for the "Add" row at bottom of sections
function AddEntryRow({
  onAdd,
  onAddManual,
  disabled,
}: {
  onAdd: (symbol: string) => void;
  onAddManual: (data: ManualEntryData) => void;
  disabled?: boolean;
}) {
  if (disabled) return null;
  return (
    <DocumentSearchInput
      onSelect={onAdd}
      onManualSubmit={onAddManual}
      placeholder="Add mandate document from database — search by symbol or title and click to select."
      submitLabel="Add"
      formTitle="Add document manually"
    />
  );
}

function MandateSection({
  title,
  mandates,
  entity,
  entityLong,
  subprogramme,
  states,
  totalComments,
  addedMetadata,
  updateTargetMetadata,
  isReviewer,
  canReviewAnyEntity,
  userEmail,
  userEntity,
  readOnly,
  foundationalSymbols,
  allEntitySymbols,
  onDecision,
  onReasonChange,
  onApprove,
  onUpdateWithManual,
  onEditManual,
  onComment,
  onAdd,
  onAddManual,
  searchQuery = "",
}: {
  title: string;
  mandates: Mandate[];
  entity: string;
  entityLong: string | null;
  subprogramme: string | null;
  states: Record<string, MandateState>;
  totalComments: Record<string, number>;
  addedMetadata: Record<
    string,
    {
      title: string | null;
      year: number | null;
      body: string | null;
      docType: string | null;
      link: string | null;
    } | null
  >;
  updateTargetMetadata: Record<
    string,
    { title: string | null; year: number | null; body: string | null } | null
  >;
  isReviewer: boolean;
  canReviewAnyEntity?: boolean;
  userEmail: string | null;
  userEntity: string | null;
  readOnly?: boolean;
  foundationalSymbols?: Set<string>;
  allEntitySymbols?: Set<string>;
  onDecision: (symbol: string, decision: Decision, newSymbol?: string) => void;
  onReasonChange: (
    symbol: string,
    decisionReason: string | null,
    otherReason: string | null,
  ) => void;
  onApprove: (decisionId: string, approved: boolean) => void;
  onUpdateWithManual: (
    symbol: string,
    newSymbol: string,
    manualData: ManualEntryData,
  ) => void;
  onEditManual?: (symbol: string, data: ManualEntryData) => void;
  onComment: (symbol: string, comment: string) => void;
  onAdd: (symbol: string) => void;
  onAddManual: (data: ManualEntryData) => void;
  searchQuery?: string;
}) {
  const [sortColumn, setSortColumn] = useState<SortColumn | null>("title");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [showEditModal, setShowEditModal] = useState(false);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      // Toggle direction or clear if already desc
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else {
        setSortColumn(null);
        setSortDirection("asc");
      }
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const stateKey = (symbol: string) => `${symbol}:${subprogramme || ""}`;
  const existingSymbols = new Set(mandates.map((m) => m.symbol));
  // Find user-added entries (decision === "add", excluding cancelled, not already in mandates)
  const addedEntries = Object.values(states).filter(
    (s) =>
      s.subprogramme === subprogramme &&
      s.decision?.decision === "add" &&
      !existingSymbols.has(s.documentSymbol),
  );

  // Convert added entries to Mandate objects
  const addedMandates: Mandate[] = addedEntries.map((s) => {
    const meta = addedMetadata[s.documentSymbol];
    // Check for manual metadata in the decision
    const manualMeta = s.decision?.manualMetadata;
    return {
      symbol: s.documentSymbol,
      title: manualMeta?.title || meta?.title || "",
      link: manualMeta?.link || meta?.link || null,
      year: manualMeta?.year || meta?.year || null,
      body: manualMeta?.body || meta?.body || null,
      docType: meta?.docType || null,
      action: null,
      relevanceCount: 0,
      relevanceIndices: [],
      aiComments: {},
      entity,
      entityLong,
      isBackground: subprogramme === null,
      otherEntitiesCount: 0,
      allEntities: [entity],
      entitySubprogrammes: subprogramme ? { [entity]: [subprogramme] } : {},
      entityLongMap: entityLong ? { [entity]: entityLong } : {},
      allEntityRelevance: {},
      metadataFromDb: !!meta,
      isAdded: true,
    };
  });

  // Get update target symbol for metadata lookup
  const getUpdateTargetSymbol = (symbol: string) => {
    const s = states[stateKey(symbol)];
    return s?.decision?.newSymbol;
  };

  // Sort mandates based on current sort state
  const sortedMandates = useMemo(() => {
    let filtered = mandates;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = mandates.filter(
        (m) =>
          m.symbol.toLowerCase().includes(query) ||
          m.title?.toLowerCase().includes(query) ||
          m.body?.toLowerCase().includes(query),
      );
    }

    if (!sortColumn) return filtered;

    return [...filtered].sort((a, b) => {
      let comparison = 0;

      switch (sortColumn) {
        case "symbol":
          // Use natural sort for symbols (handles A/RES/79/1, A/RES/79/10, A/RES/79/2 correctly)
          const symbolsOrdered = orderBy(
            [a, b],
            [(v) => v.symbol],
            [sortDirection === "asc" ? "asc" : "desc"],
          );
          return symbolsOrdered[0] === a ? -1 : 1;
        case "title":
          // Empty titles sort last
          const titleA = a.title || "";
          const titleB = b.title || "";
          if (!titleA && titleB) return sortDirection === "asc" ? 1 : -1;
          if (titleA && !titleB) return sortDirection === "asc" ? -1 : 1;
          comparison = titleA.localeCompare(titleB);

          // Secondary sort by year when titles are equal
          if (comparison === 0) {
            if (a.year === null && b.year !== null) comparison = 1;
            else if (a.year !== null && b.year === null) comparison = -1;
            else if (a.year !== null && b.year !== null) {
              comparison = (a.year ?? 0) - (b.year ?? 0);
            }

            // Tertiary sort by symbol (natural sort) when year is also equal
            if (comparison === 0) {
              const symbolsOrdered = orderBy(
                [a, b],
                [(v) => v.symbol],
                ["asc"],
              );
              comparison = symbolsOrdered[0] === a ? -1 : 1;
            }
          }
          break;
        case "body":
          const bodyA = a.body || "";
          const bodyB = b.body || "";
          if (!bodyA && bodyB) return sortDirection === "asc" ? 1 : -1;
          if (bodyA && !bodyB) return sortDirection === "asc" ? -1 : 1;
          comparison = bodyA.localeCompare(bodyB);
          break;
        case "year":
          // Null years sort last
          if (a.year === null && b.year !== null)
            return sortDirection === "asc" ? 1 : -1;
          if (a.year !== null && b.year === null)
            return sortDirection === "asc" ? -1 : 1;
          if (a.year === null && b.year === null) return 0;
          comparison = (a.year ?? 0) - (b.year ?? 0);

          // Secondary sort by title when years are equal
          if (comparison === 0) {
            const titleA = a.title || "";
            const titleB = b.title || "";
            comparison = titleA.localeCompare(titleB);
          }
          break;
        case "others":
          comparison =
            (a.otherEntitiesCount ?? 0) - (b.otherEntitiesCount ?? 0);
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [mandates, sortColumn, sortDirection, searchQuery]);

  // Build set of all symbols for warning system (to detect newer-already-cited)
  const allSymbols = useMemo(
    () =>
      new Set([
        ...mandates.map((m) => m.symbol),
        ...addedMandates.map((m) => m.symbol),
      ]),
    [mandates, addedMandates],
  );

  // Build set of symbols that are the newest citation among those sharing the same newer version
  // Only these should show the "newer version available" warning
  const newestWithNewerVersion = useMemo(() => {
    const allMandates = [...mandates, ...addedMandates];
    // Group by newer version symbol
    const byNewerVersion = new Map<string, Mandate[]>();
    for (const m of allMandates) {
      if (m.newerVersion?.symbol) {
        const existing = byNewerVersion.get(m.newerVersion.symbol) || [];
        existing.push(m);
        byNewerVersion.set(m.newerVersion.symbol, existing);
      }
    }
    // For each group, find the one with the highest year
    const newestSymbols = new Set<string>();
    for (const group of byNewerVersion.values()) {
      const newest = group.reduce((a, b) =>
        (a.year ?? 0) >= (b.year ?? 0) ? a : b,
      );
      newestSymbols.add(newest.symbol);
    }
    return newestSymbols;
  }, [mandates, addedMandates]);

  if (mandates.length === 0 && addedMandates.length === 0) return null;

  return (
    <div>
      {readOnly && (
        <div className="mb-6 border-t border-dashed border-gray-300 pt-6" />
      )}
      <div className="mb-3 flex items-baseline gap-2">
        <h3 className="text-sm font-semibold tracking-wide text-gray-600 uppercase">
          {title}
        </h3>
        {!readOnly && title !== "PROGRAMME LEVEL" && (
          <button
            onClick={() => setShowEditModal(true)}
            className="text-gray-400 transition-colors hover:text-gray-600"
            title="Edit subprogramme"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
        {readOnly && (
          <span className="text-xs text-gray-400">
            — for your reference (read-only)
          </span>
        )}
      </div>

      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Subprogramme</DialogTitle>
            <DialogDescription className="pt-2">
              Editing subprogrammes is not yet supported. If changes are
              necessary, please reach out to{" "}
              <a
                href="mailto:support@eosg.dev"
                className="text-un-blue hover:underline"
              >
                support@eosg.dev
              </a>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
      <div className="space-y-1.5">
        <ColumnHeaders
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={handleSort}
          isReviewer={isReviewer}
          onApproveAll={() => {
            // Get all decisions in this section
            const allDecisions = [
              ...sortedMandates.map((m) => states[stateKey(m.symbol)]),
              ...addedMandates.map((m) => states[stateKey(m.symbol)]),
            ].filter((s) => s?.decision);

            // Check if all are approved
            const allApproved = allDecisions.every(
              (s) => s!.decision!.approvedBy,
            );

            // Toggle: if all approved, unapprove all; otherwise approve all
            allDecisions.forEach((s) => {
              const id = s!.decision!.id;
              if (id) {
                onApprove(id, !allApproved);
              }
            });
          }}
        />
        {sortedMandates.map((m) => {
          const targetSymbol = getUpdateTargetSymbol(m.symbol);
          return (
            <MandateRow
              key={m.symbol}
              mandate={{ ...m, entity }}
              state={states[stateKey(m.symbol)]}
              commentCount={totalComments[m.symbol] || 0}
              isReviewer={isReviewer}
              canReviewAnyEntity={canReviewAnyEntity}
              userEmail={userEmail}
              userEntity={userEntity}
              readOnly={readOnly}
              isFoundational={foundationalSymbols?.has(m.symbol)}
              allSymbols={allSymbols}
              allEntitySymbols={allEntitySymbols}
              newestWithNewerVersion={newestWithNewerVersion}
              onDecision={(decision, newSymbol) =>
                onDecision(m.symbol, decision, newSymbol)
              }
              onReasonChange={(reason, otherReason) =>
                onReasonChange(m.symbol, reason, otherReason)
              }
              onApprove={onApprove}
              onUpdateWithManual={(newSymbol, manualData) =>
                onUpdateWithManual(m.symbol, newSymbol, manualData)
              }
              onEditManual={
                onEditManual ? (data) => onEditManual(m.symbol, data) : undefined
              }
              onComment={(comment) => onComment(m.symbol, comment)}
              updateTargetMetadata={
                targetSymbol ? updateTargetMetadata[targetSymbol] : undefined
              }
            />
          );
        })}
        {!readOnly &&
          addedMandates.map((m) => (
            <MandateRow
              key={m.symbol}
              mandate={m}
              state={states[stateKey(m.symbol)]}
              commentCount={totalComments[m.symbol] || 0}
              isReviewer={isReviewer}
              canReviewAnyEntity={canReviewAnyEntity}
              userEmail={userEmail}
              userEntity={userEntity}
              allSymbols={allSymbols}
              allEntitySymbols={allEntitySymbols}
              newestWithNewerVersion={newestWithNewerVersion}
              onDecision={(decision) => onDecision(m.symbol, decision)}
              onReasonChange={(reason, otherReason) =>
                onReasonChange(m.symbol, reason, otherReason)
              }
              onApprove={onApprove}
              onUpdateWithManual={() => {}}
              onEditManual={
                onEditManual ? (data) => onEditManual(m.symbol, data) : undefined
              }
              onComment={(comment) => onComment(m.symbol, comment)}
              isAdded
            />
          ))}
        {!readOnly && (
          <AddEntryRow
            onAdd={onAdd}
            onAddManual={onAddManual}
            disabled={false}
          />
        )}
      </div>
    </div>
  );
}

export function EntityDetail({
  entity,
  entityLong,
  partName,
  backgroundMandates,
  legislativeMandates,
}: Props) {
  const [filterEntity, setFilterEntity] = useState<string | null>(null);
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [states, setStates] = useState<Record<string, MandateState>>({});
  const [totalComments, setTotalComments] = useState<Record<string, number>>(
    {},
  );
  const [isReviewer, setIsReviewer] = useState(false);
  const [canReviewAnyEntity, setCanReviewAnyEntity] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userEntity, setUserEntity] = useState<string | null>(null);
  const [isUnderReview, setIsUnderReview] = useState(false);
  const [reviewModeLoaded, setReviewModeLoaded] = useState(false);
  const [reviewStartedBy, setReviewStartedBy] = useState<string | null>(null);
  const [showReviewBlockedDialog, setShowReviewBlockedDialog] = useState(false);
  const [showClearAllDialog, setShowClearAllDialog] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [addedMetadata, setAddedMetadata] = useState<
    Record<
      string,
      {
        title: string | null;
        year: number | null;
        body: string | null;
        docType: string | null;
        link: string | null;
      } | null
    >
  >({});
  const [updateTargetMetadata, setUpdateTargetMetadata] = useState<
    Record<
      string,
      { title: string | null; year: number | null; body: string | null } | null
    >
  >({});

  // Check if user owns this entity (can edit) or can review any entity (DMSPC)
  const isOwnEntity = useMemo(() => {
    return userEntity === entity || canReviewAnyEntity;
  }, [userEntity, entity, canReviewAnyEntity]);

  // Set of background mandate symbols (for foundational highlighting in legislative sections)
  const foundationalSymbols = useMemo(
    () => new Set(backgroundMandates.map((m) => m.symbol)),
    [backgroundMandates],
  );

  // Fetch user role and decisions on mount
  useEffect(() => {
    getUserRoleAction()
      .then((result) => {
        if (result.success && result.data) {
          setIsReviewer(result.data.isReviewer ?? false);
          setCanReviewAnyEntity(result.data.canReviewAnyEntity ?? false);
          setUserEmail(result.data.email);
          setUserEntity(result.data.entity ?? null);
        }
      })
      .catch(() => {});

    getEntityDecisionsAction(entity)
      .then((result) => {
        if (result.success && result.data) {
          const map: Record<string, MandateState> = {};
          for (const s of result.data.states) {
            map[`${s.documentSymbol}:${s.subprogramme || ""}`] = s;
          }
          setStates(map);
          setTotalComments(result.data.totalComments);
        }
      })
      .catch(() => {});

    getReviewModeStatusAction(entity)
      .then((result) => {
        if (result.success && result.data) {
          setIsUnderReview(result.data.isUnderReview);
          setReviewStartedBy(result.data.startedBy);
        }
      })
      .catch(() => {})
      .finally(() => setReviewModeLoaded(true));
  }, [entity]);

  // Handle real-time changes from other users (via polling)
  const handleRemoteChange = useCallback(
    async (change: RealtimeChange) => {
      // Fetch the updated state for this specific mandate
      const result = await getSingleMandateStateAction({
        documentSymbol: change.document_symbol,
        entity,
        subprogramme: change.subprogramme,
      });

      if (result.success) {
        const key = `${change.document_symbol}:${change.subprogramme || ""}`;

        if (result.data) {
          // Update or add the state
          setStates((prev) => ({
            ...prev,
            [key]: result.data!,
          }));
        }

        // Update total comments count if it was a comment change
        if (change.table === "mandate_comments") {
          setTotalComments((prev) => ({
            ...prev,
            [change.document_symbol]:
              (result.data?.comments?.length ?? prev[change.document_symbol]) ||
              0,
          }));
        }
      }
    },
    [entity],
  );

  // Real-time sync via polling (works with Vercel serverless)
  // Polls both decisions/comments AND review mode status
  useRealtimeDecisions({
    entity,
    onRemoteChange: handleRemoteChange,
    onReviewModeChange: (status) => {
      setIsUnderReview(status.isUnderReview);
      setReviewStartedBy(status.reviewStartedBy);
    },
    enabled: true,
    pollIntervalMs: 3000, // Poll every 3 seconds
  });

  // Fetch metadata for added documents
  useEffect(() => {
    const existingSymbols = new Set([
      ...backgroundMandates.map((m) => m.symbol),
      ...Object.values(legislativeMandates)
        .flat()
        .map((m) => m.symbol),
    ]);
    const addedSymbols = Object.values(states)
      .filter(
        (s) =>
          s.decision?.decision === "add" &&
          !existingSymbols.has(s.documentSymbol),
      )
      .map((s) => s.documentSymbol)
      .filter((sym) => !(sym in addedMetadata)); // Use "in" to check if key exists (even if null)

    if (addedSymbols.length === 0) return;

    getDocumentMetadataAction(addedSymbols)
      .then((result) => {
        if (!result.success) return;
        const data = result.data ?? {};
        // Mark all looked-up symbols, even if no data found (to prevent re-fetching)
        const resultMap: Record<
          string,
          {
            title: string | null;
            year: number | null;
            body: string | null;
            docType: string | null;
            link: string | null;
          } | null
        > = {};
        for (const sym of addedSymbols) {
          resultMap[sym] = data[sym] || null; // null means "looked up but not found"
        }
        setAddedMetadata((prev) => ({ ...prev, ...resultMap }));
      })
      .catch(() => {});
  }, [states, backgroundMandates, legislativeMandates, addedMetadata]);

  // Fetch metadata for update target documents
  useEffect(() => {
    const updateTargetSymbols = Object.values(states)
      .filter((s) => s.decision?.decision === "update")
      .map((s) => s.decision?.newSymbol)
      .filter((sym): sym is string => !!sym && !(sym in updateTargetMetadata));

    if (updateTargetSymbols.length === 0) return;

    getDocumentMetadataAction(updateTargetSymbols)
      .then((result) => {
        if (!result.success) return;
        const data = result.data ?? {};
        const resultMap: Record<
          string,
          {
            title: string | null;
            year: number | null;
            body: string | null;
          } | null
        > = {};
        for (const sym of updateTargetSymbols) {
          resultMap[sym] = data[sym] || null;
        }
        setUpdateTargetMetadata((prev) => ({ ...prev, ...resultMap }));
      })
      .catch(() => {});
  }, [states, updateTargetMetadata]);

  const handleDecision = useCallback(
    async (
      symbol: string,
      subprogramme: string | null,
      decision: Decision,
      newSymbol?: string,
    ) => {
      if (!userEmail) return;
      const key = `${symbol}:${subprogramme || ""}`;
      const now = new Date().toISOString();
      const newDecision: MandateDecision = {
        id: "",
        documentSymbol: symbol,
        entity,
        subprogramme,
        decision,
        newSymbol: newSymbol || null,
        decisionReason: null,
        otherReason: null,
        userEmail,
        userEntity,
        createdAt: now,
        approvedBy: null,
        approvedByEntity: null,
        approvedAt: null,
      };
      // Optimistic update
      setStates((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          documentSymbol: symbol,
          entity,
          subprogramme,
          decision: newDecision,
          decisions: [...(prev[key]?.decisions || []), newDecision],
        },
      }));

      const result = await createDecisionAction({
        documentSymbol: symbol,
        entity,
        subprogramme,
        decision,
        newSymbol,
      });
      if (result.success && result.data) {
        const updated = result.data;
        setStates((prev) => ({
          ...prev,
          [key]: {
            ...prev[key],
            decision: updated,
            decisions: [
              ...(prev[key]?.decisions?.filter((d) => d.id) || []),
              updated,
            ],
          },
        }));
      } else if (!result.success) {
        // Handle review mode blocked - let user explore, show dialog after delay
        if (result.error === "review_mode_blocked") {
          setTimeout(() => {
            setShowReviewBlockedDialog(true);
          }, 2000);
          // Don't revert - let user continue exploring
          return;
        }
        // Revert optimistic update on other failures
        console.error("Failed to save decision:", result.error);
        setStates((prev) => {
          const prevDecisions = prev[key]?.decisions?.filter((d) => d.id) || [];
          const lastValidDecision =
            prevDecisions[prevDecisions.length - 1] || null;
          return {
            ...prev,
            [key]: {
              ...prev[key],
              decision: lastValidDecision,
              decisions: prevDecisions,
            },
          };
        });
      }
    },
    [entity, userEmail, userEntity],
  );

  const handleReasonChange = useCallback(
    async (
      symbol: string,
      subprogramme: string | null,
      decisionReason: string | null,
      otherReason: string | null,
    ) => {
      const key = `${symbol}:${subprogramme || ""}`;
      const currentState = states[key];
      const decisionId = currentState?.decision?.id;

      if (!decisionId) return;

      // Optimistic update
      setStates((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          decision: prev[key]?.decision
            ? {
                ...prev[key].decision!,
                decisionReason,
                otherReason: decisionReason === "other" ? otherReason : null,
              }
            : null,
        },
      }));

      const result = await updateDecisionReasonAction({
        decisionId,
        decisionReason,
        otherReason: decisionReason === "other" ? otherReason : null,
      });

      if (result.success && result.data) {
        const updated = result.data;
        setStates((prev) => ({
          ...prev,
          [key]: {
            ...prev[key],
            decision: updated,
            decisions:
              prev[key]?.decisions?.map((d) =>
                d.id === updated.id ? updated : d,
              ) || [],
          },
        }));
      } else if (!result.success && result.error === "review_mode_blocked") {
        setTimeout(() => {
          setShowReviewBlockedDialog(true);
        }, 2000);
      }
    },
    [states],
  );

  const handleUpdateWithManual = useCallback(
    async (
      symbol: string,
      subprogramme: string | null,
      newSymbol: string,
      manualData: ManualEntryData,
    ) => {
      if (!userEmail) return;
      const key = `${symbol}:${subprogramme || ""}`;
      const now = new Date().toISOString();
      const manualMetadata = {
        title: manualData.title || undefined,
        body: manualData.body || undefined,
        year: manualData.year ? parseInt(manualData.year) : undefined,
        link: manualData.link || undefined,
      };
      const newDecision: MandateDecision = {
        id: "",
        documentSymbol: symbol,
        entity,
        subprogramme,
        decision: "update" as Decision,
        newSymbol,
        manualMetadata,
        decisionReason: null,
        otherReason: null,
        userEmail,
        userEntity,
        createdAt: now,
        approvedBy: null,
        approvedByEntity: null,
        approvedAt: null,
      };
      // Optimistic update
      setStates((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          documentSymbol: symbol,
          entity,
          subprogramme,
          decision: newDecision,
          decisions: [...(prev[key]?.decisions || []), newDecision],
        },
      }));
      // Also add to updateTargetMetadata for display
      setUpdateTargetMetadata((prev) => ({
        ...prev,
        [newSymbol]: {
          title: manualData.title || null,
          year: manualData.year ? parseInt(manualData.year) : null,
          body: manualData.body || null,
        },
      }));

      const result = await createDecisionAction({
        documentSymbol: symbol,
        entity,
        subprogramme,
        decision: "update",
        newSymbol,
        manualMetadata,
      });
      if (result.success && result.data) {
        const updated = result.data;
        setStates((prev) => ({
          ...prev,
          [key]: {
            ...prev[key],
            decision: updated,
            decisions: [
              ...(prev[key]?.decisions?.filter((d) => d.id) || []),
              updated,
            ],
          },
        }));
      } else if (!result.success && result.error === "review_mode_blocked") {
        setTimeout(() => {
          setShowReviewBlockedDialog(true);
        }, 2000);
      }
    },
    [entity, userEmail, userEntity],
  );

  const handleAddManual = useCallback(
    async (subprogramme: string | null, data: ManualEntryData) => {
      if (!userEmail) return;
      const key = `${data.symbol}:${subprogramme || ""}`;
      const now = new Date().toISOString();
      const manualMetadata = {
        title: data.title || undefined,
        body: data.body || undefined,
        year: data.year ? parseInt(data.year) : undefined,
        link: data.link || undefined,
      };
      const newDecision: MandateDecision = {
        id: "",
        documentSymbol: data.symbol,
        entity,
        subprogramme,
        decision: "add" as Decision,
        newSymbol: null,
        manualMetadata,
        decisionReason: null,
        otherReason: null,
        userEmail,
        userEntity,
        createdAt: now,
        approvedBy: null,
        approvedByEntity: null,
        approvedAt: null,
      };
      // Optimistic update
      setStates((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          documentSymbol: data.symbol,
          entity,
          subprogramme,
          decision: newDecision,
          decisions: [...(prev[key]?.decisions || []), newDecision],
        },
      }));
      // Also add to addedMetadata for display
      setAddedMetadata((prev) => ({
        ...prev,
        [data.symbol]: {
          title: data.title || null,
          year: data.year ? parseInt(data.year) : null,
          body: data.body || null,
          docType: null,
          link: data.link || null,
        },
      }));

      const result = await createDecisionAction({
        documentSymbol: data.symbol,
        entity,
        subprogramme,
        decision: "add",
        manualMetadata,
      });
      if (result.success && result.data) {
        const updated = result.data;
        setStates((prev) => ({
          ...prev,
          [key]: {
            ...prev[key],
            decision: updated,
            decisions: [
              ...(prev[key]?.decisions?.filter((d) => d.id) || []),
              updated,
            ],
          },
        }));
      } else if (!result.success && result.error === "review_mode_blocked") {
        setTimeout(() => {
          setShowReviewBlockedDialog(true);
        }, 2000);
      }
    },
    [entity, userEmail, userEntity],
  );

  const handleEditManual = useCallback(
    async (
      symbol: string,
      subprogramme: string | null,
      data: ManualEntryData,
    ) => {
      if (!userEmail) return;
      const key = `${symbol}:${subprogramme || ""}`;
      const currentState = states[key];
      const currentDecision = currentState?.decision;

      if (!currentDecision) return;

      const manualMetadata = {
        title: data.title || undefined,
        body: data.body || undefined,
        year: data.year ? parseInt(data.year) : undefined,
        link: data.link || undefined,
      };

      // Optimistic update
      const updatedDecision = {
        ...currentDecision,
        manualMetadata,
      };

      setStates((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          decision: updatedDecision,
          decisions: prev[key]?.decisions?.map((d) =>
            d.id === currentDecision.id ? updatedDecision : d,
          ) || [],
        },
      }));

      // Update addedMetadata if this is an "add" decision
      if (currentDecision.decision === "add") {
        setAddedMetadata((prev) => ({
          ...prev,
          [symbol]: {
            title: data.title || null,
            year: data.year ? parseInt(data.year) : null,
            body: data.body || null,
            docType: null,
            link: data.link || null,
          },
        }));
      }

      // Update updateTargetMetadata if this is an "update" decision
      if (currentDecision.decision === "update" && currentDecision.newSymbol) {
        setUpdateTargetMetadata((prev) => ({
          ...prev,
          [currentDecision.newSymbol!]: {
            title: data.title || null,
            year: data.year ? parseInt(data.year) : null,
            body: data.body || null,
          },
        }));
      }

      // Save to server
      const result = await createDecisionAction({
        documentSymbol: symbol,
        entity,
        subprogramme,
        decision: currentDecision.decision,
        newSymbol: currentDecision.newSymbol || undefined,
        manualMetadata,
      });

      if (result.success && result.data) {
        const updated = result.data;
        setStates((prev) => ({
          ...prev,
          [key]: {
            ...prev[key],
            decision: updated,
            decisions: [
              ...(prev[key]?.decisions?.filter((d) => d.id !== updated.id) ||
                []),
              updated,
            ],
          },
        }));
      } else if (!result.success && result.error === "review_mode_blocked") {
        setTimeout(() => {
          setShowReviewBlockedDialog(true);
        }, 2000);
      }
    },
    [entity, userEmail, states],
  );

  const handleComment = useCallback(
    async (symbol: string, subprogramme: string | null, comment: string) => {
      if (!userEmail) return;
      const key = `${symbol}:${subprogramme || ""}`;
      const now = new Date().toISOString();
      const newComment: MandateComment = {
        id: "",
        documentSymbol: symbol,
        entity,
        subprogramme,
        comment,
        userEmail,
        userEntity,
        createdAt: now,
        resolvedAt: null,
        resolvedBy: null,
      };
      // Optimistic update
      setStates((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          documentSymbol: symbol,
          entity,
          subprogramme,
          comments: [...(prev[key]?.comments || []), newComment],
        },
      }));
      setTotalComments((prev) => ({
        ...prev,
        [symbol]: (prev[symbol] || 0) + 1,
      }));

      const result = await createCommentAction({
        documentSymbol: symbol,
        entity,
        subprogramme,
        comment,
      });
      if (result.success && result.data) {
        const added = result.data;
        setStates((prev) => ({
          ...prev,
          [key]: {
            ...prev[key],
            comments: [
              ...(prev[key]?.comments?.filter((c) => c.id) || []),
              added,
            ],
          },
        }));
      }
    },
    [entity, userEmail, userEntity],
  );

  const handleStartReview = useCallback(async () => {
    const result = await startReviewModeAction(entity);
    if (result.success && result.data) {
      setIsUnderReview(result.data.isUnderReview);
      setReviewStartedBy(result.data.startedBy);
    } else if (!result.success) {
      alert(`Failed to start review: ${result.error}`);
    }
  }, [entity]);

  const handleEndReview = useCallback(async () => {
    const result = await endReviewModeAction(entity);
    if (result.success && result.data) {
      setIsUnderReview(result.data.isUnderReview);
      setReviewStartedBy(null);
    } else if (!result.success) {
      alert(`Failed to end review: ${result.error}`);
    }
  }, [entity]);

  const handleClearAll = useCallback(async () => {
    const result = await clearAllEntityDecisionsAction(entity);
    if (result.success && result.data) {
      // Clear all local state
      setStates({});
      setTotalComments({});
      setAddedMetadata({});
      setUpdateTargetMetadata({});
    } else if (!result.success) {
      throw new Error(result.error);
    }
  }, [entity]);

  // Refresh decisions from server (used after review blocked dialog closes)
  const refreshDecisions = useCallback(async () => {
    const result = await getEntityDecisionsAction(entity);
    if (result.success && result.data) {
      const map: Record<string, MandateState> = {};
      for (const s of result.data.states) {
        map[`${s.documentSymbol}:${s.subprogramme || ""}`] = s;
      }
      setStates(map);
      setTotalComments(result.data.totalComments);
    }
  }, [entity]);

  const handleApprove = useCallback(
    async (decisionId: string, approved: boolean) => {
      // Optimistic update - find and update the decision
      setStates((prev) => {
        const newStates = { ...prev };
        for (const key of Object.keys(newStates)) {
          const s = newStates[key];
          if (s?.decision?.id === decisionId) {
            newStates[key] = {
              ...s,
              decision: {
                ...s.decision,
                approvedBy: approved ? userEmail : null,
                approvedAt: approved ? new Date().toISOString() : null,
              },
            };
            break;
          }
        }
        return newStates;
      });

      await approveDecisionAction(decisionId, approved);
    },
    [userEmail],
  );

  // Combine all mandates for co-citing calculation
  const allMandates = [
    ...backgroundMandates,
    ...Object.values(legislativeMandates).flat(),
  ];

  // Compute co-citing entities and their counts
  const coCitingCounts: Record<string, number> = {};
  for (const m of allMandates) {
    for (const e of m.allEntities) {
      if (e !== entity) {
        coCitingCounts[e] = (coCitingCounts[e] || 0) + 1;
      }
    }
  }
  const coCitingEntities = Object.entries(coCitingCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([e, count]) => ({ entity: e, count }));

  // Filter function
  const filterMandates = (mandates: Mandate[]) =>
    filterEntity
      ? mandates.filter((m) => m.allEntities.includes(filterEntity))
      : mandates;

  const filteredBackground = filterMandates(backgroundMandates);
  const filteredLegislative: Record<string, Mandate[]> = {};
  for (const [key, mandates] of Object.entries(legislativeMandates)) {
    const filtered = filterMandates(mandates);
    if (filtered.length > 0) filteredLegislative[key] = filtered;
  }

  const totalMandates =
    backgroundMandates.length +
    Object.values(legislativeMandates).reduce(
      (sum, arr) => sum + arr.length,
      0,
    );
  const filteredTotal =
    filteredBackground.length +
    Object.values(filteredLegislative).reduce(
      (sum, arr) => sum + arr.length,
      0,
    );

  // Calculate unique source documents (unique symbols)
  const allMandatesForCounting = [
    ...backgroundMandates,
    ...Object.values(legislativeMandates).flat(),
  ];
  const totalUniqueDocuments = new Set(
    allMandatesForCounting.map((m) => m.symbol),
  ).size;

  const filteredMandatesForCounting = [
    ...filteredBackground,
    ...Object.values(filteredLegislative).flat(),
  ];
  const filteredUniqueDocuments = new Set(
    filteredMandatesForCounting.map((m) => m.symbol),
  ).size;

  // Entity-wide set of all symbols (including added mandates) for "newer-already-cited" detection
  const allEntitySymbols = useMemo(() => {
    const symbols = new Set<string>();
    // Add all existing mandates
    for (const m of backgroundMandates) symbols.add(m.symbol);
    for (const mandates of Object.values(legislativeMandates)) {
      for (const m of mandates) symbols.add(m.symbol);
    }
    // Add symbols from "add" decisions
    for (const s of Object.values(states)) {
      if (s.decision?.decision === "add") {
        symbols.add(s.documentSymbol);
      }
    }
    return symbols;
  }, [backgroundMandates, legislativeMandates, states]);

  // Shared props for all MandateSection instances
  const sharedSectionProps = {
    entity,
    entityLong,
    states,
    totalComments,
    addedMetadata,
    updateTargetMetadata,
    isReviewer,
    canReviewAnyEntity,
    userEmail,
    userEntity,
    onApprove: handleApprove,
    allEntitySymbols,
  };

  // Create handlers for a specific subprogramme
  const makeSubprogHandlers = (subprog: string | null) => ({
    onDecision: (symbol: string, decision: Decision, newSymbol?: string) =>
      handleDecision(symbol, subprog, decision, newSymbol),
    onReasonChange: (
      symbol: string,
      decisionReason: string | null,
      otherReason: string | null,
    ) => handleReasonChange(symbol, subprog, decisionReason, otherReason),
    onUpdateWithManual: (
      symbol: string,
      newSymbol: string,
      manualData: ManualEntryData,
    ) => handleUpdateWithManual(symbol, subprog, newSymbol, manualData),
    onEditManual: (symbol: string, data: ManualEntryData) =>
      handleEditManual(symbol, subprog, data),
    onComment: (symbol: string, comment: string) =>
      handleComment(symbol, subprog, comment),
    onAdd: (symbol: string) => handleDecision(symbol, subprog, "add"),
    onAddManual: (data: ManualEntryData) => handleAddManual(subprog, data),
  });

  return (
    <div className="space-y-5">
      {/* Read-only notice */}
      {!isOwnEntity && userEntity && !canReviewAnyEntity && (
        <ReadOnlyNoticeBanner viewingEntity={entity} userEntity={userEntity} />
      )}
      {canReviewAnyEntity && userEntity !== entity && (
        <ReviewerModeBanner reviewingEntity={entity} />
      )}
      {isUnderReview && (
        <ReviewInProgressBanner
          startedBy={reviewStartedBy}
          isReviewer={isReviewer}
          onEndReview={isReviewer ? handleEndReview : undefined}
        />
      )}

      <EntityHeader
        entity={entity}
        entityLong={entityLong}
        partName={partName}
        filterEntity={filterEntity}
        filteredCitations={filteredTotal}
        totalCitations={totalMandates}
        filteredUniqueDocuments={filteredUniqueDocuments}
        totalUniqueDocuments={totalUniqueDocuments}
        canReviewAnyEntity={canReviewAnyEntity}
        isUnderReview={isUnderReview}
        onStartReview={reviewModeLoaded ? handleStartReview : undefined}
        onClearAll={
          reviewModeLoaded && canReviewAnyEntity
            ? () => setShowClearAllDialog(true)
            : undefined
        }
        isClearingAll={isClearingAll}
      />

      {/* Phase Tracker */}
      {/* <PhaseTracker /> */}

      {/* Co-citing entities filter */}
      {coCitingEntities.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs font-medium text-gray-400 uppercase">
              Filter by shared citations
            </span>
            <span className="text-xs text-gray-400">
              — click an entity to show only documents cited by both {entity}{" "}
              and that entity
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {coCitingEntities.map(({ entity: e, count }) => (
              <button
                key={e}
                onClick={() => setFilterEntity(filterEntity === e ? null : e)}
                title={`Show ${count} mandates cited by both ${entity} and ${e}`}
                className={`rounded-full px-2 py-0.5 text-xs transition-colors ${
                  filterEntity === e
                    ? "bg-un-blue text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {e}{" "}
                <span
                  className={
                    filterEntity === e ? "text-white/60" : "text-gray-400"
                  }
                >
                  {count}
                </span>
              </button>
            ))}
            {filterEntity && (
              <button
                onClick={() => setFilterEntity(null)}
                className="rounded-full bg-gray-300 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-400"
              >
                Clear filter
              </button>
            )}
          </div>
          {filterEntity && (
            <p className="mt-2 text-xs text-un-blue">
              Showing {filteredTotal} mandate{filteredTotal !== 1 ? "s" : ""}{" "}
              cited by both <strong>{entity}</strong> and{" "}
              <strong>{filterEntity}</strong>
            </p>
          )}
        </div>
      )}

      {/* Global Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search across all mandates by symbol, title, or body..."
            value={globalSearchQuery}
            onChange={(e) => setGlobalSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pr-10 pl-10 text-sm focus:border-un-blue focus:ring-1 focus:ring-un-blue focus:outline-none"
          />
          {globalSearchQuery && (
            <button
              onClick={() => setGlobalSearchQuery("")}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Mandates List */}
      <div className="space-y-8">
        {/* Legislative mandates (interactive only if user owns entity) */}
        {Object.entries(filteredLegislative)
          .sort(([a], [b]) => {
            // Sort "All Subprogrammes" (PROGRAMME LEVEL) first
            const aIsAll = a.toLowerCase().includes("all subprogramme");
            const bIsAll = b.toLowerCase().includes("all subprogramme");
            if (aIsAll && !bIsAll) return -1;
            if (!aIsAll && bIsAll) return 1;
            return a.localeCompare(b);
          })
          .map(([subprog, mandates]) => (
            <MandateSection
              key={subprog}
              title={formatSubprogrammeName(subprog)}
              mandates={mandates}
              subprogramme={subprog}
              foundationalSymbols={foundationalSymbols}
              readOnly={!isOwnEntity}
              searchQuery={globalSearchQuery}
              {...sharedSectionProps}
              {...makeSubprogHandlers(subprog)}
            />
          ))}

        {/* Mandates and background (editable by DMSPC reviewers) */}
        <MandateSection
          title="Mandates and background"
          mandates={filteredBackground}
          subprogramme={null}
          readOnly={!canReviewAnyEntity}
          foundationalSymbols={foundationalSymbols}
          searchQuery={globalSearchQuery}
          {...sharedSectionProps}
          {...makeSubprogHandlers(null)}
        />

        {filteredTotal === 0 && filterEntity && (
          <div className="rounded-lg bg-gray-50 p-8 text-center text-gray-400">
            No mandates match this filter
          </div>
        )}
      </div>

      {/* Review blocked dialog - shown when user tries to save while under review */}
      <ReviewBlockedDialog
        isOpen={showReviewBlockedDialog}
        onClose={() => {
          setShowReviewBlockedDialog(false);
          refreshDecisions();
        }}
      />

      {/* Clear all decisions dialog - shown when reviewer clicks Clear All */}
      <ClearAllDecisionsDialog
        isOpen={showClearAllDialog}
        onClose={() => setShowClearAllDialog(false)}
        onConfirm={handleClearAll}
        entityName={entity}
        onClearingStateChange={setIsClearingAll}
      />
    </div>
  );
}
