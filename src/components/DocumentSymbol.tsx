// Modal is client-side
"use client";

import { getAgeIndicator } from "@/lib/services/age-indicator";
import { fetchParagraphs } from "@/lib/services/client/client-data-service";
import { getDocumentDecisionsAction } from "@/lib/services/housekeeping-actions";
import type {
  Decision,
  EntityRelevance,
  MandateComment,
  MandateDecision,
  MandateState,
  Paragraph,
} from "@/types";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Loader2,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Tooltip } from "./Tooltip";
import { DecisionDropdown } from "./DecisionDropdown";

interface Props {
  symbol: string;
  link: string | null;
  title?: string;
  year?: number | null;
  body?: string | null;
  docType?: string | null;
  otherEntitiesCount?: number;
  relevanceCount: number;
  relevanceIndices: number[];
  aiComments: Record<number, string>;
  entity?: string;
  entityLong?: string | null;
  allEntities?: string[];
  entitySubprogrammes?: Record<string, string[]>; // entity -> subprogrammes from PPB
  entityLongMap?: Record<string, string>;
  allEntityRelevance: Record<string, EntityRelevance>;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  state?: MandateState;
  isReviewer?: boolean;
  userEmail?: string | null;
  userEntity?: string | null;
  isFoundational?: boolean;
  onDecision?: (decision: Decision, newSymbol?: string) => void;
  onApprove?: (decisionId: string, approved: boolean) => void;
  onComment?: (comment: string) => void;
  onUpdateClick?: () => void; // Called when user selects "update" from sidebar
  metadataFromDb?: boolean;
}

function cleanPrefix(prefix: string) {
  return prefix.replace(/[.\(\)\[\]]/g, "").trim();
}

function highlightEntity(
  text: string,
  entity?: string,
  entityLong?: string | null,
): React.ReactNode {
  if (!entity && !entityLong) return text;

  const terms = [entity, entityLong].filter(Boolean) as string[];
  const pattern = new RegExp(
    `\\b(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`,
    "gi",
  );

  const parts = text.split(pattern);
  if (parts.length === 1) return text;

  return parts.map((part, i) => {
    const isMatch = terms.some((t) => t.toLowerCase() === part.toLowerCase());
    return isMatch ? (
      <strong key={i} className="text-foreground">
        {part}
      </strong>
    ) : (
      part
    );
  });
}

function ActivityMeta({
  userEmail,
  userEntity,
  createdAt,
  viaEntity,
  subprogramme,
  showSubprogramme,
  action,
}: {
  userEmail: string;
  userEntity: string | null;
  createdAt: string;
  viaEntity: string;
  subprogramme?: string | null;
  showSubprogramme?: boolean;
  action: "decided" | "commented";
}) {
  const subLabel =
    showSubprogramme && subprogramme
      ? ` / ${subprogramme.replace(/^Subprogramme \d+[.:]\s*/i, "Sub ")}`
      : "";
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-gray-400">
      <span>{userEmail}</span>
      {userEntity && (
        <span className="rounded bg-gray-100 px-1 py-0.5 text-[10px] font-medium text-gray-500">
          {userEntity}
        </span>
      )}
      <span>·</span>
      <span>{new Date(createdAt).toLocaleDateString()}</span>
      <span className="text-gray-500">
        {action} on{" "}
        <span className="font-medium text-un-blue">
          {viaEntity}
          {subLabel}
        </span>{" "}
        citation
      </span>
    </div>
  );
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
      <div className="rounded-lg bg-gray-100 p-4">
        <div className="flex gap-3">
          {label && (
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-un-blue text-xs font-medium text-white">
              {label}
            </span>
          )}
          <p className="flex-1 leading-relaxed text-gray-700">
            {highlightEntity(p.text, entity, entityLong)}
          </p>
          {aiComment && (
            <Tooltip content={aiComment}>
              <Sparkles className="h-4 w-4 flex-shrink-0 cursor-help text-amber-500" />
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  );
}

