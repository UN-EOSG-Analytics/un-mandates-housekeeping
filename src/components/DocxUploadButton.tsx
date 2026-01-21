"use client";

import { useState, useRef } from "react";
import { Upload, Loader2, Check } from "lucide-react";

interface Props {
  entity: string;
  subprogramme?: string | null;
}

type UploadState = "idle" | "uploading" | "success" | "error";

export function DocxUploadButton({ entity, subprogramme }: Props) {
  const [state, setState] = useState<UploadState>("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];

    // Validate file type
    const allowedType =
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (file.type !== allowedType && !file.name.endsWith(".docx")) {
      alert("Only DOCX files are allowed");
      return;
    }

    // Validate file size (50MB)
    if (file.size > 50 * 1024 * 1024) {
      alert("File size exceeds 50MB limit");
      return;
    }

    setState("uploading");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("entity", entity);
      if (subprogramme) {
        formData.append("subprogramme", subprogramme);
      }

      const response = await fetch("/api/upload/docx", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Upload failed");
      }

      setState("success");
      setTimeout(() => setState("idle"), 2000);
    } catch (err) {
      setState("error");
      alert(err instanceof Error ? err.message : "Upload failed");
      setTimeout(() => setState("idle"), 1000);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={handleFileSelect}
        className="hidden"
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={state === "uploading"}
        className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-all ${
          state === "success"
            ? "border-green-300 bg-green-50 text-green-700"
            : state === "uploading"
              ? "border-gray-200 bg-gray-50 text-gray-500"
              : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50 hover:shadow-sm"
        }`}
      >
        {state === "uploading" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : state === "success" ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <Upload className="h-3.5 w-3.5" />
        )}
        {state === "success" ? "Uploaded" : "Upload DOCX Submission"}
      </button>
    </>
  );
}
