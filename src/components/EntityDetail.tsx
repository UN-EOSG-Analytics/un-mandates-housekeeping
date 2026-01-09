"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Loader2, Check, MessageSquare, X, AlertTriangle } from "lucide-react";
import { ExportDropdown } from "./ExportDropdown";
import type { Mandate, MandateState, MandateComment, Decision, UserRole } from "@/types";
import { DocumentSymbol } from "./DocumentSymbol";
import { Tooltip } from "./Tooltip";
import { getAgeIndicator } from "@/lib/age-indicator";

interface Props {
  entity: string;
  entityLong: string | null;
  partName: string | null;
  backgroundMandates: Mandate[];
  legislativeMandates: Record<string, Mandate[]>;
}

// Abbreviations for common UN issuing bodies
const BODY_ABBREVS: Record<string, string> = {
  "General Assembly": "GA",
  "Security Council": "SC",
  "Economic and Social Council": "ECOSOC",
  "Human Rights Council": "HRC",
  "Secretary-General": "SG",
  "International Court of Justice": "ICJ",
  "Trusteeship Council": "TC",
};

function abbreviateBody(body: string | null): string | null {
  if (!body) return null;
  return BODY_ABBREVS[body] ?? body;
}

function DecisionSelect({
  decision,
  newSymbol,
  userEmail,
  createdAt,
  onChange,
  onUpdateClick,
  disabled,
}: {
  decision: Decision | null;
  newSymbol: string | null;
  userEmail: string | null;
  createdAt: string | null;
  onChange: (decision: Decision, newSymbol?: string) => void;
  onUpdateClick?: () => void; // Callback to show search UI
  disabled?: boolean;
}) {
  const tooltipContent = userEmail && createdAt
    ? `Set by ${userEmail} at ${new Date(createdAt).toLocaleDateString()}`
    : null;

  const select = (
    <select
      value={decision || ""}
      onChange={(e) => {
        const v = e.target.value as Decision | "";
        if (v === "update") {
          // Trigger search UI instead of immediate onChange
          if (onUpdateClick) onUpdateClick();
          else onChange(v);
        } else if (v) {
          onChange(v);
        }
      }}
      disabled={disabled}
      className={`h-7 w-20 rounded border border-gray-200 px-1 text-xs ${
        decision === "retain" ? "bg-green-50 text-green-700" :
        decision === "remove" ? "bg-red-50 text-red-700" :
        decision === "update" ? "bg-amber-50 text-amber-700" :
        "bg-white text-gray-500"
      }`}
    >
      <option value="">—</option>
      <option value="retain">Retain</option>
      <option value="remove">Remove</option>
      <option value="update">Update</option>
    </select>
  );

  return tooltipContent ? <Tooltip content={tooltipContent}>{select}</Tooltip> : select;
}

function PhaseTracker() {
  const phases = [
    { id: 1, name: "Internal Review", type: "internal" },
    { id: 2, name: "PPBD Review", type: "ppbd" },
    { id: 3, name: "Internal Review", type: "internal" },
    { id: 4, name: "PPBD Review", type: "ppbd" },
  ];
  const currentPhase = 1; // Mockup: always phase 1

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-gray-500 uppercase">Review phases</span>
        <div className="flex-1 flex items-center gap-1">
          {phases.map((phase, i) => (
            <div key={phase.id} className="flex items-center">
              {i > 0 && <div className="w-6 h-px bg-gray-200 mx-1" />}
              <div
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  phase.id < currentPhase
                    ? "bg-green-100 text-green-700"
                    : phase.id === currentPhase
                    ? phase.type === "internal"
                      ? "bg-un-blue text-white"
                      : "bg-amber-500 text-white"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {phase.id < currentPhase && <Check className="h-3 w-3" />}
                <span className="tabular-nums">{phase.id}.</span>
                {phase.name}
              </div>
            </div>
          ))}
        </div>
        {currentPhase <= phases.length && (
          <button
            onClick={() => alert("Phase completion not yet implemented")}
            className="rounded bg-un-blue px-3 py-1 text-xs font-medium text-white hover:bg-un-blue/90"
          >
            Complete Phase {currentPhase}
          </button>
        )}
      </div>
    </div>
  );
}

const GRID_COLS = "grid-cols-[140px_1fr_50px_55px_45px_60px_25px_130px_45px_50px]";

function ColumnHeaders() {
  return (
    <div className={`grid ${GRID_COLS} items-center gap-x-2 px-3 py-1.5 text-[10px] font-medium tracking-wider text-gray-400 uppercase`}>
      <div>Symbol</div>
      <div>Title</div>
      <div>Body</div>
      <div>Year</div>
      <div>Age</div>
      <div>Others</div>
      <div></div>
      <div>Decision</div>
      <div><MessageSquare className="h-3 w-3" /></div>
      <div>OK</div>
    </div>
  );
}

