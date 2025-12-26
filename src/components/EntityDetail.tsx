"use client";

import { useState } from "react";
import { GitCompareArrows } from "lucide-react";
import type { Mandate } from "@/types";
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

function MandateRow({ mandate }: { mandate: Mandate }) {
  const ageInfo = getAgeIndicator(mandate.year);

  return (
    <div className="grid grid-cols-[140px_1fr_50px_90px_55px_45px_60px_60px_70px_160px_28px] items-center gap-x-2 gap-y-1.5 rounded-lg bg-white px-3 py-2.5 text-sm shadow-sm">
      <DocumentSymbol
        symbol={mandate.symbol}
        link={mandate.link}
        title={mandate.title}
        relevanceCount={mandate.relevanceCount}
        relevanceIndices={mandate.relevanceIndices}
        aiComments={mandate.aiComments}
        entity={mandate.entity}
        entityLong={mandate.entityLong}
        allEntities={mandate.allEntities}
        entityLongMap={mandate.entityLongMap}
        allEntityRelevance={mandate.allEntityRelevance}
      />
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
          mandate.relevanceCount > 0
            ? `${mandate.relevanceCount} paragraph${mandate.relevanceCount !== 1 ? "s" : ""} relevant to ${mandate.entity}'s mandate`
            : `No paragraphs identified as relevant to ${mandate.entity}'s mandate`
        }
      >
        <span className="cursor-help text-xs text-gray-400">
          {mandate.relevanceCount > 0 ? `${mandate.relevanceCount}×` : "—"}
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
      {mandate.action ? (
        <>
          <Tooltip
            content={
              mandate.action.type === "DROP"
                ? "Newer version already cited"
                : "Newer version available"
            }
          >
            <span
              className={`inline-block cursor-help rounded px-2 py-0.5 text-xs font-medium ${
                mandate.action.type === "DROP"
                  ? "bg-red-50 text-red-600"
                  : "bg-amber-50 text-amber-600"
              }`}
            >
              {mandate.action.type}
            </span>
          </Tooltip>
          <div className="truncate text-xs text-gray-400">
            → {mandate.action.newerSymbol}
          </div>
          <Tooltip content="Compare documents">
            <a
              href={`https://mandates.un.org/diff?symbol1=${encodeURIComponent(mandate.symbol)}&symbol2=${encodeURIComponent(mandate.action.newerSymbol)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 transition-colors hover:text-un-blue"
            >
              <GitCompareArrows className="h-4 w-4" />
            </a>
          </Tooltip>
        </>
      ) : (
        <>
          <div />
          <div />
          <div />
        </>
      )}
    </div>
  );
}

function MandateSection({
  title,
  mandates,
  entity,
}: {
  title: string;
  mandates: Mandate[];
  entity: string;
}) {
  if (mandates.length === 0) return null;

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold tracking-wide text-gray-600 uppercase">
        {title}
      </h3>
      <div className="space-y-1.5">
        {mandates.map((m) => (
          <MandateRow key={m.symbol} mandate={{ ...m, entity }} />
        ))}
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
    <div className="space-y-6">
      {/* Entity Header */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
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
          </div>
        </div>

        {/* Co-citing entities filter */}
        {coCitingEntities.length > 0 && (
          <div className="mt-6 border-t border-gray-100 pt-4">
            <div className="mb-2 text-xs font-medium text-gray-500 uppercase">
              Filter by co-citing entity
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {coCitingEntities.map(({ entity: e, count }) => (
                <button
                  key={e}
                  onClick={() =>
                    setFilterEntity(filterEntity === e ? null : e)
                  }
                  className={`rounded-full px-3 py-1 text-sm transition-colors ${
                    filterEntity === e
                      ? "bg-un-blue text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {e}{" "}
                  <span
                    className={
                      filterEntity === e ? "text-white/70" : "text-gray-400"
                    }
                  >
                    ({count})
                  </span>
                </button>
              ))}
              {filterEntity && (
                <button
                  onClick={() => setFilterEntity(null)}
                  className="ml-2 rounded-full bg-gray-300 px-3 py-1 text-sm text-gray-600 hover:bg-gray-400"
                >
                  Clear filter
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Mandates List */}
      <div className="space-y-8">
        <MandateSection
          title="Mandates and background"
          mandates={filteredBackground}
          entity={entity}
        />

        {Object.entries(filteredLegislative)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([subprog, mandates]) => (
            <MandateSection
              key={subprog}
              title={subprog}
              mandates={mandates}
              entity={entity}
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
