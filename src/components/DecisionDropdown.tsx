"use client";

import * as React from "react";
import type { Decision } from "@/types";
import { ChevronDown, MessageCircle, Pencil } from "lucide-react";
import { ReasonPopup, getReasonDisplayLabel, renderReasonIcon } from "./ReasonDropdown";
import type { DecisionType } from "@/lib/services/decision-reasons";

interface DecisionDropdownProps {
  decision: Decision | null;
  onChange: (decision: Decision, newSymbol?: string) => void;
  onUpdateClick?: () => void;
  disabled?: boolean;
  userEmail?: string | null;
  createdAt?: string | null;
  className?: string;
  size?: "sm" | "md";
  // Reason props for integrated popup
  reason?: string | null;
  otherReason?: string | null;
  onReasonChange?: (reason: string | null, otherReason: string | null) => void;
  symbol?: string;
  // External control of reason popup
  showReasonPopup?: boolean;
  onReasonPopupClose?: () => void;
}

// Shared color scheme for decisions - exported for use in ReasonDropdown
export const DECISION_COLORS = {
  retain: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-700",
    hover: "hover:border-blue-300",
  },
  remove: {
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-700",
    hover: "hover:border-red-300",
  },
  update: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
    hover: "hover:border-amber-300",
  },
  add: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700",
    hover: "hover:border-emerald-300",
  },
  default: {
    bg: "bg-white",
    border: "border-gray-200",
    text: "text-gray-500",
    hover: "hover:border-gray-300",
  },
};

/**
 * Shared decision dropdown component used across the app.
 * Supports "retain", "remove", "update", and canceling back to "—".
 * Integrated with reason popup that appears after making a decision.
 */
