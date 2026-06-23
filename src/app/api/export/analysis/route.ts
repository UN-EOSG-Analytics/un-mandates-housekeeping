import { NextResponse } from "next/server";
import { exportAnalysisXlsx } from "@/features/mandates/services/export/analysis-export";
import { getISOTimestamp } from "@/lib/utils";

const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function GET() {
  try {
    const buffer = await exportAnalysisXlsx();
    const timestamp = getISOTimestamp();
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": XLSX_CONTENT_TYPE,
        "Content-Disposition": `attachment; filename="${timestamp}_mandate_analysis_data.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Analysis export error:", error);
    return NextResponse.json({ error: "Failed to export" }, { status: 500 });
  }
}
