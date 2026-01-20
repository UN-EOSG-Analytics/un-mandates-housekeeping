"use client";

import * as React from "react";
import {
  getReasonsForDecision,
  getReasonLabel,
  type DecisionType,
} from "@/lib/services/decision-reasons";
import { DECISION_COLORS } from "./DecisionDropdown";
import { X } from "lucide-react";

interface ReasonPopupProps {
  decision: DecisionType;
  reason: string | null;
  otherReason: string | null;
  onChange: (reason: string | null, otherReason: string | null) => void;
  onClose: () => void;
  isOpen: boolean;
}

/**
 * Popup for selecting a reason after a decision has been made.
 * Appears as a floating panel when triggered.
 */
export function ReasonPopup({
  decision,
  reason,
  otherReason,
  onChange,
  onClose,
  isOpen,
}: ReasonPopupProps) {
  const [localOtherReason, setLocalOtherReason] = React.useState(otherReason ?? "");
  const containerRef = React.useRef<HTMLDivElement>(null);

  const reasons = getReasonsForDecision(decision);
  const colors = DECISION_COLORS[decision];

  // Close popup when clicking outside
  React.useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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

  if (!isOpen) return null;

  const decisionLabel = decision.charAt(0).toUpperCase() + decision.slice(1);

  return (
    <div 
      ref={containerRef}
      className="absolute top-0 right-full z-50 mr-2 w-96 rounded-lg border border-gray-200 bg-white shadow-xl"
    >
      {/* Header */}
      <div className={`flex items-center justify-between rounded-t-lg px-3 py-2 ${colors.bg} ${colors.border} border-b`}>
        <span className={`text-xs font-medium ${colors.text}`}>
          Why {decisionLabel.toLowerCase()}?
        </span>
        <button
          onClick={onClose}
          className={`rounded p-0.5 transition-colors hover:bg-white/50 ${colors.text}`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Options */}
      <div className="max-h-64 overflow-y-auto py-1">
        {reasons.map((r) => (
          <button
            key={r.id}
            onClick={() => handleReasonSelect(r.id)}
            className={`w-full px-3 py-2.5 text-left text-xs leading-relaxed transition-colors ${
              reason === r.id 
                ? `${colors.bg} ${colors.text} font-medium` 
                : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Other reason freetext input */}
      {reason === "other" && (
        <div className="border-t border-gray-100 p-3">
          <textarea
            value={localOtherReason}
            onChange={(e) => handleOtherReasonChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleOtherSubmit()}
            placeholder="Please specify the reason..."
            className="w-full resize-none rounded border border-gray-200 px-2.5 py-2 text-xs text-gray-700 placeholder:text-gray-400 focus:border-gray-300 focus:outline-none"
            rows={2}
            autoFocus
          />
          <div className="mt-2 flex justify-end">
            <button
              onClick={handleOtherSubmit}
              className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${colors.bg} ${colors.text} ${colors.hover}`}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
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
