"use client";

import { useState, useCallback, useEffect } from "react";
import { X, ChevronDown, Loader2, Sparkles } from "lucide-react";
import type { Paragraph, EntityRelevance } from "@/types";
import { Tooltip } from "./Tooltip";

interface Props {
  symbol: string;
  link: string | null;
  title?: string;
  relevanceCount: number;
  relevanceIndices: number[];
  aiComments: Record<number, string>;
  entity?: string;
  entityLong?: string | null;
  allEntities?: string[];
  entityLongMap?: Record<string, string>;
  allEntityRelevance: Record<string, EntityRelevance>;
}

function cleanPrefix(prefix: string) {
  return prefix.replace(/[.\(\)\[\]]/g, "").trim();
}

function highlightEntity(text: string, entity?: string, entityLong?: string | null): React.ReactNode {
  if (!entity && !entityLong) return text;
  
  const terms = [entity, entityLong].filter(Boolean) as string[];
  const pattern = new RegExp(`\\b(${terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'gi');
  
  const parts = text.split(pattern);
  if (parts.length === 1) return text;
  
  return parts.map((part, i) => {
    const isMatch = terms.some(t => t.toLowerCase() === part.toLowerCase());
    return isMatch ? <strong key={i} className="text-foreground">{part}</strong> : part;
  });
}

function ParaBox({ 
  p, 
  indent, 
  entity, 
  entityLong,
  aiComment,
}: { 
  p: Paragraph; 
  indent: number; 
  entity?: string; 
  entityLong?: string | null;
  aiComment?: string | null;
}) {
  const label = p.prefix ? cleanPrefix(p.prefix) : null;
  
  return (
    <div style={{ marginLeft: indent }}>
      <div className="rounded-lg p-4 bg-gray-100">
        <div className="flex gap-3">
          {label && (
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-un-blue text-white text-xs font-medium flex items-center justify-center">
              {label}
            </span>
          )}
          <p className="text-gray-700 leading-relaxed flex-1">{highlightEntity(p.text, entity, entityLong)}</p>
          {aiComment && (
            <Tooltip content={aiComment}>
              <Sparkles className="h-4 w-4 text-amber-500 flex-shrink-0 cursor-help" />
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  );
}

function getIndent(p: Paragraph) {
  if (p.paragraph_level && p.paragraph_level > 1) return (p.paragraph_level - 1) * 24;
  if (p.heading_level && p.heading_level > 1) return (p.heading_level - 1) * 16;
  return 0;
}

function CollapsedGap({
  count,
  entity,
  expanded,
  onToggle,
}: {
  count: number;
  entity: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 py-2 w-full"
    >
      <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "" : "-rotate-90"}`} />
      {expanded ? "Hide" : "Show"} {count} paragraph{count !== 1 && "s"} not relevant to {entity}'s mandate
    </button>
  );
}

