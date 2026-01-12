import { NextResponse } from "next/server";
import { exportToCsv, exportToXlsx } from "@/lib/export-data";
import { exportAllToDocx } from "@/lib/export-docx";

const CONTENT_TYPES = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
} as const;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ format: string }> },
) {
  const { format } = await params;

  if (!["docx", "xlsx", "csv"].includes(format)) {
    return NextResponse.json({ error: "Invalid format" }, { status: 400 });
  }

  try {
    let buffer: Buffer;
    let contentType: string;

    if (format === "docx") {
      buffer = await exportAllToDocx();
      contentType = CONTENT_TYPES.docx;
    } else if (format === "xlsx") {
      buffer = await exportToXlsx();
      contentType = CONTENT_TYPES.xlsx;
    } else {
      buffer = Buffer.from(await exportToCsv());
      contentType = CONTENT_TYPES.csv;
    }

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="all_mandates.${format}"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Failed to export" }, { status: 500 });
  }
}