function getIndent(p: Paragraph) {
  if (p.paragraph_level && p.paragraph_level > 1)
    return (p.paragraph_level - 1) * 24;
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
      className="flex w-full items-center gap-2 py-2 text-sm text-gray-400 hover:text-gray-600"
    >
      <ChevronDown
        className={`h-4 w-4 transition-transform ${expanded ? "" : "-rotate-90"}`}
      />
      {expanded ? "Hide" : "Show"} {count} paragraph{count !== 1 && "s"} not
      mentioning {entity}
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

  const contentIndices = paragraphs
    .map((p, i) => ({ p, origIdx: i }))
    .filter(({ p }) => p.type !== "frontmatter" && p.text?.trim());

  const isRelevant = (origIdx: number) => relevantIndices.has(origIdx);

  const preamble = contentIndices.filter(
    ({ p }) => p.paragraph_type === "preambular",
  );
  const operative = contentIndices.filter(
    ({ p }) => p.paragraph_type !== "preambular",
  );

  type Segment = {
    type: "relevant" | "gap";
    items: { p: Paragraph; origIdx: number }[];
    gapIndex?: number;
  };
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
        segments.push({
          type: "gap",
          items: [...pendingHeadings, item],
          gapIndex: gapIndex++,
        });
      }
      pendingHeadings = [];
    }
  }
  if (pendingHeadings.length > 0) {
    const lastSeg = segments[segments.length - 1];
    if (lastSeg?.type === "gap") {
      lastSeg.items.push(...pendingHeadings);
    } else {
      segments.push({
        type: "gap",
        items: pendingHeadings,
        gapIndex: gapIndex++,
      });
    }
  }

  const toggleGap = (idx: number) => {
    setExpandedGaps((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  const preambleRelevant = preamble.filter(({ origIdx }) =>
    isRelevant(origIdx),
  );

  return (
    <div className="space-y-3">
      {preamble.length > 0 && (
        <>
          <button
            onClick={() => setShowPreamble(!showPreamble)}
            className="flex items-center gap-2 py-2 text-sm text-gray-500 hover:text-gray-700"
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform ${showPreamble ? "" : "-rotate-90"}`}
            />
            {showPreamble ? "Hide" : "Show"} {preamble.length} preambular
            paragraph{preamble.length !== 1 && "s"}
            {preambleRelevant.length > 0 && (
              <span className="text-un-blue">
                ({preambleRelevant.length} mentioning {entity})
              </span>
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
              const indent =
                p.heading_level && p.heading_level > 1
                  ? (p.heading_level - 1) * 16
                  : 0;
              return (
                <div
                  key={`seg-${i}-${j}`}
                  style={{ marginLeft: indent }}
                  className={`font-semibold text-foreground ${p.heading_level === 1 ? "mt-4 text-base" : "mt-2 text-sm"}`}
                >
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
            <CollapsedGap
              count={seg.items.length}
              entity={entity}
              expanded={expanded}
              onToggle={() => toggleGap(seg.gapIndex!)}
            />
            {expanded && (
              <div className="space-y-3">
                {seg.items.map(({ p }, j) => {
                  if (p.type === "heading") {
                    const indent =
                      p.heading_level && p.heading_level > 1
                        ? (p.heading_level - 1) * 16
                        : 0;
                    return (
                      <div
                        key={`gap-${seg.gapIndex}-${j}`}
                        style={{ marginLeft: indent }}
                        className={`font-semibold text-foreground ${p.heading_level === 1 ? "mt-4 text-base" : "mt-2 text-sm"}`}
                      >
                        {p.text}
                      </div>
                    );
                  }
                  return (
                    <ParaBox
                      key={`gap-${seg.gapIndex}-${j}`}
                      p={p}
                      indent={getIndent(p)}
                      entity={entity}
                      entityLong={entityLong}
                    />
                  );
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

  const content = paragraphs.filter(
    (p) => p.type !== "frontmatter" && p.text?.trim(),
  );
  const preamble = content.filter((p) => p.paragraph_type === "preambular");
  const operative = content.filter((p) => p.paragraph_type !== "preambular");

  return (
    <div className="space-y-3">
      {preamble.length > 0 && (
        <>
          <button
            onClick={() => setShowPreamble(!showPreamble)}
            className="flex items-center gap-2 py-2 text-sm text-gray-500 hover:text-gray-700"
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform ${showPreamble ? "" : "-rotate-90"}`}
            />
            {showPreamble ? "Hide" : "Show"} {preamble.length} preambular
            paragraph{preamble.length !== 1 && "s"}
          </button>
          {showPreamble && (
            <div className="space-y-3">
              {preamble.map((p, i) => (
                <ParaBox key={`pp-${i}`} p={p} indent={getIndent(p)} />
              ))}
            </div>
          )}
        </>
      )}

      {operative.map((p, i) => {
        if (p.type === "heading") {
          const indent =
            p.heading_level && p.heading_level > 1
              ? (p.heading_level - 1) * 16
              : 0;
          return (
            <div
              key={`op-${i}`}
              style={{ marginLeft: indent }}
              className={`font-semibold text-foreground ${p.heading_level === 1 ? "mt-4 text-base" : "mt-2 text-sm"}`}
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
  year,
  body,
  docType,
  otherEntitiesCount,
  relevanceCount: _relevanceCount,
  relevanceIndices: _relevanceIndices,
  aiComments: _aiComments,
  entity,
  entityLong: _entityLong,
  allEntities,
  entitySubprogrammes,
  entityLongMap,
  allEntityRelevance,
  isOpen: controlledOpen,
  onOpenChange,
  state,
  isReviewer,
  userEmail,
  userEntity,
  isFoundational,
  onDecision,
  onApprove,
  onComment,
  onUpdateClick,
  metadataFromDb,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [activityFilterEntity, setActivityFilterEntity] = useState<
    string | null
  >(null);
  const [paragraphs, setParagraphs] = useState<Paragraph[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [activeTab, setActiveTab] = useState<"activity" | "paragraphs">(
    "activity",
  );
  const [allDecisions, setAllDecisions] = useState<MandateDecision[]>([]);
  const [allComments, setAllComments] = useState<MandateComment[]>([]);

  // Fetch paragraphs and document-wide activity when sidebar opens
  useEffect(() => {
    if (open && !paragraphs && !loading) {
      const fetchData = async () => {
        setLoading(true);

        const [parasData, activityResult] = await Promise.all([
          fetchParagraphs(symbol),
          getDocumentDecisionsAction(symbol).catch(() => ({
            success: false as const,
            error: "Failed to load",
          })),
        ]);
        setParagraphs(parasData || []);
        if (activityResult.success && activityResult.data) {
          setAllDecisions(activityResult.data.decisions || []);
          setAllComments(activityResult.data.comments || []);
        }
        setLoading(false);
      };
      fetchData();
    }
  }, [open, paragraphs, loading, symbol]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setOpen(true);
    },
    [setOpen],
  );

  // Wrapper to update local state when decision is made
  const handleDecision = useCallback(
    (decision: Decision, newSymbol?: string) => {
      if (!onDecision || !entity) return;
      // Optimistic update to local state
      const newDecision: MandateDecision = {
        id: "",
        documentSymbol: symbol,
        entity,
        subprogramme: null,
        decision,
        newSymbol: newSymbol || null,
        userEmail: userEmail || "",
        userEntity: userEntity ?? null,
        createdAt: new Date().toISOString(),
        approvedBy: null,
        approvedAt: null,
      };
      setAllDecisions((prev) => [...prev, newDecision]);
      onDecision(decision, newSymbol);
    },
    [onDecision, entity, userEmail, userEntity, symbol],
  );

  // Wrapper to update local state when comment is added
  const handleComment = useCallback(
    (comment: string) => {
      if (!onComment || !entity) return;
      // Optimistic update to local state
      const newComment: MandateComment = {
        id: "",
        documentSymbol: symbol,
        entity,
        subprogramme: null,
        comment,
        userEmail: userEmail || "",
        userEntity: userEntity ?? null,
        createdAt: new Date().toISOString(),
      };
      setAllComments((prev) => [...prev, newComment]);
      onComment(comment);
    },
    [onComment, entity, userEmail, userEntity, symbol],
  );

  const isTruncated = symbol.length > 18;
  const displaySymbol = isTruncated ? symbol.slice(0, 18) + "…" : symbol;

  const btn = (
    <button
      onClick={handleClick}
      className="w-fit rounded bg-blue-50 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-un-blue transition-colors hover:bg-blue-100"
    >
      {displaySymbol}
    </button>
  );

  // Compute mention indices for an entity (using both short and long name)
  const computeMentionIndices = (
    paras: Paragraph[],
    ent: string,
    entLong?: string,
  ): Set<number> => {
    const terms = [ent];
    if (entLong) terms.push(entLong);
    const pattern = new RegExp(
      `\\b(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`,
      "i",
    );
    const indices = new Set<number>();
    paras.forEach((p, i) => {
      if (p.text && p.type !== "heading" && pattern.test(p.text))
        indices.add(i);
    });
    return indices;
  };

  // Get relevance for an entity from allEntityRelevance (pre-computed) or compute mentions on-the-fly
  const getEntityRelevance = (
    paras: Paragraph[],
    ent: string,
    entLong?: string,
  ): { indices: Set<number>; aiComments: Record<number, string> } => {
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
      entityRelevanceCounts[ent] = getEntityRelevance(
        paragraphs,
        ent,
        entLong,
      ).indices.size;
    }
  }

  const selectedEntityLong = selectedEntity
    ? entityLongMap?.[selectedEntity]
    : undefined;
  const selectedRelevance =
    paragraphs && selectedEntity
      ? getEntityRelevance(paragraphs, selectedEntity, selectedEntityLong)
      : { indices: new Set<number>(), aiComments: {} };

  // In controlled mode (isOpen passed), only render the sidebar
  const sidebarOnly = controlledOpen !== undefined;

  return (
    <>
      {!sidebarOnly &&
        (isTruncated ? <Tooltip content={symbol}>{btn}</Tooltip> : btn)}

      {open && (
        <div className="fixed inset-0 z-50 flex cursor-default justify-end">
          <div
            className="absolute inset-0 cursor-pointer bg-black/20"
            onClick={() => setOpen(false)}
          />

          <div className="relative flex h-full w-full max-w-lg cursor-default flex-col bg-white shadow-xl">
            <div className="border-b p-4 pb-3">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="text-lg font-semibold text-foreground">
                    {symbol}
                  </div>
                  {title && (
                    <div className="text-sm text-gray-600">{title}</div>
                  )}
                  {isFoundational && (
                    <Tooltip content="This mandate appears in both the legislative mandates and the foundational Mandates and Background section">
                      <div className="mt-2 flex items-center gap-1.5 text-amber-600">
                        <Star
                          className="h-4 w-4 fill-amber-400"
                          strokeWidth={0}
                        />
                        <span className="text-sm font-medium">
                          Foundational mandate
                        </span>
                      </div>
                    </Tooltip>
                  )}
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="ml-2 rounded p-1 hover:bg-gray-100"
                >
                  <X className="h-4 w-4 text-gray-500" />
                </button>
              </div>

              {/* Metadata */}
              <div className="mt-4 space-y-2 text-sm">
                {year &&
                  (() => {
                    const ageInfo = getAgeIndicator(year);
                    return (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">Year</span>
                        <span className="flex items-center gap-2">
                          <span className="text-gray-700">{year}</span>
                          <Tooltip content={ageInfo.tooltip}>
                            <span
                              className={`rounded px-1.5 py-0.5 text-xs font-medium ${ageInfo.color} ${ageInfo.bgColor}`}
                            >
                              {ageInfo.label}
                            </span>
                          </Tooltip>
                        </span>
                      </div>
                    );
                  })()}
                {body && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Issuing body</span>
                    <span className="text-gray-700">{body}</span>
                  </div>
                )}
                {docType && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Document type</span>
                    <span className="text-gray-700">{docType}</span>
                  </div>
                )}
                {otherEntitiesCount !== undefined && otherEntitiesCount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Also cited by</span>
                    <span className="text-gray-700">
                      {otherEntitiesCount} other{" "}
                      {otherEntitiesCount === 1 ? "entity" : "entities"}
                    </span>
                  </div>
                )}
                {link && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Source</span>
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-un-blue hover:underline"
                    >
                      View PDF →
                    </a>
                  </div>
                )}
              </div>

              {/* Decisions table */}
              {(allEntities?.length || allDecisions.length > 0) &&
                (() => {
                  // Merge subprogrammes from PPB data + decisions
                  const subprogsByEntity = new Map<
                    string,
                    Set<string | null>
                  >();
                  // Add from PPB data
                  for (const [ent, subprogs] of Object.entries(
                    entitySubprogrammes || {},
                  )) {
                    if (!subprogsByEntity.has(ent))
                      subprogsByEntity.set(ent, new Set());
                    for (const sp of subprogs)
                      subprogsByEntity.get(ent)!.add(sp);
                  }
                  // Add from decisions
                  for (const d of allDecisions) {
                    if (!subprogsByEntity.has(d.entity))
                      subprogsByEntity.set(d.entity, new Set());
                    subprogsByEntity.get(d.entity)!.add(d.subprogramme);
                  }
                  const entitiesWithMultiSubprogs = new Set(
                    [...subprogsByEntity.entries()]
                      .filter(([, subs]) => subs.size > 1)
                      .map(([e]) => e),
                  );

                  // Build unique rows: (entity, subprogramme) pairs from PPB + decisions
                  const rowKeys = new Set<string>();
                  const rows: {
                    entity: string;
                    subprogramme: string | null;
                  }[] = [];
                  // Add from PPB data first
                  for (const [ent, subprogs] of Object.entries(
                    entitySubprogrammes || {},
                  )) {
                    for (const sp of subprogs) {
                      const key = `${ent}:${sp || ""}`;
                      if (!rowKeys.has(key)) {
                        rowKeys.add(key);
                        rows.push({ entity: ent, subprogramme: sp });
                      }
                    }
                  }
                  // Add from decisions (might have ADDs or subprogs not in PPB)
                  for (const d of allDecisions) {
                    const key = `${d.entity}:${d.subprogramme || ""}`;
                    if (!rowKeys.has(key)) {
                      rowKeys.add(key);
                      rows.push({
                        entity: d.entity,
                        subprogramme: d.subprogramme,
                      });
                    }
                  }
                  // Add entities from allEntities that have no subprogs yet
                  for (const ent of allEntities || []) {
                    if (!subprogsByEntity.has(ent)) {
                      const key = `${ent}:`;
                      if (!rowKeys.has(key)) {
                        rowKeys.add(key);
                        rows.push({ entity: ent, subprogramme: null });
                      }
                    }
                  }

                  // Sort: user's entity first, then by entity name, then by subprogramme
                  rows.sort((a, b) => {
                    if (a.entity === userEntity && b.entity !== userEntity)
                      return -1;
                    if (b.entity === userEntity && a.entity !== userEntity)
                      return 1;
                    const entCmp = a.entity.localeCompare(b.entity);
                    if (entCmp !== 0) return entCmp;
                    return (a.subprogramme || "").localeCompare(
                      b.subprogramme || "",
                    );
                  });

                  // Helper to format display name
                  const formatRowName = (row: {
                    entity: string;
                    subprogramme: string | null;
                  }) => {
                    if (!entitiesWithMultiSubprogs.has(row.entity))
                      return row.entity;
                    const subLabel =
                      row.subprogramme?.replace(
                        /^Subprogramme \d+[.:]\s*/i,
                        "Sub ",
                      ) || "General";
                    return `${row.entity} / ${subLabel}`;
                  };

                  return (
                    <div className="mt-4 border-t pt-4">
                      <div className="mb-2 text-xs font-medium text-gray-500 uppercase">
                        Decisions
                      </div>
                      <div className="scrollbar-thin max-h-56 overflow-x-visible overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 z-10 border-b border-gray-200 bg-white shadow-sm">
                            <tr className="text-gray-500">
                              <th className="pt-2 pb-2 text-left text-[10px] font-semibold tracking-wider uppercase">
                                Entity
                              </th>
                              <th className="w-32 pt-2 pb-2 pl-3 text-left text-[10px] font-semibold tracking-wider uppercase">
                                Decision
                              </th>
                              <th className="w-16 pt-2 pb-2 pl-3 text-left text-[10px] font-semibold tracking-wider uppercase">
                                OK
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((row) => {
                              const isCurrentRow =
                                row.entity === entity &&
                                row.subprogramme ===
                                  (state?.subprogramme || null);
                              const isUserEntity = row.entity === userEntity;
                              const rowDecisions = allDecisions.filter(
                                (d) =>
                                  d.entity === row.entity &&
                                  d.subprogramme === row.subprogramme,
                              );
                              const latestDecision =
                                rowDecisions[rowDecisions.length - 1] || null;
                              const canEdit = isUserEntity && onDecision;
                              const currentDecision = isCurrentRow
                                ? state?.decision
                                : latestDecision;
                              const canApprove =
                                isUserEntity &&
                                isReviewer &&
                                onApprove &&
                                currentDecision;
                              const isApproved = !!currentDecision?.approvedBy;
                              const decisionId = currentDecision?.id;

                              return (
                                <tr
                                  key={`${row.entity}:${row.subprogramme || ""}`}
                                >
                                  <td
                                    className={`py-1.5 pr-3 font-medium ${isUserEntity ? "text-un-blue" : "text-gray-600"}`}
                                    title={row.subprogramme || undefined}
                                  >
                                    {formatRowName(row)}
                                  </td>
                                  <td className="py-1.5 pl-3">
                                    <DecisionDropdown
                                      decision={
                                        currentDecision?.decision || null
                                      }
                                      onChange={(decision) => {
                                        if (!canEdit) return;
                                        if (
                                          decision === "update" &&
                                          onUpdateClick
                                        ) {
                                          onUpdateClick();
                                        } else {
                                          handleDecision(decision);
                                        }
                                      }}
                                      onUpdateClick={
                                        canEdit ? onUpdateClick : undefined
                                      }
                                      disabled={!canEdit}
                                      userEmail={currentDecision?.userEmail}
                                      createdAt={currentDecision?.createdAt}
                                      size="sm"
                                    />
                                  </td>
                                  <td className="py-1.5 pl-3">
                                    {currentDecision ? (
                                      <button
                                        onClick={() => {
                                          if (canApprove && decisionId) {
                                            onApprove(decisionId, !isApproved);
                                          }
                                        }}
                                        disabled={!canApprove}
                                        title={
                                          isApproved
                                            ? `Approved by ${currentDecision?.approvedBy}`
                                            : canApprove
                                              ? "Click to approve"
                                              : ""
                                        }
                                        className={`inline-flex h-6 w-6 items-center justify-center rounded transition-colors ${
                                          isApproved
                                            ? "bg-emerald-600 text-white"
                                            : canApprove
                                              ? "border border-gray-300 bg-white hover:border-emerald-400 hover:bg-emerald-50"
                                              : "border border-gray-200 bg-gray-50"
                                        } ${!canApprove ? "cursor-default" : "cursor-pointer"}`}
                                      >
                                        {isApproved && (
                                          <Check className="h-4 w-4" />
                                        )}
                                      </button>
                                    ) : (
                                      <span className="text-gray-300">—</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}

              {/* Tabs */}
              <div className="mt-4 flex gap-1 border-t pt-3">
                <button
                  onClick={() => setActiveTab("activity")}
                  className={`rounded-t px-3 py-1.5 text-xs font-medium transition-colors ${
                    activeTab === "activity"
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Activity{" "}
                  {allDecisions.length + allComments.length > 0 && (
                    <span className="ml-1 text-gray-400">
                      ({allDecisions.length + allComments.length})
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab("paragraphs")}
                  className={`rounded-t px-3 py-1.5 text-xs font-medium transition-colors ${
                    activeTab === "paragraphs"
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Paragraphs
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-gray-50 p-4">
              {activeTab === "activity" ? (
                <div className="space-y-3">
                  {/* Entity filter pills */}
                  {allEntities && allEntities.length > 1 && (
                    <div className="mb-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          onClick={() => setActivityFilterEntity(null)}
                          className={`rounded px-2 py-0.5 text-xs transition-colors ${
                            !activityFilterEntity
                              ? "bg-gray-600 text-white"
                              : "bg-white text-gray-500 hover:bg-gray-100"
                          }`}
                        >
                          All entities
                        </button>
                        {allEntities.map((ent) => {
                          const isCurrentEntity = ent === entity;
                          const count =
                            allDecisions.filter((d) => d.entity === ent)
                              .length +
                            allComments.filter((c) => c.entity === ent).length;
                          return (
                            <button
                              key={ent}
                              onClick={() => setActivityFilterEntity(ent)}
                              className={`rounded px-2 py-0.5 text-xs transition-colors ${
                                activityFilterEntity === ent
                                  ? "bg-un-blue text-white"
                                  : isCurrentEntity
                                    ? "bg-un-blue/20 text-un-blue hover:bg-un-blue/30"
                                    : "bg-white text-gray-600 hover:bg-gray-100"
                              }`}
                            >
                              {ent}{" "}
                              <span
                                className={
                                  activityFilterEntity === ent
                                    ? "text-white/70"
                                    : "text-gray-400"
                                }
                              >
                                ({count})
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {/* Activity log (all decisions + comments interleaved) */}
                  {(() => {
                    type ActivityItem =
                      | { type: "decision"; data: MandateDecision }
                      | { type: "comment"; data: MandateComment };
                    const items: ActivityItem[] = [];
                    const filteredDecisions = activityFilterEntity
                      ? allDecisions.filter(
                          (d) => d.entity === activityFilterEntity,
                        )
                      : allDecisions;
                    const filteredComments = activityFilterEntity
                      ? allComments.filter(
                          (c) => c.entity === activityFilterEntity,
                        )
                      : allComments;
                    for (const d of filteredDecisions)
                      items.push({ type: "decision", data: d });
                    for (const c of filteredComments)
                      items.push({ type: "comment", data: c });
                    items.sort(
                      (a, b) =>
                        new Date(a.data.createdAt).getTime() -
                        new Date(b.data.createdAt).getTime(),
                    );

                    // Track which entities have multiple subprogrammes (from PPB + activity)
                    const subprogsByEntity = new Map<
                      string,
                      Set<string | null>
                    >();
                    // From PPB data
                    for (const [ent, subprogs] of Object.entries(
                      entitySubprogrammes || {},
                    )) {
                      if (!subprogsByEntity.has(ent))
                        subprogsByEntity.set(ent, new Set());
                      for (const sp of subprogs)
                        subprogsByEntity.get(ent)!.add(sp);
                    }
                    // From activity items
                    for (const item of items) {
                      const e = item.data.entity;
                      if (!subprogsByEntity.has(e))
                        subprogsByEntity.set(e, new Set());
                      subprogsByEntity.get(e)!.add(item.data.subprogramme);
                    }
                    const entitiesWithMultiSubprogs = new Set(
                      [...subprogsByEntity.entries()]
                        .filter(([, subs]) => subs.size > 1)
                        .map(([e]) => e),
                    );

                    if (items.length === 0) {
                      return (
                        <div className="text-sm text-gray-400">
                          No activity yet
                        </div>
                      );
                    }

                    return items.map((item, i) => {
                      const itemEntity = item.data.entity;
                      const showSubprog =
                        entitiesWithMultiSubprogs.has(itemEntity);
                      return (
                        <div key={item.data.id || i} className="text-xs">
                          {item.type === "decision" ? (
                            <div
                              className={`rounded p-2 ${
                                item.data.decision === "retain"
                                  ? "bg-green-50"
                                  : item.data.decision === "remove"
                                    ? "bg-red-50"
                                    : item.data.decision === "update"
                                      ? "bg-amber-50"
                                      : "bg-blue-50"
                              }`}
                            >
                              <div className="flex items-center gap-1">
                                <span
                                  className={`font-medium ${
                                    item.data.decision === "retain"
                                      ? "text-green-700"
                                      : item.data.decision === "remove"
                                        ? "text-red-700"
                                        : item.data.decision === "update"
                                          ? "text-amber-700"
                                          : "text-blue-700"
                                  }`}
                                >
                                  {item.data.decision}
                                </span>
                                {(item.data as MandateDecision).newSymbol && (
                                  <span className="text-gray-500">
                                    → {(item.data as MandateDecision).newSymbol}
                                  </span>
                                )}
                                {(item.data as MandateDecision).approvedBy && (
                                  <span
                                    className="ml-auto flex items-center gap-0.5 text-emerald-600"
                                    title={`Approved by ${(item.data as MandateDecision).approvedBy}`}
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                  </span>
                                )}
                              </div>
                              <ActivityMeta
                                userEmail={item.data.userEmail}
                                userEntity={
                                  (item.data as MandateDecision).userEntity
                                }
                                createdAt={item.data.createdAt}
                                viaEntity={itemEntity}
                                subprogramme={item.data.subprogramme}
                                showSubprogramme={showSubprog}
                                action="decided"
                              />
                            </div>
                          ) : (
                            <div className="rounded bg-white p-2 shadow-sm">
                              <div className="text-gray-700">
                                {(item.data as MandateComment).comment}
                              </div>
                              <ActivityMeta
                                userEmail={item.data.userEmail}
                                userEntity={
                                  (item.data as MandateComment).userEntity
                                }
                                createdAt={item.data.createdAt}
                                viaEntity={itemEntity}
                                subprogramme={item.data.subprogramme}
                                showSubprogramme={showSubprog}
                                action="commented"
                              />
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
                  {/* Add comment input */}
                  {onComment && (
                    <div className="flex gap-2 pt-2">
                      <input
                        type="text"
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && commentText.trim()) {
                            handleComment(commentText.trim());
                            setCommentText("");
                          }
                        }}
                        placeholder={`Add a comment for ${entity}...`}
                        className="flex-1 rounded border border-gray-200 bg-white px-2 py-1.5 text-xs"
                      />
                      <button
                        onClick={() => {
                          if (commentText.trim()) {
                            handleComment(commentText.trim());
                            setCommentText("");
                          }
                        }}
                        disabled={!commentText.trim()}
                        className="rounded bg-un-blue px-3 py-1.5 text-xs text-white disabled:opacity-50"
                      >
                        Send
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {allEntities && allEntities.length > 0 && (
                    <div className="mb-4">
                      <div className="mb-1.5 text-xs text-gray-500">
                        Filter by entity
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          onClick={() => setSelectedEntity(null)}
                          className={`rounded px-2 py-0.5 text-xs transition-colors ${
                            !selectedEntity
                              ? "bg-gray-600 text-white"
                              : "bg-white text-gray-500 hover:bg-gray-100"
                          }`}
                        >
                          All
                        </button>
                        {allEntities.map((e) => {
                          const count = entityRelevanceCounts[e] || 0;
                          return (
                            <button
                              key={e}
                              onClick={() => setSelectedEntity(e)}
                              className={`rounded px-2 py-0.5 text-xs transition-colors ${
                                selectedEntity === e
                                  ? "bg-un-blue text-white"
                                  : "bg-white text-gray-600 hover:bg-gray-100"
                              }`}
                            >
                              {e}{" "}
                              <span
                                className={
                                  selectedEntity === e
                                    ? "text-white/70"
                                    : "text-gray-400"
                                }
                              >
                                ({count})
                              </span>
                            </button>
                          );
                        })}
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
                    <div className="text-sm text-gray-400">
                      No paragraph data available
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
