"use client";

import { useState, useRef } from "react";
import { X } from "lucide-react";
import type { SectionData, Mandate } from "@/types";
import { DocumentSymbol } from "./DocumentSymbol";

interface Props {
  sections: SectionData[];
}

function MandateGrid({ mandates }: { mandates: Mandate[] }) {
  return (
    <div className="grid grid-cols-[160px_1fr_60px_140px] gap-x-3 gap-y-1.5 text-sm items-center">
      {mandates.map((m) => (
        <div key={m.symbol} className="contents">
          <DocumentSymbol
            symbol={m.symbol}
            link={m.link}
            title={m.title}
            paragraphs={m.paragraphs}
          />
          <div className="text-gray-600 truncate">{m.title}</div>
          {m.action ? (
            <>
              <span
                className={`inline-block w-14 text-center text-xs py-0.5 rounded font-medium ${
                  m.action.type === "DROP"
                    ? "bg-red-50 text-red-600"
                    : "bg-amber-50 text-amber-600"
                }`}
              >
                {m.action.type}
              </span>
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
  subprogrammes,
  onClose,
  chipRef,
}: {
  entity: string;
  entityLong: string | null;
  subprogrammes: Record<string, Mandate[]>;
  onClose: () => void;
  chipRef: HTMLButtonElement | null;
}) {
  const totalMandates = Object.values(subprogrammes).reduce(
    (sum, arr) => sum + arr.length,
    0
  );

  return (
    <div className="relative mt-2 col-span-full">
      {/* Arrow pointing up */}
      <div
        className="absolute -top-2 w-4 h-4 bg-gray-100 rotate-45"
        style={{
          left: chipRef
            ? `${chipRef.offsetLeft + chipRef.offsetWidth / 2 - 8}px`
            : "24px",
        }}
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
          {Object.entries(subprogrammes)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([subprog, mandates]) => (
              <div key={subprog}>
                {subprog !== "General" && (
                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                    {subprog}
                  </h4>
                )}
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

export function EntityOverview({ sections }: Props) {
  const [expandedEntity, setExpandedEntity] = useState<string | null>(null);
  const chipRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const toggleEntity = (entityKey: string) => {
    setExpandedEntity((prev) => (prev === entityKey ? null : entityKey));
  };

  return (
    <div className="space-y-8">
      {sections.map((section) => {
        const expandedInSection = section.entities.find(
          (e) => `${section.section}-${e.entity}` === expandedEntity
        );

        return (
          <div key={section.section}>
            <div className="flex items-baseline gap-2 mb-3 text-gray-400">
              <span className="text-sm font-medium">{section.section}</span>
              <span className="text-sm">{section.sectionTitle}</span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
              {section.entities.map((entityData) => {
                const entityKey = `${section.section}-${entityData.entity}`;
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

              {expandedInSection && (
                <EntityPanel
                  entity={expandedInSection.entity}
                  entityLong={expandedInSection.entityLong}
                  subprogrammes={expandedInSection.subprogrammes}
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
