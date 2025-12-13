export interface CitationInfo {
  origin_document: string;
  budget_part: string | null;
  section: string | null;
  section_title: string | null;
  entity_long: string | null;
  entity: string | null;
  programme: number | null;
  programme_title: string | null;
  "sub-programme": string | null;
  component: string | null;
  part_in_document: string | null;
}

export interface RecurrenceAction {
  entity: string;
  newer_cited_symbols: string[];
  latest_symbol: string;
  group_title: string;
}

export interface Paragraph {
  text: string;
  type: string | null;
  heading_level: number | null;
  paragraph_level: number | null;
  paragraph_type: string | null;
  prefix: string | null;
}

export interface PPBRecord {
  full_document_symbol: string;
  num_citations: number;
  num_entities: number;
  entities: (string | null)[];
  link: string | null;
  priority_area: string | null;
  year: number | null;
  body: string | null;
  pillar: string | null;
  entity_long: string | null;
  description: string | null;
  type: string | null;
  citation_info: CitationInfo[];
  document_symbol: string | null;
  uniform_title: string | null;
  paragraphs?: Paragraph[];
  recurrence_actions?: RecurrenceAction[];
  entity_mentioning_paragraphs?: Record<string, Paragraph[]>;
}

// Hierarchical structure for UI
export interface MandateAction {
  type: "DROP" | "UPDATE";
  newerSymbol: string;
}

export interface Mandate {
  symbol: string;
  title: string;
  link: string | null;
  action: MandateAction | null;
  paragraphs?: Paragraph[];
  mentioningParagraphs?: Paragraph[];
  entity?: string;
  entityLong?: string | null;
  isBackground?: boolean;
}

export interface EntityData {
  entity: string;
  entityLong: string | null;
  backgroundMandates: Mandate[];
  legislativeMandates: Record<string, Mandate[]>;
}

export interface BudgetPartMeta {
  numeral: string;
  order: number;
  name: string;
}

export interface PartData {
  part: string;
  numeral: string;
  order: number;
  entities: EntityData[];
}
