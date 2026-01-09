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
  disabled,
}: {
  decision: Decision | null;
  newSymbol: string | null;
  userEmail: string | null;
  createdAt: string | null;
  onChange: (decision: Decision, newSymbol?: string) => void;
  disabled?: boolean;
}) {
  const [localNewSymbol, setLocalNewSymbol] = useState(newSymbol || "");

  const tooltipContent = userEmail && createdAt
    ? `Set by ${userEmail} at ${new Date(createdAt).toLocaleDateString()}`
    : null;

  const select = (
    <select
      value={decision || ""}
      onChange={(e) => {
        const v = e.target.value as Decision | "";
        if (v) onChange(v, v === "update" ? localNewSymbol : undefined);
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

  return (
    <div className="flex items-center gap-1">
      {tooltipContent ? <Tooltip content={tooltipContent}>{select}</Tooltip> : select}
      {decision === "update" && (
        <input
          type="text"
          value={localNewSymbol}
          onChange={(e) => setLocalNewSymbol(e.target.value)}
          onBlur={() => onChange("update", localNewSymbol)}
          onKeyDown={(e) => e.key === "Enter" && onChange("update", localNewSymbol)}
          placeholder="New symbol"
          className="h-7 w-28 rounded border border-gray-200 px-1.5 text-xs"
        />
      )}
    </div>
  );
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

const GRID_COLS = "grid-cols-[140px_1fr_50px_55px_45px_60px_45px_25px_130px_130px]";

function ColumnHeaders() {
  return (
    <div className={`grid ${GRID_COLS} items-center gap-x-2 px-3 py-1.5 text-[10px] font-medium tracking-wider text-gray-400 uppercase`}>
      <div>Symbol</div>
      <div>Title</div>
      <div>Body</div>
      <div>Year</div>
      <div>Age</div>
      <div>Others</div>
      <div><MessageSquare className="h-3 w-3" /></div>
      <div></div>
      <div>Focal Point</div>
      <div>PPBD</div>
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
  onComment,
  isAdded,
}: {
  mandate: Mandate;
  state?: MandateState;
  commentCount: number;
  userRole: UserRole | null;
  userEmail: string | null;
  onDecision: (decision: Decision, newSymbol?: string) => void;
  onComment: (comment: string) => void;
  isAdded?: boolean;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const ageInfo = getAgeIndicator(mandate.year);

  const focalAdded = isAdded && state?.focal?.decision === "add";
  const ppbdAdded = isAdded && state?.ppbd?.decision === "add";
  const canCancelFocal = isAdded && userRole === "focal" && focalAdded;
  const canCancelPpbd = isAdded && userRole === "ppbd" && ppbdAdded;

  return (
    <div
      className={`grid ${GRID_COLS} items-center gap-x-2 gap-y-1.5 rounded-lg bg-white px-3 py-2.5 text-sm shadow-sm cursor-pointer hover:bg-gray-50 transition-colors`}
      onClick={() => setSidebarOpen(true)}
    >
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
          onComment={onComment}
          metadataFromDb={mandate.metadataFromDb}
          docType={mandate.docType}
        />
      </div>
      <div className="cursor-help truncate text-gray-600" title={mandate.title || undefined}>
        {mandate.title || <span className="italic text-gray-400">No title</span>}
      </div>
      <div className="text-xs text-gray-400" title={mandate.body ?? undefined}>
        {abbreviateBody(mandate.body) ?? "—"}
      </div>
      <div className="text-xs text-gray-400">{mandate.year ?? "—"}</div>
      <Tooltip content={ageInfo.tooltip}>
        <span
          className={`cursor-help rounded px-1.5 py-0.5 text-xs font-medium ${ageInfo.color} ${ageInfo.bgColor}`}
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
        <span className="cursor-help text-xs text-gray-400">
          {mandate.otherEntitiesCount > 0
            ? `+${mandate.otherEntitiesCount}`
            : "—"}
        </span>
      </Tooltip>
      <Tooltip content={commentCount > 0 ? "Click to view comments" : "Click to add a comment"}>
        <span className={`cursor-pointer text-xs ${commentCount > 0 ? "text-un-blue font-medium" : "text-gray-400"}`}>
          {commentCount > 0 ? commentCount : "—"}
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
        {isAdded ? (
          <AddBadge show={!!focalAdded} canCancel={!!canCancelFocal} onCancel={() => onDecision("cancel")} />
        ) : (
          <DecisionSelect
            decision={state?.focal?.decision ?? null}
            newSymbol={state?.focal?.newSymbol ?? null}
            userEmail={state?.focal?.userEmail ?? null}
            createdAt={state?.focal?.createdAt ?? null}
            onChange={userRole === "focal" ? onDecision : () => {}}
            disabled={userRole !== "focal"}
          />
        )}
      </div>
      <div onClick={(e) => e.stopPropagation()}>
        {isAdded ? (
          <AddBadge show={!!ppbdAdded} canCancel={!!canCancelPpbd} onCancel={() => onDecision("cancel")} />
        ) : (
          <DecisionSelect
            decision={state?.ppbd?.decision ?? null}
            newSymbol={state?.ppbd?.newSymbol ?? null}
            userEmail={state?.ppbd?.userEmail ?? null}
            createdAt={state?.ppbd?.createdAt ?? null}
            onChange={userRole === "ppbd" ? onDecision : () => {}}
            disabled={userRole !== "ppbd"}
          />
        )}
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

function AddEntryRow({
  onAdd,
  disabled,
}: {
  onAdd: (symbol: string) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback((q: string) => {
    if (q.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    setSearching(true);
    fetch(`/api/documents/search?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((data) => {
        setResults(data);
        setOpen(data.length > 0);
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
    onAdd(doc.symbol);
    setQuery("");
    setResults([]);
    setOpen(false);
    setHighlighted(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) {
      if (e.key === "Escape") setQuery("");
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlighted((i) => (i + 1) % results.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlighted((i) => (i - 1 + results.length) % results.length);
        break;
      case "Enter":
        e.preventDefault();
        if (highlighted >= 0) handleSelect(results[highlighted]);
        break;
      case "Escape":
        setOpen(false);
        setHighlighted(-1);
        break;
    }
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (disabled) return null;

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
            if (results.length > 0) setOpen(true);
          }}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder="Add mandate document — search by symbol or title..."
          className="flex-1 bg-transparent text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none"
        />
        {searching && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-20 mt-1 max-h-72 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {results.map((doc, i) => (
            <button
              key={doc.symbol}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(doc)}
              onMouseEnter={() => setHighlighted(i)}
              className={`w-full px-3 py-2 text-left border-b border-gray-100 last:border-0 ${
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
        </div>
      )}
    </div>
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
  userRole,
  userEmail,
  onDecision,
  onComment,
  onAdd,
}: {
  title: string;
  mandates: Mandate[];
  entity: string;
  entityLong: string | null;
  subprogramme: string | null;
  states: Record<string, MandateState>;
  totalComments: Record<string, number>;
  addedMetadata: Record<string, { title: string | null; year: number | null; body: string | null; docType: string | null }>;
  userRole: UserRole | null;
  userEmail: string | null;
  onDecision: (symbol: string, decision: Decision, newSymbol?: string) => void;
  onComment: (symbol: string, comment: string) => void;
  onAdd: (symbol: string) => void;
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
    return {
      symbol: s.documentSymbol,
      title: meta?.title || "",
      link: null,
      year: meta?.year || null,
      body: meta?.body || null,
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

  return (
    <div>
      <h3 className="mb-3 px-3 text-sm font-semibold tracking-wide text-gray-600 uppercase">
        {title}
      </h3>
      <div className="space-y-1.5">
        <ColumnHeaders />
        {mandates.map((m) => (
          <MandateRow
            key={m.symbol}
            mandate={{ ...m, entity }}
            state={states[stateKey(m.symbol)]}
            commentCount={totalComments[m.symbol] || 0}
            userRole={userRole}
            userEmail={userEmail}
            onDecision={(decision, newSymbol) => onDecision(m.symbol, decision, newSymbol)}
            onComment={(comment) => onComment(m.symbol, comment)}
          />
        ))}
        {addedMandates.map((m) => (
          <MandateRow
            key={m.symbol}
            mandate={m}
            state={states[stateKey(m.symbol)]}
            commentCount={totalComments[m.symbol] || 0}
            userRole={userRole}
            userEmail={userEmail}
            onDecision={(decision) => onDecision(m.symbol, decision)}
            onComment={(comment) => onComment(m.symbol, comment)}
            isAdded
          />
        ))}
        <AddEntryRow onAdd={onAdd} disabled={!userRole} />
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
  const [addedMetadata, setAddedMetadata] = useState<Record<string, { title: string | null; year: number | null; body: string | null; docType: string | null }>>({});

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
      .filter((sym) => !addedMetadata[sym]);

    if (addedSymbols.length === 0) return;

    fetch(`/api/documents/metadata?symbols=${encodeURIComponent(addedSymbols.join(","))}`)
      .then((r) => r.ok ? r.json() : {})
      .then((data) => setAddedMetadata((prev) => ({ ...prev, ...data })))
      .catch(() => {});
  }, [states, backgroundMandates, legislativeMandates, addedMetadata]);

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
        createdAt: now,
        role: userRole,
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
          userRole={userRole}
          userEmail={userEmail}
          onDecision={(symbol, decision, newSymbol) =>
            handleDecision(symbol, null, decision, newSymbol)
          }
          onComment={(symbol, comment) => handleComment(symbol, null, comment)}
          onAdd={(symbol) => handleDecision(symbol, null, "add")}
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
              userRole={userRole}
              userEmail={userEmail}
              onDecision={(symbol, decision, newSymbol) =>
                handleDecision(symbol, subprog, decision, newSymbol)
              }
              onComment={(symbol, comment) => handleComment(symbol, subprog, comment)}
              onAdd={(symbol) => handleDecision(symbol, subprog, "add")}
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
