"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Loader2 } from "lucide-react";
import { ExportDropdown } from "./ExportDropdown";
import type { Mandate, MandateEntry, DecisionValue } from "@/types";
import { DocumentSymbol } from "./DocumentSymbol";
import { Tooltip } from "./Tooltip";

interface Props {
  entity: string;
  entityLong: string | null;
  partName: string | null;
  backgroundMandates: Mandate[];
  legislativeMandates: Record<string, Mandate[]>;
}

const currentYear = new Date().getFullYear();

function getAgeIndicator(year: number | null): {
  color: string;
  bgColor: string;
  label: string;
  tooltip: string;
} {
  if (!year)
    return {
      color: "text-gray-400",
      bgColor: "bg-gray-100",
      label: "—",
      tooltip: "Year unknown",
    };

  const age = currentYear - year;

  if (age < 5) {
    return {
      color: "text-green-600",
      bgColor: "bg-green-100",
      label: "<5",
      tooltip: `${age} year${age !== 1 ? "s" : ""} old`,
    };
  } else if (age < 10) {
    return {
      color: "text-yellow-600",
      bgColor: "bg-yellow-100",
      label: ">5",
      tooltip: `${age} years old`,
    };
  } else if (age < 20) {
    return {
      color: "text-orange-600",
      bgColor: "bg-orange-100",
      label: ">10",
      tooltip: `${age} years old`,
    };
  } else if (age < 50) {
    return {
      color: "text-red-600",
      bgColor: "bg-red-100",
      label: ">20",
      tooltip: `${age} years old`,
    };
  } else {
    return {
      color: "text-red-800",
      bgColor: "bg-red-200",
      label: ">50",
      tooltip: `${age} years old`,
    };
  }
}

type DecisionType = "focal" | "ppbd";

