import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/auth";
import { query } from "@/lib/db/db";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { entity } = await req.json();
  if (!entity || typeof entity !== "string" || !entity.trim()) {
    return NextResponse.json({ error: "Entity is required" }, { status: 400 });
  }

  await query(
    `UPDATE mandates_housekeeping.users SET entity = $1 WHERE id = $2`,
    [entity.trim(), user.id],
  );

  return NextResponse.json({ success: true });
}
