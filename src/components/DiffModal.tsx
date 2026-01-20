"use client";

import { X, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { computeDocumentDiffAction } from "@/lib/services/housekeeping-actions";
import { DiffViewer } from "undifferent/react";
import type { DiffResult } from "undifferent/core";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  originalSymbol: string;
  originalYear: number;
  originalTitle?: string;
  compareSymbol: string;
  compareYear: number;
  compareTitle?: string;
}

export function DiffModal({
  isOpen,
  onClose,
  originalSymbol,
  originalYear,
  originalTitle,
  compareSymbol,
  compareYear,
  compareTitle,
}: Props) {
  const [state, setState] = useState<{
    loading: boolean;
    error: string | null;
    diffResult: DiffResult | null;
  }>({ loading: true, error: null, diffResult: null });

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    computeDocumentDiffAction(originalSymbol, compareSymbol)
      .then((result) => {
        if (cancelled) return;
        if (!result.success) {
          setState({ loading: false, error: result.error, diffResult: null });
        } else {
          setState({ loading: false, error: null, diffResult: result.data ?? null });
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.error(err);
        setState({ loading: false, error: "Failed to compute diff", diffResult: null });
      });

    return () => {
      cancelled = true;
      // Reset state for next open
      setState({ loading: true, error: null, diffResult: null });
    };
  }, [isOpen, originalSymbol, compareSymbol]);

  const { loading, error, diffResult } = state;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-5xl flex-col rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="min-w-0 flex-1 pr-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Compare Document Versions
            </h2>
            <p className="mt-1 truncate text-sm text-gray-500">
              {originalSymbol} ({originalYear}) → {compareSymbol} ({compareYear})
            </p>
            {(originalTitle || compareTitle) && (
              <p className="truncate text-xs text-gray-400">
                {originalTitle || compareTitle}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto rounded-b-xl">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
            </div>
          ) : error ? (
            <div className="py-20 text-center">
              <p className="text-sm text-red-500">{error}</p>
              <p className="mt-2 text-xs text-gray-400">
                Document content may not be available from UN ODS.
              </p>
            </div>
          ) : diffResult ? (
            <div
              className="p-6"
              style={
                {
                  "--diff-item-bg": "#ffffff",
                  "--diff-added-bg": "#dcfce7",
                  "--diff-removed-bg": "#fee2e2",
                  "--diff-moved-bg": "#fefce8",
                  "--diff-aligned-bg": "#eff6ff",
                  "--diff-score-color": "#009edb",
                } as React.CSSProperties
              }
            >
              <DiffViewer
                data={diffResult}
                left={{ symbol: originalSymbol }}
                right={{ symbol: compareSymbol }}
              />
            </div>
          ) : (
            <div className="py-20 text-center">
              <p className="text-sm text-gray-500">No content to compare</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
