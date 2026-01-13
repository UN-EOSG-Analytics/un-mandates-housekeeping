"use client";

import * as React from "react";
import type { Decision } from "@/types";
import { Tooltip } from "./Tooltip";

interface DecisionDropdownProps {
  decision: Decision | null;
  onChange: (decision: Decision, newSymbol?: string) => void;
  onUpdateClick?: () => void;
  disabled?: boolean;
  userEmail?: string | null;
  createdAt?: string | null;
  className?: string;
  size?: "sm" | "md";
}

/**
 * Shared decision dropdown component used across the app.
 * Supports "retain", "remove", "update", and canceling back to "—".
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
}: DecisionDropdownProps) {
  const tooltipContent =
    userEmail && createdAt
      ? `Set by ${userEmail} at ${new Date(createdAt).toLocaleDateString()}`
      : null;

  const sizeClasses = size === "sm" ? "h-6 w-full text-xs" : "h-7 w-20 text-xs";

  const select = (
    <select
      value={decision || ""}
      onChange={(e) => {
        const v = e.target.value as Decision | "";

        // Handle empty value (—) as "cancel" to reset decision
        if (!v) {
          onChange("cancel");
          return;
        }

        // Always update the decision state first
        onChange(v);
        
        // Then trigger the search UI for update
        if (v === "update" && onUpdateClick) {
          onUpdateClick();
        }
      }}
      disabled={disabled}
      className={`rounded border px-1 transition-colors ${sizeClasses} ${
        decision === "retain"
          ? "border-green-200 bg-green-50 text-green-700"
          : decision === "remove"
            ? "border-red-200 bg-red-50 text-red-700"
            : decision === "update"
              ? "border-amber-200 bg-amber-50 text-amber-700"
              : decision === "add"
                ? "border-blue-200 bg-blue-50 text-blue-700"
                : "border-gray-200 bg-white text-gray-500"
      } ${disabled ? "cursor-default opacity-60" : "cursor-pointer hover:border-gray-300"} ${className || ""}`}
    >
      <option value="">—</option>
      <option value="retain">Retain</option>
      <option value="remove">Remove</option>
      <option value="update">Update</option>
    </select>
  );

  return tooltipContent ? (
    <Tooltip content={tooltipContent}>{select}</Tooltip>
  ) : (
    select
  );
}
