"use client";

import { useState, useEffect } from "react";
import { X, Info, ArrowLeftFromLine } from "lucide-react";
import { Tooltip } from "./Tooltip";

export interface ManualEntryData {
  symbol: string;
  title: string;
  body: string;
  year: string;
  link: string;
}

interface Props {
  onSubmit: (data: ManualEntryData) => void;
  onSelect?: (symbol: string) => void;
  onCancel: () => void;
  initialSymbol?: string;
  submitLabel?: string;
  formTitle?: string;
  compact?: boolean;
  originalTitle?: string;
  originalSymbol?: string;
}

export function ManualDocumentForm({
  onSubmit,
  onSelect,
  onCancel,
  initialSymbol = "",
  submitLabel = "Add",
  formTitle = "Add document manually",
  compact = false,
  originalTitle,
  originalSymbol,
}: Props) {
  const [manualData, setManualData] = useState<ManualEntryData>({
    symbol: initialSymbol,
    title: "",
    body: "",
    year: "",
    link: "",
  });
  const [bodySuggestions, setBodySuggestions] = useState<string[]>([]);
  const [showBodySuggestions, setShowBodySuggestions] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [otherBody, setOtherBody] = useState("");
  const [symbolExists, setSymbolExists] = useState(false);
  const [checkingSymbol, setCheckingSymbol] = useState(false);
  const [overrideDuplicate, setOverrideDuplicate] = useState(false);
  const [existingDoc, setExistingDoc] = useState<{
    symbol: string;
    title: string;
    body: string;
    year: number;
  } | null>(null);

  useEffect(() => {
    fetch("/api/documents/bodies")
      .then((r) => r.json())
      .then(setBodySuggestions)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!manualData.symbol.trim()) {
      // Defer state updates to next tick to avoid synchronous setState in effect
      const clearTimer = setTimeout(() => {
        setSymbolExists(false);
        setOverrideDuplicate(false);
        setExistingDoc(null);
      }, 0);
      return () => clearTimeout(clearTimer);
    }

    const timer = setTimeout(() => {
      setCheckingSymbol(true);
      fetch(`/api/documents/search?q=${encodeURIComponent(manualData.symbol)}`)
        .then((r) => r.json())
        .then((results) => {
          const exactMatch = results.find(
            (doc: { symbol: string }) => doc.symbol === manualData.symbol,
          );
          if (exactMatch) {
            setSymbolExists(true);
            setExistingDoc(exactMatch);
          } else {
            setSymbolExists(false);
            setExistingDoc(null);
          }
        })
        .catch(() => {
          setSymbolExists(false);
          setExistingDoc(null);
        })
        .finally(() => setCheckingSymbol(false));
    }, 500);

    return () => clearTimeout(timer);
  }, [manualData.symbol]);

  const isFormValid =
    manualData.symbol.trim() &&
    manualData.title.trim() &&
    manualData.body.trim() &&
    (manualData.body !== "Other" || otherBody.trim()) &&
    manualData.year.trim() &&
    manualData.link.trim() &&
    /^\d{4}$/.test(manualData.year) &&
    parseInt(manualData.year) >= 1945 &&
    parseInt(manualData.year) <= 2026 &&
    /^https?:\/\/.+/.test(manualData.link) &&
    (!symbolExists || overrideDuplicate);

  const handleSubmit = () => {
    if (!isFormValid) return;
    const submissionData = {
      ...manualData,
      body: manualData.body === "Other" ? otherBody : manualData.body,
    };
    onSubmit(submissionData);
  };

  const allBodyOptions = [...bodySuggestions, "Other"];

  return (
    <div
      className={`rounded-lg border border-gray-200 bg-white shadow-sm ${compact ? "p-3" : "p-6"}`}
    >
      <div className="mb-4 border-b border-gray-100 pb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-base font-medium text-gray-900">{formTitle}</h3>
            <p className="mt-1.5 text-sm text-gray-500">
              Use this form to add a mandate document that is not in our
              database yet or that has missing or incorrect metadata.
            </p>
          </div>
          <button
            onClick={onCancel}
            className="shrink-0 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-700">
            Official Document Symbol <span className="text-red-500">*</span>
            <Tooltip content="Official UN document symbol of the document. Please make sure this is 100% accurate and unique.">
              <Info className="ml-1 inline h-3.5 w-3.5 cursor-help text-gray-400" />
            </Tooltip>
          </label>
          <div className="relative">
            <input
              type="text"
              value={manualData.symbol}
              onChange={(e) => {
                setManualData((d) => ({ ...d, symbol: e.target.value }));
                setOverrideDuplicate(false);
              }}
              className={`w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:ring-2 focus:ring-un-blue/20 focus:outline-none ${
                symbolExists && !overrideDuplicate
                  ? "border-un-blue bg-un-blue/5"
                  : "border-gray-200 bg-white hover:border-gray-300"
              } ${originalSymbol ? "pr-40" : ""}`}
            />
            {originalSymbol && (
              <button
                type="button"
                onClick={() =>
                  setManualData((d) => ({ ...d, symbol: originalSymbol }))
                }
                className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-600 transition-colors hover:bg-gray-200 hover:text-gray-900"
                title="Use symbol from document being replaced"
              >
                <ArrowLeftFromLine className="h-3 w-3" />
                Copy symbol from above
              </button>
            )}
          </div>
          {checkingSymbol && (
            <p className="mt-1 text-xs text-gray-400">Checking symbol...</p>
          )}
          {symbolExists && !overrideDuplicate && existingDoc && onSelect && (
            <div className="mt-2 rounded-lg border border-un-blue/30 bg-un-blue/5 p-3">
              <div className="mb-2">
                <div className="mb-1 text-xs font-medium text-un-blue">
                  {existingDoc.symbol}
                </div>
                <div className="text-sm text-gray-700">{existingDoc.title}</div>
                <div className="mt-1 text-xs text-gray-500">
                  {[existingDoc.body, existingDoc.year]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onSelect(existingDoc.symbol)}
                className="rounded bg-un-blue px-3 py-1.5 text-sm text-white hover:bg-un-blue/90"
              >
                Add this document
              </button>
            </div>
          )}
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-700">
            Title <span className="text-red-500">*</span>
            <Tooltip content="Full official title of the document">
              <Info className="ml-1 inline h-3.5 w-3.5 cursor-help text-gray-400" />
            </Tooltip>
          </label>
          <div className="relative">
            <input
              type="text"
              value={manualData.title}
              onChange={(e) =>
                setManualData((d) => ({ ...d, title: e.target.value }))
              }
              className={`w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm transition-colors hover:border-gray-300 focus:ring-2 focus:ring-un-blue/20 focus:outline-none ${
                originalTitle ? "pr-40" : ""
              }`}
            />
            {originalTitle && (
              <button
                type="button"
                onClick={() =>
                  setManualData((d) => ({ ...d, title: originalTitle }))
                }
                className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-600 transition-colors hover:bg-gray-200 hover:text-gray-900"
                title="Use title from document being replaced"
              >
                <ArrowLeftFromLine className="h-3 w-3" />
                Copy title from above
              </button>
            )}
          </div>
        </div>
        <div className="relative">
          <label className="mb-1.5 block text-xs font-medium text-gray-700">
            Issuing Body <span className="text-red-500">*</span>
            <Tooltip content="The UN body that issued this document (e.g., General Assembly, Security Council, Economic and Social Council)">
              <Info className="ml-1 inline h-3.5 w-3.5 cursor-help text-gray-400" />
            </Tooltip>
          </label>
          <input
            type="text"
            value={manualData.body}
            onChange={(e) => {
              const value = e.target.value;
              setManualData((d) => ({ ...d, body: value }));
              // Clear otherBody if user is typing and changes from "Other"
              if (manualData.body === "Other" && value !== "Other") {
                setOtherBody("");
              }
            }}
            onFocus={() => setShowBodySuggestions(true)}
            onBlur={() => setTimeout(() => setShowBodySuggestions(false), 150)}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm transition-colors hover:border-gray-300 focus:ring-2 focus:ring-un-blue/20 focus:outline-none"
          />
          {showBodySuggestions && allBodyOptions.length > 0 && (
            <div className="absolute top-full right-0 left-0 z-10 mt-1 max-h-40 overflow-y-auto rounded border border-gray-200 bg-white shadow-lg">
              {allBodyOptions.map((b) => (
                <button
                  key={b}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    if (b === "Other") {
                      setManualData((d) => ({ ...d, body: "Other" }));
                    } else {
                      setManualData((d) => ({ ...d, body: b }));
                    }
                    setShowBodySuggestions(false);
                  }}
                  className="w-full px-2 py-1.5 text-left text-sm hover:bg-gray-50"
                >
                  {b}
                </button>
              ))}
            </div>
          )}
        </div>
        {manualData.body === "Other" && (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-700">
              Specify Issuing Body <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={otherBody}
              onChange={(e) => setOtherBody(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm transition-colors hover:border-gray-300 focus:ring-2 focus:ring-un-blue/20 focus:outline-none"
              placeholder="Enter the name of the issuing body"
            />
          </div>
        )}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-700">
            Year <span className="text-red-500">*</span>
            <Tooltip content="Year the document was published (1945-2026)">
              <Info className="ml-1 inline h-3.5 w-3.5 cursor-help text-gray-400" />
            </Tooltip>
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={manualData.year}
            onChange={(e) =>
              setManualData((d) => ({ ...d, year: e.target.value }))
            }
            className={`w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:ring-2 focus:outline-none ${
              manualData.year &&
              (!/^\d{4}$/.test(manualData.year) ||
                parseInt(manualData.year) < 1945 ||
                parseInt(manualData.year) > 2026)
                ? "border-red-300 bg-red-50/50 focus:ring-red-500/20"
                : "border-gray-200 bg-white hover:border-gray-300 focus:ring-un-blue/20"
            }`}
          />
          {manualData.year &&
            (!/^\d{4}$/.test(manualData.year) ||
              parseInt(manualData.year) < 1945 ||
              parseInt(manualData.year) > 2026) && (
              <p className="mt-1 text-xs text-red-500">
                Year must be between 1945-2026
              </p>
            )}
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-700">
            Fulltext Link <span className="text-red-500">*</span>
            <Tooltip content="Direct URL to the official document on ODS, UN Digital Library, or other offical document repository.">
              <Info className="ml-1 inline h-3.5 w-3.5 cursor-help text-gray-400" />
            </Tooltip>
          </label>
          <input
            type="url"
            value={manualData.link}
            onChange={(e) => {
              setManualData((d) => ({ ...d, link: e.target.value }));
              setLinkError("");
            }}
            className={`w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:ring-2 focus:outline-none ${
              linkError ||
              (manualData.link && !/^https?:\/\/.+/.test(manualData.link))
                ? "border-red-300 bg-red-50/50 focus:ring-red-500/20"
                : "border-gray-200 bg-white hover:border-gray-300 focus:ring-un-blue/20"
            }`}
            placeholder="https://..."
          />
          {(linkError ||
            (manualData.link && !/^https?:\/\/.+/.test(manualData.link))) && (
            <p className="mt-1 text-xs text-red-500">
              {linkError || "Link must start with http:// or https://"}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
          <button
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isFormValid}
            className="rounded-lg bg-un-blue px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-un-blue/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
