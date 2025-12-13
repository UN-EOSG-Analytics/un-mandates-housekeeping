"use client";

import { useState, useCallback } from "react";
import { X, ChevronDown } from "lucide-react";
import type { Paragraph } from "@/types";
import { Tooltip } from "./Tooltip";

interface Props {
  symbol: string;
  link: string | null;
  title?: string;
  paragraphs?: Paragraph[];
  mentioningParagraphs?: Paragraph[];
  entity?: string;
  entityLong?: string | null;
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

function ParaBox({ p, indent, entity, entityLong }: { p: Paragraph; indent: number; entity?: string; entityLong?: string | null }) {
  const label = p.prefix ? cleanPrefix(p.prefix) : null;
  return (
    <div className="bg-gray-100 rounded-lg p-4" style={{ marginLeft: indent }}>
      <div className="flex gap-3">
        {label && (
          <span className="flex-shrink-0 w-7 h-7 rounded-full bg-un-blue text-white text-xs font-medium flex items-center justify-center">
            {label}
          </span>
        )}
        <p className="text-gray-700 leading-relaxed">{highlightEntity(p.text, entity, entityLong)}</p>
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
      {expanded ? "Hide" : "Show"} {count} paragraph{count !== 1 && "s"} without mention of {entity}
    </button>
  );
}

function FilteredParagraphTree({
  paragraphs,
  mentioningParagraphs,
  entity,
  entityLong,
}: {
  paragraphs: Paragraph[];
  mentioningParagraphs: Paragraph[];
  entity: string;
  entityLong?: string | null;
}) {
  const [expandedGaps, setExpandedGaps] = useState<Set<number>>(new Set());
  const [showPreamble, setShowPreamble] = useState(false);

  const content = paragraphs.filter((p) => p.type !== "frontmatter" && p.text?.trim());
  
  // Create set of mentioning paragraph texts for fast lookup
  const mentioningTexts = new Set(mentioningParagraphs.map((p) => p.text));
  const isMentioning = (p: Paragraph) => mentioningTexts.has(p.text);

  // Split preambular vs operative
  const preamble = content.filter((p) => p.paragraph_type === "preambular");
  const operative = content.filter((p) => p.paragraph_type !== "preambular");

  // Group operative paragraphs into segments: mentioning vs gaps
  // Headings attach to the next mentioning paragraph, otherwise go into gap
  type Segment = { type: "mentioning" | "gap"; paras: Paragraph[]; gapIndex?: number };
  const segments: Segment[] = [];
  let gapIndex = 0;
  let pendingHeadings: Paragraph[] = [];

  for (const p of operative) {
    const mentions = isMentioning(p);

    if (p.type === "heading") {
      pendingHeadings.push(p);
    } else if (mentions) {
      // Flush pending headings into mentioning segment
      const lastSeg = segments[segments.length - 1];
      if (lastSeg?.type === "mentioning") {
        lastSeg.paras.push(...pendingHeadings, p);
      } else {
        segments.push({ type: "mentioning", paras: [...pendingHeadings, p] });
      }
      pendingHeadings = [];
    } else {
      // Non-mentioning paragraph - flush headings into gap
      const lastSeg = segments[segments.length - 1];
      if (lastSeg?.type === "gap") {
        lastSeg.paras.push(...pendingHeadings, p);
      } else {
        segments.push({ type: "gap", paras: [...pendingHeadings, p], gapIndex: gapIndex++ });
      }
      pendingHeadings = [];
    }
  }
  // Flush any remaining headings at end
  if (pendingHeadings.length > 0) {
    const lastSeg = segments[segments.length - 1];
    if (lastSeg?.type === "gap") {
      lastSeg.paras.push(...pendingHeadings);
    } else {
      segments.push({ type: "gap", paras: pendingHeadings, gapIndex: gapIndex++ });
    }
  }

  const toggleGap = (idx: number) => {
    setExpandedGaps((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  // Check if any preamble mentions the entity
  const preambleMentions = preamble.filter(isMentioning);
  const preambleGaps = preamble.filter((p) => !isMentioning(p));

  return (
    <div className="space-y-3">
      {/* Preambular section */}
      {preamble.length > 0 && (
        <>
          <button
            onClick={() => setShowPreamble(!showPreamble)}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 py-2"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${showPreamble ? "" : "-rotate-90"}`} />
            {showPreamble ? "Hide" : "Show"} {preamble.length} preambular paragraph
            {preamble.length !== 1 && "s"}
            {preambleMentions.length > 0 && (
              <span className="text-un-blue">({preambleMentions.length} mentioning {entity})</span>
            )}
          </button>
          {showPreamble && (
            <div className="space-y-3">
              {preamble.map((p, i) => <ParaBox key={`pp-${i}`} p={p} indent={getIndent(p)} entity={entity} entityLong={entityLong} />)}
            </div>
          )}
        </>
      )}

      {/* Operative segments */}
      {segments.map((seg, i) => {
        if (seg.type === "mentioning") {
          return seg.paras.map((p, j) => {
            if (p.type === "heading") {
              const indent = p.heading_level && p.heading_level > 1 ? (p.heading_level - 1) * 16 : 0;
              return (
                <div
                  key={`seg-${i}-${j}`}
                  style={{ marginLeft: indent }}
                  className={`font-semibold text-foreground ${
                    p.heading_level === 1 ? "text-base mt-4" : "text-sm mt-2"
                  }`}
                >
                  {p.text}
                </div>
              );
            }
            return <ParaBox key={`seg-${i}-${j}`} p={p} indent={getIndent(p)} entity={entity} entityLong={entityLong} />;
          });
        }

        // Gap segment
        const expanded = expandedGaps.has(seg.gapIndex!);
        return (
          <div key={`gap-${seg.gapIndex}`}>
            <CollapsedGap
              count={seg.paras.length}
              entity={entity}
              expanded={expanded}
              onToggle={() => toggleGap(seg.gapIndex!)}
            />
            {expanded && (
              <div className="space-y-3">
                {seg.paras.map((p, j) => {
                  if (p.type === "heading") {
                    const indent = p.heading_level && p.heading_level > 1 ? (p.heading_level - 1) * 16 : 0;
                    return (
                      <div
                        key={`gap-${seg.gapIndex}-${j}`}
                        style={{ marginLeft: indent }}
                        className={`font-semibold text-foreground ${p.heading_level === 1 ? "text-base mt-4" : "text-sm mt-2"}`}
                      >
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
          <button
            onClick={() => setShowPreamble(!showPreamble)}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 py-2"
          >
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
            <div
              key={`op-${i}`}
              style={{ marginLeft: indent }}
              className={`font-semibold text-foreground ${p.heading_level === 1 ? "text-base mt-4" : "text-sm mt-2"}`}
            >
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

export function DocumentSymbol({
  symbol,
  link,
  title,
  paragraphs,
  mentioningParagraphs,
  entity,
  entityLong,
}: Props) {
  const [open, setOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"entity" | "all">("entity");

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (paragraphs?.length) {
        e.preventDefault();
        setOpen(true);
      }
    },
    [paragraphs]
  );

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
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-2 text-sm text-un-blue hover:underline"
                >
                  View PDF →
                </a>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {/* View mode toggle */}
              {entity && paragraphs?.length && (
                <div className="flex items-center gap-3 mb-4">
                  <button
                    onClick={() => setViewMode(viewMode === "entity" ? "all" : "entity")}
                    className={`relative flex-shrink-0 w-9 h-5 rounded-full transition-colors ${
                      viewMode === "entity" ? "bg-un-blue" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                        viewMode === "entity" ? "right-0.5" : "left-0.5"
                      }`}
                    />
                  </button>
                  <span className="text-sm text-gray-600">
                    {viewMode === "entity" ? `Filtered for ${entity}` : "Showing all paragraphs"}
                  </span>
                </div>
              )}
              {paragraphs?.length ? (
                viewMode === "entity" && entity ? (
                  <FilteredParagraphTree
                    paragraphs={paragraphs}
                    mentioningParagraphs={mentioningParagraphs || []}
                    entity={entity}
                    entityLong={entityLong}
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
