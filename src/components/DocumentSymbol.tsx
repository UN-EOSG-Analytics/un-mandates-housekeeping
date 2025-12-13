"use client";

import { useState, useCallback } from "react";
import { X, ChevronDown } from "lucide-react";
import type { Paragraph } from "@/types";

interface Props {
  symbol: string;
  link: string | null;
  title?: string;
  paragraphs?: Paragraph[];
}

function cleanPrefix(prefix: string) {
  return prefix.replace(/[.\(\)\[\]]/g, "").trim();
}

function ParaBox({ p, indent }: { p: Paragraph; indent: number }) {
  const label = p.prefix ? cleanPrefix(p.prefix) : null;
  return (
    <div
      className="bg-gray-100 rounded-lg p-4"
      style={{ marginLeft: indent }}
    >
      <div className="flex gap-3">
        {label && (
          <span className="flex-shrink-0 w-7 h-7 rounded-full bg-un-blue text-white text-xs font-medium flex items-center justify-center">
            {label}
          </span>
        )}
        <p className="text-gray-700 leading-relaxed">{p.text}</p>
      </div>
    </div>
  );
}

function ParagraphTree({ paragraphs }: { paragraphs: Paragraph[] }) {
  const [showPreamble, setShowPreamble] = useState(false);

  const content = paragraphs.filter(
    (p) => p.type !== "frontmatter" && p.text?.trim()
  );

  // Split preambular vs operative paragraphs
  const preamble = content.filter((p) => p.paragraph_type === "preambular");
  const operative = content.filter((p) => p.paragraph_type !== "preambular");

  const getIndent = (p: Paragraph) => {
    if (p.paragraph_level && p.paragraph_level > 1) return (p.paragraph_level - 1) * 24;
    if (p.heading_level && p.heading_level > 1) return (p.heading_level - 1) * 16;
    return 0;
  };

  return (
    <div className="space-y-3">
      {/* Preambular paragraphs - collapsed by default */}
      {preamble.length > 0 && (
        <button
          onClick={() => setShowPreamble(!showPreamble)}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 py-2"
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform ${showPreamble ? "" : "-rotate-90"}`}
          />
          {showPreamble ? "Hide" : "Show"} {preamble.length} preambular paragraph{preamble.length !== 1 && "s"}
        </button>
      )}

      {showPreamble &&
        preamble.map((p, i) => (
          <ParaBox key={`pp-${i}`} p={p} indent={getIndent(p)} />
        ))}

      {/* Operative paragraphs and headings */}
      {operative.map((p, i) => {
        if (p.type === "heading") {
          const indent = p.heading_level && p.heading_level > 1 ? (p.heading_level - 1) * 16 : 0;
          return (
            <div
              key={`op-${i}`}
              style={{ marginLeft: indent }}
              className={`font-semibold text-foreground ${
                p.heading_level === 1 ? "text-base mt-4" : "text-sm mt-2"
              }`}
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

export function DocumentSymbol({ symbol, link, title, paragraphs }: Props) {
  const [open, setOpen] = useState(false);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (paragraphs?.length) {
        e.preventDefault();
        setOpen(true);
      }
    },
    [paragraphs]
  );

  return (
    <>
      <button
        onClick={handleClick}
        className="text-un-blue hover:underline font-medium text-left"
      >
        {symbol}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/20"
            onClick={() => setOpen(false)}
          />

          {/* Sidebar */}
          <div className="relative w-full max-w-lg bg-white shadow-xl flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <div className="font-semibold text-foreground">{symbol}</div>
                {title && (
                  <div className="text-sm text-gray-500 mt-0.5">{title}</div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {link && (
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-un-blue hover:underline"
                  >
                    Open →
                  </a>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X className="h-4 w-4 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {paragraphs?.length ? (
                <ParagraphTree paragraphs={paragraphs} />
              ) : (
                <div className="text-gray-400 text-sm">
                  No paragraph data available
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

