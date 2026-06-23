"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import {
  pairKey,
  type MatrixData,
} from "@/features/mandates/heatmap/matrix-utils";
import {
  CURATED_ENTITIES,
  SECTION_META,
  SECTION_ORDER,
  CROSS_SECTION_COLOR,
  getCuratedEntity,
  type Section,
} from "@/features/mandates/heatmap/entity-sections";
import {
  sequentialColor,
  divergingColor,
  tint,
} from "@/features/mandates/heatmap/color-scale";

export type LayerId =
  | "v2026"
  | "v2027"
  | "delta"
  | "projected"
  | "projectedDelta";

interface LayerDef {
  id: LayerId;
  label: string;
  kind: "sequential" | "diverging";
  description: string;
}

const LAYERS: LayerDef[] = [
  {
    id: "v2026",
    label: "2026",
    kind: "sequential",
    description: "Shared mandates per entity pair in the PPB 2026 source data.",
  },
  {
    id: "v2027",
    label: "2027",
    kind: "sequential",
    description: "Shared mandates per entity pair in the PPB 2027 fascicle.",
  },
  {
    id: "delta",
    label: "Δ 2027 − 2026",
    kind: "diverging",
    description:
      "Change from 2026 to 2027. Green = overlap reduced (cleaner), red = overlap grew.",
  },
  {
    id: "projected",
    label: "After decisions",
    kind: "sequential",
    description:
      "2026 source data after applying reviewers' housekeeping decisions (remove/add).",
  },
  {
    id: "projectedDelta",
    label: "Δ decisions",
    kind: "diverging",
    description:
      "Impact of housekeeping decisions on 2026 overlap. Green = reduced, red = increased.",
  },
];

export interface HeatmapPayload {
  layers: Record<LayerId, MatrixData>;
}

interface OrderedEntity {
  code: string;
  label: string;
  section: Section;
}

const CELL = 18;
const COLHEAD_H = 62; // top label gutter height
const LABEL_W = COLHEAD_H; // left label gutter width — kept equal to the header height

