"use client";

import { useRef, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { MandateWarning } from "@/lib/services/mandate-warnings";
import { getWarningIcon } from "@/lib/services/mandate-warnings";
import { ArrowLeftRight } from "lucide-react";
import { WarningIcon } from "./WarningIcon";

interface WarningTooltipProps {
  warnings: MandateWarning[];
  children: React.ReactNode;
  onAction?: (warning: MandateWarning) => void;
  onPrimaryClick?: () => void;
  disabled?: boolean;
  /** Current document symbol for diff comparison */
  currentSymbol?: string;
  /** Current document year for diff comparison */
  currentYear?: number;
  /** Callback when diff is requested */
  onDiff?: (
    originalSymbol: string,
    originalYear: number,
    compareSymbol: string,
    compareYear: number,
  ) => void;
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

const colorSchemeStyles = {
  red: "bg-red-100 text-red-600",
  amber: "bg-amber-100 text-amber-600",
  blue: "bg-un-blue/10 text-un-blue",
};

export function WarningTooltip({
  warnings,
  children,
  onAction,
  onPrimaryClick,
  disabled,
  currentSymbol,
  currentYear,
  onDiff,
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
        className={`w-80 overflow-hidden p-0 ${disabled ? "grayscale" : ""}`}
        side="left"
        sideOffset={8}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-gray-200 bg-gray-50 px-3 py-2">
          <h4 className="text-xs font-medium tracking-wide text-gray-500 uppercase">
            {warnings.length === 1
              ? "Suggestion"
              : `${warnings.length} Suggestions`}
          </h4>
        </div>
        <div className="max-h-64 divide-y divide-gray-100 overflow-y-auto">
          {warnings.map((warning, index) => {
            const styles = severityStyles[warning.severity];
            const iconStyle = warning.colorScheme
              ? colorSchemeStyles[warning.colorScheme]
              : styles.icon;
            return (
              <div
                key={warning.id || index}
                className="px-3 py-2.5 transition-colors hover:bg-gray-50/50"
              >
                <div className="flex gap-2.5">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${iconStyle}`}
                  >
                    <WarningIcon
                      icon={warning.icon || getWarningIcon(warning.severity)}
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-relaxed text-gray-700">
                      {warning.message}
                      {warning.linkedYear && (
                        <>
                          {" "}
                          <span className="font-semibold">
                            {warning.linkedYear}
                          </span>
                        </>
                      )}
                      {warning.messageSuffix ? (
                        <> {warning.messageSuffix}</>
                      ) : warning.linkedSymbol ? (
                        ":"
                      ) : null}
                      {warning.linkedSymbol && (
                        <>
                          {" "}
                          <a
                            href={`https://docs.un.org/en/${warning.linkedSymbol}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-un-blue hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {warning.linkedSymbol}
                          </a>
                        </>
                      )}
                      {onDiff &&
                        currentSymbol &&
                        currentYear &&
                        warning.linkedSymbol &&
                        warning.linkedYear && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDiff(
                                currentSymbol,
                                currentYear,
                                warning.linkedSymbol!,
                                warning.linkedYear!,
                              );
                              setOpen(false);
                            }}
                            className="ml-2 inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-un-blue transition-colors hover:bg-blue-100"
                          >
                            <ArrowLeftRight className="h-3 w-3" />
                            Compare
                          </button>
                        )}
                    </p>
                    {warning.action && onAction && !disabled && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAction(warning);
                          setOpen(false);
                        }}
                        className={`mt-2 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                          warning.action === "remove"
                            ? "bg-red-100 text-red-700 hover:bg-red-200"
                            : "bg-amber-100 text-amber-700 hover:bg-amber-200"
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
