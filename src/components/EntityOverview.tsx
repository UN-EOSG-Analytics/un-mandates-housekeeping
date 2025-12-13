"use client";

import { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";
import type { PartData, Mandate } from "@/types";
import { DocumentSymbol } from "./DocumentSymbol";
import { Tooltip } from "./Tooltip";

interface Props {
  parts: PartData[];
}

function MandateGrid({ mandates }: { mandates: Mandate[] }) {
  return (
    <div className="grid grid-cols-[130px_1fr_50px_60px_140px] gap-x-3 gap-y-1.5 text-sm items-center">
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

  useEffect(() => {
    if (chipRef && panelRef.current) {
      const chipRect = chipRef.getBoundingClientRect();
      const panelRect = panelRef.current.getBoundingClientRect();
      setArrowLeft(chipRect.left + chipRect.width / 2 - panelRect.left - 8);
    }
  }, [chipRef]);

  const totalMandates =
    backgroundMandates.length +
    Object.values(legislativeMandates).reduce((sum, arr) => sum + arr.length, 0);

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
              {totalMandates} mandates
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
          >
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>
        <div className="space-y-4">
          {/* Background mandates first */}
          {backgroundMandates.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Mandates and background
              </h4>
              <MandateGrid mandates={backgroundMandates} />
            </div>
          )}

          {/* Legislative mandates */}
          {Object.entries(legislativeMandates)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([subprog, mandates]) => (
              <div key={subprog}>
                <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  {subprog}
                </h4>
                <MandateGrid mandates={mandates} />
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

function EntityBox({
  entity,
  isSelected,
  onClick,
  buttonRef,
}: {
  entity: string;
  isSelected: boolean;
  onClick: () => void;
  buttonRef: (el: HTMLButtonElement | null) => void;
}) {
  return (
    <button
      ref={buttonRef}
      onClick={onClick}
      className={`px-3 py-2 h-10 rounded-lg text-sm font-medium text-left transition-colors truncate ${
        isSelected
          ? "bg-un-blue text-white"
          : "bg-gray-200 hover:bg-gray-300 text-foreground"
      }`}
    >
      {entity}
    </button>
  );
}

export function EntityOverview({ parts }: Props) {
  const [expandedEntity, setExpandedEntity] = useState<string | null>(null);
  const chipRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const toggleEntity = (entityKey: string) => {
    setExpandedEntity((prev) => (prev === entityKey ? null : entityKey));
  };

  return (
    <div className="space-y-8">
      {parts.map((partData) => {
        const expandedInPart = partData.entities.find(
          (e) => `${partData.part}-${e.entity}` === expandedEntity
        );

        return (
          <div key={partData.part}>
            <div className="mb-3 flex items-baseline gap-2">
              {partData.numeral && (
                <span className="text-sm font-medium text-gray-400">{partData.numeral}.</span>
              )}
              <span className="text-sm font-medium text-gray-500">{partData.part}</span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
              {partData.entities.map((entityData) => {
                const entityKey = `${partData.part}-${entityData.entity}`;
                return (
                  <EntityBox
                    key={entityKey}
                    entity={entityData.entity}
                    isSelected={expandedEntity === entityKey}
                    onClick={() => toggleEntity(entityKey)}
                    buttonRef={(el) => {
                      chipRefs.current[entityKey] = el;
                    }}
                  />
                );
              })}

              {expandedInPart && (
                <EntityPanel
                  entity={expandedInPart.entity}
                  entityLong={expandedInPart.entityLong}
                  backgroundMandates={expandedInPart.backgroundMandates}
                  legislativeMandates={expandedInPart.legislativeMandates}
                  onClose={() => setExpandedEntity(null)}
                  chipRef={chipRefs.current[expandedEntity!]}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