function DecisionSelect({
  value,
  newSymbol,
  decidedBy,
  decidedAt,
  onChange,
  disabled,
}: {
  value: DecisionValue;
  newSymbol: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  onChange: (decision: DecisionValue, newSymbol?: string) => void;
  disabled?: boolean;
}) {
  const [localNewSymbol, setLocalNewSymbol] = useState(newSymbol || "");

  const tooltipContent = decidedBy && decidedAt
    ? `Set by ${decidedBy} at ${new Date(decidedAt).toLocaleDateString()}`
    : null;

  const select = (
    <select
      value={value || ""}
      onChange={(e) => {
        const v = e.target.value as DecisionValue | "";
        onChange(v || null, v === "update" ? localNewSymbol : undefined);
      }}
      disabled={disabled}
      className={`h-7 w-20 rounded border border-gray-200 px-1 text-xs ${
        value === "retain" ? "bg-green-50 text-green-700" :
        value === "remove" ? "bg-red-50 text-red-700" :
        value === "update" ? "bg-amber-50 text-amber-700" :
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
      {value === "update" && (
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

const GRID_COLS = "grid-cols-[140px_1fr_50px_90px_55px_45px_60px_130px_130px]";

function ColumnHeaders() {
  return (
    <div className={`grid ${GRID_COLS} items-center gap-x-2 px-3 py-1.5 text-[10px] font-medium tracking-wider text-gray-400 uppercase`}>
      <div>Symbol</div>
      <div>Title</div>
      <div>Body</div>
      <div>Type</div>
      <div>Year</div>
      <div>Age</div>
      <div>Others</div>
      <div>Focal Point</div>
      <div>PPBD</div>
    </div>
  );
}

function MandateRow({
  mandate,
  entry,
  onDecisionChange,
}: {
  mandate: Mandate;
  entry?: MandateEntry;
  onDecisionChange: (type: DecisionType, value: DecisionValue, newSymbol?: string) => void;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const ageInfo = getAgeIndicator(mandate.year);

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
          docType={mandate.docType}
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
          entry={entry}
          onDecisionChange={onDecisionChange}
        />
      </div>
      <div className="cursor-help truncate text-gray-600" title={mandate.title}>
        {mandate.title}
      </div>
      <div className="text-xs text-gray-400" title={mandate.body ?? undefined}>
        {mandate.body ?? "—"}
      </div>
      <div
        className="truncate text-xs text-gray-400"
        title={mandate.docType ?? undefined}
      >
        {mandate.docType ?? "—"}
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
      <div onClick={(e) => e.stopPropagation()}>
        <DecisionSelect
          value={entry?.focalDecision ?? null}
          newSymbol={entry?.focalNewSymbol ?? null}
          decidedBy={entry?.focalDecidedBy ?? null}
          decidedAt={entry?.focalDecidedAt ?? null}
          onChange={(v, ns) => onDecisionChange("focal", v, ns)}
        />
      </div>
      <div onClick={(e) => e.stopPropagation()}>
        <DecisionSelect
          value={entry?.ppbdDecision ?? null}
          newSymbol={entry?.ppbdNewSymbol ?? null}
          decidedBy={entry?.ppbdDecidedBy ?? null}
          decidedAt={entry?.ppbdDecidedAt ?? null}
          onChange={(v, ns) => onDecisionChange("ppbd", v, ns)}
        />
      </div>
    </div>
  );
}

function AddEntryRow({
  entity,
  subprogramme,
  onAdd,
}: {
  entity: string;
  subprogramme: string | null;
  onAdd: (symbol: string) => void;
}) {
  const [symbol, setSymbol] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    if (!symbol.trim()) return;
    setLoading(true);
    await onAdd(symbol.trim());
    setSymbol("");
    setLoading(false);
  };

  return (
    <div className={`grid ${GRID_COLS} items-center gap-x-2 gap-y-1.5 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50/50 px-3 py-2 text-sm`}>
      <div className="col-span-2 flex items-center gap-2">
        <input
          type="text"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Add document symbol..."
          className="h-7 flex-1 rounded border border-gray-200 px-2 text-xs"
        />
        <button
          onClick={handleAdd}
          disabled={!symbol.trim() || loading}
          className="flex h-7 items-center gap-1 rounded bg-un-blue px-2 text-xs text-white hover:bg-un-blue/90 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          Add
        </button>
      </div>
      <div className="col-span-7" />
    </div>
  );
}

function MandateSection({
  title,
  mandates,
  entity,
  subprogramme,
  entries,
  onDecisionChange,
  onAddEntry,
}: {
  title: string;
  mandates: Mandate[];
  entity: string;
  subprogramme: string | null;
  entries: Record<string, MandateEntry>;
  onDecisionChange: (symbol: string, type: DecisionType, value: DecisionValue, newSymbol?: string) => void;
  onAddEntry: (symbol: string) => void;
}) {
  const entryKey = (symbol: string) => `${symbol}:${entity}:${subprogramme || ""}`;
  const addedEntries = Object.values(entries).filter(
    (e) => e.addedBy && e.subprogramme === subprogramme
  );

  if (mandates.length === 0 && addedEntries.length === 0) return null;

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
            entry={entries[entryKey(m.symbol)]}
            onDecisionChange={(type, value, newSymbol) =>
              onDecisionChange(m.symbol, type, value, newSymbol)
            }
          />
        ))}
        {addedEntries.map((e) => (
          <div
            key={e.id}
            className={`grid ${GRID_COLS} items-center gap-x-2 gap-y-1.5 rounded-lg bg-blue-50 px-3 py-2.5 text-sm shadow-sm`}
          >
            <div className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-un-blue">
              {e.documentSymbol}
            </div>
            <div className="col-span-6 text-xs text-gray-400">
              Added by {e.addedBy}
            </div>
            <div />
            <div />
          </div>
        ))}
        <AddEntryRow entity={entity} subprogramme={subprogramme} onAdd={onAddEntry} />
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
  const [entries, setEntries] = useState<Record<string, MandateEntry>>({});

  // Fetch entries on mount
  useEffect(() => {
    fetch(`/api/housekeeping/entries?entity=${encodeURIComponent(entity)}`)
      .then((r) => r.ok ? r.json() : [])
      .then((data: MandateEntry[]) => {
        const map: Record<string, MandateEntry> = {};
        for (const e of data) {
          map[`${e.documentSymbol}:${e.entity}:${e.subprogramme || ""}`] = e;
        }
        setEntries(map);
      })
      .catch(() => {});
  }, [entity]);

  const handleDecisionChange = useCallback(
    async (symbol: string, subprogramme: string | null, type: DecisionType, value: DecisionValue, newSymbol?: string) => {
      const key = `${symbol}:${entity}:${subprogramme || ""}`;
      // Optimistic update
      setEntries((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          id: prev[key]?.id || "",
          documentSymbol: symbol,
          entity,
          subprogramme,
          ...(type === "focal"
            ? { focalDecision: value, focalNewSymbol: newSymbol || null }
            : { ppbdDecision: value, ppbdNewSymbol: newSymbol || null }),
        } as MandateEntry,
      }));

      const res = await fetch("/api/housekeeping/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentSymbol: symbol,
          entity,
          subprogramme,
          action: { type, decision: value, newSymbol },
        }),
      });
      if (res.ok) {
        const updated: MandateEntry = await res.json();
        setEntries((prev) => ({ ...prev, [key]: updated }));
      }
    },
    [entity]
  );

  const handleAddEntry = useCallback(
    async (subprogramme: string | null, symbol: string) => {
      const key = `${symbol}:${entity}:${subprogramme || ""}`;
      const res = await fetch("/api/housekeeping/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentSymbol: symbol,
          entity,
          subprogramme,
          action: { type: "add" },
        }),
      });
      if (res.ok) {
        const added: MandateEntry = await res.json();
        setEntries((prev) => ({ ...prev, [key]: added }));
      }
    },
    [entity]
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
          subprogramme={null}
          entries={entries}
          onDecisionChange={(symbol, type, value, newSymbol) =>
            handleDecisionChange(symbol, null, type, value, newSymbol)
          }
          onAddEntry={(symbol) => handleAddEntry(null, symbol)}
        />

        {Object.entries(filteredLegislative)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([subprog, mandates]) => (
            <MandateSection
              key={subprog}
              title={subprog}
              mandates={mandates}
              entity={entity}
              subprogramme={subprog}
              entries={entries}
              onDecisionChange={(symbol, type, value, newSymbol) =>
                handleDecisionChange(symbol, subprog, type, value, newSymbol)
              }
              onAddEntry={(symbol) => handleAddEntry(subprog, symbol)}
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
