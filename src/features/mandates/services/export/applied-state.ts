import { query } from "@/lib/db/db";
import type { PPBRecord, CitationInfo, ManualMetadata } from "@/types";
import { fetchPPBRecords } from "@/features/mandates/services/data-service";
import {
  fetchDocumentMetadata,
  cleanTitle as cleanMetadataTitle,
} from "@/features/mandates/services/documents/metadata";

export interface AppliedMandateRow {
  symbol: string;
  title: string;
  body: string;
  docType: string | null;
  year: number | null;
  link: string | null;
  entity: string;
  entityLong: string | null;
  subprogramme: string | null;
  part: string | null;
}

export interface LatestDecisionRow {
  id: string;
  documentSymbol: string;
  entity: string;
  subprogramme: string | null;
  decision: string;
  newSymbol: string | null;
  manualMetadata: ManualMetadata | null;
  decisionReason: string | null;
  otherReason: string | null;
  userEmail: string;
  userEntity: string | null;
  createdAt: string;
  approvedBy: string | null;
  approvedByEntity: string | null;
  approvedAt: string | null;
}

interface DecisionRow {
  id: string;
  document_symbol: string;
  entity: string;
  subprogramme: string | null;
  decision: string;
  new_symbol: string | null;
  manual_metadata: ManualMetadata | null;
  decision_reason: string | null;
  other_reason: string | null;
  user_email: string;
  user_entity: string | null;
  created_at: string;
  approved_by: string | null;
  approved_by_entity: string | null;
  approved_at: string | null;
}

interface ResolvedDecisionMetadata {
  title: string;
  body: string;
  docType: string | null;
  year: number | null;
  link: string | null;
}

function getSubprogramme(ci: CitationInfo): string | null {
  return ci["sub-programme"] || ci.component || null;
}

function isLegislative(part: string | null): boolean {
  return part === "Legislative mandates";
}

function decisionKey(
  entity: string,
  symbol: string,
  subprogramme: string | null,
): string {
  return `${entity}:${symbol}:${subprogramme || ""}`;
}

function applyManualOverrides(
  base: ResolvedDecisionMetadata,
  manual: ManualMetadata | null | undefined,
): ResolvedDecisionMetadata {
  if (!manual) return base;
  return {
    title: manual.title ?? base.title,
    body: manual.body ?? base.body,
    docType: base.docType,
    year: manual.year ?? base.year,
    link: manual.link ?? base.link,
  };
}

function cleanTitle(title: string | null | undefined): string {
  if (!title) return "";
  return cleanMetadataTitle(title) || "";
}

function getSubprogrammeSortKey(subprogramme: string | null): string {
  return subprogramme?.trim() || "All Subprogrammes";
}

