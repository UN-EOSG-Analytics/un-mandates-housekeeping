"use client";

import { useState, useRef, useEffect, Fragment } from "react";
import { X, GitCompareArrows } from "lucide-react";
import type { PartData, Mandate } from "@/types";
import { DocumentSymbol } from "./DocumentSymbol";
import { Tooltip } from "./Tooltip";

interface Props {
  parts: PartData[];
}

const currentYear = new Date().getFullYear();

function getAgeIndicator(year: number | null): {
  color: string;
  bgColor: string;
  label: string;
  tooltip: string;
} {
  if (!year) return { color: "text-gray-400", bgColor: "bg-gray-100", label: "—", tooltip: "Year unknown" };
  
  const age = currentYear - year;
  
  if (age < 5) {
    return { color: "text-green-600", bgColor: "bg-green-100", label: "<5", tooltip: `${age} year${age !== 1 ? "s" : ""} old` };
  } else if (age < 10) {
    return { color: "text-yellow-600", bgColor: "bg-yellow-100", label: ">5", tooltip: `${age} years old` };
  } else if (age < 20) {
    return { color: "text-orange-600", bgColor: "bg-orange-100", label: ">10", tooltip: `${age} years old` };
  } else if (age < 50) {
    return { color: "text-red-600", bgColor: "bg-red-100", label: ">20", tooltip: `${age} years old` };
  } else {
    return { color: "text-red-800", bgColor: "bg-red-200", label: ">50", tooltip: `${age} years old` };
  }
}

