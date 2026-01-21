import JSZip from "jszip";
import { readFile } from "fs/promises";
import { join } from "path";
import { fetchPPBRecords } from "../data-service";

interface Mandate {
  symbol: string;
  title: string;
  link: string | null;
  body: string | null;
}

const BODY_ORDER = ["GA", "SC", "ECOSOC", "HRC", "UNEA"];

function getBodyLabel(body: string, hasRes: boolean, hasDec: boolean): string {
  const bodyNames: Record<string, string> = {
    GA: "General Assembly",
    SC: "Security Council",
    ECOSOC: "Economic and Social Council",
    HRC: "Human Rights Council",
    UNEA: "United Nations Environment Assembly",
  };
  const name = bodyNames[body] || body;
  if (hasRes && hasDec) return `${name} resolutions and decisions`;
  if (hasDec) return `${name} decisions`;
  return `${name} resolutions`;
}

function stripPrefix(symbol: string): string {
  return symbol
    .replace(/^[AES]\/RES\//, "")
    .replace(/^[AES]\/DEC\//, "")
    .replace(/^S\/RES\//, "")
    .trim();
}

function isDecision(symbol: string): boolean {
  return /^[AES]\/DEC\//.test(symbol);
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

// Style IDs from UN template: H1 = "_ H_1", H23 = "_ H_2/3", H4 = "_ H_4"

// Generate paragraph XML with UN style
function para(styleId: string, text: string, tabs = ""): string {
  const escapedText = escapeXml(tabs + text);
  return `<w:p><w:pPr><w:pStyle w:val="${styleId}"/></w:pPr><w:r><w:t>${escapedText}</w:t></w:r></w:p>`;
}

// Generate table XML for citations
function citationTable(
  mandates: Mandate[],
  hyperlinks: Map<string, string>,
): string {
  const sorted = [...mandates].sort((a, b) => a.symbol.localeCompare(b.symbol));

  let rows = "";
  for (let i = 0; i < sorted.length; i += 2) {
    let cells = "";
    for (let j = 0; j < 2; j++) {
      const m = sorted[i + j];
      if (m) {
        const displaySymbol = escapeXml(stripPrefix(m.symbol));
        const title = escapeXml(m.title);

        // Symbol cell - with or without hyperlink
        let symbolContent: string;
        if (m.link) {
          const rId = `rId${hyperlinks.size + 10}`;
          hyperlinks.set(rId, m.link);
          symbolContent = `<w:hyperlink r:id="${rId}"><w:r><w:rPr><w:rStyle w:val="Hyperlink"/><w:sz w:val="17"/></w:rPr><w:t>${displaySymbol}</w:t></w:r></w:hyperlink>`;
        } else {
          symbolContent = `<w:r><w:rPr><w:sz w:val="17"/></w:rPr><w:t>${displaySymbol}</w:t></w:r>`;
        }

        cells += `<w:tc><w:tcPr><w:tcW w:w="1408" w:type="dxa"/><w:tcBorders><w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/></w:tcBorders></w:tcPr><w:p><w:pPr><w:spacing w:before="40" w:after="40" w:line="200" w:lineRule="exact"/></w:pPr>${symbolContent}</w:p></w:tc>`;

        // Title cell
        cells += `<w:tc><w:tcPr><w:tcW w:w="1699" w:type="dxa"/><w:tcBorders><w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/></w:tcBorders></w:tcPr><w:p><w:pPr><w:spacing w:before="40" w:after="40" w:line="200" w:lineRule="exact"/><w:ind w:left="86"/></w:pPr><w:r><w:rPr><w:sz w:val="17"/></w:rPr><w:t>${title}</w:t></w:r></w:p></w:tc>`;
      } else {
        // Empty cells for odd count
        cells += `<w:tc><w:tcPr><w:tcW w:w="1408" w:type="dxa"/><w:tcBorders><w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/></w:tcBorders></w:tcPr><w:p/></w:tc>`;
        cells += `<w:tc><w:tcPr><w:tcW w:w="1699" w:type="dxa"/><w:tcBorders><w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/></w:tcBorders></w:tcPr><w:p/></w:tc>`;
      }
    }
    rows += `<w:tr>${cells}</w:tr>`;
  }

  return `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="5000" w:type="pct"/>
      <w:tblBorders>
        <w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/>
        <w:insideH w:val="none"/><w:insideV w:val="none"/>
      </w:tblBorders>
      <w:tblCellMar><w:left w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar>
    </w:tblPr>
    <w:tblGrid><w:gridCol w:w="1408"/><w:gridCol w:w="1699"/><w:gridCol w:w="1408"/><w:gridCol w:w="1699"/></w:tblGrid>
    ${rows}
  </w:tbl>`;
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

  // Load PPB data from database (same source as frontend)
  const ppbData = await fetchPPBRecords();

  // Build structure: subprog -> body -> mandates
  const bySubprog: Map<string, Map<string, Mandate[]>> = new Map();
  const seen = new Set<string>();

  for (const rec of ppbData) {
    if (!rec.entities?.includes(entityAbbrev)) continue;

    for (const ci of rec.citation_info) {
      if (ci.entity !== entityAbbrev) continue;

      const part = ci.part_in_document || "Legislative mandates";
      if (part !== "Legislative mandates") continue;

      const subprog =
        ci["sub-programme"] || ci.component || "All Subprogrammes";
      const key = `${subprog}:${rec.full_document_symbol}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const body = rec.body || "Other";
      if (!bySubprog.has(subprog)) bySubprog.set(subprog, new Map());
      const bodyMap = bySubprog.get(subprog)!;
      if (!bodyMap.has(body)) bodyMap.set(body, []);

      const title = rec.description || rec.uniform_title || "";
      bodyMap.get(body)!.push({
        symbol: rec.full_document_symbol,
        title: cleanTitle(title),
        link: rec.link,
        body,
      });
    }
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
    return a.localeCompare(b);
  });

  // Generate document content
  const hyperlinks = new Map<string, string>();
  let content = "";

  // Main header
  content += para("H1", "Legislative mandates", "\t\t");

  for (const subprog of sortedSubprogs) {
    const bodyMap = bySubprog.get(subprog)!;

    // Subprogramme header (except for overall)
    if (!subprog.toLowerCase().includes("all subprogrammes")) {
      const match = subprog.match(/^(Subprogramme \d+)[.:]\s*(.+)$/i);
      if (match) {
        content += para("H23", match[1], "\t\t");
        content += para("H23", match[2], "\t\t");
      } else {
        content += para("H23", subprog, "\t\t");
      }
    }

    // Sort bodies
    const sortedBodies = [...bodyMap.keys()].sort((a, b) => {
      const ai = BODY_ORDER.indexOf(a);
      const bi = BODY_ORDER.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });

    for (const body of sortedBodies) {
      const mandates = bodyMap.get(body)!;
      const hasRes = mandates.some((m) => !isDecision(m.symbol));
      const hasDec = mandates.some((m) => isDecision(m.symbol));

      content += para("H4", getBodyLabel(body, hasRes, hasDec));
      content += citationTable(mandates, hyperlinks);
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
  ppbData: Awaited<ReturnType<typeof fetchPPBRecords>>,
  entityAbbrev: string,
  hyperlinks: Map<string, string>,
): string {
  const bySubprog: Map<string, Map<string, Mandate[]>> = new Map();
  const seen = new Set<string>();

  for (const rec of ppbData) {
    if (!rec.entities?.includes(entityAbbrev)) continue;
    for (const ci of rec.citation_info) {
      if (ci.entity !== entityAbbrev) continue;
      const part = ci.part_in_document || "Legislative mandates";
      if (part !== "Legislative mandates") continue;

      const subprog =
        ci["sub-programme"] || ci.component || "All Subprogrammes";
      const key = `${subprog}:${rec.full_document_symbol}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const body = rec.body || "Other";
      if (!bySubprog.has(subprog)) bySubprog.set(subprog, new Map());
      const bodyMap = bySubprog.get(subprog)!;
      if (!bodyMap.has(body)) bodyMap.set(body, []);

      bodyMap.get(body)!.push({
        symbol: rec.full_document_symbol,
        title: cleanTitle(rec.description || rec.uniform_title || ""),
        link: rec.link,
        body,
      });
    }
  }

  if (bySubprog.size === 0) return "";

  const sortedSubprogs = [...bySubprog.keys()].sort((a, b) => {
    if (a.toLowerCase().includes("all subprogrammes")) return -1;
    if (b.toLowerCase().includes("all subprogrammes")) return 1;
    return a.localeCompare(b);
  });

  let content = "";
  content += para("H1", "Legislative mandates", "\t\t");

  for (const subprog of sortedSubprogs) {
    const bodyMap = bySubprog.get(subprog)!;
    if (!subprog.toLowerCase().includes("all subprogrammes")) {
      const match = subprog.match(/^(Subprogramme \d+)[.:]\s*(.+)$/i);
      if (match) {
        content += para("H23", match[1], "\t\t");
        content += para("H23", match[2], "\t\t");
      } else {
        content += para("H23", subprog, "\t\t");
      }
    }

    const sortedBodies = [...bodyMap.keys()].sort((a, b) => {
      const ai = BODY_ORDER.indexOf(a);
      const bi = BODY_ORDER.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });

    for (const body of sortedBodies) {
      const mandates = bodyMap.get(body)!;
      const hasRes = mandates.some((m) => !isDecision(m.symbol));
      const hasDec = mandates.some((m) => isDecision(m.symbol));
      content += para("H4", getBodyLabel(body, hasRes, hasDec));
      content += citationTable(mandates, hyperlinks);
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
  const ppbData = await fetchPPBRecords();

  // Get all unique entities with their long names
  const entityNames = new Map<string, string>(); // abbrev -> long name
  for (const rec of ppbData) {
    for (const ci of rec.citation_info) {
      if (ci.entity && ci.part_in_document === "Legislative mandates") {
        if (!entityNames.has(ci.entity) && ci.entity_long) {
          entityNames.set(ci.entity, ci.entity_long);
        }
      }
    }
  }

  const hyperlinks = new Map<string, string>();
  let content = "";

  // Sort entities alphabetically by long name
  const sortedEntities = [...entityNames.entries()].sort((a, b) =>
    (a[1] || a[0]).localeCompare(b[1] || b[0]),
  );

  for (const [entity, entityLong] of sortedEntities) {
    const entityContent = buildEntityContent(ppbData, entity, hyperlinks);
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
