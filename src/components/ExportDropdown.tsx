"use client";

import { useState, useRef, useEffect } from "react";
import { Download, ChevronDown } from "lucide-react";

interface Props {
  entity?: string; // undefined = export all
  label?: string;
}

const FORMATS = [
  { id: "csv", label: "CSV" },
  { id: "xlsx", label: "Excel" },
  { id: "docx", label: "Word" },
] as const;

export function ExportDropdown({ entity, label = "Export" }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const basePath = entity ? `/api/export/${entity}` : "/api/export/all";

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors ${
          open
            ? "border-gray-300 bg-gray-50 text-gray-900"
            : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900"
        }`}
      >
        <Download className="h-3.5 w-3.5" />
        {label}
        <ChevronDown
          className={`ml-0.5 h-3 w-3 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="absolute top-full right-0 z-10 mt-1 min-w-full overflow-hidden rounded-md border border-gray-200 bg-white py-1 shadow-sm">
          {FORMATS.map(({ id, label }) => (
            <a
              key={id}
              href={`${basePath}/${id}`}
              download
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
            >
              {label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
