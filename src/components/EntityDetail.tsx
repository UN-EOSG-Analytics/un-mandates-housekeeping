"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Loader2 } from "lucide-react";
import { ExportDropdown } from "./ExportDropdown";
import type { Mandate, MandateState, Decision, UserRole } from "@/types";
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

function DecisionSelect({
  decision,
  newSymbol,
  userEmail,
  createdAt,
  onChange,
  disabled,
  showAdd,
}: {
  decision: Decision | null;
  newSymbol: string | null;
  userEmail: string | null;
  createdAt: string | null;
  onChange: (decision: Decision, newSymbol?: string) => void;
  disabled?: boolean;
  showAdd?: boolean;
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
        decision === "add" ? "bg-blue-50 text-blue-700" :
        "bg-white text-gray-500"
      }`}
    >
      <option value="">—</option>
      <option value="retain">Retain</option>
      <option value="remove">Remove</option>
      <option value="update">Update</option>
      {showAdd && <option value="add">Add</option>}
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
  state,
  userRole,
  onDecision,
}: {
  mandate: Mandate;
  state?: MandateState;
  userRole: UserRole | null;
  onDecision: (decision: Decision, newSymbol?: string) => void;
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
          state={state}
          userRole={userRole}
          onDecision={onDecision}
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
          decision={state?.focal?.decision ?? null}
          newSymbol={state?.focal?.newSymbol ?? null}
          userEmail={state?.focal?.userEmail ?? null}
          createdAt={state?.focal?.createdAt ?? null}
          onChange={userRole === "focal" ? onDecision : () => {}}
          disabled={userRole !== "focal"}
        />
      </div>
      <div onClick={(e) => e.stopPropagation()}>
        <DecisionSelect
          decision={state?.ppbd?.decision ?? null}
          newSymbol={state?.ppbd?.newSymbol ?? null}
          userEmail={state?.ppbd?.userEmail ?? null}
          createdAt={state?.ppbd?.createdAt ?? null}
          onChange={userRole === "ppbd" ? onDecision : () => {}}
          disabled={userRole !== "ppbd"}
        />
      </div>
    </div>
  );
}

function AddEntryRow({
  onAdd,
  disabled,
}: {
  onAdd: (symbol: string) => void;
  disabled?: boolean;
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
          onKeyDown={(e) => e.key === "Enter" && !disabled && handleAdd()}
          placeholder="Add document symbol..."
          disabled={disabled}
          className="h-7 flex-1 rounded border border-gray-200 px-2 text-xs disabled:opacity-50"
        />
        <button
          onClick={handleAdd}
          disabled={!symbol.trim() || loading || disabled}
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
  states,
  userRole,
  onDecision,
  onAdd,
}: {
  title: string;
  mandates: Mandate[];
  entity: string;
  subprogramme: string | null;
  states: Record<string, MandateState>;
  userRole: UserRole | null;
  onDecision: (symbol: string, decision: Decision, newSymbol?: string) => void;
  onAdd: (symbol: string) => void;
}) {
  const stateKey = (symbol: string) => `${symbol}:${subprogramme || ""}`;
  // Find user-added entries (decision === "add")
  const addedEntries = Object.values(states).filter(
    (s) => s.subprogramme === subprogramme && (s.focal?.decision === "add" || s.ppbd?.decision === "add")
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
            state={states[stateKey(m.symbol)]}
            userRole={userRole}
            onDecision={(decision, newSymbol) => onDecision(m.symbol, decision, newSymbol)}
          />
        ))}
        {addedEntries.map((s) => {
          const addedBy = s.focal?.decision === "add" ? s.focal : s.ppbd;
          return (
            <div
              key={`${s.documentSymbol}:${s.subprogramme}`}
              className={`grid ${GRID_COLS} items-center gap-x-2 gap-y-1.5 rounded-lg bg-blue-50 px-3 py-2.5 text-sm shadow-sm`}
            >
              <div className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-un-blue">
                {s.documentSymbol}
              </div>
              <div className="col-span-6 text-xs text-gray-400">
                Added by {addedBy?.userEmail}
              </div>
              <div />
              <div />
            </div>
          );
        })}
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
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

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
      .then((r) => r.ok ? r.json() : [])
      .then((data: MandateState[]) => {
        const map: Record<string, MandateState> = {};
        for (const s of data) {
          map[`${s.documentSymbol}:${s.subprogramme || ""}`] = s;
        }
        setStates(map);
      })
      .catch(() => {});
  }, [entity]);

  const handleDecision = useCallback(
    async (symbol: string, subprogramme: string | null, decision: Decision, newSymbol?: string) => {
      if (!userRole || !userEmail) return;
      const key = `${symbol}:${subprogramme || ""}`;
      const now = new Date().toISOString();
      // Optimistic update
      setStates((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          documentSymbol: symbol,
          entity,
          subprogramme,
          [userRole]: {
            id: "",
            documentSymbol: symbol,
            entity,
            subprogramme,
            decision,
            newSymbol: newSymbol || null,
            userEmail,
            createdAt: now,
            role: userRole,
          },
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
          [key]: { ...prev[key], [updated.role]: updated },
        }));
      }
    },
    [entity, userRole, userEmail]
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
          states={states}
          userRole={userRole}
          onDecision={(symbol, decision, newSymbol) =>
            handleDecision(symbol, null, decision, newSymbol)
          }
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
              subprogramme={subprog}
              states={states}
              userRole={userRole}
              onDecision={(symbol, decision, newSymbol) =>
                handleDecision(symbol, subprog, decision, newSymbol)
              }
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
