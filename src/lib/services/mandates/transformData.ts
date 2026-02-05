import type {
  PPBRecord,
  PartData,
  Mandate,
  MandateAction,
  BudgetPartMeta,
  NewerVersion,
} from "@/types";

function getActionForEntity(
  rec: PPBRecord,
  entity: string,
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

function cleanTitle(title: string): string {
  return title.replace(/\s*:\s*$/, "").trim();
}

export function transformPPBData(
  records: PPBRecord[],
  budgetPartsMeta: BudgetPartMeta[],
  newerVersions?: Map<string, NewerVersion>,
): PartData[] {
  // Build lookup from key (database budget_part value) to meta
  const metaByKey: Record<string, BudgetPartMeta> = {};
  for (const meta of budgetPartsMeta) {
    metaByKey[meta.key.toLowerCase()] = meta;
  }

  const structure: Record<
    string,
    {
      meta: BudgetPartMeta | null;
      entities: Record<
        string,
        {
          entityLong: string | null;
          section: string | null;
          sectionTitle: string | null;
          backgroundMandates: Mandate[];
          legislativeMandates: Record<string, Mandate[]>;
        }
      >;
    }
  > = {};

  for (const rec of records) {
    const symbol = rec.full_document_symbol;
    const title = cleanTitle(rec.description || rec.uniform_title || "");
    const link = rec.link;
    const year = rec.year;
    const body = rec.body;
    const docType = rec.type;
    const metadataFromDb = rec.metadata_from_db ?? false;

    // Build entity -> entityLong map and entity -> subprogrammes from all citation_info
    const entityLongMap: Record<string, string> = {};
    const entitySubprogrammes: Record<string, string[]> = {};
    for (const ci of rec.citation_info) {
      if (ci.entity && ci.entity_long) {
        entityLongMap[ci.entity] = ci.entity_long;
      }
      if (ci.entity) {
        const subprog = ci["sub-programme"] || ci.component || null;
        if (!entitySubprogrammes[ci.entity])
          entitySubprogrammes[ci.entity] = [];
        if (subprog && !entitySubprogrammes[ci.entity].includes(subprog)) {
          entitySubprogrammes[ci.entity].push(subprog);
        }
      }
    }

    for (const ci of rec.citation_info) {
      const budgetPart = ci.budget_part || "Other";
      const entity = ci.entity;
      const entityLong = ci.entity_long;
      const partInDoc = ci.part_in_document;
      const isBackground = isBackgroundPart(partInDoc);
      const subprog = ci["sub-programme"] || ci.component || null;

      if (!entity) continue;

      const action = getActionForEntity(rec, entity);
      const relevance = rec.entity_relevance?.[entity];
      const relevanceIndices = relevance?.indices || [];
      const aiComments = relevance?.ai_comments || {};

      const mandate: Mandate = {
        symbol,
        title,
        link,
        year,
        body,
        docType,
        action,
        relevanceCount: relevanceIndices.length,
        relevanceIndices,
        aiComments,
        entity,
        entityLong,
        isBackground,
        otherEntitiesCount: Math.max(0, rec.num_entities - 1),
        allEntities: (rec.entities || []).filter(
          (e): e is string => e !== null,
        ),
        entitySubprogrammes,
        entityLongMap,
        allEntityRelevance: rec.entity_relevance || {},
        metadataFromDb,
        newerVersion: rec.document_symbol
          ? newerVersions?.get(rec.document_symbol)
          : undefined,
      };

      const meta = metaByKey[budgetPart.toLowerCase()] || null;

      if (!structure[budgetPart]) {
        structure[budgetPart] = { meta, entities: {} };
      }

      if (!structure[budgetPart].entities[entity]) {
        structure[budgetPart].entities[entity] = {
          entityLong,
          section: ci.section,
          sectionTitle: ci.section_title,
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
        if (
          !entityData.legislativeMandates[key].some((m) => m.symbol === symbol)
        ) {
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
      part: data.meta?.label || part,
      numeral: data.meta?.numeral || "",
      order: data.meta?.order ?? 999,
      entities: Object.entries(data.entities)
        .sort(([, a], [, b]) => {
          // Sort by section first (nulls last), then by entity name
          const sectionA = a.section ?? "\uffff";
          const sectionB = b.section ?? "\uffff";
          if (sectionA !== sectionB) return sectionA.localeCompare(sectionB);
          return 0; // Keep original order within section
        })
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([entity, entityData]) => ({
          entity,
          entityLong: entityData.entityLong,
          section: entityData.section,
          sectionTitle: entityData.sectionTitle,
          backgroundMandates: entityData.backgroundMandates,
          legislativeMandates: entityData.legislativeMandates,
        })),
    }));

  return parts;
}
