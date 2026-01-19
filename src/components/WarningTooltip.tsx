"use client";

import { useRef, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { MandateWarning } from "@/lib/services/mandate-warnings";

interface WarningTooltipProps {
  warnings: MandateWarning[];
  children: React.ReactNode;
  onAction?: (warning: MandateWarning) => void;
  onPrimaryClick?: () => void;
  disabled?: boolean;
}

const severityStyles = {
  error: {
    icon: "bg-red-100 text-red-600",
    border: "border-red-200",
    text: "text-red-800",
  },
  warning: {
    icon: "bg-amber-100 text-amber-600",
    border: "border-amber-200",
    text: "text-amber-800",
  },
  info: {
    icon: "bg-un-blue/10 text-un-blue",
    border: "border-un-blue/20",
    text: "text-gray-700",
  },
};

export function WarningTooltip({
  warnings,
  children,
  onAction,
  onPrimaryClick,
  disabled,
}: WarningTooltipProps) {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  if (warnings.length === 0) return <>{children}</>;

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setOpen(false), 150);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (onPrimaryClick && !disabled) {
      e.preventDefault();
      e.stopPropagation();
      onPrimaryClick();
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        asChild
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {children}
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0 overflow-hidden"
        align="start"
        sideOffset={8}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gray-50 border-b border-gray-200 px-3 py-2">
          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            {warnings.length === 1
              ? "Suggestion"
              : `${warnings.length} Suggestions`}
          </h4>
        </div>
        <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
          {warnings.map((warning, index) => {
            const styles = severityStyles[warning.severity];
            return (
              <div
                key={warning.id || index}
                className="px-3 py-2.5 hover:bg-gray-50/50 transition-colors"
              >
                <div className="flex gap-2.5">
                  <span
                    className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-sm ${styles.icon}`}
                  >
                    {warning.icon || "⚠"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {warning.message}
                      {warning.linkedSymbol && (
                        <>
                          {" "}
                          <a
                            href={`https://undocs.org/en/${warning.linkedSymbol}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-un-blue hover:underline font-medium"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {warning.linkedSymbol}
                          </a>
                        </>
                      )}
                    </p>
                    {warning.action && onAction && !disabled && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAction(warning);
                          setOpen(false);
                        }}
                        className={`mt-2 text-xs font-medium px-2.5 py-1 rounded-md transition-colors ${
                          warning.action === "remove"
                            ? "bg-red-100 text-red-700 hover:bg-red-200"
                            : "bg-un-blue/10 text-un-blue hover:bg-un-blue/20"
                        }`}
                      >
                        {warning.action === "remove"
                          ? "Consider removing"
                          : "Consider updating"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