function MandateGrid({ mandates }: { mandates: Mandate[] }) {
  return (
    <div className="grid grid-cols-[130px_1fr_45px_36px_50px_50px_60px_140px_24px] items-center gap-x-3 gap-y-1.5 text-sm">
      {mandates.map((m) => {
        const ageInfo = getAgeIndicator(m.year);
        return (
        <div key={m.symbol} className="contents">
          <DocumentSymbol
            symbol={m.symbol}
            link={m.link}
            title={m.title}
            relevanceCount={m.relevanceCount}
            relevanceIndices={m.relevanceIndices}
            aiComments={m.aiComments}
            entity={m.entity}
            entityLong={m.entityLong}
            allEntities={m.allEntities}
            entityLongMap={m.entityLongMap}
            allEntityRelevance={m.allEntityRelevance}
          />
          <div
            className="cursor-help truncate text-gray-600"
            title={m.title}
          >
            {m.title}
          </div>
          <div className="text-center text-xs text-gray-400">
            {m.year ?? "—"}
          </div>
          <Tooltip content={ageInfo.tooltip}>
            <span className={`cursor-help rounded px-1 py-0.5 text-center text-xs font-medium ${ageInfo.color} ${ageInfo.bgColor}`}>
              {ageInfo.label}
            </span>
          </Tooltip>
          <Tooltip
            content={
              m.relevanceCount > 0
                ? `${m.relevanceCount} paragraph${m.relevanceCount !== 1 ? "s" : ""} relevant to ${m.entity}'s mandate`
                : `No paragraphs identified as relevant to ${m.entity}'s mandate`
            }
          >
            <span className="cursor-help text-center text-xs text-gray-400">
              {m.relevanceCount > 0 ? `${m.relevanceCount}×` : "—"}
            </span>
          </Tooltip>
          <Tooltip
            content={
              m.otherEntitiesCount > 0
                ? `${m.otherEntitiesCount} other entit${m.otherEntitiesCount !== 1 ? "ies" : "y"} also cite${m.otherEntitiesCount === 1 ? "s" : ""} ${m.symbol}`
                : `No other entities cite ${m.symbol}`
            }
          >
            <span className="cursor-help text-center text-xs text-gray-400">
              {m.otherEntitiesCount > 0 ? `+${m.otherEntitiesCount}` : "—"}
            </span>
          </Tooltip>
          {m.action ? (
            <>
              <Tooltip
                content={
                  m.action.type === "DROP"
                    ? "Newer version already cited"
                    : "Newer version available"
                }
              >
                <span
                  className={`inline-block w-14 cursor-help rounded py-0.5 text-center text-xs font-medium ${
                    m.action.type === "DROP"
                      ? "bg-red-50 text-red-600"
                      : "bg-amber-50 text-amber-600"
                  }`}
                >
                  {m.action.type}
                </span>
              </Tooltip>
              <div className="truncate text-xs text-gray-400">
                → {m.action.newerSymbol}
              </div>
              <Tooltip content="Compare documents">
                <a
                  href={`https://mandates.un.org/diff?symbol1=${encodeURIComponent(m.symbol)}&symbol2=${encodeURIComponent(m.action.newerSymbol)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 transition-colors hover:text-un-blue"
                >
                  <GitCompareArrows className="h-3.5 w-3.5" />
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
      })}
    </div>
  );
}

function EntityPanel({
  entity,
  entityLong,
  backgroundMandates,
  legislativeMandates,
  onClose,
  chipRef,
}: {
  entity: string;
  entityLong: string | null;
  backgroundMandates: Mandate[];
  legislativeMandates: Record<string, Mandate[]>;
  onClose: () => void;
  chipRef: HTMLButtonElement | null;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [arrowLeft, setArrowLeft] = useState(24);
  const [filterEntity, setFilterEntity] = useState<string | null>(null);

  useEffect(() => {
    if (chipRef && panelRef.current) {
      const chipRect = chipRef.getBoundingClientRect();
      const panelRect = panelRef.current.getBoundingClientRect();
      setArrowLeft(chipRect.left + chipRect.width / 2 - panelRect.left - 8);
    }
  }, [chipRef]);

  // Combine all mandates
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
    .sort((a, b) => b[1] - a[1]) // Sort by count descending
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
    <div ref={panelRef} className="relative col-span-full mt-2">
      {/* Arrow pointing up */}
      <div
        className="absolute -top-2 h-4 w-4 rotate-45 bg-gray-100"
        style={{ left: `${arrowLeft}px` }}
      />
      <div className="relative rounded-lg bg-gray-100 p-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <span className="font-semibold text-foreground">{entity}</span>
            {entityLong && (
              <span className="ml-2 text-sm text-gray-500">{entityLong}</span>
            )}
            <span className="ml-2 text-xs text-gray-400">
              {filterEntity
                ? `${filteredTotal} of ${totalMandates}`
                : totalMandates}{" "}
              mandates
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 transition-colors hover:bg-gray-200"
          >
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        {/* Co-citing entities filter */}
        {coCitingEntities.length > 0 && (
          <div className="mb-4">
            <div className="mb-1.5 text-xs text-gray-500">
              Co-citing entities
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {coCitingEntities.map(({ entity: e, count }) => (
                <button
                  key={e}
                  onClick={() => setFilterEntity(filterEntity === e ? null : e)}
                  className={`rounded px-2 py-0.5 text-xs transition-colors ${
                    filterEntity === e
                      ? "bg-un-blue text-white"
                      : "bg-white text-gray-600 hover:bg-gray-200"
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
                  className="ml-1 rounded bg-gray-300 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-400"
                >
                  show all mandate documents
                </button>
              )}
            </div>
          </div>
        )}

        <div className="space-y-4">
          {/* Background mandates first */}
          {filteredBackground.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-medium tracking-wide text-gray-500 uppercase">
                Mandates and background
              </h4>
              <MandateGrid mandates={filteredBackground} />
            </div>
          )}

          {/* Legislative mandates */}
          {Object.entries(filteredLegislative)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([subprog, mandates]) => (
              <div key={subprog}>
                <h4 className="mb-2 text-xs font-medium tracking-wide text-gray-500 uppercase">
                  {subprog}
                </h4>
                <MandateGrid mandates={mandates} />
              </div>
            ))}

          {filteredTotal === 0 && filterEntity && (
            <div className="text-sm text-gray-400">
              No mandates match this filter
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EntityBox({
  entity,
  mandateCount,
  isSelected,
  onClick,
  buttonRef,
}: {
  entity: string;
  mandateCount: number;
  isSelected: boolean;
  onClick: () => void;
  buttonRef: (el: HTMLButtonElement | null) => void;
}) {
  return (
    <button
      ref={buttonRef}
      onClick={onClick}
      className={`flex h-10 items-center justify-between gap-2 truncate rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
        isSelected
          ? "bg-un-blue text-white"
          : "bg-gray-200 text-foreground hover:bg-gray-300"
      }`}
    >
      <span className="truncate">{entity}</span>
      <span
        className={`text-xs ${isSelected ? "text-white/70" : "text-gray-400"}`}
      >
        {mandateCount}
      </span>
    </button>
  );
}

function useColumns() {
  const [columns, setColumns] = useState(8);
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      // Must match Tailwind breakpoints: grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8
      if (w >= 1024) setColumns(8);
      else if (w >= 768) setColumns(6);
      else if (w >= 640) setColumns(4);
      else setColumns(3);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return columns;
}

export function EntityOverview({ parts }: Props) {
  const [expandedEntity, setExpandedEntity] = useState<string | null>(null);
  const chipRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const columns = useColumns();

  const toggleEntity = (entityKey: string) => {
    setExpandedEntity((prev) => (prev === entityKey ? null : entityKey));
  };

  return (
    <div className="space-y-8">
      {parts.map((partData) => {
        const entities = partData.entities;
        const selectedIdx = entities.findIndex(
          (e) => `${partData.part}-${e.entity}` === expandedEntity,
        );
        const selectedRowEnd =
          selectedIdx >= 0
            ? Math.ceil((selectedIdx + 1) / columns) * columns
            : -1;
        const expandedData = selectedIdx >= 0 ? entities[selectedIdx] : null;

        return (
          <div key={partData.part}>
            <div className="mb-3 flex items-baseline gap-2">
              {partData.numeral && (
                <span className="text-sm font-medium text-gray-400">
                  {partData.numeral}.
                </span>
              )}
              <span className="text-sm font-medium text-gray-500">
                {partData.part}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
              {entities.map((entityData, idx) => {
                const entityKey = `${partData.part}-${entityData.entity}`;
                const isLastInSelectedRow =
                  idx + 1 === selectedRowEnd ||
                  (idx === entities.length - 1 &&
                    selectedRowEnd > entities.length);
                return (
                  <Fragment key={entityKey}>
                    <EntityBox
                      entity={entityData.entity}
                      mandateCount={
                        entityData.backgroundMandates.length +
                        Object.values(entityData.legislativeMandates).reduce(
                          (sum, arr) => sum + arr.length,
                          0,
                        )
                      }
                      isSelected={expandedEntity === entityKey}
                      onClick={() => toggleEntity(entityKey)}
                      buttonRef={(el) => {
                        chipRefs.current[entityKey] = el;
                      }}
                    />
                    {isLastInSelectedRow && expandedData && (
                      <EntityPanel
                        entity={expandedData.entity}
                        entityLong={expandedData.entityLong}
                        backgroundMandates={expandedData.backgroundMandates}
                        legislativeMandates={expandedData.legislativeMandates}
                        onClose={() => setExpandedEntity(null)}
                        chipRef={chipRefs.current[expandedEntity!]}
                      />
                    )}
                  </Fragment>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