function FilteredParagraphTree({
  paragraphs,
  relevantIndices,
  aiComments,
  entity,
  entityLong,
}: {
  paragraphs: Paragraph[];
  relevantIndices: Set<number>;
  aiComments: Record<number, string>;
  entity: string;
  entityLong?: string | null;
}) {
  const [expandedGaps, setExpandedGaps] = useState<Set<number>>(new Set());
  const [showPreamble, setShowPreamble] = useState(false);

  const contentIndices = paragraphs.map((p, i) => ({ p, origIdx: i })).filter(({ p }) => p.type !== "frontmatter" && p.text?.trim());
  
  const isRelevant = (origIdx: number) => relevantIndices.has(origIdx);

  const preamble = contentIndices.filter(({ p }) => p.paragraph_type === "preambular");
  const operative = contentIndices.filter(({ p }) => p.paragraph_type !== "preambular");

  type Segment = { type: "relevant" | "gap"; items: { p: Paragraph; origIdx: number }[]; gapIndex?: number };
  const segments: Segment[] = [];
  let gapIndex = 0;
  let pendingHeadings: { p: Paragraph; origIdx: number }[] = [];

  for (const item of operative) {
    const relevant = isRelevant(item.origIdx);

    if (item.p.type === "heading" && !relevant) {
      pendingHeadings.push(item);
    } else if (relevant) {
      const lastSeg = segments[segments.length - 1];
      if (lastSeg?.type === "relevant") {
        lastSeg.items.push(...pendingHeadings, item);
      } else {
        segments.push({ type: "relevant", items: [...pendingHeadings, item] });
      }
      pendingHeadings = [];
    } else {
      const lastSeg = segments[segments.length - 1];
      if (lastSeg?.type === "gap") {
        lastSeg.items.push(...pendingHeadings, item);
      } else {
        segments.push({ type: "gap", items: [...pendingHeadings, item], gapIndex: gapIndex++ });
      }
      pendingHeadings = [];
    }
  }
  if (pendingHeadings.length > 0) {
    const lastSeg = segments[segments.length - 1];
    if (lastSeg?.type === "gap") {
      lastSeg.items.push(...pendingHeadings);
    } else {
      segments.push({ type: "gap", items: pendingHeadings, gapIndex: gapIndex++ });
    }
  }

  const toggleGap = (idx: number) => {
    setExpandedGaps((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const preambleRelevant = preamble.filter(({ origIdx }) => isRelevant(origIdx));

  return (
    <div className="space-y-3">
      {preamble.length > 0 && (
        <>
          <button
            onClick={() => setShowPreamble(!showPreamble)}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 py-2"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${showPreamble ? "" : "-rotate-90"}`} />
            {showPreamble ? "Hide" : "Show"} {preamble.length} preambular paragraph{preamble.length !== 1 && "s"}
            {preambleRelevant.length > 0 && (
              <span className="text-un-blue">({preambleRelevant.length} relevant to {entity}'s mandate)</span>
            )}
          </button>
          {showPreamble && (
            <div className="space-y-3">
              {preamble.map(({ p, origIdx }, i) => (
                <ParaBox 
                  key={`pp-${i}`} 
                  p={p} 
                  indent={getIndent(p)} 
                  entity={entity} 
                  entityLong={entityLong}
                  aiComment={aiComments[origIdx]}
                />
              ))}
            </div>
          )}
        </>
      )}

      {segments.map((seg, i) => {
        if (seg.type === "relevant") {
          return seg.items.map(({ p, origIdx }, j) => {
            if (p.type === "heading") {
              const indent = p.heading_level && p.heading_level > 1 ? (p.heading_level - 1) * 16 : 0;
              return (
                <div key={`seg-${i}-${j}`} style={{ marginLeft: indent }} className={`font-semibold text-foreground ${p.heading_level === 1 ? "text-base mt-4" : "text-sm mt-2"}`}>
                  {p.text}
                </div>
              );
            }
            return (
              <ParaBox 
                key={`seg-${i}-${j}`} 
                p={p} 
                indent={getIndent(p)} 
                entity={entity} 
                entityLong={entityLong}
                aiComment={aiComments[origIdx]}
              />
            );
          });
        }

        const expanded = expandedGaps.has(seg.gapIndex!);
        return (
          <div key={`gap-${seg.gapIndex}`}>
            <CollapsedGap count={seg.items.length} entity={entity} expanded={expanded} onToggle={() => toggleGap(seg.gapIndex!)} />
            {expanded && (
              <div className="space-y-3">
                {seg.items.map(({ p, origIdx }, j) => {
                  if (p.type === "heading") {
                    const indent = p.heading_level && p.heading_level > 1 ? (p.heading_level - 1) * 16 : 0;
                    return (
                      <div key={`gap-${seg.gapIndex}-${j}`} style={{ marginLeft: indent }} className={`font-semibold text-foreground ${p.heading_level === 1 ? "text-base mt-4" : "text-sm mt-2"}`}>
                        {p.text}
                      </div>
                    );
                  }
                  return <ParaBox key={`gap-${seg.gapIndex}-${j}`} p={p} indent={getIndent(p)} entity={entity} entityLong={entityLong} />;
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FullParagraphTree({ paragraphs }: { paragraphs: Paragraph[] }) {
  const [showPreamble, setShowPreamble] = useState(false);

  const content = paragraphs.filter((p) => p.type !== "frontmatter" && p.text?.trim());
  const preamble = content.filter((p) => p.paragraph_type === "preambular");
  const operative = content.filter((p) => p.paragraph_type !== "preambular");

  return (
    <div className="space-y-3">
      {preamble.length > 0 && (
        <>
          <button onClick={() => setShowPreamble(!showPreamble)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 py-2">
            <ChevronDown className={`h-4 w-4 transition-transform ${showPreamble ? "" : "-rotate-90"}`} />
            {showPreamble ? "Hide" : "Show"} {preamble.length} preambular paragraph{preamble.length !== 1 && "s"}
          </button>
          {showPreamble && (
            <div className="space-y-3">
              {preamble.map((p, i) => <ParaBox key={`pp-${i}`} p={p} indent={getIndent(p)} />)}
            </div>
          )}
        </>
      )}

      {operative.map((p, i) => {
        if (p.type === "heading") {
          const indent = p.heading_level && p.heading_level > 1 ? (p.heading_level - 1) * 16 : 0;
          return (
            <div key={`op-${i}`} style={{ marginLeft: indent }} className={`font-semibold text-foreground ${p.heading_level === 1 ? "text-base mt-4" : "text-sm mt-2"}`}>
              {p.text}
            </div>
          );
        }
        if (p.type === "paragraph") {
          return <ParaBox key={`op-${i}`} p={p} indent={getIndent(p)} />;
        }
        return null;
      })}
    </div>
  );
}

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export function DocumentSymbol({
  symbol,
  link,
  title,
  relevanceCount,
  relevanceIndices,
  aiComments,
  entity,
  entityLong,
  allEntities,
  entityLongMap,
  allEntityRelevance,
}: Props) {
  const [open, setOpen] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<string | null>(entity || null);
  const [paragraphs, setParagraphs] = useState<Paragraph[] | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch paragraphs when sidebar opens
  useEffect(() => {
    if (open && !paragraphs && !loading) {
      setLoading(true);
      const safeSymbol = symbol.replace(/\//g, "_").replace(/ /g, "_");
      
      fetch(`${basePath}/data/paragraphs/${safeSymbol}.json`)
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null)
        .then((parasData) => {
          setParagraphs(parasData || []);
          setLoading(false);
        });
    }
  }, [open, paragraphs, loading, symbol]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setOpen(true);
  }, []);

  const isTruncated = symbol.length > 18;
  const displaySymbol = isTruncated ? symbol.slice(0, 18) + "…" : symbol;
  
  const btn = (
    <button
      onClick={handleClick}
      className="w-fit px-2 py-0.5 rounded bg-blue-50 text-un-blue text-xs font-medium hover:bg-blue-100 transition-colors whitespace-nowrap"
    >
      {displaySymbol}
    </button>
  );

  // Compute mention indices for an entity (using both short and long name)
  const computeMentionIndices = (paras: Paragraph[], ent: string, entLong?: string): Set<number> => {
    const terms = [ent];
    if (entLong) terms.push(entLong);
    const pattern = new RegExp(`\\b(${terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'i');
    const indices = new Set<number>();
    paras.forEach((p, i) => {
      if (p.text && p.type !== "heading" && pattern.test(p.text)) indices.add(i);
    });
    return indices;
  };

  // Get relevance for an entity from allEntityRelevance (pre-computed) or compute mentions on-the-fly
  const getEntityRelevance = (paras: Paragraph[], ent: string, entLong?: string): { indices: Set<number>; aiComments: Record<number, string> } => {
    const relevance = allEntityRelevance[ent];
    if (relevance) {
      // Use pre-computed data from augmented JSON
      return {
        indices: new Set(relevance.indices),
        aiComments: relevance.ai_comments || {},
      };
    }
    // Fallback: compute mentions only (no AI comments)
    return {
      indices: computeMentionIndices(paras, ent, entLong),
      aiComments: {},
    };
  };

  // Compute relevance counts for all entities
  const entityRelevanceCounts: Record<string, number> = {};
  if (paragraphs && allEntities) {
    for (const ent of allEntities) {
      const entLong = entityLongMap?.[ent];
      entityRelevanceCounts[ent] = getEntityRelevance(paragraphs, ent, entLong).indices.size;
    }
  }

  const selectedEntityLong = selectedEntity ? entityLongMap?.[selectedEntity] : undefined;
  const selectedRelevance = paragraphs && selectedEntity
    ? getEntityRelevance(paragraphs, selectedEntity, selectedEntityLong)
    : { indices: new Set<number>(), aiComments: {} };

  return (
    <>
      {isTruncated ? <Tooltip content={symbol}>{btn}</Tooltip> : btn}

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/20" onClick={() => setOpen(false)} />

          <div className="relative w-full max-w-lg bg-white shadow-xl flex flex-col h-full">
            <div className="p-4 border-b">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold text-foreground">{symbol}</div>
                  {title && <div className="text-sm text-gray-500 mt-0.5">{title}</div>}
                </div>
                <button onClick={() => setOpen(false)} className="p-1 hover:bg-gray-100 rounded">
                  <X className="h-4 w-4 text-gray-500" />
                </button>
              </div>
              {link && (
                <a href={link} target="_blank" rel="noopener noreferrer" className="inline-block mt-2 text-sm text-un-blue hover:underline">
                  View PDF →
                </a>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {allEntities && allEntities.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs text-gray-500 mb-1.5">Entities citing this document</div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {allEntities.map((e) => {
                      const count = entityRelevanceCounts[e] || 0;
                      return (
                        <button
                          key={e}
                          onClick={() => setSelectedEntity(e)}
                          className={`text-xs px-2 py-0.5 rounded transition-colors ${
                            selectedEntity === e ? "bg-un-blue text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {e} <span className={selectedEntity === e ? "text-white/70" : "text-gray-400"}>({count})</span>
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setSelectedEntity(null)}
                      className={`text-xs px-2 py-0.5 rounded transition-colors ml-1 ${
                        !selectedEntity ? "bg-gray-600 text-white" : "bg-gray-200 text-gray-500 hover:bg-gray-300"
                      }`}
                    >
                      show all paragraphs
                    </button>
                  </div>
                </div>
              )}
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : paragraphs && paragraphs.length > 0 ? (
                selectedEntity ? (
                  <FilteredParagraphTree 
                    paragraphs={paragraphs} 
                    relevantIndices={selectedRelevance.indices} 
                    aiComments={selectedRelevance.aiComments}
                    entity={selectedEntity} 
                    entityLong={selectedEntityLong || null} 
                  />
                ) : (
                  <FullParagraphTree paragraphs={paragraphs} />
                )
              ) : (
                <div className="text-gray-400 text-sm">No paragraph data available</div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
