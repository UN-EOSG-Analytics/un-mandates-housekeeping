"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, FileText, X, Check, Loader2 } from "lucide-react";

interface DocxUploadProps {
  entity: string;
  subprogramme?: string | null;
  onUploadComplete?: (upload: UploadResult) => void;
}

interface UploadResult {
  id: string;
  filename: string;
  size: number;
  entity: string;
  subprogramme: string | null;
  createdAt: string;
}

type UploadState = "idle" | "dragging" | "uploading" | "success" | "error";

export function DocxUpload({
  entity,
  subprogramme,
  onUploadComplete,
}: DocxUploadProps) {
  const [state, setState] = useState<UploadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setState("dragging");
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setState("idle");
  }, []);

  const validateFile = (file: File): string | null => {
    const allowedType =
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (file.type !== allowedType && !file.name.endsWith(".docx")) {
      return "Only DOCX files are allowed";
    }
    if (file.size > 50 * 1024 * 1024) {
      return "File size exceeds 50MB limit";
    }
    return null;
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setState("idle");

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        setState("error");
        return;
      }
      setSelectedFile(file);
      setError(null);
    }
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        const file = files[0];
        const validationError = validateFile(file);
        if (validationError) {
          setError(validationError);
          setState("error");
          return;
        }
        setSelectedFile(file);
        setError(null);
      }
    },
    [],
  );

  const handleUpload = async () => {
    if (!selectedFile) return;

    setState("uploading");
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
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
      onUploadComplete?.(data.upload);

      // Reset after success
      setTimeout(() => {
        setSelectedFile(null);
        setState("idle");
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setState("error");
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
    setError(null);
    setState("idle");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="w-full">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Drop zone / Upload area */}
      {!selectedFile && state !== "success" && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors ${
            state === "dragging"
              ? "border-un-blue bg-un-blue/5"
              : state === "error"
                ? "border-red-300 bg-red-50"
                : "border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100"
          }`}
        >
          <Upload
            className={`mb-2 h-8 w-8 ${
              state === "dragging"
                ? "text-un-blue"
                : state === "error"
                  ? "text-red-400"
                  : "text-gray-400"
            }`}
          />
          <p className="text-sm text-gray-600">
            Drop DOCX file here or{" "}
            <span className="text-un-blue font-medium">browse</span>
          </p>
          <p className="mt-1 text-xs text-gray-400">Max 50MB</p>
        </div>
      )}

      {/* Selected file preview */}
      {selectedFile && state !== "success" && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 shrink-0 text-un-blue" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900">
                {selectedFile.name}
              </p>
              <p className="text-xs text-gray-500">
                {formatFileSize(selectedFile.size)}
              </p>
            </div>
            {state !== "uploading" && (
              <button
                onClick={handleClear}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Upload button */}
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleUpload}
              disabled={state === "uploading"}
              className="bg-un-blue hover:bg-un-blue/90 flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
            >
              {state === "uploading" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Upload
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Success state */}
      {state === "success" && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4">
          <Check className="h-5 w-5 text-green-600" />
          <span className="text-sm font-medium text-green-700">
            File uploaded successfully
          </span>
        </div>
      )}

      {/* Error message */}
      {error && state === "error" && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