// Inner row content (shared between normal and update target rows)
function MandateRowContent({
  mandate,
  state,
  commentCount,
  userRole,
  isAdded,
  isUpdateTarget,
  onOpenSidebar,
  onDecision,
  onApprove,
  onUpdateClick,
}: {
  mandate: Mandate;
  state?: MandateState;
  commentCount: number;
  userRole: UserRole | null;
  isAdded?: boolean;
  isUpdateTarget?: boolean; // True for the "new" row in update view (no dropdowns)
  onOpenSidebar: () => void;
  onDecision: (decision: Decision, newSymbol?: string) => void;
  onApprove?: (decisionId: string, approved: boolean) => void;
  onUpdateClick?: () => void;
}) {
  const ageInfo = getAgeIndicator(mandate.year);

  const focalAdded = isAdded && state?.focal?.decision === "add";
  const canCancelFocal = isAdded && userRole === "focal" && focalAdded;

  // Check if this row has an update decision (to grey out content)
  const hasUpdate = state?.focal?.decision === "update";
  const contentGreyed = hasUpdate && !isUpdateTarget;

  // Approval state
  const hasDecision = !!state?.focal;
  const isApproved = !!state?.focal?.approvedBy;
  const canApprove = userRole === "ppbd" && onApprove && hasDecision && state?.focal?.id;

  return (
    <div
      className={`grid ${GRID_COLS} items-center gap-x-2 gap-y-1.5 px-3 py-2.5 text-sm cursor-pointer transition-colors ${
        isUpdateTarget ? "bg-amber-50/50" : "hover:bg-gray-50"
      }`}
      onClick={onOpenSidebar}
    >
      <div onClick={(e) => e.stopPropagation()}>
        {isUpdateTarget && <span className="text-amber-500 mr-1 text-xs">↳</span>}
        <a
          href={mandate.link || "#"}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-block rounded px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-colors ${
            contentGreyed 
              ? "bg-gray-100 text-gray-400" 
              : "bg-blue-50 text-un-blue hover:bg-blue-100"
          }`}
          onClick={(e) => !mandate.link && e.preventDefault()}
        >
          {mandate.symbol}
        </a>
      </div>
      <div className={`cursor-help truncate ${contentGreyed ? "text-gray-400" : "text-gray-600"}`} title={mandate.title || undefined}>
        {mandate.title || <span className="italic text-gray-400">No title</span>}
      </div>
      <div className={`text-xs ${contentGreyed ? "text-gray-300" : "text-gray-400"}`} title={mandate.body ?? undefined}>
        {abbreviateBody(mandate.body) ?? "—"}
      </div>
      <div className={`text-xs ${contentGreyed ? "text-gray-300" : "text-gray-400"}`}>{mandate.year ?? "—"}</div>
      <Tooltip content={ageInfo.tooltip}>
        <span
          className={`cursor-help rounded px-1.5 py-0.5 text-xs font-medium ${contentGreyed ? "opacity-50" : ""} ${ageInfo.color} ${ageInfo.bgColor}`}
        >
          {ageInfo.label}
        </span>
      </Tooltip>
      <Tooltip
        content={
          mandate.otherEntitiesCount > 0
            ? `${mandate.otherEntitiesCount} other entit${mandate.otherEntitiesCount !== 1 ? "ies" : "y"} also cite${mandate.otherEntitiesCount === 1 ? "s" : ""} ${mandate.symbol}`
            : `No other entities cite ${mandate.symbol}`
        }
      >
        <span className={`cursor-help text-xs ${contentGreyed ? "text-gray-300" : "text-gray-400"}`}>
          {mandate.otherEntitiesCount > 0 ? `+${mandate.otherEntitiesCount}` : "—"}
        </span>
      </Tooltip>
      <div>
        {!mandate.metadataFromDb && (
          <Tooltip content="Metadata not found in documents database">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </Tooltip>
        )}
      </div>
      <div onClick={(e) => e.stopPropagation()}>
        {isUpdateTarget ? (
          <span className="text-xs text-gray-400">—</span>
        ) : isAdded ? (
          <AddBadge show={!!focalAdded} canCancel={!!canCancelFocal} onCancel={() => onDecision("cancel")} />
        ) : (
          <DecisionSelect
            decision={state?.focal?.decision ?? null}
            newSymbol={state?.focal?.newSymbol ?? null}
            userEmail={state?.focal?.userEmail ?? null}
            createdAt={state?.focal?.createdAt ?? null}
            onChange={userRole === "focal" ? onDecision : () => {}}
            onUpdateClick={userRole === "focal" ? onUpdateClick : undefined}
            disabled={userRole !== "focal"}
          />
        )}
      </div>
      <Tooltip content={commentCount > 0 ? "Click to view comments" : "Click to add a comment"}>
        <span className={`cursor-pointer text-xs ${commentCount > 0 ? "text-un-blue font-medium" : "text-gray-400"} ${contentGreyed ? "opacity-50" : ""}`}>
          {commentCount > 0 ? commentCount : "—"}
        </span>
      </Tooltip>
      <div onClick={(e) => e.stopPropagation()} className="flex items-center justify-center">
        {isUpdateTarget ? (
          <span className="inline-flex h-6 w-6 items-center justify-center text-xs text-gray-400">—</span>
        ) : hasDecision ? (
          <button
            onClick={() => canApprove && state?.focal?.id && onApprove(state.focal.id, !isApproved)}
            disabled={!canApprove}
            title={isApproved ? `Approved by ${state?.focal?.approvedBy}` : (canApprove ? "Click to approve" : "No decision to approve")}
            className={`inline-flex h-6 w-6 items-center justify-center rounded transition-colors ${
              isApproved 
                ? "bg-emerald-600 text-white" 
                : canApprove 
                  ? "border border-gray-300 bg-white hover:border-emerald-400 hover:bg-emerald-50" 
                  : "border border-gray-200 bg-gray-50"
            } ${!canApprove ? "cursor-default" : "cursor-pointer"}`}
          >
            {isApproved && <Check className="h-4 w-4" />}
          </button>
        ) : (
          <span className="inline-flex h-6 w-6 items-center justify-center text-xs text-gray-300">—</span>
        )}
      </div>
    </div>
  );
}

function MandateRow({
  mandate,
  state,
  commentCount,
  userRole,
  userEmail,
  onDecision,
  onApprove,
  onUpdateWithManual,
  onComment,
  isAdded,
  updateTargetMetadata,
}: {
  mandate: Mandate;
  state?: MandateState;
  commentCount: number;
  userRole: UserRole | null;
  userEmail: string | null;
  onDecision: (decision: Decision, newSymbol?: string) => void;
  onApprove: (decisionId: string, approved: boolean) => void;
  onUpdateWithManual: (newSymbol: string, manualData: ManualEntryData) => void;
  onComment: (comment: string) => void;
  isAdded?: boolean;
  updateTargetMetadata?: { title: string | null; year: number | null; body: string | null } | null;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showUpdateSearch, setShowUpdateSearch] = useState(false);

  // Check if there's a completed update (has newSymbol)
  const currentUserDecision = userRole === "focal" ? state?.focal : null;
  const hasCompletedUpdate = currentUserDecision?.decision === "update" && currentUserDecision?.newSymbol;
  const newSymbol = currentUserDecision?.newSymbol;

  // Create a fake mandate object for the "new" row in update view
  const newMandate: Mandate | null = hasCompletedUpdate && newSymbol ? {
    ...mandate,
    symbol: newSymbol,
    title: updateTargetMetadata?.title || "",
    year: updateTargetMetadata?.year || null,
    body: updateTargetMetadata?.body || null,
    link: null,
    metadataFromDb: !!updateTargetMetadata,
    isAdded: false,
  } : null;

  const handleUpdateSelect = (symbol: string) => {
    onDecision("update", symbol);
    setShowUpdateSearch(false);
  };

  const handleUpdateManual = (data: ManualEntryData) => {
    onUpdateWithManual(data.symbol, data);
    setShowUpdateSearch(false);
  };

  return (
    <div className="rounded-lg bg-white shadow-sm">
      {/* Original row */}
      <MandateRowContent
        mandate={mandate}
        state={state}
        commentCount={commentCount}
        userRole={userRole}
        isAdded={isAdded}
        onOpenSidebar={() => setSidebarOpen(true)}
        onDecision={onDecision}
        onApprove={onApprove}
        onUpdateClick={() => setShowUpdateSearch(true)}
      />

      {/* Update search input (shown when user selects "update" from dropdown) */}
      {showUpdateSearch && !hasCompletedUpdate && (
        <div className="border-t border-gray-100 px-3 py-2 bg-amber-50/30">
          <div className="text-xs text-amber-600 mb-2 font-medium">Select replacement document:</div>
          <DocumentSearchInput
            onSelect={handleUpdateSelect}
            onManualSubmit={handleUpdateManual}
            onCancel={() => setShowUpdateSearch(false)}
            placeholder="Search for replacement document..."
            submitLabel="Update"
            formTitle="Enter replacement document manually"
            compact
          />
        </div>
      )}

      {/* New document row (shown when update is complete) */}
      {hasCompletedUpdate && newMandate && (
        <MandateRowContent
          mandate={newMandate}
          state={undefined}
          commentCount={0}
          userRole={null}
          isUpdateTarget
          onOpenSidebar={() => {}}
          onDecision={() => {}}
        />
      )}

      {/* Sidebar (reuse DocumentSymbol for full sidebar) */}
      <div onClick={(e) => e.stopPropagation()}>
        <DocumentSymbol
          symbol={mandate.symbol}
          link={mandate.link}
          title={mandate.title}
          year={mandate.year}
          body={mandate.body}
          otherEntitiesCount={mandate.otherEntitiesCount}
          relevanceCount={mandate.relevanceCount}
          relevanceIndices={mandate.relevanceIndices}
          aiComments={mandate.aiComments}
          entity={mandate.entity}
          entityLong={mandate.entityLong}
          allEntities={mandate.allEntities}
          entityLongMap={mandate.entityLongMap}
          allEntityRelevance={mandate.allEntityRelevance}
          isOpen={sidebarOpen}
          onOpenChange={setSidebarOpen}
          state={state}
          userRole={userRole}
          userEmail={userEmail}
          onDecision={onDecision}
          onApprove={onApprove}
          onComment={onComment}
          onUpdateClick={() => { setSidebarOpen(false); setShowUpdateSearch(true); }}
          metadataFromDb={mandate.metadataFromDb}
          docType={mandate.docType}
        />
      </div>
    </div>
  );
}

function AddBadge({ show, canCancel, onCancel }: { show: boolean; canCancel: boolean; onCancel: () => void }) {
  if (!show) return <span className="text-xs text-gray-400">—</span>;
  return (
    <span className="inline-flex h-7 w-20 items-center rounded border border-blue-200 bg-blue-50 pl-2 pr-px text-xs text-blue-700">
      <span className="flex-1">Add</span>
      {canCancel && (
        <button onClick={onCancel} className="rounded p-0.5 hover:bg-blue-100" title="Cancel">
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}

interface SearchResult {
  symbol: string;
  title: string | null;
  type: string | null;
  year: number | null;
  body: string | null;
}

interface ManualEntryData {
  symbol: string;
  title: string;
  body: string;
  year: string;
  link: string;
}

// Reusable document search input component
function DocumentSearchInput({
  onSelect,
  onManualSubmit,
  onCancel,
  placeholder,
  submitLabel,
  formTitle,
  compact,
}: {
  onSelect: (symbol: string) => void;
  onManualSubmit: (data: ManualEntryData) => void;
  onCancel?: () => void;
  placeholder?: string;
  submitLabel?: string;
  formTitle?: string;
  compact?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchDone, setSearchDone] = useState(false);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualData, setManualData] = useState<ManualEntryData>({ symbol: "", title: "", body: "", year: "", link: "" });
  const [bodySuggestions, setBodySuggestions] = useState<string[]>([]);
  const [showBodySuggestions, setShowBodySuggestions] = useState(false);
  const [linkError, setLinkError] = useState("");
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback((q: string) => {
    if (q.length < 2) {
      setResults([]);
      setOpen(false);
      setSearchDone(false);
      return;
    }
    setSearching(true);
    setSearchDone(false);
    fetch(`/api/documents/search?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((data) => {
        setResults(data);
        setOpen(true);
        setSearchDone(true);
        setHighlighted(data.length > 0 ? 0 : -1);
      })
      .finally(() => setSearching(false));
  }, []);

  const handleInputChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 200);
  };

  const handleSelect = (doc: SearchResult) => {
    onSelect(doc.symbol);
    setQuery("");
    setResults([]);
    setOpen(false);
    setHighlighted(-1);
    setSearchDone(false);
  };

  const handleOpenManualForm = () => {
    setManualData({ symbol: query, title: "", body: "", year: "", link: "" });
    setShowManualForm(true);
    setOpen(false);
    fetch("/api/documents/bodies")
      .then((r) => r.json())
      .then(setBodySuggestions)
      .catch(() => {});
  };

  const isFormValid = manualData.symbol.trim() && 
    manualData.title.trim() && 
    manualData.body.trim() && 
    manualData.year.trim() && 
    manualData.link.trim() &&
    /^\d{4}$/.test(manualData.year) &&
    parseInt(manualData.year) >= 1945 &&
    parseInt(manualData.year) <= 2100 &&
    /^https?:\/\/.+/.test(manualData.link);

  const handleManualSubmit = () => {
    if (!isFormValid) return;
    onManualSubmit(manualData);
    setShowManualForm(false);
    setManualData({ symbol: "", title: "", body: "", year: "", link: "" });
    setQuery("");
    setLinkError("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "Escape") {
        setQuery("");
        onCancel?.();
      }
      return;
    }
    const totalItems = results.length + (searchDone ? 1 : 0);
    if (totalItems === 0) return;
    
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlighted((i) => (i + 1) % totalItems);
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlighted((i) => (i - 1 + totalItems) % totalItems);
        break;
      case "Enter":
        e.preventDefault();
        if (highlighted >= 0 && highlighted < results.length) {
          handleSelect(results[highlighted]);
        } else if (highlighted === results.length || (results.length === 0 && highlighted === 0)) {
          handleOpenManualForm();
        }
        break;
      case "Escape":
        setOpen(false);
        setHighlighted(-1);
        onCancel?.();
        break;
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowBodySuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (showManualForm) {
    const filteredBodies = bodySuggestions.filter((b) => 
      b.toLowerCase().includes(manualData.body.toLowerCase())
    ).slice(0, 8);

    return (
      <div className={`rounded-lg border border-gray-200 bg-white p-4 shadow-sm ${compact ? "p-3" : ""}`}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-700">{formTitle || "Add document manually"}</span>
          <button onClick={() => { setShowManualForm(false); onCancel?.(); }} className="text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Symbol <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={manualData.symbol}
              onChange={(e) => setManualData((d) => ({ ...d, symbol: e.target.value }))}
              className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm focus:border-un-blue focus:outline-none"
              placeholder="e.g. A/RES/78/123"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Title <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={manualData.title}
              onChange={(e) => setManualData((d) => ({ ...d, title: e.target.value }))}
              className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm focus:border-un-blue focus:outline-none"
              placeholder="Document title"
            />
          </div>
          <div className="relative">
            <label className="block text-xs text-gray-500 mb-1">Issuing body <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={manualData.body}
              onChange={(e) => setManualData((d) => ({ ...d, body: e.target.value }))}
              onFocus={() => setShowBodySuggestions(true)}
              onBlur={() => setTimeout(() => setShowBodySuggestions(false), 150)}
              className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm focus:border-un-blue focus:outline-none"
              placeholder="e.g. General Assembly"
            />
            {showBodySuggestions && filteredBodies.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-10 mt-1 max-h-40 overflow-y-auto rounded border border-gray-200 bg-white shadow-lg">
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
            <label className="block text-xs text-gray-500 mb-1">Year <span className="text-red-400">*</span></label>
            <input
              type="number"
              value={manualData.year}
              onChange={(e) => setManualData((d) => ({ ...d, year: e.target.value }))}
              className={`w-full rounded border px-2 py-1.5 text-sm focus:outline-none ${
                manualData.year && (!/^\d{4}$/.test(manualData.year) || parseInt(manualData.year) < 1945 || parseInt(manualData.year) > 2100)
                  ? "border-red-300 focus:border-red-400"
                  : "border-gray-200 focus:border-un-blue"
              }`}
              placeholder="e.g. 2024"
              min="1945"
              max="2100"
            />
            {manualData.year && (!/^\d{4}$/.test(manualData.year) || parseInt(manualData.year) < 1945 || parseInt(manualData.year) > 2100) && (
              <p className="text-xs text-red-500 mt-1">Year must be 4 digits between 1945-2100</p>
            )}
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Link <span className="text-red-400">*</span></label>
            <input
              type="url"
              value={manualData.link}
              onChange={(e) => {
                setManualData((d) => ({ ...d, link: e.target.value }));
                setLinkError("");
              }}
              className={`w-full rounded border px-2 py-1.5 text-sm focus:outline-none ${
                linkError || (manualData.link && !/^https?:\/\/.+/.test(manualData.link))
                  ? "border-red-300 focus:border-red-400"
                  : "border-gray-200 focus:border-un-blue"
              }`}
              placeholder="https://..."
            />
            {(linkError || (manualData.link && !/^https?:\/\/.+/.test(manualData.link))) && (
              <p className="text-xs text-red-500 mt-1">{linkError || "Link must start with http:// or https://"}</p>
            )}
          </div>
          <p className="text-xs text-gray-400">All fields are required</p>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => { setShowManualForm(false); onCancel?.(); }}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleManualSubmit}
              disabled={!isFormValid}
              className="rounded bg-un-blue px-3 py-1.5 text-sm text-white hover:bg-un-blue/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitLabel || "Add"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        className={`flex items-center gap-2 rounded-lg border-2 border-dashed px-3 py-2 transition-colors ${
          focused ? "border-un-blue/40 bg-blue-50/30" : "border-gray-200 bg-gray-50/50"
        }`}
      >
        <Plus className={`h-4 w-4 ${focused ? "text-un-blue" : "text-gray-400"}`} />
        <input
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            setFocused(true);
            if (searchDone) setOpen(true);
          }}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || "Search by symbol or title..."}
          className="flex-1 bg-transparent text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none"
          autoFocus={compact}
        />
        {searching && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
        {onCancel && (
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 z-20 mt-1 max-h-72 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {results.map((doc, i) => (
            <button
              key={doc.symbol}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(doc)}
              onMouseEnter={() => setHighlighted(i)}
              className={`w-full px-3 py-2 text-left border-b border-gray-100 ${
                i === highlighted ? "bg-un-blue/10" : "hover:bg-gray-50"
              }`}
            >
              <div className="flex items-baseline gap-2">
                <span className="font-medium text-un-blue text-sm">{doc.symbol}</span>
                <span className="text-xs text-gray-400">
                  {[doc.body, doc.year].filter(Boolean).join(" · ")}
                </span>
              </div>
              {doc.title && (
                <div className="text-xs text-gray-600 truncate mt-0.5">{doc.title}</div>
              )}
            </button>
          ))}
          {searchDone && results.length === 0 && (
            <div className="px-3 py-2 text-sm text-gray-500">No documents found</div>
          )}
          {searchDone && (
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleOpenManualForm}
              onMouseEnter={() => setHighlighted(results.length)}
              className={`w-full px-3 py-2 text-left text-sm border-t border-gray-100 ${
                highlighted === results.length ? "bg-un-blue/10" : "hover:bg-gray-50"
              }`}
            >
              <span className="text-un-blue">+ Add manually...</span>
              {query && <span className="text-gray-400 ml-1">"{query}"</span>}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Wrapper for the "Add" row at bottom of sections
function AddEntryRow({
  onAdd,
  onAddManual,
  disabled,
}: {
  onAdd: (symbol: string) => void;
  onAddManual: (data: ManualEntryData) => void;
  disabled?: boolean;
}) {
  if (disabled) return null;
  return (
    <DocumentSearchInput
      onSelect={onAdd}
      onManualSubmit={onAddManual}
      placeholder="Add mandate document — search by symbol or title..."
      submitLabel="Add"
      formTitle="Add document manually"
    />
  );
}

function MandateSection({
  title,
  mandates,
  entity,
  entityLong,
  subprogramme,
  states,
  totalComments,
  addedMetadata,
  updateTargetMetadata,
  userRole,
  userEmail,
  onDecision,
  onApprove,
  onUpdateWithManual,
  onComment,
  onAdd,
  onAddManual,
}: {
  title: string;
  mandates: Mandate[];
  entity: string;
  entityLong: string | null;
  subprogramme: string | null;
  states: Record<string, MandateState>;
  totalComments: Record<string, number>;
  addedMetadata: Record<string, { title: string | null; year: number | null; body: string | null; docType: string | null } | null>;
  updateTargetMetadata: Record<string, { title: string | null; year: number | null; body: string | null } | null>;
  userRole: UserRole | null;
  userEmail: string | null;
  onDecision: (symbol: string, decision: Decision, newSymbol?: string) => void;
  onApprove: (decisionId: string, approved: boolean) => void;
  onUpdateWithManual: (symbol: string, newSymbol: string, manualData: ManualEntryData) => void;
  onComment: (symbol: string, comment: string) => void;
  onAdd: (symbol: string) => void;
  onAddManual: (data: ManualEntryData) => void;
}) {
  const stateKey = (symbol: string) => `${symbol}:${subprogramme || ""}`;
  const existingSymbols = new Set(mandates.map((m) => m.symbol));
  // Find user-added entries (decision === "add", excluding cancelled, not already in mandates)
  const addedEntries = Object.values(states).filter(
    (s) => s.subprogramme === subprogramme && 
      (s.focal?.decision === "add" || s.ppbd?.decision === "add") &&
      s.focal?.decision !== "cancel" && s.ppbd?.decision !== "cancel" &&
      !existingSymbols.has(s.documentSymbol)
  );

  // Convert added entries to Mandate objects
  const addedMandates: Mandate[] = addedEntries.map((s) => {
    const meta = addedMetadata[s.documentSymbol];
    // Check for manual metadata in the decision
    const manualMeta = s.focal?.manualMetadata || s.ppbd?.manualMetadata;
    return {
      symbol: s.documentSymbol,
      title: manualMeta?.title || meta?.title || "",
      link: manualMeta?.link || null,
      year: manualMeta?.year || meta?.year || null,
      body: manualMeta?.body || meta?.body || null,
      docType: meta?.docType || null,
      action: null,
      relevanceCount: 0,
      relevanceIndices: [],
      aiComments: {},
      entity,
      entityLong,
      isBackground: subprogramme === null,
      otherEntitiesCount: 0,
      allEntities: [entity],
      entityLongMap: entityLong ? { [entity]: entityLong } : {},
      allEntityRelevance: {},
      metadataFromDb: !!meta,
      isAdded: true,
    };
  });

  if (mandates.length === 0 && addedMandates.length === 0) return null;

  // Get update target symbol for metadata lookup
  const getUpdateTargetSymbol = (symbol: string) => {
    const s = states[stateKey(symbol)];
    return s?.focal?.newSymbol || s?.ppbd?.newSymbol;
  };

  return (
    <div>
      <h3 className="mb-3 px-3 text-sm font-semibold tracking-wide text-gray-600 uppercase">
        {title}
      </h3>
      <div className="space-y-1.5">
        <ColumnHeaders />
        {mandates.map((m) => {
          const targetSymbol = getUpdateTargetSymbol(m.symbol);
          return (
            <MandateRow
              key={m.symbol}
              mandate={{ ...m, entity }}
              state={states[stateKey(m.symbol)]}
              commentCount={totalComments[m.symbol] || 0}
              userRole={userRole}
              userEmail={userEmail}
              onDecision={(decision, newSymbol) => onDecision(m.symbol, decision, newSymbol)}
              onApprove={onApprove}
              onUpdateWithManual={(newSymbol, manualData) => onUpdateWithManual(m.symbol, newSymbol, manualData)}
              onComment={(comment) => onComment(m.symbol, comment)}
              updateTargetMetadata={targetSymbol ? updateTargetMetadata[targetSymbol] : undefined}
            />
          );
        })}
        {addedMandates.map((m) => (
          <MandateRow
            key={m.symbol}
            mandate={m}
            state={states[stateKey(m.symbol)]}
            commentCount={totalComments[m.symbol] || 0}
            userRole={userRole}
            userEmail={userEmail}
            onDecision={(decision) => onDecision(m.symbol, decision)}
            onApprove={onApprove}
            onUpdateWithManual={() => {}}
            onComment={(comment) => onComment(m.symbol, comment)}
            isAdded
          />
        ))}
        <AddEntryRow onAdd={onAdd} onAddManual={onAddManual} disabled={!userRole} />
      </div>
    </div>
  );
}

export function EntityDetail({
  entity,
  entityLong,
  partName,
  backgroundMandates,
  legislativeMandates,
}: Props) {
  const [filterEntity, setFilterEntity] = useState<string | null>(null);
  const [states, setStates] = useState<Record<string, MandateState>>({});
  const [totalComments, setTotalComments] = useState<Record<string, number>>({});
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [addedMetadata, setAddedMetadata] = useState<Record<string, { title: string | null; year: number | null; body: string | null; docType: string | null } | null>>({});
  const [updateTargetMetadata, setUpdateTargetMetadata] = useState<Record<string, { title: string | null; year: number | null; body: string | null } | null>>({});

  // Fetch user role and decisions on mount
  useEffect(() => {
    fetch("/api/housekeeping/role")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          setUserRole(data.role);
          setUserEmail(data.email);
        }
      })
      .catch(() => {});

    fetch(`/api/housekeeping/decisions?entity=${encodeURIComponent(entity)}`)
      .then((r) => r.ok ? r.json() : { states: [], totalComments: {} })
      .then((data: { states: MandateState[]; totalComments: Record<string, number> }) => {
        const map: Record<string, MandateState> = {};
        for (const s of data.states) {
          map[`${s.documentSymbol}:${s.subprogramme || ""}`] = s;
        }
        setStates(map);
        setTotalComments(data.totalComments);
      })
      .catch(() => {});
  }, [entity]);

  // Fetch metadata for added documents
  useEffect(() => {
    const existingSymbols = new Set([
      ...backgroundMandates.map((m) => m.symbol),
      ...Object.values(legislativeMandates).flat().map((m) => m.symbol),
    ]);
    const addedSymbols = Object.values(states)
      .filter((s) => (s.focal?.decision === "add" || s.ppbd?.decision === "add") && !existingSymbols.has(s.documentSymbol))
      .map((s) => s.documentSymbol)
      .filter((sym) => !(sym in addedMetadata)); // Use "in" to check if key exists (even if null)

    if (addedSymbols.length === 0) return;

    fetch(`/api/documents/metadata?symbols=${encodeURIComponent(addedSymbols.join(","))}`)
      .then((r) => r.ok ? r.json() : {})
      .then((data: Record<string, { title: string | null; year: number | null; body: string | null; docType: string | null }>) => {
        // Mark all looked-up symbols, even if no data found (to prevent re-fetching)
        const result: Record<string, { title: string | null; year: number | null; body: string | null; docType: string | null } | null> = {};
        for (const sym of addedSymbols) {
          result[sym] = data[sym] || null; // null means "looked up but not found"
        }
        setAddedMetadata((prev) => ({ ...prev, ...result }));
      })
      .catch(() => {});
  }, [states, backgroundMandates, legislativeMandates, addedMetadata]);

  // Fetch metadata for update target documents
  useEffect(() => {
    const updateTargetSymbols = Object.values(states)
      .filter((s) => s.focal?.decision === "update" || s.ppbd?.decision === "update")
      .map((s) => s.focal?.newSymbol || s.ppbd?.newSymbol)
      .filter((sym): sym is string => !!sym && !(sym in updateTargetMetadata));

    if (updateTargetSymbols.length === 0) return;

    fetch(`/api/documents/metadata?symbols=${encodeURIComponent(updateTargetSymbols.join(","))}`)
      .then((r) => r.ok ? r.json() : {})
      .then((data: Record<string, { title: string | null; year: number | null; body: string | null }>) => {
        const result: Record<string, { title: string | null; year: number | null; body: string | null } | null> = {};
        for (const sym of updateTargetSymbols) {
          result[sym] = data[sym] || null;
        }
        setUpdateTargetMetadata((prev) => ({ ...prev, ...result }));
      })
      .catch(() => {});
  }, [states, updateTargetMetadata]);

  const handleDecision = useCallback(
    async (symbol: string, subprogramme: string | null, decision: Decision, newSymbol?: string) => {
      if (!userRole || !userEmail) return;
      const key = `${symbol}:${subprogramme || ""}`;
      const now = new Date().toISOString();
      const newDecision = {
        id: "",
        documentSymbol: symbol,
        entity,
        subprogramme,
        decision,
        newSymbol: newSymbol || null,
        userEmail,
        userEntity: null,
        createdAt: now,
        role: userRole,
        approvedBy: null,
        approvedAt: null,
      };
      // Optimistic update
      setStates((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          documentSymbol: symbol,
          entity,
          subprogramme,
          [userRole]: newDecision,
          decisions: [...(prev[key]?.decisions || []), newDecision],
        },
      }));

      const res = await fetch("/api/housekeeping/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentSymbol: symbol, entity, subprogramme, decision, newSymbol }),
      });
      if (res.ok) {
        const updated = await res.json();
        setStates((prev) => ({
          ...prev,
          [key]: {
            ...prev[key],
            [updated.role]: updated,
            decisions: [...(prev[key]?.decisions?.filter((d) => d.id) || []), updated],
          },
        }));
      }
    },
    [entity, userRole, userEmail]
  );

  const handleUpdateWithManual = useCallback(
    async (symbol: string, subprogramme: string | null, newSymbol: string, manualData: ManualEntryData) => {
      if (!userRole || !userEmail) return;
      const key = `${symbol}:${subprogramme || ""}`;
      const now = new Date().toISOString();
      const manualMetadata = {
        title: manualData.title || undefined,
        body: manualData.body || undefined,
        year: manualData.year ? parseInt(manualData.year) : undefined,
        link: manualData.link || undefined,
      };
      const newDecision = {
        id: "",
        documentSymbol: symbol,
        entity,
        subprogramme,
        decision: "update" as Decision,
        newSymbol,
        manualMetadata,
        userEmail,
        userEntity: null,
        createdAt: now,
        role: userRole,
        approvedBy: null,
        approvedAt: null,
      };
      // Optimistic update
      setStates((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          documentSymbol: symbol,
          entity,
          subprogramme,
          [userRole]: newDecision,
          decisions: [...(prev[key]?.decisions || []), newDecision],
        },
      }));
      // Also add to updateTargetMetadata for display
      setUpdateTargetMetadata((prev) => ({
        ...prev,
        [newSymbol]: {
          title: manualData.title || null,
          year: manualData.year ? parseInt(manualData.year) : null,
          body: manualData.body || null,
        },
      }));

      const res = await fetch("/api/housekeeping/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentSymbol: symbol,
          entity,
          subprogramme,
          decision: "update",
          newSymbol,
          manualMetadata,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setStates((prev) => ({
          ...prev,
          [key]: {
            ...prev[key],
            [updated.role]: updated,
            decisions: [...(prev[key]?.decisions?.filter((d) => d.id) || []), updated],
          },
        }));
      }
    },
    [entity, userRole, userEmail]
  );

  const handleAddManual = useCallback(
    async (subprogramme: string | null, data: ManualEntryData) => {
      if (!userRole || !userEmail) return;
      const key = `${data.symbol}:${subprogramme || ""}`;
      const now = new Date().toISOString();
      const manualMetadata = {
        title: data.title || undefined,
        body: data.body || undefined,
        year: data.year ? parseInt(data.year) : undefined,
        link: data.link || undefined,
      };
      const newDecision = {
        id: "",
        documentSymbol: data.symbol,
        entity,
        subprogramme,
        decision: "add" as Decision,
        newSymbol: null,
        manualMetadata,
        userEmail,
        userEntity: null,
        createdAt: now,
        role: userRole,
        approvedBy: null,
        approvedAt: null,
      };
      // Optimistic update
      setStates((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          documentSymbol: data.symbol,
          entity,
          subprogramme,
          [userRole]: newDecision,
          decisions: [...(prev[key]?.decisions || []), newDecision],
        },
      }));
      // Also add to addedMetadata for display
      setAddedMetadata((prev) => ({
        ...prev,
        [data.symbol]: {
          title: data.title || null,
          year: data.year ? parseInt(data.year) : null,
          body: data.body || null,
          docType: null,
        },
      }));

      const res = await fetch("/api/housekeeping/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentSymbol: data.symbol,
          entity,
          subprogramme,
          decision: "add",
          manualMetadata,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setStates((prev) => ({
          ...prev,
          [key]: {
            ...prev[key],
            [updated.role]: updated,
            decisions: [...(prev[key]?.decisions?.filter((d) => d.id) || []), updated],
          },
        }));
      }
    },
    [entity, userRole, userEmail]
  );

  const handleComment = useCallback(
    async (symbol: string, subprogramme: string | null, comment: string) => {
      if (!userEmail) return;
      const key = `${symbol}:${subprogramme || ""}`;
      const now = new Date().toISOString();
      const newComment: MandateComment = {
        id: "",
        documentSymbol: symbol,
        entity,
        subprogramme,
        comment,
        userEmail,
        userEntity: null, // Will be populated from server response
        createdAt: now,
      };
      // Optimistic update
      setStates((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          documentSymbol: symbol,
          entity,
          subprogramme,
          comments: [...(prev[key]?.comments || []), newComment],
        },
      }));
      setTotalComments((prev) => ({
        ...prev,
        [symbol]: (prev[symbol] || 0) + 1,
      }));

      const res = await fetch("/api/housekeeping/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentSymbol: symbol, entity, subprogramme, comment }),
      });
      if (res.ok) {
        const added: MandateComment = await res.json();
        setStates((prev) => ({
          ...prev,
          [key]: {
            ...prev[key],
            comments: [...(prev[key]?.comments?.filter((c) => c.id) || []), added],
          },
        }));
      }
    },
    [entity, userEmail]
  );

  const handleApprove = useCallback(
    async (decisionId: string, approved: boolean) => {
      // Optimistic update - find and update the decision
      setStates((prev) => {
        const newStates = { ...prev };
        for (const key of Object.keys(newStates)) {
          const s = newStates[key];
          if (s?.focal?.id === decisionId) {
            newStates[key] = {
              ...s,
              focal: {
                ...s.focal,
                approvedBy: approved ? userEmail : null,
                approvedAt: approved ? new Date().toISOString() : null,
              },
            };
            break;
          }
        }
        return newStates;
      });

      await fetch("/api/housekeeping/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisionId, approved }),
      });
    },
    [userEmail]
  );

  // Combine all mandates for co-citing calculation
  const allMandates = [
    ...backgroundMandates,
    ...Object.values(legislativeMandates).flat(),
  ];

  // Compute co-citing entities and their counts
  const coCitingCounts: Record<string, number> = {};
  for (const m of allMandates) {
    for (const e of m.allEntities) {
      if (e !== entity) {
        coCitingCounts[e] = (coCitingCounts[e] || 0) + 1;
      }
    }
  }
  const coCitingEntities = Object.entries(coCitingCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([e, count]) => ({ entity: e, count }));

  // Filter function
  const filterMandates = (mandates: Mandate[]) =>
    filterEntity
      ? mandates.filter((m) => m.allEntities.includes(filterEntity))
      : mandates;

  const filteredBackground = filterMandates(backgroundMandates);
  const filteredLegislative: Record<string, Mandate[]> = {};
  for (const [key, mandates] of Object.entries(legislativeMandates)) {
    const filtered = filterMandates(mandates);
    if (filtered.length > 0) filteredLegislative[key] = filtered;
  }

  const totalMandates =
    backgroundMandates.length +
    Object.values(legislativeMandates).reduce(
      (sum, arr) => sum + arr.length,
      0,
    );
  const filteredTotal =
    filteredBackground.length +
    Object.values(filteredLegislative).reduce(
      (sum, arr) => sum + arr.length,
      0,
    );

  return (
    <div className="space-y-5">
      {/* Entity Header */}
      <div className="rounded-xl border border-gray-200 bg-white px-3 py-4 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-3xl font-bold text-foreground">{entity}</h2>
            {entityLong && (
              <p className="mt-1 text-lg text-gray-500">{entityLong}</p>
            )}
            {partName && (
              <p className="mt-2 text-sm text-gray-400">{partName}</p>
            )}
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold text-un-blue">
              {filterEntity ? filteredTotal : totalMandates}
            </div>
            <div className="text-sm text-gray-500">
              {filterEntity ? `of ${totalMandates} ` : ""}mandate
              {totalMandates !== 1 ? "s" : ""}
            </div>
            <div className="mt-3">
              <ExportDropdown entity={entity} />
            </div>
          </div>
        </div>
      </div>

      {/* Phase Tracker */}
      <PhaseTracker />

      {/* Co-citing entities filter */}
      {coCitingEntities.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-3">
          <span className="text-[10px] font-medium text-gray-400 uppercase mr-2">
            Filter mandate documents by cross-citing entities:
          </span>
          {coCitingEntities.map(({ entity: e, count }) => (
            <button
              key={e}
              onClick={() => setFilterEntity(filterEntity === e ? null : e)}
              className={`rounded-full px-2 py-0.5 text-xs transition-colors ${
                filterEntity === e
                  ? "bg-un-blue text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {e}{" "}
              <span className={filterEntity === e ? "text-white/60" : "text-gray-400"}>
                {count}
              </span>
            </button>
          ))}
          {filterEntity && (
            <button
              onClick={() => setFilterEntity(null)}
              className="rounded-full bg-gray-300 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-400"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Mandates List */}
      <div className="space-y-8">
        <MandateSection
          title="Mandates and background"
          mandates={filteredBackground}
          entity={entity}
          entityLong={entityLong}
          subprogramme={null}
          states={states}
          totalComments={totalComments}
          addedMetadata={addedMetadata}
          updateTargetMetadata={updateTargetMetadata}
          userRole={userRole}
          userEmail={userEmail}
          onDecision={(symbol, decision, newSymbol) =>
            handleDecision(symbol, null, decision, newSymbol)
          }
          onApprove={handleApprove}
          onUpdateWithManual={(symbol, newSymbol, manualData) =>
            handleUpdateWithManual(symbol, null, newSymbol, manualData)
          }
          onComment={(symbol, comment) => handleComment(symbol, null, comment)}
          onAdd={(symbol) => handleDecision(symbol, null, "add")}
          onAddManual={(data) => handleAddManual(null, data)}
        />

        {Object.entries(filteredLegislative)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([subprog, mandates]) => (
            <MandateSection
              key={subprog}
              title={subprog}
              mandates={mandates}
              entity={entity}
              entityLong={entityLong}
              subprogramme={subprog}
              states={states}
              totalComments={totalComments}
              addedMetadata={addedMetadata}
              updateTargetMetadata={updateTargetMetadata}
              userRole={userRole}
              userEmail={userEmail}
              onDecision={(symbol, decision, newSymbol) =>
                handleDecision(symbol, subprog, decision, newSymbol)
              }
              onApprove={handleApprove}
              onUpdateWithManual={(symbol, newSymbol, manualData) =>
                handleUpdateWithManual(symbol, subprog, newSymbol, manualData)
              }
              onComment={(symbol, comment) => handleComment(symbol, subprog, comment)}
              onAdd={(symbol) => handleDecision(symbol, subprog, "add")}
              onAddManual={(data) => handleAddManual(subprog, data)}
            />
          ))}

        {filteredTotal === 0 && filterEntity && (
          <div className="rounded-lg bg-gray-50 p-8 text-center text-gray-400">
            No mandates match this filter
          </div>
        )}
      </div>
    </div>
  );
}
