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
  onCancel: () => void;
  initialSymbol?: string;
  submitLabel?: string;
  formTitle?: string;
  compact?: boolean;
}

export function ManualDocumentForm({
  onSubmit,
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

  useEffect(() => {
    fetch("/api/documents/bodies")
      .then((r) => r.json())
      .then(setBodySuggestions)
      .catch(() => {});
  }, []);

  const isFormValid =
    manualData.symbol.trim() &&
    manualData.title.trim() &&
    manualData.body.trim() &&
    manualData.year.trim() &&
    manualData.link.trim() &&
    /^\d{4}$/.test(manualData.year) &&
    parseInt(manualData.year) >= 1945 &&
    parseInt(manualData.year) <= 2100 &&
    /^https?:\/\/.+/.test(manualData.link);

  const handleSubmit = () => {
    if (!isFormValid) return;
    onSubmit(manualData);
  };

  const filteredBodies = bodySuggestions
    .filter((b) => b.toLowerCase().includes(manualData.body.toLowerCase()))
    .slice(0, 8);

  return (
    <div
      className={`rounded-lg border border-gray-200 bg-white p-4 shadow-sm ${compact ? "p-3" : ""}`}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">{formTitle}</span>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs text-gray-500">
            Symbol <span className="text-red-400">*</span>
            <Tooltip content="UN document symbol (e.g., A/RES/78/123 for General Assembly resolutions)">
              <span className="ml-1 cursor-help text-gray-400">ⓘ</span>
            </Tooltip>
          </label>
          <input
            type="text"
            value={manualData.symbol}
            onChange={(e) =>
              setManualData((d) => ({ ...d, symbol: e.target.value }))
            }
            className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm focus:border-un-blue focus:outline-none"
            placeholder="e.g. A/RES/78/123"
          />
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
            onChange={(e) =>
              setManualData((d) => ({ ...d, body: e.target.value }))
            }
            onFocus={() => setShowBodySuggestions(true)}
            onBlur={() => setTimeout(() => setShowBodySuggestions(false), 150)}
            className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm focus:border-un-blue focus:outline-none"
            placeholder="e.g. General Assembly"
          />
          {showBodySuggestions && filteredBodies.length > 0 && (
            <div className="absolute top-full right-0 left-0 z-10 mt-1 max-h-40 overflow-y-auto rounded border border-gray-200 bg-white shadow-lg">
              {filteredBodies.map((b) => (
                <button
                  key={b}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setManualData((d) => ({ ...d, body: b }));
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
            Link <span className="text-red-400">*</span>
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
