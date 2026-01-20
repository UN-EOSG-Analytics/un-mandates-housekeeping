"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  getReasonsForDecision,
  getReasonLabel,
  type DecisionType,
} from "@/lib/services/decision-reasons";
import { DECISION_COLORS } from "./DecisionDropdown";
import {
  X,
  CheckCircle2,
  Clock,
  Building2,
  RefreshCw,
  CalendarCheck,
  Timer,
  Award,
  Replace,
  Edit3,
  Layers,
  CheckSquare,
  Calendar,
  Package,
  Archive,
  FileX,
  Building,
  MessageSquare,
} from "lucide-react";

interface ReasonPopupProps {
  decision: DecisionType;
  reason: string | null;
  otherReason: string | null;
  onChange: (reason: string | null, otherReason: string | null) => void;
  onClose: () => void;
  isOpen: boolean;
  symbol?: string;
}

/**
 * Modal dialog for selecting a reason after a decision has been made.
 * Renders centered on screen with a backdrop.
 */
export function ReasonPopup({
  decision,
  reason,
  otherReason,
  onChange,
  onClose,
  isOpen,
  symbol,
}: ReasonPopupProps) {
  const [localOtherReason, setLocalOtherReason] = React.useState(
    otherReason ?? "",
  );
  const [mounted, setMounted] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const reasons = getReasonsForDecision(decision);
  const colors = DECISION_COLORS[decision];

  // Icons for each reason ID
  const reasonIcons: Record<string, React.ReactNode> = {
    // Retain reasons
    action_applicable: <CheckCircle2 className="h-4 w-4" />,
    ongoing_lt_5y: <Clock className="h-4 w-4" />,
    foundational: <Building2 className="h-4 w-4" />,
    continuing_no_end: <RefreshCw className="h-4 w-4" />,
    recent_relevant: <CalendarCheck className="h-4 w-4" />,
    ongoing_gt_5y: <Timer className="h-4 w-4" />,
    comparative_advantage: <Award className="h-4 w-4" />,
    // Update reasons
    superseded: <Replace className="h-4 w-4" />,
    updated_citation: <Edit3 className="h-4 w-4" />,
    // Remove reasons
    consolidated: <Layers className="h-4 w-4" />,
    activity_concluded: <CheckSquare className="h-4 w-4" />,
    completed_process: <Calendar className="h-4 w-4" />,
    delivered: <Package className="h-4 w-4" />,
    old_not_foundational: <Archive className="h-4 w-4" />,
    no_action_request: <FileX className="h-4 w-4" />,
    subsidiary_removed: <Building className="h-4 w-4" />,
    no_comparative_advantage: <Award className="h-4 w-4" />,
    // Other
    other: <MessageSquare className="h-4 w-4" />,
  };

  // Client-side only rendering for portal
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll when modal is open
  React.useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // Close on escape key
  React.useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Sync local other reason with prop
  React.useEffect(() => {
    setLocalOtherReason(otherReason ?? "");
  }, [otherReason]);

  const handleReasonSelect = (reasonId: string) => {
    if (reasonId === "other") {
      onChange("other", localOtherReason || null);
    } else {
      onChange(reasonId, null);
      onClose();
    }
  };

  const handleOtherReasonChange = (text: string) => {
    setLocalOtherReason(text);
  };

  const handleOtherSubmit = () => {
    onChange("other", localOtherReason || null);
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen || !mounted) return null;

  const decisionLabel = decision.charAt(0).toUpperCase() + decision.slice(1);

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-[1px]"
      style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0 }}
      onClick={handleBackdropClick}
    >
      <div
        ref={containerRef}
        className="mx-4 max-w-lg animate-in rounded-lg border border-gray-200 bg-white shadow-xl duration-150 zoom-in-95 fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between rounded-t-lg px-4 py-3 ${colors.bg} ${colors.border} border-b`}
        >
          <span className={`text-sm font-medium ${colors.text}`}>
            Why {decisionLabel.toLowerCase()}
            {symbol && <span className="font-semibold"> {symbol}</span>}?
          </span>
          <button
            onClick={onClose}
            className={`rounded p-1 transition-colors hover:bg-white/50 ${colors.text}`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Options */}
        <div className="scrollbar-thin max-h-[70vh] overflow-y-auto py-1">
          {reasons.map((r, index) => (
            <button
              key={r.id}
              onClick={() => handleReasonSelect(r.id)}
              className={`flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors ${
                index !== reasons.length - 1 ? "border-b border-gray-50" : ""
              } ${
                reason === r.id
                  ? `${colors.bg} ${colors.text}`
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <span
                className={`mt-0.5 shrink-0 opacity-60 ${reason === r.id ? colors.text : "text-gray-400"}`}
              >
                {reasonIcons[r.id] || <MessageSquare className="h-4 w-4" />}
              </span>
              <span className="text-[13px] leading-relaxed">{r.label}</span>
            </button>
          ))}
        </div>

        {/* Other reason freetext input */}
        {reason === "other" && (
          <div className="border-t border-gray-100 p-4">
            <textarea
              value={localOtherReason}
              onChange={(e) => handleOtherReasonChange(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && !e.shiftKey && handleOtherSubmit()
              }
              placeholder="Please specify the reason..."
              className="w-full resize-none rounded border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:border-gray-300 focus:outline-none"
              rows={3}
              autoFocus
            />
            <div className="mt-3 flex justify-end">
              <button
                onClick={handleOtherSubmit}
                className={`rounded px-4 py-2 text-sm font-medium transition-colors ${colors.bg} ${colors.text} ${colors.hover}`}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

/**
 * Get the display label for a reason (for use in tooltips)
 */
export function getReasonDisplayLabel(
  decision: DecisionType,
  reasonId: string | null,
  otherReason: string | null,
): string | null {
  if (!reasonId) return null;
  if (reasonId === "other" && otherReason) return otherReason;
  return getReasonLabel(decision, reasonId);
}