export function DecisionDropdown({
  decision,
  onChange,
  onUpdateClick,
  disabled,
  userEmail,
  createdAt,
  className,
  size = "md",
  reason,
  otherReason,
  onReasonChange,
  symbol,
  showReasonPopup: externalShowReasonPopup,
  onReasonPopupClose,
}: DecisionDropdownProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [internalShowReasonPopup, setInternalShowReasonPopup] =
    React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Show popup if either internal or external says to show it
  // (external is used for "update" flow, internal for "retain"/"remove")
  const showReasonPopup = externalShowReasonPopup || internalShowReasonPopup;
  const setShowReasonPopup = (value: boolean) => {
    setInternalShowReasonPopup(value);
    if (!value && onReasonPopupClose) {
      onReasonPopupClose();
    }
  };

  // Get reason display label for tooltip
  const reasonLabel =
    decision && decision !== "cancel" && decision !== "add"
      ? getReasonDisplayLabel(
          decision as DecisionType,
          reason ?? null,
          otherReason ?? null,
        )
      : null;

  const colors =
    decision && decision in DECISION_COLORS
      ? DECISION_COLORS[decision as keyof typeof DECISION_COLORS]
      : DECISION_COLORS.default;
  const sizeClasses = size === "sm" ? "h-6 text-[11px]" : "h-6 text-[11px]";

  // Close dropdown when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (value: Decision | "") => {
    setIsOpen(false);

    if (!value) {
      onChange("cancel");
      // Just close the popup - the new "cancel" decision won't have a reason.
      // Don't call onReasonChange here as it would update the OLD decision
      // and cause the state to revert.
      setShowReasonPopup(false);
      return;
    }

    // For "update", don't call onChange yet - the decision will be created
    // after the user selects a replacement document in the update search panel.
    // Calling onChange("update") without a newSymbol would be rejected by the server.
    if (value === "update" && onUpdateClick) {
      onUpdateClick();
      return;
    }

    onChange(value);

    // Show reason popup after selecting a decision (except for cancel/add)
    if (value && value !== "cancel" && value !== "add" && onReasonChange) {
      setShowReasonPopup(true);
    }
  };

  const handleReasonChange = (
    newReason: string | null,
    newOtherReason: string | null,
  ) => {
    if (onReasonChange) {
      onReasonChange(newReason, newOtherReason);
    }
  };

  const displayLabel =
    decision && decision !== "cancel"
      ? decision.charAt(0).toUpperCase() + decision.slice(1)
      : "—";

  const options: { value: Decision | ""; label: string }[] = [
    { value: "", label: "—" },
    { value: "retain", label: "Retain" },
    { value: "remove", label: "Remove" },
    { value: "update", label: "Update" },
  ];

  // Show indicator if reason is set
  const hasReason = reason && reason !== "";

  return (
    <div ref={containerRef} className="relative flex items-center gap-0.5">
      {/* Main decision dropdown button */}
      <div className="group relative">
        <button
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`flex w-[5.25rem] items-center justify-between gap-1 rounded border px-2 font-medium transition-colors ${sizeClasses} ${colors.bg} ${colors.border} ${colors.text} ${
            disabled
              ? "cursor-default opacity-60"
              : `cursor-pointer ${colors.hover}`
          } ${className || ""}`}
        >
          <span>{displayLabel}</span>
          {!disabled && <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />}
        </button>
        {/* Tooltip on hover */}
        {decision && decision !== "cancel" && (
          <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            <div className="rounded-lg bg-gray-800 px-3 py-2 text-white shadow-lg">
              <div className="w-72 space-y-2 text-left">
                {reasonLabel ? (
                  <div className="flex items-start gap-2">
                    {reason && renderReasonIcon(reason, "mt-0.5 h-3.5 w-3.5 shrink-0 opacity-70")}
                    <span className="text-[11px] leading-relaxed">{reasonLabel}</span>
                  </div>
                ) : (
                  <div className="text-[11px] italic text-gray-300">No reason provided</div>
                )}
                {userEmail && createdAt && (
                  <div className="border-t border-white/10 pt-1.5 text-[10px] text-gray-300">
                    by {userEmail.split("@")[0]} · {new Date(createdAt).toLocaleDateString()}
                  </div>
                )}
              </div>
              <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
            </div>
          </div>
        )}
      </div>

      {/* Reason indicator/edit button */}
      {decision && decision !== "cancel" && decision !== "add" && onReasonChange && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowReasonPopup(true);
          }}
          className={`group/reason relative flex h-6 items-center justify-center rounded border transition-all ${
            hasReason
              ? `w-6 ${colors.bg} ${colors.border} ${colors.text} ${colors.hover}`
              : "w-6 border-dashed border-gray-300 bg-white text-gray-400 hover:border-gray-400 hover:bg-gray-50"
          }`}
          title={hasReason ? "Edit reason" : "Add reason"}
        >
          {hasReason ? (
            reason ? (
              renderReasonIcon(reason, "h-3.5 w-3.5")
            ) : (
              <MessageCircle className="h-3.5 w-3.5" />
            )
          ) : (
            <Pencil className="h-3 w-3" />
          )}
        </button>
      )}

      {isOpen && !disabled && (
        <div className="absolute top-full left-0 z-50 mt-1 w-[5.25rem] rounded border border-gray-200 bg-white py-0.5 shadow-lg">
          {options.map((opt) => {
            const optColors =
              opt.value && opt.value in DECISION_COLORS
                ? DECISION_COLORS[opt.value as keyof typeof DECISION_COLORS]
                : DECISION_COLORS.default;
            // "—" option is selected when decision is null, undefined, or "cancel"
            const isSelected =
              decision === opt.value ||
              ((!decision || decision === "cancel") && opt.value === "");
            return (
              <button
                key={opt.value || "empty"}
                onClick={() => handleSelect(opt.value)}
                className={`flex w-full items-center px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  isSelected
                    ? `${optColors.bg} ${optColors.text}`
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Reason popup - appears after making a decision */}
      {decision &&
        decision !== "cancel" &&
        decision !== "add" &&
        onReasonChange && (
          <ReasonPopup
            decision={decision as DecisionType}
            reason={reason ?? null}
            otherReason={otherReason ?? null}
            onChange={handleReasonChange}
            onClose={() => setShowReasonPopup(false)}
            isOpen={showReasonPopup}
            symbol={symbol}
          />
        )}
    </div>
  );
}
