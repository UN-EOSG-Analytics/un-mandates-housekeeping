"use client";

import { useState, useRef, useEffect } from "react";
import {
  Download,
  ChevronDown,
  Table,
  FileSpreadsheet,
  FileType,
} from "lucide-react";

interface Props {
  entity?: string; // undefined = export all
  label?: string;
}

const FORMATS = [
  { id: "csv", label: "CSV", icon: Table },
  { id: "xlsx", label: "Excel", icon: FileSpreadsheet },
  { id: "docx", label: "Word", icon: FileType },
] as const;

export function ExportDropdown({ entity, label = "Export Mandates" }: Props) {
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
        className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-all ${
          open
            ? "border-gray-300 bg-gray-50 text-gray-900 shadow-sm"
            : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50 hover:shadow-sm"
        }`}
      >
        <Download className="h-3.5 w-3.5" />
        {label}
        <ChevronDown
          className={`h-3 w-3 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="absolute top-full right-0 z-10 mt-2 min-w-[140px] overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {FORMATS.map(({ id, label, icon: Icon }) => (
            <a
              key={id}
              href={`${basePath}/${id}`}
              download
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900"
            >
              <Icon className="h-4 w-4 text-gray-400" />
              {label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
