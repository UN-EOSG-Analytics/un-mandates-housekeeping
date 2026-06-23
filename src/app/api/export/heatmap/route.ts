import { NextResponse } from "next/server";
import { exportHeatmapXlsx } from "@/features/mandates/services/export/heatmap-export";
import { getISOTimestamp } from "@/lib/utils";

const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function GET() {
  try {
    const buffer = await exportHeatmapXlsx();
    const timestamp = getISOTimestamp();
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": XLSX_CONTENT_TYPE,
        "Content-Disposition": `attachment; filename="${timestamp}_cocitation_2026_vs_2027.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Heatmap export error:", error);
    return NextResponse.json({ error: "Failed to export" }, { status: 500 });
  }
}
