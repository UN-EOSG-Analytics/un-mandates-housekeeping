import type {
  PPBRecord,
  PartData,
  Mandate,
  MandateAction,
  BudgetPartMeta,
} from "@/types";

function getActionForEntity(
  rec: PPBRecord,
  entity: string
): MandateAction | null {
  const action = rec.recurrence_actions?.find((a) => a.entity === entity);
  if (!action) return null;

  if (action.newer_cited_symbols.length > 0) {
    return { type: "DROP", newerSymbol: action.newer_cited_symbols[0] };
  }
  return { type: "UPDATE", newerSymbol: action.latest_symbol };
}

function isBackgroundPart(part: string | null): boolean {
  return part === "Mandates and background";
}

export function transformPPBData(
  records: PPBRecord[],
  budgetPartsMeta: BudgetPartMeta[]
): PartData[] {
  // Build lookup from name to meta
  const metaByName: Record<string, BudgetPartMeta> = {};
  for (const meta of budgetPartsMeta) {
    metaByName[meta.name.toLowerCase()] = meta;
  }

  const structure: Record<
    string,
    {
      meta: BudgetPartMeta | null;
      entities: Record<
        string,
        {
          entityLong: string | null;
          backgroundMandates: Mandate[];
          legislativeMandates: Record<string, Mandate[]>;
        }
      >;
    }
  > = {};

  for (const rec of records) {
    const symbol = rec.full_document_symbol;
    const title = rec.description || rec.uniform_title || "";
    const link = rec.link;

    for (const ci of rec.citation_info) {
      const budgetPart = ci.budget_part || "Other";
      const entity = ci.entity;
      const entityLong = ci.entity_long;
      const partInDoc = ci.part_in_document;
      const isBackground = isBackgroundPart(partInDoc);
      const subprog = ci["sub-programme"] || ci.component || null;

      if (!entity) continue;

      const action = getActionForEntity(rec, entity);
      const mentionCount = rec.entity_mention_counts?.[entity] || 0;
      const mentionIndices = rec.entity_mention_indices?.[entity] || [];

      const mandate: Mandate = {
        symbol,
        title,
        link,
        action,
        mentionCount,
        mentionIndices,
        entity,
        entityLong,
        isBackground,
      };

      const meta = metaByName[budgetPart.toLowerCase()] || null;

      if (!structure[budgetPart]) {
        structure[budgetPart] = { meta, entities: {} };
      }

      if (!structure[budgetPart].entities[entity]) {
        structure[budgetPart].entities[entity] = {
          entityLong,
          backgroundMandates: [],
          legislativeMandates: {},
        };
      }

      const entityData = structure[budgetPart].entities[entity];

      if (isBackground) {
        if (!entityData.backgroundMandates.some((m) => m.symbol === symbol)) {
          entityData.backgroundMandates.push(mandate);
        }
      } else {
        const key = subprog || "Legislative mandates";
        if (!entityData.legislativeMandates[key]) {
          entityData.legislativeMandates[key] = [];
        }
        if (!entityData.legislativeMandates[key].some((m) => m.symbol === symbol)) {
          entityData.legislativeMandates[key].push(mandate);
        }
      }
    }
  }

  // Sort by order (roman numeral order), unknown parts at end
  const parts: PartData[] = Object.entries(structure)
    .sort(([, a], [, b]) => {
      const aOrder = a.meta?.order ?? 999;
      const bOrder = b.meta?.order ?? 999;
      return aOrder - bOrder;
    })
    .map(([part, data]) => ({
      part,
      numeral: data.meta?.numeral || "",
      order: data.meta?.order ?? 999,
      entities: Object.entries(data.entities)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([entity, entityData]) => ({
          entity,
          entityLong: entityData.entityLong,
          backgroundMandates: entityData.backgroundMandates,
          legislativeMandates: entityData.legislativeMandates,
        })),
    }));

  return parts;
}
