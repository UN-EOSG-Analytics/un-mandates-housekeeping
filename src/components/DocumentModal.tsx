// Modal is client-side
"use client";

import React from "react";
import { getAgeIndicator } from "@/lib/services/age-indicator";
import { fetchParagraphs } from "@/lib/services/client/client-data-service";
import {
  getDocumentDecisionsAction,
  getDocumentVersionsAction,
  resolveCommentAction,
  updateDecisionReasonAction,
} from "@/lib/services/housekeeping-actions";
import type { DocumentVersion } from "@/lib/services/document-versions";
import { DiffModal } from "./DiffModal";
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
  ArrowLeftRight,
  ArrowRight,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ExternalLink,
  FileText,
  History,
  Info,
  Loader2,
  MessageSquare,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Tooltip } from "./Tooltip";
import { DecisionDropdown } from "./DecisionDropdown";
import {
  getReasonDisplayLabel,
  renderReasonIcon,
  renderLabelWithBold,
} from "./ReasonsModal";
import type { DecisionType } from "@/lib/services/decision-reasons";

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
  canReviewAnyEntity?: boolean;
  userEmail?: string | null;
  userEntity?: string | null;
  isFoundational?: boolean;
  onDecision?: (decision: Decision, newSymbol?: string) => void;
  onApprove?: (decisionId: string, approved: boolean) => void;
  onComment?: (comment: string) => void;
  onUpdateClick?: (prefillSymbol?: string) => void; // Called when user selects "update" from sidebar
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
  action: "decided" | "commented" | "approved";
}) {
  const subLabel =
    showSubprogramme && subprogramme
      ? ` / ${subprogramme.replace(/^Subprogramme \d+[.:]\s*/i, "Sub ")}`
      : "";
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-gray-400">
      <span className="font-medium text-gray-500">{userEmail}</span>
      {userEntity && (
        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
          {userEntity}
        </span>
      )}
      <span className="text-gray-300">·</span>
      <span>{new Date(createdAt).toLocaleDateString()}</span>
      <span className="text-gray-400">
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
      <div className="rounded-lg bg-gray-100 p-3">
        <div className="flex gap-2">
          {label && (
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-un-blue text-[10px] font-medium text-white">
              {label}
            </span>
          )}
          <p className="flex-1 text-sm leading-relaxed text-gray-700">
            {highlightEntity(p.text, entity, entityLong)}
          </p>
          {aiComment && (
            <Tooltip content={aiComment}>
              <Sparkles className="h-3.5 w-3.5 shrink-0 cursor-help text-amber-500" />
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  );
}

function getIndent(p: Paragraph) {
  if (p.paragraph_level && p.paragraph_level > 1)
    return (p.paragraph_level - 1) * 16;
  if (p.heading_level && p.heading_level > 1) return (p.heading_level - 1) * 12;
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
      className="flex w-full items-center gap-2 py-1.5 text-xs text-gray-400 hover:text-gray-600"
    >
      <ChevronDown
        className={`h-3.5 w-3.5 transition-transform ${expanded ? "" : "-rotate-90"}`}
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
    <div className="space-y-2">
      {preamble.length > 0 && (
        <>
          <button
            onClick={() => setShowPreamble(!showPreamble)}
            className="flex items-center gap-2 py-1.5 text-xs text-gray-500 hover:text-gray-700"
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${showPreamble ? "" : "-rotate-90"}`}
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
            <div className="space-y-2">
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
                  ? (p.heading_level - 1) * 12
                  : 0;
              return (
                <div
                  key={`seg-${i}-${j}`}
                  style={{ marginLeft: indent }}
                  className={`font-semibold text-foreground ${p.heading_level === 1 ? "mt-3 text-sm" : "mt-1.5 text-xs"}`}
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
              <div className="space-y-2">
                {seg.items.map(({ p }, j) => {
                  if (p.type === "heading") {
                    const indent =
                      p.heading_level && p.heading_level > 1
                        ? (p.heading_level - 1) * 12
                        : 0;
                    return (
                      <div
                        key={`gap-${seg.gapIndex}-${j}`}
                        style={{ marginLeft: indent }}
                        className={`font-semibold text-foreground ${p.heading_level === 1 ? "mt-3 text-sm" : "mt-1.5 text-xs"}`}
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
    <div className="space-y-2">
      {preamble.length > 0 && (
        <>
          <button
            onClick={() => setShowPreamble(!showPreamble)}
            className="flex items-center gap-2 py-1.5 text-xs text-gray-500 hover:text-gray-700"
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${showPreamble ? "" : "-rotate-90"}`}
            />
            {showPreamble ? "Hide" : "Show"} {preamble.length} preambular
            paragraph{preamble.length !== 1 && "s"}
          </button>
          {showPreamble && (
            <div className="space-y-2">
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
              ? (p.heading_level - 1) * 12
              : 0;
          return (
            <div
              key={`op-${i}`}
              style={{ marginLeft: indent }}
              className={`font-semibold text-foreground ${p.heading_level === 1 ? "mt-3 text-sm" : "mt-1.5 text-xs"}`}
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
  entity,
  allEntities,
  entitySubprogrammes,
  entityLongMap,
  allEntityRelevance,
  isOpen: controlledOpen,
  onOpenChange,
  state,
  isReviewer,
  canReviewAnyEntity,
  userEmail,
  userEntity,
  isFoundational,
  onDecision,
  onApprove,
  onComment,
  onUpdateClick,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [activityFilterEntity, setActivityFilterEntity] = useState<
    string | null
  >(null);
  const [activityFilterType, setActivityFilterType] = useState<
    "all" | "comments"
  >("all");
  const [paragraphs, setParagraphs] = useState<Paragraph[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [activeTab, setActiveTab] = useState<
    "info" | "decisions" | "activity" | "paragraphs"
  >("info");
  const [allDecisions, setAllDecisions] = useState<MandateDecision[]>([]);
  const [allComments, setAllComments] = useState<MandateComment[]>([]);
  const [documentVersions, setDocumentVersions] = useState<DocumentVersion[]>(
    [],
  );
  const [diffModalOpen, setDiffModalOpen] = useState(false);
  const [diffCompareSymbol, setDiffCompareSymbol] = useState<{
    symbol: string;
    year: number;
    title?: string | null;
  } | null>(null);
  const [diffOriginalOverride, setDiffOriginalOverride] = useState<{
    symbol: string;
    year: number;
    title?: string | null;
  } | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, setOpen]);

  // Fetch paragraphs, activity, and versions when sidebar opens
  useEffect(() => {
    if (open && !paragraphs && !loading) {
      const fetchData = async () => {
        setLoading(true);

        const [parasData, activityResult, versionsResult] = await Promise.all([
          fetchParagraphs(symbol),
          getDocumentDecisionsAction(symbol).catch(() => ({
            success: false as const,
            error: "Failed to load",
          })),
          getDocumentVersionsAction(symbol).catch(() => ({
            success: false as const,
            error: "Failed to load",
          })),
        ]);
        setParagraphs(parasData || []);
        if (activityResult.success && activityResult.data) {
          setAllDecisions(activityResult.data.decisions || []);
          setAllComments(activityResult.data.comments || []);
        }
        if (versionsResult.success && versionsResult.data) {
          setDocumentVersions(versionsResult.data);
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
        decisionReason: null,
        otherReason: null,
        userEmail: userEmail || "",
        userEntity: userEntity ?? null,
        createdAt: new Date().toISOString(),
        approvedBy: null,
        approvedByEntity: null,
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
        resolvedAt: null,
        resolvedBy: null,
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

          <div
            ref={sidebarRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="sidebar-title"
            className="relative flex h-full w-full max-w-xl cursor-default flex-col bg-white shadow-xl"
          >
            <div className="border-b p-5 pb-0">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <h2
                      id="sidebar-title"
                      className="text-xl font-semibold text-foreground"
                    >
                      {symbol}
                    </h2>
                    {isFoundational && (
                      <Tooltip content="Also cited in the Mandates and Background section">
                        <span className="inline-flex items-center gap-1 rounded-full bg-un-blue/10 px-2.5 py-0.5 text-xs font-medium text-un-blue">
                          <Star
                            className="h-3 w-3 fill-un-blue"
                            strokeWidth={0}
                          />
                          Foundational
                        </span>
                      </Tooltip>
                    )}
                  </div>
                  {title && (
                    <p className="mt-1 text-sm text-gray-500">{title}</p>
                  )}
                </div>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close sidebar"
                  className="ml-2 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Tabs */}
              <div className="mt-5 flex gap-1">
                <button
                  onClick={() => setActiveTab("info")}
                  className={`flex items-center gap-1.5 rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                    activeTab === "info"
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                  }`}
                >
                  <Info className="h-4 w-4" />
                  Info
                </button>
                <button
                  onClick={() => setActiveTab("decisions")}
                  className={`flex items-center gap-1.5 rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                    activeTab === "decisions"
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                  }`}
                >
                  <CheckSquare className="h-4 w-4" />
                  Decisions
                  {(() => {
                    // Count unique entity/subprogramme pairs with active decisions (not cancelled)
                    // Group by entity/subprogramme and check if latest decision is not "cancel"
                    const latestByKey = new Map<string, string>();
                    for (const d of allDecisions) {
                      const key = `${d.entity}:${d.subprogramme || ""}`;
                      latestByKey.set(key, d.decision);
                    }
                    const activeCount = [...latestByKey.values()].filter(
                      (decision) => decision !== "cancel",
                    ).length;
                    return activeCount > 0 ? (
                      <span className="ml-1 rounded-full bg-gray-200 px-1.5 py-0.5 text-xs text-gray-600">
                        {activeCount}
                      </span>
                    ) : null;
                  })()}
                </button>
                <button
                  onClick={() => setActiveTab("activity")}
                  className={`flex items-center gap-1.5 rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                    activeTab === "activity"
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                  }`}
                >
                  <History className="h-4 w-4" />
                  Activity
                  {allDecisions.length + allComments.length > 0 && (
                    <span className="ml-1 rounded-full bg-gray-200 px-1.5 py-0.5 text-xs text-gray-600">
                      {allDecisions.length + allComments.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab("paragraphs")}
                  className={`flex items-center gap-1.5 rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                    activeTab === "paragraphs"
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                  }`}
                >
                  <FileText className="h-4 w-4" />
                  Paragraphs
                  {paragraphs && paragraphs.length > 0 && (
                    <span className="ml-1 rounded-full bg-gray-200 px-1.5 py-0.5 text-xs text-gray-600">
                      {paragraphs.length}
                    </span>
                  )}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-gray-100 p-5">
              {/* Info Tab */}
              {activeTab === "info" && (
                <div className="space-y-4">
                  <div className="rounded-xl bg-white p-4 shadow-sm">
                    <h3 className="mb-3 text-xs font-semibold tracking-wider text-gray-400 uppercase">
                      Document Details
                    </h3>
                    <dl className="space-y-2 text-sm">
                      {year &&
                        (() => {
                          const ageInfo = getAgeIndicator(year);
                          return (
                            <div className="flex items-center justify-between border-b border-gray-100 py-1.5">
                              <dt className="text-gray-500">Year</dt>
                              <dd className="flex items-center gap-2 font-medium text-gray-900">
                                {year}
                                <Tooltip content={ageInfo.tooltip}>
                                  <span
                                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${ageInfo.color} ${ageInfo.bgColor}`}
                                  >
                                    {ageInfo.label}
                                  </span>
                                </Tooltip>
                              </dd>
                            </div>
                          );
                        })()}
                      {body && (
                        <div className="flex items-center justify-between border-b border-gray-100 py-1.5">
                          <dt className="text-gray-500">Issuing body</dt>
                          <dd className="font-medium text-gray-900">{body}</dd>
                        </div>
                      )}
                      {docType && (
                        <div className="flex items-center justify-between border-b border-gray-100 py-1.5">
                          <dt className="text-gray-500">Document type</dt>
                          <dd className="font-medium text-gray-900">
                            {docType}
                          </dd>
                        </div>
                      )}
                      {otherEntitiesCount !== undefined &&
                        otherEntitiesCount > 0 && (
                          <div className="flex items-center justify-between border-b border-gray-100 py-1.5">
                            <dt className="text-gray-500">Also cited by</dt>
                            <dd className="font-medium text-gray-900">
                              {otherEntitiesCount} other{" "}
                              {otherEntitiesCount === 1 ? "entity" : "entities"}
                            </dd>
                          </div>
                        )}
                      {link && (
                        <div className="flex items-center justify-between py-1.5">
                          <dt className="text-gray-500">Source</dt>
                          <dd>
                            <a
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-medium text-un-blue hover:underline"
                            >
                              View PDF →
                            </a>
                          </dd>
                        </div>
                      )}
                    </dl>
                  </div>

                  {/* Newer Versions */}
                  {!loading &&
                    (() => {
                      // Find current document index
                      const currentIndex = documentVersions.findIndex(
                        (v) => v.symbol === symbol,
                      );
                      // Only show versions newer than current (after current index in the sorted list)
                      const newerVersions =
                        currentIndex >= 0
                          ? documentVersions.slice(currentIndex + 1)
                          : [];

                      if (newerVersions.length > 0) {
                        return (
                          <div className="rounded-xl bg-white p-4 shadow-sm">
                            <h3 className="mb-3 text-xs font-semibold tracking-wider text-gray-400 uppercase">
                              Newer Versions ({newerVersions.length})
                            </h3>
                            {/* Header row */}
                            <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] items-center gap-x-3 gap-y-2 text-xs">
                              <span className="font-medium text-gray-500">
                                Year
                              </span>
                              <span className="font-medium text-gray-500">
                                Symbol
                              </span>
                              <span className="text-center font-medium text-gray-500">
                                vs Original
                              </span>
                              <span className="text-center font-medium text-gray-500">
                                vs Previous
                              </span>
                              <span className="font-medium text-gray-500">
                                PDF
                              </span>
                              <span className="font-medium text-gray-500">
                                Action
                              </span>

                              {newerVersions.map((version, idx) => {
                                // Previous version is either the one before in newerVersions, or the current document
                                const previousSymbol =
                                  idx === 0
                                    ? symbol
                                    : newerVersions[idx - 1].symbol;
                                const previousYear =
                                  idx === 0
                                    ? (year ?? 0)
                                    : newerVersions[idx - 1].year;

                                return (
                                  <React.Fragment key={version.symbol}>
                                    {/* Year */}
                                    <span className="text-sm text-gray-700">
                                      {version.year}
                                    </span>

                                    {/* Symbol */}
                                    <span className="truncate text-sm font-medium text-gray-900">
                                      {version.symbol}
                                    </span>

                                    {/* Compare with Original */}
                                    <button
                                      onClick={() => {
                                        setDiffOriginalOverride(null); // Use main document as original
                                        setDiffCompareSymbol({
                                          symbol: version.symbol,
                                          year: version.year,
                                          title: version.title,
                                        });
                                        setDiffModalOpen(true);
                                      }}
                                      className="inline-flex items-center justify-center gap-1 rounded bg-blue-50 px-2 py-1 text-xs font-medium text-un-blue transition-colors hover:bg-blue-100"
                                      title={`Compare ${version.symbol} with ${symbol}`}
                                    >
                                      <ArrowLeftRight className="h-3 w-3" />
                                    </button>

                                    {/* Compare with Previous */}
                                    <button
                                      onClick={() => {
                                        // For comparing with previous version
                                        setDiffOriginalOverride({
                                          symbol: previousSymbol,
                                          year: previousYear,
                                          title:
                                            idx === 0
                                              ? title
                                              : newerVersions[idx - 1].title,
                                        });
                                        setDiffCompareSymbol({
                                          symbol: version.symbol,
                                          year: version.year,
                                          title: version.title,
                                        });
                                        setDiffModalOpen(true);
                                      }}
                                      className={`inline-flex items-center justify-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                                        idx === 0
                                          ? "cursor-not-allowed bg-gray-100 text-gray-400"
                                          : "bg-blue-50 text-un-blue hover:bg-blue-100"
                                      }`}
                                      title={
                                        idx === 0
                                          ? "Same as original"
                                          : `Compare ${version.symbol} with ${previousSymbol}`
                                      }
                                      disabled={idx === 0}
                                    >
                                      <ArrowLeftRight className="h-3 w-3" />
                                    </button>

                                    {/* View PDF */}
                                    <a
                                      href={`https://docs.un.org/en/${version.symbol}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center justify-center rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-200"
                                      title="View PDF in ODS in a new tab"
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                    </a>

                                    {/* Update To */}
                                    {(entity === userEntity ||
                                      canReviewAnyEntity) &&
                                    onUpdateClick ? (
                                      <button
                                        onClick={() => {
                                          onUpdateClick(version.symbol);
                                        }}
                                        className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100"
                                        title="Update the mandate citation to this newer version"
                                      >
                                        <ArrowRight className="h-3 w-3" />
                                        Update
                                      </button>
                                    ) : (
                                      <span className="text-xs text-gray-400">
                                        —
                                      </span>
                                    )}
                                  </React.Fragment>
                                );
                              })}
                            </div>
                          </div>
                        );
                      }

                      return null;
                    })()}
                </div>
              )}

              {/* Decisions Tab */}
              {activeTab === "decisions" &&
                (allEntities?.length || allDecisions.length > 0) &&
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
                    <div className="rounded-xl bg-white p-5 shadow-sm">
                      <h3 className="mb-4 text-xs font-semibold tracking-wider text-gray-400 uppercase">
                        Entity Decisions
                      </h3>
                      <div className="scrollbar-thin overflow-x-visible overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="border-b border-gray-200">
                            <tr className="text-gray-500">
                              <th className="pb-3 text-left text-xs font-semibold tracking-wider uppercase">
                                Entity
                              </th>
                              <th className="w-36 pb-3 pl-3 text-left text-xs font-semibold tracking-wider uppercase">
                                Decision
                              </th>
                              <th className="w-20 pb-3 pl-3 text-left text-xs font-semibold tracking-wider uppercase">
                                Approved
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
                              const canEdit =
                                (isUserEntity || canReviewAnyEntity) &&
                                onDecision;
                              const currentDecision = isCurrentRow
                                ? state?.decision
                                : latestDecision;
                              const canApprove =
                                (isUserEntity || canReviewAnyEntity) &&
                                isReviewer &&
                                onApprove &&
                                currentDecision;
                              const isApproved = !!currentDecision?.approvedBy;
                              const decisionId = currentDecision?.id;

                              return (
                                <tr
                                  key={`${row.entity}:${row.subprogramme || ""}`}
                                  className="h-14 border-b border-gray-100 last:border-0"
                                >
                                  <td
                                    className={`py-3 pr-3 align-middle font-medium ${isUserEntity ? "text-un-blue" : "text-gray-700"}`}
                                    title={row.subprogramme || undefined}
                                  >
                                    {formatRowName(row)}
                                  </td>
                                  <td className="py-3 pl-3 align-middle">
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
                                      reason={currentDecision?.decisionReason}
                                      otherReason={currentDecision?.otherReason}
                                      onReasonChange={
                                        canEdit
                                          ? async (reason, otherReason) => {
                                              if (!currentDecision?.id) return;
                                              // Optimistic update
                                              setAllDecisions((prev) =>
                                                prev.map((d) =>
                                                  d.id === currentDecision?.id
                                                    ? {
                                                        ...d,
                                                        decisionReason: reason,
                                                        otherReason:
                                                          reason === "other"
                                                            ? otherReason
                                                            : null,
                                                      }
                                                    : d,
                                                ),
                                              );
                                              // Persist to database
                                              const result =
                                                await updateDecisionReasonAction(
                                                  {
                                                    decisionId:
                                                      currentDecision.id,
                                                    decisionReason: reason,
                                                    otherReason:
                                                      reason === "other"
                                                        ? otherReason
                                                        : null,
                                                  },
                                                );
                                              if (
                                                result.success &&
                                                result.data
                                              ) {
                                                setAllDecisions((prev) =>
                                                  prev.map((d) =>
                                                    d.id === result.data!.id
                                                      ? result.data!
                                                      : d,
                                                  ),
                                                );
                                              }
                                            }
                                          : undefined
                                      }
                                      symbol={symbol}
                                      size="sm"
                                    />
                                  </td>
                                  <td className="py-3 pl-3 align-middle">
                                    {currentDecision ? (
                                      <button
                                        onClick={() => {
                                          if (canApprove && decisionId) {
                                            const newApproved = !isApproved;
                                            setAllDecisions((prev) =>
                                              prev.map((d) =>
                                                d.id === decisionId
                                                  ? {
                                                      ...d,
                                                      approvedBy: newApproved
                                                        ? userEmail || null
                                                        : null,
                                                      approvedByEntity:
                                                        newApproved
                                                          ? userEntity || null
                                                          : null,
                                                      approvedAt: newApproved
                                                        ? new Date().toISOString()
                                                        : null,
                                                    }
                                                  : d,
                                              ),
                                            );
                                            onApprove(decisionId, newApproved);
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
                                        className={`inline-flex h-6 w-6 items-center justify-center rounded border transition-colors ${
                                          isApproved
                                            ? "border-emerald-600 bg-emerald-600 text-white"
                                            : canApprove
                                              ? "border-gray-300 bg-white hover:border-emerald-400 hover:bg-emerald-50"
                                              : "border-gray-200 bg-gray-50"
                                        } ${!canApprove ? "cursor-default" : "cursor-pointer"}`}
                                      >
                                        <Check
                                          className={`h-4 w-4 ${isApproved ? "" : "invisible"}`}
                                        />
                                      </button>
                                    ) : (
                                      <span className="inline-flex h-6 w-6 items-center justify-center border border-transparent text-gray-300">
                                        —
                                      </span>
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

              {/* Activity Tab */}
              {activeTab === "activity" && (
                <div className="space-y-4">
                  {/* Filters */}
                  <div className="rounded-xl bg-white p-4 shadow-sm">
                    {/* Entity filter pills */}
                    {allEntities && allEntities.length > 1 && (
                      <div className="mb-3">
                        <div className="mb-2 text-xs font-semibold tracking-wider text-gray-400 uppercase">
                          Filter by citing entity
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            onClick={() => setActivityFilterEntity(null)}
                            className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                              !activityFilterEntity
                                ? "bg-gray-700 text-white"
                                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                            }`}
                          >
                            All entities
                          </button>
                          {allEntities.map((ent) => {
                            const isCurrentEntity = ent === entity;
                            const count =
                              allDecisions.filter((d) => d.entity === ent)
                                .length +
                              allComments.filter((c) => c.entity === ent)
                                .length;
                            return (
                              <button
                                key={ent}
                                onClick={() => setActivityFilterEntity(ent)}
                                className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                                  activityFilterEntity === ent
                                    ? "bg-un-blue text-white"
                                    : isCurrentEntity
                                      ? "bg-un-blue/20 text-un-blue hover:bg-un-blue/30"
                                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                                }`}
                              >
                                {ent}{" "}
                                <span
                                  className={
                                    activityFilterEntity === ent
                                      ? "text-white/60"
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
                    {/* Type filter toggle */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setActivityFilterType("all")}
                        className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                          activityFilterType === "all"
                            ? "bg-gray-700 text-white"
                            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        }`}
                      >
                        All activity
                      </button>
                      <button
                        onClick={() => setActivityFilterType("comments")}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                          activityFilterType === "comments"
                            ? "bg-amber-500 text-white"
                            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        }`}
                      >
                        <MessageSquare className="h-3 w-3" />
                        Comments only
                        {allComments.length > 0 && (
                          <span
                            className={
                              activityFilterType === "comments"
                                ? "text-white/70"
                                : "text-gray-400"
                            }
                          >
                            ({allComments.length})
                          </span>
                        )}
                      </button>
                    </div>
                  </div>
                  {/* Activity log (all decisions + comments interleaved) */}
                  {(() => {
                    type ActivityItem =
                      | {
                          type: "decision";
                          data: MandateDecision;
                          isSuperseded: boolean;
                        }
                      | { type: "comment"; data: MandateComment }
                      | {
                          type: "approval";
                          data: MandateDecision;
                          isSuperseded: boolean;
                        };
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

                    // Track latest decision per entity/subprogramme to identify superseded ones
                    const latestDecisionByKey = new Map<string, string>();
                    // Sort by createdAt descending to find latest
                    const sortedDecisions = [...filteredDecisions].sort(
                      (a, b) =>
                        new Date(b.createdAt).getTime() -
                        new Date(a.createdAt).getTime(),
                    );
                    for (const d of sortedDecisions) {
                      const key = `${d.entity}:${d.subprogramme || ""}`;
                      if (!latestDecisionByKey.has(key)) {
                        latestDecisionByKey.set(key, d.id);
                      }
                    }

                    // Only add decisions/approvals if not filtering to comments only
                    if (activityFilterType === "all") {
                      for (const d of filteredDecisions) {
                        const key = `${d.entity}:${d.subprogramme || ""}`;
                        const isSuperseded =
                          latestDecisionByKey.get(key) !== d.id ||
                          d.decision === "cancel";
                        items.push({ type: "decision", data: d, isSuperseded });
                        // Add approval as separate activity item if decision is approved
                        if (d.approvedBy && d.approvedAt) {
                          items.push({
                            type: "approval",
                            data: d,
                            isSuperseded,
                          });
                        }
                      }
                    }
                    for (const c of filteredComments)
                      items.push({ type: "comment", data: c });
                    items.sort((a, b) => {
                      const aTime =
                        a.type === "approval"
                          ? new Date(
                              (a.data as MandateDecision).approvedAt!,
                            ).getTime()
                          : new Date(a.data.createdAt).getTime();
                      const bTime =
                        b.type === "approval"
                          ? new Date(
                              (b.data as MandateDecision).approvedAt!,
                            ).getTime()
                          : new Date(b.data.createdAt).getTime();
                      return aTime - bTime;
                    });

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
                        <div className="rounded-xl bg-white p-8 text-center shadow-sm">
                          <div className="text-sm text-gray-400">
                            {activityFilterType === "comments"
                              ? "No comments yet"
                              : "No activity yet"}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-3">
                        {items.map((item, i) => {
                          const itemEntity = item.data.entity;
                          const showSubprog =
                            entitiesWithMultiSubprogs.has(itemEntity);

                          // Decision items (retain, remove, update, etc.)
                          if (item.type === "decision") {
                            const decision = item.data as MandateDecision;
                            const isSuperseded = item.isSuperseded;
                            const reasonLabel =
                              decision.decision !== "cancel" &&
                              decision.decision !== "add"
                                ? getReasonDisplayLabel(
                                    decision.decision as DecisionType,
                                    decision.decisionReason,
                                    decision.otherReason,
                                  )
                                : null;
                            return (
                              <div
                                key={decision.id || i}
                                className={`text-xs ${isSuperseded ? "opacity-50" : ""}`}
                              >
                                <div
                                  className={`rounded-lg border p-3 ${
                                    decision.decision === "retain"
                                      ? "border-blue-200 bg-blue-50/50"
                                      : decision.decision === "remove"
                                        ? "border-red-200 bg-red-50/50"
                                        : decision.decision === "update"
                                          ? "border-amber-200 bg-amber-50/50"
                                          : decision.decision === "cancel"
                                            ? "border-gray-200 bg-gray-50"
                                            : "border-emerald-200 bg-emerald-50/50"
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`text-sm font-semibold ${
                                        decision.decision === "retain"
                                          ? "text-blue-700"
                                          : decision.decision === "remove"
                                            ? "text-red-700"
                                            : decision.decision === "update"
                                              ? "text-amber-700"
                                              : decision.decision === "cancel"
                                                ? "text-gray-500"
                                                : "text-emerald-700"
                                      }`}
                                    >
                                      {decision.decision
                                        .charAt(0)
                                        .toUpperCase() +
                                        decision.decision.slice(1)}
                                    </span>
                                    {decision.newSymbol && (
                                      <span className="text-gray-500">
                                        → {decision.newSymbol}
                                      </span>
                                    )}
                                  </div>
                                  {/* Reason display */}
                                  {reasonLabel && (
                                    <div
                                      className={`mt-2 flex items-start gap-2 rounded-md px-2.5 py-2 ${
                                        decision.decision === "retain"
                                          ? "bg-blue-100/60"
                                          : decision.decision === "remove"
                                            ? "bg-red-100/60"
                                            : decision.decision === "update"
                                              ? "bg-amber-100/60"
                                              : "bg-gray-100/60"
                                      }`}
                                    >
                                      {decision.decisionReason &&
                                        renderReasonIcon(
                                          decision.decisionReason,
                                          `mt-0.5 h-3.5 w-3.5 shrink-0 ${
                                            decision.decision === "retain"
                                              ? "text-blue-600"
                                              : decision.decision === "remove"
                                                ? "text-red-600"
                                                : decision.decision === "update"
                                                  ? "text-amber-600"
                                                  : "text-gray-500"
                                          }`,
                                        )}
                                      <span
                                        className={`text-[11px] leading-relaxed ${
                                          decision.decision === "retain"
                                            ? "text-blue-700"
                                            : decision.decision === "remove"
                                              ? "text-red-700"
                                              : decision.decision === "update"
                                                ? "text-amber-700"
                                                : "text-gray-600"
                                        }`}
                                      >
                                        {renderLabelWithBold(reasonLabel)}
                                      </span>
                                    </div>
                                  )}
                                  <ActivityMeta
                                    userEmail={decision.userEmail}
                                    userEntity={decision.userEntity}
                                    createdAt={decision.createdAt}
                                    viaEntity={itemEntity}
                                    subprogramme={decision.subprogramme}
                                    showSubprogramme={showSubprog}
                                    action="decided"
                                  />
                                </div>
                              </div>
                            );
                          }

                          // Approval items
                          if (item.type === "approval") {
                            const decision = item.data as MandateDecision;
                            const isSuperseded = item.isSuperseded;
                            return (
                              <div
                                key={`approval-${decision.id}`}
                                className={`text-xs ${isSuperseded ? "opacity-50" : ""}`}
                              >
                                <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
                                  <div className="flex items-center gap-2">
                                    <div
                                      className={`flex h-5 w-5 items-center justify-center rounded-full ${isSuperseded ? "bg-emerald-400" : "bg-emerald-500"}`}
                                    >
                                      <Check className="h-3 w-3 text-white" />
                                    </div>
                                    <span className="text-sm font-semibold text-emerald-700">
                                      Approved
                                    </span>
                                    <span className="text-gray-500">
                                      {decision.decision
                                        .charAt(0)
                                        .toUpperCase() +
                                        decision.decision.slice(1)}
                                    </span>
                                    {decision.newSymbol && (
                                      <span className="text-gray-500">
                                        → {decision.newSymbol}
                                      </span>
                                    )}
                                  </div>
                                  <ActivityMeta
                                    userEmail={decision.approvedBy!}
                                    userEntity={decision.approvedByEntity}
                                    createdAt={decision.approvedAt!}
                                    viaEntity={itemEntity}
                                    subprogramme={decision.subprogramme}
                                    showSubprogramme={showSubprog}
                                    action="approved"
                                  />
                                </div>
                              </div>
                            );
                          }

                          // Comment items
                          const comment = item.data as MandateComment;
                          const isReviewerComment =
                            comment.userEntity?.toUpperCase() === "DMSPC";
                          const isResolved = !!comment.resolvedAt;

                          return (
                            <div key={comment.id || i} className="text-xs">
                              <div
                                className={`rounded-lg border p-3 transition-all ${
                                  isResolved
                                    ? "border-gray-200 bg-gray-50 opacity-60"
                                    : isReviewerComment
                                      ? "border-amber-300 bg-amber-50/70 shadow-sm"
                                      : "border-gray-200 bg-white"
                                }`}
                              >
                                <div className="flex items-start gap-2">
                                  <MessageSquare
                                    className={`mt-0.5 h-4 w-4 shrink-0 ${
                                      isResolved
                                        ? "text-gray-400"
                                        : isReviewerComment
                                          ? "text-amber-500"
                                          : "text-gray-400"
                                    }`}
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div
                                      className={`leading-relaxed ${
                                        isResolved
                                          ? "text-gray-500 line-through"
                                          : isReviewerComment
                                            ? "font-medium text-gray-800"
                                            : "text-gray-700"
                                      }`}
                                    >
                                      {comment.comment}
                                    </div>
                                    <ActivityMeta
                                      userEmail={comment.userEmail}
                                      userEntity={comment.userEntity}
                                      createdAt={comment.createdAt}
                                      viaEntity={itemEntity}
                                      subprogramme={comment.subprogramme}
                                      showSubprogramme={showSubprog}
                                      action="commented"
                                    />
                                    {/* Mark as resolved button for reviewer comments */}
                                    {isReviewerComment && !isResolved && (
                                      <button
                                        onClick={async () => {
                                          const result =
                                            await resolveCommentAction(
                                              comment.id,
                                              true,
                                            );
                                          if (result.success && result.data) {
                                            // Update the comment in local state
                                            setAllComments((prev) =>
                                              prev.map((c) =>
                                                c.id === comment.id
                                                  ? result.data!
                                                  : c,
                                              ),
                                            );
                                          }
                                        }}
                                        className="mt-2 inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-1 text-[10px] font-medium text-amber-700 transition-colors hover:bg-amber-200"
                                      >
                                        <CheckCircle2 className="h-3 w-3" />
                                        Mark as resolved
                                      </button>
                                    )}
                                    {isResolved && (
                                      <div className="mt-2 flex items-center gap-2">
                                        <span className="inline-flex items-center gap-1 text-[10px] text-gray-400">
                                          <CheckCircle2 className="h-3 w-3" />
                                          Resolved by {
                                            comment.resolvedBy
                                          } on{" "}
                                          {new Date(
                                            comment.resolvedAt!,
                                          ).toLocaleDateString()}
                                        </span>
                                        <button
                                          onClick={async () => {
                                            const result =
                                              await resolveCommentAction(
                                                comment.id,
                                                false,
                                              );
                                            if (result.success && result.data) {
                                              setAllComments((prev) =>
                                                prev.map((c) =>
                                                  c.id === comment.id
                                                    ? result.data!
                                                    : c,
                                                ),
                                              );
                                            }
                                          }}
                                          className="text-[10px] text-gray-400 underline transition-colors hover:text-gray-600"
                                        >
                                          Reopen
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                  {/* Add comment input */}
                  {onComment && (
                    <div className="mt-4 flex gap-2">
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
                        className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:border-un-blue focus:ring-2 focus:ring-un-blue/20 focus:outline-none"
                      />
                      <button
                        onClick={() => {
                          if (commentText.trim()) {
                            handleComment(commentText.trim());
                            setCommentText("");
                          }
                        }}
                        disabled={!commentText.trim()}
                        className="rounded-lg bg-un-blue px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-un-blue/90 disabled:opacity-50"
                      >
                        Send
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Paragraphs Tab */}
              {activeTab === "paragraphs" && (
                <div className="space-y-4">
                  {allEntities && allEntities.length > 0 && (
                    <div className="rounded-xl bg-white p-4 shadow-sm">
                      <div className="mb-2 text-xs font-semibold tracking-wider text-gray-400 uppercase">
                        Filter by mentioned entity (Experimental)
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          onClick={() => setSelectedEntity(null)}
                          className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                            !selectedEntity
                              ? "bg-gray-700 text-white"
                              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
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
                              className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                                selectedEntity === e
                                  ? "bg-un-blue text-white"
                                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                              }`}
                            >
                              {e}{" "}
                              <span
                                className={
                                  selectedEntity === e
                                    ? "text-white/60"
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
                  <div className="rounded-xl bg-white p-5 shadow-sm">
                    {loading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
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
                      <div className="py-12 text-center">
                        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                          <AlertTriangle className="h-6 w-6 text-gray-400" />
                        </div>
                        <p className="text-sm font-medium text-gray-600">
                          No fulltext available
                        </p>
                        <p className="mt-1 text-xs text-gray-400">
                          The parsed document text is not available in our
                          database
                        </p>
                        {link && (
                          <a
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-un-blue hover:underline"
                          >
                            View original PDF →
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Diff Modal */}
      {diffCompareSymbol && (
        <DiffModal
          isOpen={diffModalOpen}
          onClose={() => {
            setDiffModalOpen(false);
            setDiffCompareSymbol(null);
            setDiffOriginalOverride(null);
          }}
          originalSymbol={diffOriginalOverride?.symbol ?? symbol}
          originalYear={diffOriginalOverride?.year ?? year ?? 0}
          originalTitle={diffOriginalOverride?.title ?? title}
          compareSymbol={diffCompareSymbol.symbol}
          compareYear={diffCompareSymbol.year}
          compareTitle={diffCompareSymbol.title ?? undefined}
        />
      )}
    </>
  );
}
