"use client";

import type { EntityData, PartData } from "@/types";
import { Building2, ChevronRight, Layers, Search, X } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { ExportDropdown } from "./ExportDropdown";

interface Props {
  parts: PartData[];
  userEntity?: string | null;
}

function EntityCard({
  entityData,
  highlight,
}: {
  entityData: EntityData;
  highlight?: boolean;
}) {
  const mandateCount =
    entityData.backgroundMandates.length +
    Object.values(entityData.legislativeMandates).reduce(
      (sum, arr) => sum + arr.length,
      0,
    );

  // Count actions (updates/drops)
  const allMandates = [
    ...entityData.backgroundMandates,
    ...Object.values(entityData.legislativeMandates).flat(),
  ];
  const actionCount = allMandates.filter((m) => m.action).length;

  return (
    <Link
      href={`/entity/${encodeURIComponent(entityData.entity)}`}
      className={`group flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 transition-all hover:shadow-md ${
        highlight
          ? "bg-un-blue/10 ring-2 ring-un-blue/30 hover:bg-un-blue"
          : "bg-gray-100 hover:bg-un-blue"
      }`}
      title={entityData.entityLong || entityData.entity}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-foreground group-hover:text-white">
            {entityData.entity}
          </span>
          <span className="shrink-0 text-xs text-gray-400 group-hover:text-white/70">
            {mandateCount}
          </span>
        </div>
        {entityData.entityLong && (
          <div className="truncate text-xs text-gray-500 group-hover:text-white/70">
            {entityData.entityLong}
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {actionCount > 0 && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-600 group-hover:bg-white/20 group-hover:text-white">
            {actionCount}
          </span>
        )}
        <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-white/70" />
      </div>
    </Link>
  );
}

export function EntityOverview({ parts, userEntity }: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showSections, setShowSections] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("showSections") === "true";
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem("showSections", String(showSections));
  }, [showSections]);

  // Find user's entity data
  const myEntityData = userEntity
    ? parts.flatMap((p) => p.entities).find((e) => e.entity === userEntity)
    : null;

  // Filter parts based on search query
  const filteredParts = searchQuery.trim()
    ? parts
        .map((partData) => ({
          ...partData,
          entities: partData.entities.filter(
            (e) =>
              e.entity.toLowerCase().includes(searchQuery.toLowerCase()) ||
              e.entityLong?.toLowerCase().includes(searchQuery.toLowerCase()),
          ),
        }))
        .filter((partData) => partData.entities.length > 0)
    : parts;

  const totalMatchingEntities = filteredParts.reduce(
    (sum, part) => sum + part.entities.length,
    0,
  );

  // Group entities by section within each part
  const groupEntitiesBySection = (entities: EntityData[]) => {
    const grouped: Record<
      string,
      { title: string | null; entities: EntityData[] }
    > = {};
    for (const entity of entities) {
      const key = entity.section || "_none";
      if (!grouped[key]) {
        grouped[key] = { title: entity.sectionTitle, entities: [] };
      }
      grouped[key].entities.push(entity);
    }
    // Sort sections by section number, _none at end
    return Object.entries(grouped).sort(([a], [b]) => {
      if (a === "_none") return 1;
      if (b === "_none") return -1;
      return a.localeCompare(b, undefined, { numeric: true });
    });
  };

  return (
    <div className="space-y-6">
      {/* My Entity card - shown for non-reviewer users */}
      {myEntityData && !searchQuery && (
        <div className="mb-8">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-un-blue">
            <Building2 className="h-4 w-4" />
            My Entity
          </div>
          <div className="max-w-xs">
            <EntityCard entityData={myEntityData} highlight />
          </div>
        </div>
      )}

      {/* Search box and controls */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-80">
            <div className="relative">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search entities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-gray-300 py-2 pr-4 pl-10 text-sm focus:border-un-blue focus:ring-1 focus:ring-un-blue focus:outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {searchQuery && (
              <div className="mt-2 text-xs text-gray-500">
                Found {totalMatchingEntities} entit
                {totalMatchingEntities !== 1 ? "ies" : "y"}
              </div>
            )}
          </div>
          <button
            onClick={() => setShowSections(!showSections)}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              showSections
                ? "bg-un-blue text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
            title="Group entities by budget section"
          >
            <Layers className="h-4 w-4" />
            View Sections
          </button>
        </div>
        <ExportDropdown label="Export All" />
      </div>

      {filteredParts.map((partData) => (
        <div key={partData.part}>
          <div className="mb-3 flex items-baseline gap-1.5">
            {partData.numeral && (
              <span className="text-base font-medium text-gray-400">
                PART {partData.numeral}.
              </span>
            )}
            <span className="text-base font-semibold text-gray-600">
              {partData.part}
            </span>
          </div>

          {showSections ? (
            // Grouped by section
            <div className="space-y-4">
              {groupEntitiesBySection(partData.entities).map(
                ([sectionKey, { title, entities }]) => (
                  <div key={sectionKey}>
                    {sectionKey !== "_none" && (
                      <div className="mb-2 ml-1 flex items-baseline gap-1.5">
                        <span className="text-sm font-medium text-gray-400">
                          Section {sectionKey}.
                        </span>
                        {title && (
                          <span className="text-sm font-medium text-gray-500">
                            {title}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                      {entities.map((entityData) => (
                        <EntityCard
                          key={entityData.entity}
                          entityData={entityData}
                          highlight={userEntity === entityData.entity}
                        />
                      ))}
                    </div>
                  </div>
                ),
              )}
            </div>
          ) : (
            // Flat list
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {partData.entities.map((entityData) => (
                <EntityCard
                  key={entityData.entity}
                  entityData={entityData}
                  highlight={userEntity === entityData.entity}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
