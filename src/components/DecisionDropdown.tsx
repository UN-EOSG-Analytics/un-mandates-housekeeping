"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import type { Decision } from "@/types";
import { ChevronDown, MessageCircle, Pencil } from "lucide-react";
import {
  ReasonPopup,
  getReasonDisplayLabel,
  renderReasonIcon,
  renderLabelWithBold,
} from "../features/mandates/ui/ReasonsModal";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { DecisionType } from "@/lib/services/mandates/decision-reasons";

interface DecisionDropdownProps {
  decision: Decision | null;
  onChange: (decision: Decision, newSymbol?: string) => void;
  onUpdateClick?: () => void;
  disabled?: boolean;
  locked?: boolean; // Prevents changing decision but keeps full styling (used for 'add' decisions)
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
function DropdownMenu({
  containerRef,
  menuRef,
  options,
  decision,
  onSelect,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  menuRef: React.RefObject<HTMLDivElement | null>;
  options: { value: Decision | ""; label: string }[];
  decision: Decision | null;
  onSelect: (value: Decision | "") => void;
}) {
  const [pos, setPos] = React.useState({ top: 0, left: 0 });

  React.useLayoutEffect(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
  }, [containerRef]);

  return (
    <div
      ref={menuRef}
      className="fixed z-9999 w-21 rounded border border-gray-200 bg-white py-0.5 shadow-lg"
      style={{ top: pos.top, left: pos.left }}
    >
      {options.map((opt) => {
        const optColors =
          opt.value && opt.value in DECISION_COLORS
            ? DECISION_COLORS[opt.value as keyof typeof DECISION_COLORS]
            : DECISION_COLORS.default;
        const isSelected =
          decision === opt.value ||
          ((!decision || decision === "cancel") && opt.value === "");
        return (
          <button
            key={opt.value || "empty"}
            onClick={() => onSelect(opt.value)}
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
  );
}

export const DECISION_COLORS = {
  retain: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-700",
    hover: "hover:border-blue-300",
    hoverBg: "hover:bg-blue-50/50",
  },
  remove: {
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-700",
    hover: "hover:border-red-300",
    hoverBg: "hover:bg-red-50/50",
  },
  update: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
    hover: "hover:border-amber-300",
    hoverBg: "hover:bg-amber-50/50",
  },
  add: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700",
    hover: "hover:border-emerald-300",
    hoverBg: "hover:bg-emerald-50/50",
  },
  default: {
    bg: "bg-white",
    border: "border-gray-200",
    text: "text-gray-500",
    hover: "hover:border-gray-300",
    hoverBg: "hover:bg-gray-50",
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
  locked,
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
  const [decisionTooltipOpen, setDecisionTooltipOpen] = React.useState(false);
  const [reasonTooltipOpen, setReasonTooltipOpen] = React.useState(false);
  const decisionTooltipTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const reasonTooltipTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);

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
    decision && decision !== "cancel"
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
      const target = event.target as Node;
      const isInsideContainer = containerRef.current?.contains(target);
      const isInsideMenu = menuRef.current?.contains(target);
      if (!isInsideContainer && !isInsideMenu) {
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

    // Show reason popup after selecting a decision (except for cancel)
    if (value && value !== "cancel" && onReasonChange) {
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

  // For "add" decisions, only show the cancel option
  const options: { value: Decision | ""; label: string }[] =
    decision === "add"
      ? [{ value: "", label: "—" }]
      : [
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
      {decision && decision !== "cancel" && userEmail && createdAt ? (
        <Popover
          open={decisionTooltipOpen}
          onOpenChange={setDecisionTooltipOpen}
        >
          <PopoverTrigger asChild>
            <button
              onClick={() => !disabled && !locked && setIsOpen(!isOpen)}
              onMouseEnter={() => {
                if (decisionTooltipTimeoutRef.current)
                  clearTimeout(decisionTooltipTimeoutRef.current);
                setDecisionTooltipOpen(true);
              }}
              onMouseLeave={() => {
                decisionTooltipTimeoutRef.current = setTimeout(
                  () => setDecisionTooltipOpen(false),
                  150,
                );
              }}
              disabled={disabled}
              className={`flex w-21 items-center justify-between gap-1 rounded border px-2 font-medium transition-colors ${sizeClasses} ${colors.bg} ${colors.border} ${colors.text} ${
                disabled
                  ? "cursor-default opacity-60"
                  : locked
                    ? "cursor-default"
                    : `cursor-pointer ${colors.hover}`
              } ${className || ""}`}
            >
              <span>{displayLabel}</span>
              {!disabled && !locked && (
                <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-auto overflow-hidden p-0"
            side="top"
            sideOffset={8}
            onMouseEnter={() => {
              if (decisionTooltipTimeoutRef.current)
                clearTimeout(decisionTooltipTimeoutRef.current);
              setDecisionTooltipOpen(true);
            }}
            onMouseLeave={() => {
              decisionTooltipTimeoutRef.current = setTimeout(
                () => setDecisionTooltipOpen(false),
                150,
              );
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-2">
              <p className="text-sm text-gray-700">
                <span className={`font-medium ${colors.text}`}>
                  {displayLabel}
                </span>{" "}
                by {userEmail} · {new Date(createdAt).toLocaleDateString()}
              </p>
            </div>
          </PopoverContent>
        </Popover>
      ) : (
        <button
          onClick={() => !disabled && !locked && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`flex w-21 items-center justify-between gap-1 rounded border px-2 font-medium transition-colors ${sizeClasses} ${colors.bg} ${colors.border} ${colors.text} ${
            disabled
              ? "cursor-default opacity-60"
              : locked
                ? "cursor-default"
                : `cursor-pointer ${colors.hover}`
          } ${className || ""}`}
        >
          <span>{displayLabel}</span>
          {!disabled && !locked && (
            <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
          )}
        </button>
      )}

      {/* Reason indicator/edit button with hover tooltip */}
      {decision && decision !== "cancel" && onReasonChange && (
        <Popover open={reasonTooltipOpen} onOpenChange={setReasonTooltipOpen}>
          <PopoverTrigger asChild>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowReasonPopup(true);
              }}
              onMouseEnter={() => {
                if (reasonTooltipTimeoutRef.current)
                  clearTimeout(reasonTooltipTimeoutRef.current);
                setReasonTooltipOpen(true);
              }}
              onMouseLeave={() => {
                reasonTooltipTimeoutRef.current = setTimeout(
                  () => setReasonTooltipOpen(false),
                  150,
                );
              }}
              className={`group/reason flex h-6 items-center justify-center rounded border transition-all ${
                hasReason
                  ? `w-6 ${colors.bg} ${colors.border} ${colors.text} ${colors.hover}`
                  : "w-6 border-dashed border-gray-300 bg-white text-gray-400 hover:border-gray-400 hover:bg-gray-50"
              }`}
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
          </PopoverTrigger>
          <PopoverContent
            className="w-80 overflow-hidden p-0"
            side="top"
            sideOffset={8}
            onMouseEnter={() => {
              if (reasonTooltipTimeoutRef.current)
                clearTimeout(reasonTooltipTimeoutRef.current);
              setReasonTooltipOpen(true);
            }}
            onMouseLeave={() => {
              reasonTooltipTimeoutRef.current = setTimeout(
                () => setReasonTooltipOpen(false),
                150,
              );
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-gray-200 bg-gray-50 px-3 py-2">
              <h4 className="text-xs font-medium tracking-wide text-gray-500 uppercase">
                Reason
              </h4>
            </div>
            <div className="px-3 py-2.5">
              <div className="flex gap-2.5">
                {reason && (
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${colors.bg} ${colors.text}`}
                  >
                    {renderReasonIcon(reason, "h-3.5 w-3.5")}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  {reasonLabel ? (
                    <p className="text-sm leading-relaxed text-gray-700">
                      {renderLabelWithBold(reasonLabel)}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-400 italic">
                      No reason provided
                    </p>
                  )}
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}

      {isOpen &&
        !disabled &&
        !locked &&
        typeof document !== "undefined" &&
        createPortal(
          <DropdownMenu
            containerRef={containerRef}
            menuRef={menuRef}
            options={options}
            decision={decision}
            onSelect={handleSelect}
          />,
          document.body,
        )}

      {/* Reason popup - appears after making a decision */}
      {decision && decision !== "cancel" && onReasonChange && (
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
