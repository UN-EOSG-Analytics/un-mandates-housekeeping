"use client";

import { useState } from "react";
import Link from "next/link";
import { X, Search, ChevronRight } from "lucide-react";
import type { PartData, EntityData } from "@/types";

interface Props {
  parts: PartData[];
}

function EntityCard({ entityData }: { entityData: EntityData }) {
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
      className="group flex items-center justify-between gap-2 rounded-lg bg-gray-100 px-3 py-2.5 transition-all hover:bg-un-blue hover:shadow-md"
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground group-hover:text-white">
          {entityData.entity}
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
        <span className="text-xs text-gray-400 group-hover:text-white/70">
          {mandateCount}
        </span>
        <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-white/70" />
      </div>
    </Link>
  );
}

export function EntityOverview({ parts }: Props) {
  const [searchQuery, setSearchQuery] = useState("");

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

  return (
    <div className="space-y-6">
      {/* Search box */}
      <div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search entities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-un-blue focus:outline-none focus:ring-1 focus:ring-un-blue"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
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

      {filteredParts.map((partData) => (
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

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {partData.entities.map((entityData) => (
              <EntityCard key={entityData.entity} entityData={entityData} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
