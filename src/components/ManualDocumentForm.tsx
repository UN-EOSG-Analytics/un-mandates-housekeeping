"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
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
}

export function ManualDocumentForm({
  onSubmit,
  onSelect,
  onCancel,
  initialSymbol = "",
  submitLabel = "Add",
  formTitle = "Add document manually",
  compact = false,
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
            (doc: { symbol: string }) => doc.symbol === manualData.symbol
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
    parseInt(manualData.year) <= 2100 &&
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
      className={`rounded-lg border border-gray-200 bg-white p-4 shadow-sm ${compact ? "p-3" : ""}`}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">{formTitle}</span>
        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs text-gray-500">
            Symbol <span className="text-red-400">*</span>
            <Tooltip content="Official UN document symbol">
              <span className="ml-1 cursor-help text-gray-400">ⓘ</span>
            </Tooltip>
          </label>
          <input
            type="text"
            value={manualData.symbol}
            onChange={(e) => {
              setManualData((d) => ({ ...d, symbol: e.target.value }));
              setOverrideDuplicate(false);
            }}
            className={`w-full rounded border px-2 py-1.5 text-sm focus:outline-none ${
              symbolExists && !overrideDuplicate
                ? "border-un-blue focus:border-un-blue"
                : "border-gray-200 focus:border-un-blue"
            }`}
            placeholder="e.g. A/RES/79/1"
          />
          {checkingSymbol && (
            <p className="mt-1 text-xs text-gray-400">Checking symbol...</p>
          )}
          {symbolExists && !overrideDuplicate && existingDoc && onSelect && (
            <div className="mt-2 rounded-lg border border-un-blue/30 bg-un-blue/5 p-3">
              <div className="mb-2">
                <div className="mb-1 text-xs font-medium text-un-blue">
                  {existingDoc.symbol}
                </div>
                <div className="text-sm text-gray-700">
                  {existingDoc.title}
                </div>
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
          <label className="mb-1 block text-xs text-gray-500">
            Title <span className="text-red-400">*</span>
            <Tooltip content="Full official title of the document">
              <span className="ml-1 cursor-help text-gray-400">ⓘ</span>
            </Tooltip>
          </label>
          <input
            type="text"
            value={manualData.title}
            onChange={(e) =>
              setManualData((d) => ({ ...d, title: e.target.value }))
            }
            className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm focus:border-un-blue focus:outline-none"
            placeholder="Document title"
          />
        </div>
        <div className="relative">
          <label className="mb-1 block text-xs text-gray-500">
            Issuing body <span className="text-red-400">*</span>
            <Tooltip content="The UN body that issued this document (e.g., General Assembly, Security Council, Economic and Social Council)">
              <span className="ml-1 cursor-help text-gray-400">ⓘ</span>
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
            className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm focus:border-un-blue focus:outline-none"
            placeholder="e.g. General Assembly"
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
            <label className="mb-1 block text-xs text-gray-500">
              Specify issuing body <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={otherBody}
              onChange={(e) => setOtherBody(e.target.value)}
              className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm focus:border-un-blue focus:outline-none"
              placeholder="Enter the name of the issuing body"
            />
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs text-gray-500">
            Year <span className="text-red-400">*</span>
            <Tooltip content="Year the document was published (1945-2100)">
              <span className="ml-1 cursor-help text-gray-400">ⓘ</span>
            </Tooltip>
          </label>
          <input
            type="number"
            value={manualData.year}
            onChange={(e) =>
              setManualData((d) => ({ ...d, year: e.target.value }))
            }
            className={`w-full rounded border px-2 py-1.5 text-sm focus:outline-none ${
              manualData.year &&
              (!/^\d{4}$/.test(manualData.year) ||
                parseInt(manualData.year) < 1945 ||
                parseInt(manualData.year) > 2100)
                ? "border-red-300 focus:border-red-400"
                : "border-gray-200 focus:border-un-blue"
            }`}
            placeholder="e.g. 2024"
            min="1945"
            max="2100"
          />
          {manualData.year &&
            (!/^\d{4}$/.test(manualData.year) ||
              parseInt(manualData.year) < 1945 ||
              parseInt(manualData.year) > 2100) && (
              <p className="mt-1 text-xs text-red-500">
                Year must be 4 digits between 1945-2100
              </p>
            )}
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">
            Fulltext Link <span className="text-red-400">*</span>
            <Tooltip content="URL to the official document on digitallibrary.un.org or undocs.org">
              <span className="ml-1 cursor-help text-gray-400">ⓘ</span>
            </Tooltip>
          </label>
          <input
            type="url"
            value={manualData.link}
            onChange={(e) => {
              setManualData((d) => ({ ...d, link: e.target.value }));
              setLinkError("");
            }}
            className={`w-full rounded border px-2 py-1.5 text-sm focus:outline-none ${
              linkError ||
              (manualData.link && !/^https?:\/\/.+/.test(manualData.link))
                ? "border-red-300 focus:border-red-400"
                : "border-gray-200 focus:border-un-blue"
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
        <p className="text-xs text-gray-400">All fields are required</p>
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isFormValid}
            className="rounded bg-un-blue px-3 py-1.5 text-sm text-white hover:bg-un-blue/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
