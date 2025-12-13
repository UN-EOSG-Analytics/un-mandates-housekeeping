"use client";

import { useState, useRef, useEffect, Fragment } from "react";
import { X } from "lucide-react";
import type { PartData, Mandate } from "@/types";
import { DocumentSymbol } from "./DocumentSymbol";
import { Tooltip } from "./Tooltip";

interface Props {
  parts: PartData[];
}

function MandateGrid({ mandates }: { mandates: Mandate[] }) {
  return (
    <div className="grid grid-cols-[130px_1fr_50px_50px_60px_140px] gap-x-3 gap-y-1.5 text-sm items-center">
      {mandates.map((m) => (
          <div key={m.symbol} className="contents">
            <DocumentSymbol
              symbol={m.symbol}
              link={m.link}
              title={m.title}
              mentionCount={m.mentionCount}
              mentionIndices={m.mentionIndices}
              entity={m.entity}
              entityLong={m.entityLong}
              allEntities={m.allEntities}
              entityLongMap={m.entityLongMap}
            />
            <div className="text-gray-600 truncate">{m.title}</div>
            <Tooltip
              content={
                m.mentionCount > 0
                  ? `${m.mentionCount} mention${m.mentionCount !== 1 ? "s" : ""} of ${m.entity} in ${m.symbol}`
                  : `No mentions of ${m.entity} in ${m.symbol}`
              }
            >
              <span className="text-gray-400 text-xs text-center cursor-help">
                {m.mentionCount > 0 ? `${m.mentionCount}×` : "—"}
              </span>
            </Tooltip>
            <Tooltip
              content={
                m.otherEntitiesCount > 0
                  ? `${m.otherEntitiesCount} other entit${m.otherEntitiesCount !== 1 ? "ies" : "y"} also cite${m.otherEntitiesCount === 1 ? "s" : ""} ${m.symbol}`
                  : `No other entities cite ${m.symbol}`
              }
            >
              <span className="text-gray-400 text-xs text-center cursor-help">
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
                    className={`inline-block w-14 text-center text-xs py-0.5 rounded font-medium cursor-help ${
                      m.action.type === "DROP"
                        ? "bg-red-50 text-red-600"
                        : "bg-amber-50 text-amber-600"
                    }`}
                  >
                    {m.action.type}
                  </span>
                </Tooltip>
                <div className="text-gray-400 truncate text-xs">
                  → {m.action.newerSymbol}
                </div>
              </>
            ) : (
              <>
                <div />
                <div />
              </>
            )}
          </div>
        ))}
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
    Object.values(legislativeMandates).reduce((sum, arr) => sum + arr.length, 0);
  const filteredTotal =
    filteredBackground.length +
    Object.values(filteredLegislative).reduce((sum, arr) => sum + arr.length, 0);

  return (
    <div ref={panelRef} className="relative mt-2 col-span-full">
      {/* Arrow pointing up */}
      <div
        className="absolute -top-2 w-4 h-4 bg-gray-100 rotate-45"
        style={{ left: `${arrowLeft}px` }}
      />
      <div className="bg-gray-100 rounded-lg p-4 relative">
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="font-semibold text-foreground">{entity}</span>
            {entityLong && (
              <span className="text-sm text-gray-500 ml-2">{entityLong}</span>
            )}
            <span className="text-xs text-gray-400 ml-2">
              {filterEntity ? `${filteredTotal} of ${totalMandates}` : totalMandates} mandates
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
          >
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        {/* Co-citing entities filter */}
        {coCitingEntities.length > 0 && (
          <div className="mb-4">
            <div className="text-xs text-gray-500 mb-1.5">Co-citing entities</div>
            <div className="flex flex-wrap items-center gap-1.5">
              {coCitingEntities.map(({ entity: e, count }) => (
                <button
                  key={e}
                  onClick={() => setFilterEntity(filterEntity === e ? null : e)}
                  className={`text-xs px-2 py-0.5 rounded transition-colors ${
                    filterEntity === e ? "bg-un-blue text-white" : "bg-white text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {e} <span className={filterEntity === e ? "text-white/70" : "text-gray-400"}>({count})</span>
                </button>
              ))}
              {filterEntity && (
                <button
                  onClick={() => setFilterEntity(null)}
                  className="text-xs px-2 py-0.5 rounded bg-gray-300 text-gray-600 hover:bg-gray-400 ml-1"
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
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
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
                <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  {subprog}
                </h4>
                <MandateGrid mandates={mandates} />
              </div>
            ))}

          {filteredTotal === 0 && filterEntity && (
            <div className="text-sm text-gray-400">No mandates match this filter</div>
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
      className={`px-3 py-2 h-10 rounded-lg text-sm font-medium text-left transition-colors truncate flex items-center justify-between gap-2 ${
        isSelected
          ? "bg-un-blue text-white"
          : "bg-gray-200 hover:bg-gray-300 text-foreground"
      }`}
    >
      <span className="truncate">{entity}</span>
      <span className={`text-xs ${isSelected ? "text-white/70" : "text-gray-400"}`}>{mandateCount}</span>
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
        const selectedIdx = entities.findIndex((e) => `${partData.part}-${e.entity}` === expandedEntity);
        const selectedRowEnd = selectedIdx >= 0 ? Math.ceil((selectedIdx + 1) / columns) * columns : -1;
        const expandedData = selectedIdx >= 0 ? entities[selectedIdx] : null;

        return (
          <div key={partData.part}>
            <div className="mb-3 flex items-baseline gap-2">
              {partData.numeral && (
                <span className="text-sm font-medium text-gray-400">{partData.numeral}.</span>
              )}
              <span className="text-sm font-medium text-gray-500">{partData.part}</span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
              {entities.map((entityData, idx) => {
                const entityKey = `${partData.part}-${entityData.entity}`;
                const isLastInSelectedRow = idx + 1 === selectedRowEnd || (idx === entities.length - 1 && selectedRowEnd > entities.length);
                return (
                  <Fragment key={entityKey}>
                    <EntityBox
                      entity={entityData.entity}
                      mandateCount={entityData.backgroundMandates.length + Object.values(entityData.legislativeMandates).reduce((sum, arr) => sum + arr.length, 0)}
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
