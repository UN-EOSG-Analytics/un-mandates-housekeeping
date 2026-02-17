import JSZip from "jszip";
import { readFile } from "fs/promises";
import { join } from "path";
import {
  getAppliedExportData,
  type AppliedMandateRow,
} from "@/features/mandates/services/export/applied-state";
import { query } from "@/lib/db/db";

interface Mandate {
  symbol: string;
  title: string;
  link: string | null;
  body: string | null;
}

// Master hierarchy order for intergovernmental bodies (UN standard)
// Maps both abbreviations AND full names to the same sort index so sorting
// works regardless of whether the body field contains "GA" or "General Assembly".
const BODY_ORDER_LIST: [string, string | null][] = [
  ["Charter", null],
  ["UNCLOS", null],
  ["Other", null],
  ["GA", "General Assembly"],
  ["ECOSOC", "Economic and Social Council"],
  ["TC", "Trusteeship Council"],
  ["SC", "Security Council"],
  ["HRC", "Human Rights Council"],
  ["UNEA", "United Nations Environment Assembly"],
  ["UNHA and Other", "United Nations Habitat Assembly and other"],
];

// Build sort-index lookup accepting both abbreviation and full name
const BODY_SORT_INDEX: Record<string, number> = {};
BODY_ORDER_LIST.forEach(([abbr, full], i) => {
  BODY_SORT_INDEX[abbr] = i;
  if (full) BODY_SORT_INDEX[full] = i;
});

// Well-known body abbreviation → full name (fallback before DB lookup)
const BODY_NAMES: Record<string, string> = {};
for (const [abbr, full] of BODY_ORDER_LIST) {
  if (full) BODY_NAMES[abbr] = full;
}

// Bodies that get a fixed label (no "resolutions and decisions" suffix)
const FIXED_LABELS: Record<string, string> = {
  Charter: "Charter of the United Nations",
  UNCLOS: "Conventions",
  Other: "Conventions and protocols",
};

async function fetchBodyFullNames(): Promise<Record<string, string>> {
  const rows = await query<{ entity: string; entity_long: string }>(
    "SELECT entity, entity_long FROM systemchart.entities",
  );
  const map: Record<string, string> = {};
  for (const row of rows) {
    map[row.entity] = row.entity_long;
  }
  return map;
}

// Fetch bracket descriptions from meta_title for symbols where the resolved
// title is just "Resolution NNNN (YYYY)" (mainly SC resolutions).
// Returns symbol → bracket text, e.g. "S/RES/1325(2000)" → "[on women and peace and security]"
async function fetchBracketDescriptions(): Promise<Record<string, string>> {
  const rows = await query<{ symbol: string; title: string }>(
    `SELECT ppb_full_document_symbol AS symbol, title
     FROM ppb2026.source_documents_metadata_clean
     WHERE title LIKE '%[%]%'`,
  );
  const map: Record<string, string> = {};
  for (const row of rows) {
    const match = row.title.match(/\[(.+?)\]\s*$/);
    if (match) {
      map[row.symbol] = match[1];
    }
  }
  return map;
}

function getBodyLabel(
  body: string,
  hasRes: boolean,
  hasDec: boolean,
  bodyFullNames: Record<string, string>,
): string {
  if (FIXED_LABELS[body]) return FIXED_LABELS[body];
  // If body is already a full name (e.g. "General Assembly"), use it directly.
  // Otherwise look up abbreviation → full name via BODY_NAMES, then DB, then raw value.
  const isAlreadyFullName = Object.values(BODY_NAMES).includes(body);
  const name = isAlreadyFullName ? body : (BODY_NAMES[body] || bodyFullNames[body] || body);
  if (hasRes && hasDec) return `${name} resolutions and decisions`;
  if (hasDec) return `${name} decisions`;
  return `${name} resolutions`;
}

