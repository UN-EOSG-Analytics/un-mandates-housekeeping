"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  getReasonsForDecision,
  getReasonLabel,
  type DecisionType,
} from "@/features/mandates/services/decision-reasons";
import { DECISION_COLORS } from "../../../components/DecisionDropdown";
import { POPUP_STYLES } from "@/lib/theme";
import {
  X,
  CheckCircle2,
  Building2,
  RefreshCw,
  Replace,
  Layers,
  Package,
  Building,
  MessageSquare,
  Lightbulb,
  Users,
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
 * Parse a label with **bold** markers and render as React nodes
 */
export function renderLabelWithBold(label: string): React.ReactNode {
  const parts = label.split(/(\*\*[^*]+\*\*)/);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <span key={i} className="font-semibold">
          {part.slice(2, -2)}
        </span>
      );
    }
    return part;
  });
}

// Exported icon mapping for use in other components
const REASON_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  // Add & Retain reasons
  direct_request: CheckCircle2,
  influences_work: Lightbulb,
  foundational: Building2,
  foundational_amend: Building2,
  // Update reasons
  superseded_identical: Replace,
  superseded_different: RefreshCw,
  // Remove reasons
  delivered: Package,
  other_entity_advantage: Users,
  subsidiary_removed: Building,
  consolidated: Layers,
  // Other
  other: MessageSquare,
};

/**
 * Get the icon component for a reason ID
 */
export function getReasonIcon(
  reasonId: string | null,
): React.ComponentType<{ className?: string }> | null {
  if (!reasonId) return null;
  return REASON_ICONS[reasonId] || MessageSquare;
}

/**
 * Render a reason icon as a React node
 */
export function renderReasonIcon(
  reasonId: string | null,
  className?: string,
): React.ReactNode {
  if (!reasonId) return null;
  const IconComponent = REASON_ICONS[reasonId] || MessageSquare;
  return <IconComponent className={className} />;
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
  const [localReason, setLocalReason] = React.useState<string | null>(reason);
  const [mounted, setMounted] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const reasons = getReasonsForDecision(decision);
  const colors = DECISION_COLORS[decision];

  // Get icon for a reason ID
  const getIconForReason = (reasonId: string) => {
    const IconComponent = REASON_ICONS[reasonId] || MessageSquare;
    return <IconComponent className="h-4 w-4" />;
  };

  // Client-side only rendering for portal
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // Lock body scroll when modal is open (comprehensive solution for all browsers including iOS)
  React.useEffect(() => {
    if (!isOpen) return;

    const scrollY = window.scrollY;
    const originalStyles = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
    };

    // Apply scroll lock
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";

    return () => {
      // Restore original styles
      document.body.style.overflow = originalStyles.overflow;
      document.body.style.position = originalStyles.position;
      document.body.style.top = originalStyles.top;
      document.body.style.width = originalStyles.width;
      // Restore scroll position
      window.scrollTo(0, scrollY);
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

  // Sync local state with props
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalOtherReason(otherReason ?? "");
    setLocalReason(reason);
  }, [otherReason, reason]);

  const handleReasonSelect = (reasonId: string) => {
    if (reasonId === "other") {
      // Set local state to show textarea, but don't persist yet
      // The onChange will be called in handleOtherSubmit when user clicks Done or presses Enter
      setLocalReason("other");
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
      className={`fixed inset-0 z-50 flex items-center justify-center ${POPUP_STYLES.overlay}`}
      style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0 }}
      onClick={handleBackdropClick}
    >
      <div
        ref={containerRef}
        className={`mx-4 max-w-lg animate-in ${POPUP_STYLES.popup} shadow-xl duration-150 zoom-in-95 fade-in`}
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
        <div className="max-h-[70vh] scrollbar-thin overflow-y-auto py-1">
          {reasons.map((r, index) => (
            <button
              key={r.id}
              onClick={() => handleReasonSelect(r.id)}
              className={`flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors ${
                index !== reasons.length - 1 ? "border-b border-gray-50" : ""
              } ${
                localReason === r.id
                  ? `${colors.bg} ${colors.text}`
                  : `text-gray-600 ${colors.hoverBg}`
              }`}
            >
              <span
                className={`mt-0.75 shrink-0 opacity-60 ${localReason === r.id ? colors.text : "text-gray-400"}`}
              >
                {getIconForReason(r.id)}
              </span>
              <span className="text-[13px] leading-5">
                {renderLabelWithBold(r.label)}
              </span>
            </button>
          ))}
        </div>

        {/* Other reason freetext input */}
        {localReason === "other" && (
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
