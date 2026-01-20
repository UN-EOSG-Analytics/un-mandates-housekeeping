"use client";

import * as React from "react";
import type { Decision } from "@/types";
import { Tooltip } from "./Tooltip";
import { ChevronDown, MessageSquare } from "lucide-react";
import { ReasonPopup, getReasonDisplayLabel } from "./ReasonDropdown";
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
}: DecisionDropdownProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [showReasonPopup, setShowReasonPopup] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Get reason display label for tooltip
  const reasonLabel = decision && decision !== "cancel" && decision !== "add"
    ? getReasonDisplayLabel(decision as DecisionType, reason ?? null, otherReason ?? null)
    : null;

  // Build tooltip content
  const tooltipParts: string[] = [];
  if (reasonLabel) {
    tooltipParts.push(reasonLabel);
  }
  if (userEmail && createdAt) {
    tooltipParts.push(`Set by ${userEmail} at ${new Date(createdAt).toLocaleDateString()}`);
  }
  const tooltipContent = tooltipParts.length > 0 ? tooltipParts.join("\n\n") : null;

  const colors = decision && decision in DECISION_COLORS 
    ? DECISION_COLORS[decision as keyof typeof DECISION_COLORS] 
    : DECISION_COLORS.default;
  const sizeClasses = size === "sm" ? "h-6 text-[11px]" : "h-6 text-[11px]";

  // Close dropdown when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
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
      // Clear reason when canceling
      if (onReasonChange) {
        onReasonChange(null, null);
      }
      return;
    }

    onChange(value);

    if (value === "update" && onUpdateClick) {
      onUpdateClick();
    }

    // Show reason popup after selecting a decision (except for cancel/add)
    if (value && value !== "cancel" && value !== "add" && onReasonChange) {
      setShowReasonPopup(true);
    }
  };

  const handleReasonChange = (newReason: string | null, newOtherReason: string | null) => {
    if (onReasonChange) {
      onReasonChange(newReason, newOtherReason);
    }
  };

  const displayLabel = decision 
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

  const button = (
    <button
      onClick={() => !disabled && setIsOpen(!isOpen)}
      disabled={disabled}
      className={`flex w-full items-center justify-between gap-1 rounded border px-2 font-medium transition-colors ${sizeClasses} ${colors.bg} ${colors.border} ${colors.text} ${
        disabled ? "cursor-default opacity-60" : `cursor-pointer ${colors.hover}`
      } ${className || ""}`}
      style={{ minWidth: "5rem" }}
    >
      <span className="flex items-center gap-1">
        {displayLabel}
        {hasReason && <MessageSquare className="h-2.5 w-2.5 opacity-60" />}
      </span>
      {!disabled && <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />}
    </button>
  );

  return (
    <div ref={containerRef} className="relative">
      {tooltipContent ? (
        <Tooltip content={tooltipContent}>{button}</Tooltip>
      ) : (
        button
      )}

      {isOpen && !disabled && (
        <div className="absolute top-full left-0 z-50 mt-1 min-w-[5rem] rounded border border-gray-200 bg-white py-0.5 shadow-lg">
          {options.map((opt) => {
            const optColors = opt.value && opt.value in DECISION_COLORS 
              ? DECISION_COLORS[opt.value as keyof typeof DECISION_COLORS] 
              : DECISION_COLORS.default;
            const isSelected = decision === opt.value || (!decision && opt.value === "");
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
      {decision && decision !== "cancel" && decision !== "add" && onReasonChange && (
        <ReasonPopup
          decision={decision as DecisionType}
          reason={reason ?? null}
          otherReason={otherReason ?? null}
          onChange={handleReasonChange}
          onClose={() => setShowReasonPopup(false)}
          isOpen={showReasonPopup}
        />
      )}
    </div>
  );
}