export function HeatmapMatrix({ layers }: HeatmapPayload) {
  const [layerId, setLayerId] = useState<LayerId>("v2026");
  const [showAll, setShowAll] = useState(false);
  const [hover, setHover] = useState<{
    a: OrderedEntity;
    b: OrderedEntity;
    value: number;
  } | null>(null);

  const layer = LAYERS.find((l) => l.id === layerId)!;
  const matrix = layers[layerId];
  const isDiff = layer.kind === "diverging";

  // Ordered entity list for the current mode.
  const entities = useMemo<OrderedEntity[]>(() => {
    if (!showAll) {
      return CURATED_ENTITIES.map((e) => ({
        code: e.code,
        label: e.label,
        section: e.section,
      }));
    }
    // "All" mode: union of every entity code across all layers.
    const codes = new Set<string>();
    for (const id of Object.keys(layers) as LayerId[]) {
      for (const c of layers[id].entities) codes.add(c);
    }
    const curatedIndex = new Map(
      CURATED_ENTITIES.map((e, i) => [e.code, i] as const),
    );
    return [...codes]
      .map<OrderedEntity>((code) => {
        const cur = getCuratedEntity(code);
        return cur
          ? { code, label: cur.label, section: cur.section }
          : { code, label: code, section: "other" };
      })
      .sort((x, y) => {
        const sx = SECTION_ORDER.indexOf(x.section);
        const sy = SECTION_ORDER.indexOf(y.section);
        if (sx !== sy) return sx - sy;
        const cx = curatedIndex.get(x.code) ?? Infinity;
        const cy = curatedIndex.get(y.code) ?? Infinity;
        if (cx !== cy) return cx - cy;
        return x.code.localeCompare(y.code);
      });
  }, [showAll, layers]);

  // Scale reference. Diverging layers use a single max-abs (cross-block
  // comparable). Sequential layers normalize PER colour group — each section
  // block against its own max, cross-section greys against theirs — so the
  // smaller clusters stay vivid instead of being washed out by Development's
  // large counts (matches the figure's per-block saturation).
  const scaleRef = useMemo(() => {
    if (isDiff) {
      let maxAbs = 0;
      for (let i = 0; i < entities.length; i++) {
        for (let j = i + 1; j < entities.length; j++) {
          const v =
            matrix.pairs[pairKey(entities[i].code, entities[j].code)] ?? 0;
          maxAbs = Math.max(maxAbs, Math.abs(v));
        }
      }
      return { maxAbs, perSection: {} as Record<string, number>, cross: 0 };
    }
    const perSection: Record<string, number> = {};
    let cross = 0;
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const a = entities[i];
        const b = entities[j];
        const v = matrix.pairs[pairKey(a.code, b.code)] ?? 0;
        if (a.section === b.section && a.section !== "other") {
          perSection[a.section] = Math.max(perSection[a.section] ?? 0, v);
        } else {
          cross = Math.max(cross, v);
        }
      }
    }
    return { maxAbs: 0, perSection, cross };
  }, [entities, matrix, isDiff]);

  // Contiguous section runs for the band header.
  const bands = useMemo(() => {
    const runs: { section: Section; count: number }[] = [];
    for (const e of entities) {
      const last = runs[runs.length - 1];
      if (last && last.section === e.section) last.count++;
      else runs.push({ section: e.section, count: 1 });
    }
    return runs;
  }, [entities]);

  function cellColor(a: OrderedEntity, b: OrderedEntity, value: number) {
    if (isDiff) return divergingColor(value, scaleRef.maxAbs);
    const sameSection = a.section === b.section && a.section !== "other";
    return sameSection
      ? sequentialColor(
          value,
          scaleRef.perSection[a.section] ?? 0,
          SECTION_META[a.section].baseColor,
        )
      : sequentialColor(value, scaleRef.cross, CROSS_SECTION_COLOR);
  }

  return (
    <div>
      {/* Controls */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex overflow-hidden rounded-md border border-gray-200">
          {LAYERS.map((l) => (
            <button
              key={l.id}
              onClick={() => setLayerId(l.id)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                l.id === layerId
                  ? "bg-un-blue text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
        <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-gray-700">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => setShowAll(e.target.checked)}
            className="h-3.5 w-3.5"
          />
          Show all entities ({entities.length})
        </label>
        <a
          href="/api/export/heatmap"
          download
          className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-all hover:border-gray-300 hover:bg-gray-50 hover:shadow-sm"
        >
          <Download className="h-3.5 w-3.5" />
          Export Excel
        </a>
      </div>

      <p className="mb-3 max-w-3xl text-sm text-gray-500">{layer.description}</p>

      {/* Hover status bar */}
      <div className="mb-2 h-5 text-xs text-gray-600">
        {hover ? (
          <span>
            <span className="font-medium text-gray-900">{hover.a.label}</span>
            {" ↔ "}
            <span className="font-medium text-gray-900">{hover.b.label}</span>
            {" — "}
            {isDiff
              ? `${hover.value > 0 ? "+" : ""}${hover.value} change`
              : `${hover.value} shared mandate${hover.value === 1 ? "" : "s"}`}
          </span>
        ) : (
          <span className="text-gray-400">Hover a cell for details</span>
        )}
      </div>

      {/* Matrix */}
      <div className="overflow-x-auto pb-4">
        <div className="inline-block select-none">
          {/* Section bands — coloured underline spans the section's columns;
              the centred label is allowed to overflow (never truncated), like
              the PDF, without pushing neighbouring bands. */}
          <div
            className="relative flex items-end"
            style={{ marginLeft: LABEL_W, height: 30 }}
          >
            {bands.map((b, i) => (
              <div
                key={i}
                className="relative h-full"
                style={{ width: b.count * CELL }}
              >
                {/* Label constrained to the band width: multi-word labels wrap
                    (e.g. Humanitarian → two lines); short un-wrappable ones
                    (H/R, Legal) overflow centred into empty space. */}
                <span
                  className="absolute bottom-1 left-0 w-full text-center text-[11px] font-semibold leading-[1.05]"
                  style={{
                    color: SECTION_META[b.section].baseColor,
                    hyphens: "manual",
                  }}
                >
                  {SECTION_META[b.section].label}
                </span>
                <div
                  className="absolute bottom-0 left-0 w-full border-b-2"
                  style={{ borderColor: SECTION_META[b.section].baseColor }}
                />
              </div>
            ))}
          </div>

          {/* Column labels */}
          <div className="flex items-end">
            <div
              className="flex items-end justify-start pr-1 text-[10px] font-semibold text-gray-500"
              style={{ width: LABEL_W, height: COLHEAD_H }}
            >
              Cross-citation
            </div>
            {entities.map((e) => (
              <div
                key={e.code}
                className="flex items-end justify-center"
                style={{
                  width: CELL,
                  height: COLHEAD_H,
                  backgroundColor: tint(SECTION_META[e.section].baseColor),
                  borderRight: "1px solid rgba(255,255,255,0.7)",
                }}
              >
                <span
                  className="py-1 text-[10px] text-gray-700"
                  style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                >
                  {e.label}
                </span>
              </div>
            ))}
          </div>

          {/* Rows */}
          {entities.map((rowE) => (
            <div key={rowE.code} className="flex items-center">
              <div
                className="truncate px-1 text-right text-[10px] leading-4.5 text-gray-700"
                style={{
                  width: LABEL_W,
                  height: CELL,
                  backgroundColor: tint(SECTION_META[rowE.section].baseColor),
                  borderBottom: "1px solid rgba(255,255,255,0.7)",
                }}
                title={rowE.code}
              >
                {rowE.label}
              </div>
              {entities.map((colE) => {
                const isDiagonal = rowE.code === colE.code;
                const value = isDiagonal
                  ? 0
                  : matrix.pairs[pairKey(rowE.code, colE.code)] ?? 0;
                const bg = isDiagonal ? null : cellColor(rowE, colE, value);
                return (
                  <div
                    key={colE.code}
                    onMouseEnter={() =>
                      !isDiagonal && setHover({ a: rowE, b: colE, value })
                    }
                    title={
                      isDiagonal
                        ? rowE.label
                        : `${rowE.label} ↔ ${colE.label}: ${value}`
                    }
                    style={{
                      width: CELL,
                      height: CELL,
                      backgroundColor: bg ?? (isDiagonal ? "#f9fafb" : "#fff"),
                      outline: "0.5px solid rgba(0,0,0,0.04)",
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-gray-600">
        {isDiff ? (
          <>
            <LegendSwatch color="rgb(22,163,74)" label="Overlap reduced" />
            <LegendSwatch color="rgb(220,38,38)" label="Overlap grew" />
            <span className="text-gray-400">Intensity = magnitude of change</span>
          </>
        ) : (
          <>
            {SECTION_ORDER.filter((s) =>
              bands.some((b) => b.section === s),
            ).map((s) => (
              <LegendSwatch
                key={s}
                color={SECTION_META[s].baseColor}
                label={SECTION_META[s].label}
              />
            ))}
            <LegendSwatch color={CROSS_SECTION_COLOR} label="Cross-section" />
            <span className="text-gray-400">
              Intensity = number of shared mandates
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-3 w-3 rounded-sm"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}
