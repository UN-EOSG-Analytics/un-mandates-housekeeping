import { NextResponse } from "next/server";
import { fetchEntities } from "@/lib/services/data-service";

export async function GET() {
  const entities = await fetchEntities();
  return NextResponse.json({ entities });
}
