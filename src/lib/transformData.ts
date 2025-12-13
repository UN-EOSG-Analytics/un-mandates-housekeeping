import type {
  PPBRecord,
  SectionData,
  Mandate,
  MandateAction,
} from "@/types";

function cleanSectionTitle(title: string): string {
  return title
    .replace(/^Financing of the /i, "")
    .replace(/^Financing of /i, "")
    .replace(/^The /i, "");
}

function sectionSortKey(section: string): [number, number, string] {
  const match = section.match(/^(\d+)(?:\s*\(Add\.?(\d+)\))?/i);
  if (match) {
    const base = parseInt(match[1], 10);
    const isAddendum = !!match[2];
    return [isAddendum ? 1 : 0, base, section];
  }
  return [2, 999, section];
}

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

export function transformPPBData(records: PPBRecord[]): SectionData[] {
  const structure: Record<
    string,
    {
      sectionTitle: string;
      entities: Record<
        string,
        { entityLong: string | null; subprogrammes: Record<string, Mandate[]> }
      >;
    }
  > = {};

  for (const rec of records) {
    const symbol = rec.full_document_symbol;
    const title = rec.description || rec.uniform_title || "";
    const link = rec.link;

    for (const ci of rec.citation_info) {
      const section = ci.section;
      const sectionTitle = ci.section_title;
      const entity = ci.entity;
      const entityLong = ci.entity_long;
      const subprog = ci["sub-programme"] || ci.component || "General";

      if (!section || !entity) continue;

      const action = getActionForEntity(rec, entity);

      if (!structure[section]) {
        structure[section] = {
          sectionTitle: cleanSectionTitle(sectionTitle || ""),
          entities: {},
        };
      }

      if (!structure[section].entities[entity]) {
        structure[section].entities[entity] = { entityLong, subprogrammes: {} };
      }

      if (!structure[section].entities[entity].subprogrammes[subprog]) {
        structure[section].entities[entity].subprogrammes[subprog] = [];
      }

      const existing =
        structure[section].entities[entity].subprogrammes[subprog];
      if (!existing.some((m) => m.symbol === symbol)) {
        existing.push({ symbol, title, link, action, paragraphs: rec.paragraphs });
      }
    }
  }

  // Sort: regular sections first, then addendum sections
  const sections: SectionData[] = Object.entries(structure)
    .sort(([a], [b]) => {
      const [aType, aBase, aStr] = sectionSortKey(a);
      const [bType, bBase, bStr] = sectionSortKey(b);
      if (aType !== bType) return aType - bType;
      if (aBase !== bBase) return aBase - bBase;
      return aStr.localeCompare(bStr);
    })
    .map(([section, data]) => ({
      section,
      sectionTitle: data.sectionTitle,
      entities: Object.entries(data.entities)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([entity, entityData]) => ({
          entity,
          entityLong: entityData.entityLong,
          subprogrammes: entityData.subprogrammes,
        })),
    }));

  return sections;
}