function compareSymbolsNatural(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function compareAppliedRows(
  a: AppliedMandateRow,
  b: AppliedMandateRow,
): number {
  const aSub = getSubprogrammeSortKey(a.subprogramme).toLowerCase();
  const bSub = getSubprogrammeSortKey(b.subprogramme).toLowerCase();
  const aIsAll = aSub.includes("all subprogramme");
  const bIsAll = bSub.includes("all subprogramme");
  if (aIsAll && !bIsAll) return -1;
  if (!aIsAll && bIsAll) return 1;
  if (aSub !== bSub) {
    return aSub.localeCompare(bSub, undefined, { sensitivity: "base" });
  }
  return compareSymbolsNatural(a.symbol, b.symbol);
}

async function fetchLatestDecisions(
  entity?: string,
): Promise<LatestDecisionRow[]> {
  const rows = await query<DecisionRow>(
    `
      SELECT DISTINCT ON (d.entity, d.document_symbol, d.subprogramme)
        d.id,
        d.document_symbol,
        d.entity,
        d.subprogramme,
        d.decision,
        d.new_symbol,
        d.manual_metadata,
        d.decision_reason,
        d.other_reason,
        d.user_email,
        u.entity as user_entity,
        d.created_at,
        d.approved_by,
        approver.entity as approved_by_entity,
        d.approved_at
      FROM mandates_housekeeping.mandate_decisions d
      LEFT JOIN mandates_housekeeping.users u ON d.user_email = u.email
      LEFT JOIN mandates_housekeeping.users approver ON d.approved_by = approver.email
      WHERE ($1::text IS NULL OR d.entity = $1)
      ORDER BY d.entity, d.document_symbol, d.subprogramme, d.created_at DESC, d.id DESC
    `,
    [entity || null],
  );

  return rows.map((row) => ({
    id: row.id,
    documentSymbol: row.document_symbol,
    entity: row.entity,
    subprogramme: row.subprogramme,
    decision: row.decision,
    newSymbol: row.new_symbol,
    manualMetadata: row.manual_metadata,
    decisionReason: row.decision_reason,
    otherReason: row.other_reason,
    userEmail: row.user_email,
    userEntity: row.user_entity,
    createdAt: row.created_at,
    approvedBy: row.approved_by,
    approvedByEntity: row.approved_by_entity,
    approvedAt: row.approved_at,
  }));
}

function resolveDecisionMetadata(
  symbol: string,
  manualMetadata: ManualMetadata | null,
  metadataLookup: Record<string, ResolvedDecisionMetadata | null>,
): ResolvedDecisionMetadata {
  const base = metadataLookup[symbol] || {
    title: "",
    body: "",
    docType: null,
    year: null,
    link: null,
  };
  return applyManualOverrides(base, manualMetadata);
}

function buildEntityLongMap(records: PPBRecord[]): Map<string, string | null> {
  const map = new Map<string, string | null>();
  for (const rec of records) {
    for (const ci of rec.citation_info) {
      if (ci.entity && !map.has(ci.entity)) {
        map.set(ci.entity, ci.entity_long || null);
      }
    }
  }
  return map;
}

export async function getAppliedExportData(entity?: string): Promise<{
  rows: AppliedMandateRow[];
  decisions: LatestDecisionRow[];
}> {
  const records = await fetchPPBRecords();
  const decisions = await fetchLatestDecisions(entity);
  const decisionsMap = new Map<string, LatestDecisionRow>();
  const symbolsToResolve = new Set<string>();

  for (const decision of decisions) {
    decisionsMap.set(
      decisionKey(
        decision.entity,
        decision.documentSymbol,
        decision.subprogramme,
      ),
      decision,
    );
    if (decision.decision === "update" && decision.newSymbol) {
      symbolsToResolve.add(decision.newSymbol);
    }
    if (decision.decision === "add") {
      symbolsToResolve.add(decision.documentSymbol);
    }
  }

  const metadata = await fetchDocumentMetadata([...symbolsToResolve]);
  const metadataLookup: Record<string, ResolvedDecisionMetadata | null> = {};
  for (const [symbol, meta] of Object.entries(metadata)) {
    metadataLookup[symbol] = meta
      ? {
          title: cleanTitle(meta.title),
          body: meta.body || "",
          docType: meta.docType || null,
          year: meta.year ?? null,
          link: meta.link || null,
        }
      : null;
  }

  const entityLongMap = buildEntityLongMap(records);
  const rows: AppliedMandateRow[] = [];
  const seen = new Set<string>();

  for (const rec of records) {
    for (const ci of rec.citation_info) {
      if (!ci.entity) continue;
      if (entity && ci.entity !== entity) continue;
      if (!isLegislative(ci.part_in_document)) continue;

      const subprogramme = getSubprogramme(ci);
      const key = decisionKey(
        ci.entity,
        rec.full_document_symbol,
        subprogramme,
      );
      const decision = decisionsMap.get(key);

      if (decision?.decision === "remove") continue;

      if (decision?.decision === "update" && decision.newSymbol) {
        const resolved = resolveDecisionMetadata(
          decision.newSymbol,
          decision.manualMetadata || null,
          metadataLookup,
        );
        const appliedKey = decisionKey(
          decision.entity,
          decision.newSymbol,
          decision.subprogramme,
        );
        if (!seen.has(appliedKey)) {
          seen.add(appliedKey);
          rows.push({
            symbol: decision.newSymbol,
            title: cleanTitle(resolved.title),
            body: resolved.body || "",
            docType: resolved.docType || null,
            year: resolved.year ?? null,
            link: resolved.link || null,
            entity: decision.entity,
            entityLong: ci.entity_long || null,
            subprogramme,
            part: "Legislative mandates",
          });
        }
        continue;
      }

      const appliedKey = decisionKey(
        ci.entity,
        rec.full_document_symbol,
        subprogramme,
      );
      if (seen.has(appliedKey)) continue;
      seen.add(appliedKey);

      rows.push({
        symbol: rec.full_document_symbol,
        title: cleanTitle(rec.description || rec.uniform_title || ""),
        body: rec.body || "",
        docType: rec.type || null,
        year: rec.year,
        link: rec.link,
        entity: ci.entity,
        entityLong: ci.entity_long || null,
        subprogramme,
        part: ci.part_in_document,
      });
    }
  }

  for (const decision of decisions) {
    if (decision.decision !== "add") continue;
    if (entity && decision.entity !== entity) continue;

    const appliedKey = decisionKey(
      decision.entity,
      decision.documentSymbol,
      decision.subprogramme,
    );
    if (seen.has(appliedKey)) continue;

    const resolved = resolveDecisionMetadata(
      decision.documentSymbol,
      decision.manualMetadata || null,
      metadataLookup,
    );
    rows.push({
      symbol: decision.documentSymbol,
      title: cleanTitle(resolved.title),
      body: resolved.body || "",
      docType: resolved.docType || null,
      year: resolved.year ?? null,
      link: resolved.link || null,
      entity: decision.entity,
      entityLong: entityLongMap.get(decision.entity) || null,
      subprogramme: decision.subprogramme,
      part: "Legislative mandates",
    });
  }

  return {
    rows: rows.sort(compareAppliedRows),
    decisions,
  };
}
