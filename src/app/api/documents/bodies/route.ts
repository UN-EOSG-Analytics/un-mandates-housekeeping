import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  const rows = await query<{ issuing_body: string }>(
    `SELECT DISTINCT issuing_body 
     FROM public.documents 
     WHERE issuing_body IS NOT NULL 
     ORDER BY issuing_body`
  );
  return NextResponse.json(rows.map((r) => r.issuing_body));
}