function sortBodies(bodies: string[]): string[] {
  return [...bodies].sort((a, b) => {
    const ai = BODY_SORT_INDEX[a] ?? -1;
    const bi = BODY_SORT_INDEX[b] ?? -1;
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

function stripPrefix(symbol: string): string {
  // Standard UN organs: A/RES/70/1, S/RES/2250, E/DEC/2015/1, etc.
  const standard = symbol
    .replace(/^[AES]\/RES\//, "")
    .replace(/^[AES]\/DEC\//, "")
    .replace(/^S\/RES\//, "");
  if (standard !== symbol) return normalizeSymbolSpacing(standard.trim());
  // Governing bodies: "E/CEPAL Resolution 769 (XL)" → "769 (XL)"
  // Also handles "UNEP/EA.RES/1/7" style or "X/Y Decision 3 (Z)"
  const bodyRes = symbol.match(/\b(?:Resolution|Decision)\s+(.+)$/i);
  if (bodyRes) return normalizeSymbolSpacing(bodyRes[1].trim());
  return normalizeSymbolSpacing(symbol.trim());
}

// Ensure space before parenthetical year/session: "1904(2009)" → "1904 (2009)"
function normalizeSymbolSpacing(s: string): string {
  return s.replace(/(\d)\(/, "$1 (");
}

function isDecision(symbol: string): boolean {
  return /^[AES]\/DEC\//.test(symbol);
}

function isPresidentialStatement(symbol: string): boolean {
  return /^S\/PRST\//.test(symbol);
}

function escapeXml(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function cleanTitle(title: string): string {
  return title.replace(/[\s:]+$/, "");
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Detect titles that are just the resolution label (e.g. "Resolution 1325 (2000)")
// and thus redundant with the symbol column
const REDUNDANT_TITLE_RE = /^(Security Council )?resolution\s+\d+(?:\s*\(\d{4}\))?\s*\/?$/i;

// Extract topic from PRST bracket titles like:
// "Statement [made on behalf of … the item entitled "Central African region"]"
// → "Central African region"
function extractPrstTopic(title: string): string {
  // Try "item entitled "TOPIC"" pattern (with various quote styles)
  const entitled = title.match(/item entitled\s+["\u201c](.+?)["\u201d]/i);
  if (entitled) return entitled[1].replace(/[\s"]+$/, "");
  // Fallback: extract entire bracket content for manual inspection
  const bracket = title.match(/\[(.+?)\]\s*$/);
  if (bracket) return bracket[1];
  return title;
}

// Enhance mandate titles: replace redundant "Resolution NNNN (YYYY)" titles
// with bracket descriptions where available, or empty string if none.
// Also clean up PRST titles to just the topic name.
function enhanceTitles(
  mandates: Mandate[],
  bracketDescs: Record<string, string>,
): void {
  for (const m of mandates) {
    if (REDUNDANT_TITLE_RE.test(m.title)) {
      m.title = capitalize(bracketDescs[m.symbol] || "");
    } else if (isPresidentialStatement(m.symbol)) {
      // The PPB description is just "Statement /" — the full bracket text
      // with the topic is only in the metadata table (bracketDescs)
      const bracketText = bracketDescs[m.symbol];
      m.title = bracketText ? extractPrstTopic(bracketText) : "";
    }
  }
}

// Style IDs from UN template: H1 = "_ H_1", H23 = "_ H_2/3", H4 = "_ H_4"

const H23_TABS = `<w:tabs><w:tab w:val="right" w:pos="1022"/><w:tab w:val="left" w:pos="1267"/><w:tab w:val="left" w:pos="1742"/><w:tab w:val="left" w:pos="2218"/><w:tab w:val="left" w:pos="2693"/><w:tab w:val="left" w:pos="3182"/><w:tab w:val="left" w:pos="3658"/><w:tab w:val="left" w:pos="4133"/><w:tab w:val="left" w:pos="4622"/><w:tab w:val="left" w:pos="5098"/><w:tab w:val="left" w:pos="5573"/><w:tab w:val="left" w:pos="6048"/></w:tabs>`;

// Cell paragraph properties matching UN SingleTxt style with cleared inherited tabs
const CELL_PPR_SYMBOL = `<w:pPr><w:pStyle w:val="SingleTxt"/><w:tabs><w:tab w:val="clear" w:pos="1267"/><w:tab w:val="clear" w:pos="1742"/><w:tab w:val="clear" w:pos="2218"/><w:tab w:val="clear" w:pos="2693"/><w:tab w:val="clear" w:pos="3182"/><w:tab w:val="clear" w:pos="3658"/><w:tab w:val="clear" w:pos="4133"/><w:tab w:val="clear" w:pos="4622"/><w:tab w:val="clear" w:pos="5098"/><w:tab w:val="clear" w:pos="5573"/><w:tab w:val="clear" w:pos="6048"/><w:tab w:val="left" w:pos="288"/><w:tab w:val="left" w:pos="576"/><w:tab w:val="left" w:pos="864"/><w:tab w:val="left" w:pos="1152"/></w:tabs><w:spacing w:before="40" w:after="40" w:line="200" w:lineRule="exact"/><w:ind w:left="0" w:right="43"/><w:jc w:val="left"/><w:rPr><w:sz w:val="17"/></w:rPr></w:pPr>`;

const CELL_PPR_TITLE = `<w:pPr><w:pStyle w:val="SingleTxt"/><w:tabs><w:tab w:val="clear" w:pos="1267"/><w:tab w:val="clear" w:pos="1742"/><w:tab w:val="clear" w:pos="2218"/><w:tab w:val="clear" w:pos="2693"/><w:tab w:val="clear" w:pos="3182"/><w:tab w:val="clear" w:pos="3658"/><w:tab w:val="clear" w:pos="4133"/><w:tab w:val="clear" w:pos="4622"/><w:tab w:val="clear" w:pos="5098"/><w:tab w:val="clear" w:pos="5573"/><w:tab w:val="clear" w:pos="6048"/><w:tab w:val="left" w:pos="288"/><w:tab w:val="left" w:pos="576"/><w:tab w:val="left" w:pos="864"/><w:tab w:val="left" w:pos="1152"/></w:tabs><w:spacing w:before="40" w:after="40" w:line="200" w:lineRule="exact"/><w:ind w:left="86" w:right="43"/><w:jc w:val="left"/><w:rPr><w:sz w:val="17"/></w:rPr></w:pPr>`;

// Empty spacer paragraphs matching the reference document pattern
const EMPTY_SINGLETXT = `<w:p><w:pPr><w:pStyle w:val="SingleTxt"/></w:pPr></w:p>`;
const EMPTY_PARA = `<w:p/>`;

// Generate paragraph XML matching exact UN reference formatting
function paraH1(text: string): string {
  const t = escapeXml(text);
  return `<w:p><w:pPr><w:pStyle w:val="H1"/><w:ind w:right="1260"/></w:pPr><w:r><w:tab/></w:r><w:r><w:tab/><w:t>${t}</w:t></w:r></w:p>`;
}

// H23 pair: emits spacer before, both lines with keepNext, spacer after
function paraH23Pair(line1: string, line2: string): string {
  const t1 = escapeXml(line1);
  const t2 = escapeXml(line2);
  return `${EMPTY_SINGLETXT}<w:p><w:pPr><w:pStyle w:val="H23"/>${H23_TABS}<w:keepNext/><w:ind w:left="1267" w:right="1260" w:hanging="1267"/></w:pPr><w:r><w:tab/></w:r><w:r><w:tab/><w:t>${t1}</w:t></w:r></w:p><w:p><w:pPr><w:pStyle w:val="H23"/>${H23_TABS}<w:ind w:left="1267" w:right="1260" w:hanging="1267"/></w:pPr><w:r><w:tab/></w:r><w:r><w:tab/><w:t>${t2}</w:t></w:r></w:p>${EMPTY_SINGLETXT}`;
}

// Single H23 line (when subprogramme name doesn't split into label+title)
function paraH23(text: string): string {
  const t = escapeXml(text);
  return `${EMPTY_SINGLETXT}<w:p><w:pPr><w:pStyle w:val="H23"/>${H23_TABS}<w:ind w:left="1267" w:right="1260" w:hanging="1267"/></w:pPr><w:r><w:tab/></w:r><w:r><w:tab/><w:t>${t}</w:t></w:r></w:p>${EMPTY_SINGLETXT}`;
}

function paraH4(text: string): string {
  const t = escapeXml(text);
  return `${EMPTY_PARA}<w:p><w:pPr><w:pStyle w:val="H4"/><w:ind w:right="1260"/></w:pPr><w:r><w:t>${t}</w:t></w:r></w:p>${EMPTY_PARA}`;
}

// A grouped citation entry: one or more mandates sharing the same title
interface CitationEntry {
  mandates: Mandate[];
  title: string;
}

// Group mandates with identical titles, preserving symbol sort order
function groupByTitle(mandates: Mandate[]): CitationEntry[] {
  const sorted = [...mandates].sort((a, b) => a.symbol.localeCompare(b.symbol));
  const titleMap = new Map<string, Mandate[]>();
  const titleOrder: string[] = [];
  for (const m of sorted) {
    const key = m.title.trim();
    if (!titleMap.has(key)) {
      titleMap.set(key, []);
      titleOrder.push(key);
    }
    titleMap.get(key)!.push(m);
  }
  // Sort groups by first symbol in each group
  return titleOrder.map((t) => ({ mandates: titleMap.get(t)!, title: t }));
}

// Build symbol cell with potentially multiple symbols joined by "; "
function buildSymbolCell(entry: CitationEntry, hyperlinks: Map<string, string>): string {
  const parts: string[] = [];
  for (const m of entry.mandates) {
    const displaySymbol = escapeXml(stripPrefix(m.symbol));
    if (m.link) {
      const rId = `rId${hyperlinks.size + 10}`;
      hyperlinks.set(rId, m.link);
      parts.push(`<w:hyperlink r:id="${rId}" w:history="1"><w:r><w:rPr><w:rStyle w:val="Hyperlink"/><w:sz w:val="17"/></w:rPr><w:t>${displaySymbol}</w:t></w:r></w:hyperlink>`);
    } else {
      parts.push(`<w:r><w:rPr><w:sz w:val="17"/></w:rPr><w:t>${displaySymbol}</w:t></w:r>`);
    }
  }
  // Join with "; " runs between each symbol
  const separator = `<w:r><w:rPr><w:sz w:val="17"/></w:rPr><w:t xml:space="preserve">; </w:t></w:r>`;
  const symbolContent = parts.join(separator);
  return `<w:tc><w:tcPr><w:tcW w:w="733" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="auto"/></w:tcPr><w:p>${CELL_PPR_SYMBOL}${symbolContent}</w:p></w:tc>`;
}

// Map body names found in titles to UN document symbol prefixes
const TITLE_BODY_TO_PREFIX: Record<string, string> = {
  "General Assembly": "A/RES/",
  "Security Council": "S/RES/",
  "Economic and Social Council": "E/RES/",
  "Human Rights Council": "A/HRC/RES/",
};

// Pattern: "Body resolution(s) 71/243" — captures body name and number
const TITLE_RES_RE = new RegExp(
  `(${Object.keys(TITLE_BODY_TO_PREFIX).join("|")})\\s+resolutions?\\s+(\\d+(?:/\\d+)*)`,
  "gi",
);

// Build title cell with inline hyperlinks for resolution references
function buildTitleCell(entry: CitationEntry, hyperlinks: Map<string, string>): string {
  const raw = entry.title;
  const segments: string[] = [];
  let lastIndex = 0;

  for (const match of raw.matchAll(TITLE_RES_RE)) {
    const bodyName = match[1];
    const num = match[2];
    const prefix = TITLE_BODY_TO_PREFIX[bodyName];
    if (!prefix) continue;

    // Text before the match
    if (match.index > lastIndex) {
      segments.push(textRun(raw.slice(lastIndex, match.index)));
    }
    // "General Assembly resolution " as plain text
    const labelEnd = match.index + match[0].length - num.length;
    segments.push(textRun(raw.slice(match.index, labelEnd)));
    // The number as a hyperlink
    const url = `https://documents.un.org/en/${prefix}${num}`;
    const rId = `rId${hyperlinks.size + 10}`;
    hyperlinks.set(rId, url);
    segments.push(
      `<w:hyperlink r:id="${rId}" w:history="1"><w:r><w:rPr><w:rStyle w:val="Hyperlink"/><w:sz w:val="17"/></w:rPr><w:t>${escapeXml(num)}</w:t></w:r></w:hyperlink>`,
    );
    lastIndex = match.index + match[0].length;
  }

  // Remaining text (or entire title if no matches)
  if (lastIndex < raw.length) {
    segments.push(textRun(raw.slice(lastIndex)));
  }

  const content = segments.length > 0
    ? segments.join("")
    : textRun(raw);

  return `<w:tc><w:tcPr><w:tcW w:w="1767" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="auto"/></w:tcPr><w:p>${CELL_PPR_TITLE}${content}</w:p></w:tc>`;
}

function textRun(text: string): string {
  return `<w:r><w:rPr><w:sz w:val="17"/></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

const CHARTER_URL = "https://www.un.org/en/about-us/un-charter/full-text";

// Render Charter section as a single paragraph: "Articles 1, 7, 12 (2) and 50"
// Non-article symbols (e.g. "ICJ Statute") rendered separately after
function charterContent(
  mandates: Mandate[],
  hyperlinks: Map<string, string>,
): string {
  const articles: string[] = [];
  const other: Mandate[] = [];

  for (const m of mandates) {
    const artMatch = m.symbol.match(/^UN Charter Article\s+(.+)$/i);
    if (artMatch) {
      articles.push(artMatch[1].trim());
    } else {
      other.push(m);
    }
  }

  let xml = "";

  if (articles.length > 0) {
    // Natural sort: "1", "7", "12 (2)", "102"
    articles.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const label = articles.length === 1 ? "Article" : "Articles";
    // Join: "1, 7, 12 (2) and 50"
    let joined: string;
    if (articles.length === 1) {
      joined = articles[0];
    } else {
      joined = articles.slice(0, -1).join(", ") + " and " + articles[articles.length - 1];
    }
    const text = `${label} ${joined}`;

    const rId = `rId${hyperlinks.size + 10}`;
    hyperlinks.set(rId, CHARTER_URL);
    // Left-aligned paragraph matching H4/table indent level
    xml += `<w:p><w:pPr><w:pStyle w:val="SingleTxt"/><w:ind w:left="0" w:right="1260"/></w:pPr><w:hyperlink r:id="${rId}" w:history="1"><w:r><w:rPr><w:rStyle w:val="Hyperlink"/></w:rPr><w:t>${escapeXml(text)}</w:t></w:r></w:hyperlink></w:p>`;
  }

  // Render non-article charter items (e.g. ICJ Statute) as a normal table
  if (other.length > 0) {
    xml += citationTable(other, hyperlinks);
  }

  return xml;
}

const EMPTY_SYMBOL_CELL = `<w:tc><w:tcPr><w:tcW w:w="733" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="auto"/></w:tcPr><w:p>${CELL_PPR_SYMBOL}</w:p></w:tc>`;
const EMPTY_TITLE_CELL = `<w:tc><w:tcPr><w:tcW w:w="1767" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="auto"/></w:tcPr><w:p>${CELL_PPR_TITLE}</w:p></w:tc>`;

// Render a body section, splitting SC into resolutions and presidential statements
function renderBodySection(
  body: string,
  mandates: Mandate[],
  hyperlinks: Map<string, string>,
  bodyFullNames: Record<string, string>,
  bracketDescs: Record<string, string>,
): string {
  enhanceTitles(mandates, bracketDescs);

  if (body === "Charter") {
    return paraH4(getBodyLabel(body, true, false, bodyFullNames)) +
      charterContent(mandates, hyperlinks);
  }

  // For SC: split presidential statements from resolutions/decisions
  const isSC = body === "Security Council" || body === "SC";
  const statements = isSC ? mandates.filter((m) => isPresidentialStatement(m.symbol)) : [];
  const rest = isSC ? mandates.filter((m) => !isPresidentialStatement(m.symbol)) : mandates;

  let content = "";

  if (rest.length > 0) {
    const hasRes = rest.some((m) => !isDecision(m.symbol));
    const hasDec = rest.some((m) => isDecision(m.symbol));
    content += paraH4(getBodyLabel(body, hasRes, hasDec, bodyFullNames));
    content += citationTable(rest, hyperlinks);
  }

  if (statements.length > 0) {
    content += paraH4("Statements by the President of the Security Council");
    content += citationTable(statements, hyperlinks);
  }

  return content;
}

// Generate table XML for citations (4-column: 2 entries per row, each as symbol(s) + title)
function citationTable(
  mandates: Mandate[],
  hyperlinks: Map<string, string>,
): string {
  const entries = groupByTitle(mandates);

  // Column-first layout: left column gets first half, right column gets second half
  // so reading order is sequential down the left, then down the right
  const half = Math.ceil(entries.length / 2);
  let rows = "";
  for (let i = 0; i < half; i++) {
    const e1 = entries[i];
    const e2 = i + half < entries.length ? entries[i + half] : null;

    rows += `<w:tr>${buildSymbolCell(e1, hyperlinks)}${buildTitleCell(e1, hyperlinks)}${e2 ? buildSymbolCell(e2, hyperlinks) + buildTitleCell(e2, hyperlinks) : EMPTY_SYMBOL_CELL + EMPTY_TITLE_CELL}</w:tr>`;
  }

  return `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="5000" w:type="pct"/><w:tblBorders><w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:bottom w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:insideH w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:insideV w:val="none" w:sz="0" w:space="0" w:color="auto"/></w:tblBorders><w:tblCellMar><w:left w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar><w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr><w:tblGrid><w:gridCol w:w="1408"/><w:gridCol w:w="3397"/><w:gridCol w:w="1408"/><w:gridCol w:w="3397"/></w:tblGrid>${rows}</w:tbl>`;
}

export async function exportEntityToDocx(
  entityAbbrev: string,
): Promise<Buffer> {
  // Load template
  const templatePath = join(
    process.cwd(),
    "data/references/un_styles_template.docx",
  );
  const templateBuffer = await readFile(templatePath);
  const zip = await JSZip.loadAsync(templateBuffer);

  const [{ rows }, bodyFullNames, bracketDescs] = await Promise.all([
    getAppliedExportData(entityAbbrev),
    fetchBodyFullNames(),
    fetchBracketDescriptions(),
  ]);

  // Build structure: subprog -> body -> mandates
  const bySubprog: Map<string, Map<string, Mandate[]>> = new Map();
  const seen = new Set<string>();

  for (const row of rows) {
    const subprog = row.subprogramme || "All Subprogrammes";
    const key = `${subprog}:${row.symbol}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const body = row.body || "Other";
    if (!bySubprog.has(subprog)) bySubprog.set(subprog, new Map());
    const bodyMap = bySubprog.get(subprog)!;
    if (!bodyMap.has(body)) bodyMap.set(body, []);

    bodyMap.get(body)!.push({
      symbol: row.symbol,
      title: cleanTitle(row.title),
      link: row.link,
      body,
    });
  }

  // Check if we found any data
  if (bySubprog.size === 0) {
    throw new Error(
      `No legislative mandates found for entity: ${entityAbbrev}`,
    );
  }

  // Sort subprogrammes
  const sortedSubprogs = [...bySubprog.keys()].sort((a, b) => {
    if (a.toLowerCase().includes("all subprogrammes")) return -1;
    if (b.toLowerCase().includes("all subprogrammes")) return 1;
    return a.localeCompare(b, undefined, { numeric: true });
  });

  // Generate document content
  const hyperlinks = new Map<string, string>();
  let content = "";

  // Main header
  content += paraH1("Legislative mandates");

  for (const subprog of sortedSubprogs) {
    const bodyMap = bySubprog.get(subprog)!;

    // Subprogramme header (except for overall)
    if (!subprog.toLowerCase().includes("all subprogrammes")) {
      const match = subprog.match(/^(Subprogramme \d+)[.:]\s*(.+)$/i);
      if (match) {
        content += paraH23Pair(match[1], match[2]);
      } else {
        content += paraH23(subprog);
      }
    }

    for (const body of sortBodies([...bodyMap.keys()])) {
      const mandates = bodyMap.get(body)!;
      content += renderBodySection(body, mandates, hyperlinks, bodyFullNames, bracketDescs);
    }
  }

  // Build document.xml
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${content}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  // Build document.xml.rels with hyperlinks
  let relsContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/fontTable" Target="fontTable.xml"/>
  <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
  <Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>
  <Relationship Id="rId6" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/webSettings" Target="webSettings.xml"/>
  <Relationship Id="rId7" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes" Target="footnotes.xml"/>
  <Relationship Id="rId8" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/endnotes" Target="endnotes.xml"/>`;

  for (const [rId, url] of hyperlinks) {
    relsContent += `\n  <Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${escapeXml(url)}" TargetMode="External"/>`;
  }
  relsContent += `\n</Relationships>`;

  // Update zip
  zip.file("word/document.xml", documentXml);
  zip.file("word/_rels/document.xml.rels", relsContent);

  // Generate output
  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  });
  return buffer;
}

// Build content for a single entity (reusable)
function buildEntityContent(
  rows: AppliedMandateRow[],
  entityAbbrev: string,
  hyperlinks: Map<string, string>,
  bodyFullNames: Record<string, string>,
  bracketDescs: Record<string, string>,
): string {
  const bySubprog: Map<string, Map<string, Mandate[]>> = new Map();
  const seen = new Set<string>();

  for (const row of rows) {
    if (row.entity !== entityAbbrev) continue;

    const subprog = row.subprogramme || "All Subprogrammes";
    const key = `${subprog}:${row.symbol}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const body = row.body || "Other";
    if (!bySubprog.has(subprog)) bySubprog.set(subprog, new Map());
    const bodyMap = bySubprog.get(subprog)!;
    if (!bodyMap.has(body)) bodyMap.set(body, []);

    bodyMap.get(body)!.push({
      symbol: row.symbol,
      title: cleanTitle(row.title),
      link: row.link,
      body,
    });
  }

  if (bySubprog.size === 0) return "";

  const sortedSubprogs = [...bySubprog.keys()].sort((a, b) => {
    if (a.toLowerCase().includes("all subprogrammes")) return -1;
    if (b.toLowerCase().includes("all subprogrammes")) return 1;
    return a.localeCompare(b, undefined, { numeric: true });
  });

  let content = "";
  content += paraH1("Legislative mandates");

  for (const subprog of sortedSubprogs) {
    const bodyMap = bySubprog.get(subprog)!;
    if (!subprog.toLowerCase().includes("all subprogrammes")) {
      const match = subprog.match(/^(Subprogramme \d+)[.:]\s*(.+)$/i);
      if (match) {
        content += paraH23Pair(match[1], match[2]);
      } else {
        content += paraH23(subprog);
      }
    }

    for (const body of sortBodies([...bodyMap.keys()])) {
      const mandates = bodyMap.get(body)!;
      content += renderBodySection(body, mandates, hyperlinks, bodyFullNames, bracketDescs);
    }
  }

  return content;
}

export async function exportAllToDocx(): Promise<Buffer> {
  const templatePath = join(
    process.cwd(),
    "data/references/un_styles_template.docx",
  );
  const templateBuffer = await readFile(templatePath);
  const zip = await JSZip.loadAsync(templateBuffer);
  const [{ rows }, bodyFullNames, bracketDescs] = await Promise.all([
    getAppliedExportData(),
    fetchBodyFullNames(),
    fetchBracketDescriptions(),
  ]);

  // Get all unique entities with their long names
  const entityNames = new Map<string, string>(); // abbrev -> long name
  for (const row of rows) {
    if (!entityNames.has(row.entity)) {
      entityNames.set(row.entity, row.entityLong || row.entity);
    }
  }

  const hyperlinks = new Map<string, string>();
  let content = "";

  // Sort entities alphabetically by long name
  const sortedEntities = [...entityNames.entries()].sort((a, b) =>
    (a[1] || a[0]).localeCompare(b[1] || b[0]),
  );

  for (const [entity, entityLong] of sortedEntities) {
    const entityContent = buildEntityContent(rows, entity, hyperlinks, bodyFullNames, bracketDescs);
    if (!entityContent) continue;

    // Entity header (bold, larger) - use long name
    const displayName = entityLong || entity;
    content += `<w:p><w:pPr><w:spacing w:before="400" w:after="200"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="28"/></w:rPr><w:t>${escapeXml(displayName)}</w:t></w:r></w:p>`;
    content += entityContent;
  }

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${content}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  let relsContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/fontTable" Target="fontTable.xml"/>
  <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
  <Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>
  <Relationship Id="rId6" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/webSettings" Target="webSettings.xml"/>
  <Relationship Id="rId7" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes" Target="footnotes.xml"/>
  <Relationship Id="rId8" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/endnotes" Target="endnotes.xml"/>`;

  for (const [rId, url] of hyperlinks) {
    relsContent += `\n  <Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${escapeXml(url)}" TargetMode="External"/>`;
  }
  relsContent += `\n</Relationships>`;

  zip.file("word/document.xml", documentXml);
  zip.file("word/_rels/document.xml.rels", relsContent);

  return await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  });
}
