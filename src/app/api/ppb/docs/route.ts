// http://localhost:3000/api/ppb/docs/

import { query } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const docs = await query(
      `SELECT * FROM ppb2026.source_documents 
       ORDER BY last_updated DESC 
       LIMIT 5`
    );

    return NextResponse.json(docs);
  } catch (error) {
    console.error("Database error:", error);
    return NextResponse.json(
      { error: "Failed to fetch documents" },
      { status: 500 }
    );
  }
}
