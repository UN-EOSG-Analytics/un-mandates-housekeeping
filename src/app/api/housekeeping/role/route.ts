import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import type { UserRole } from "@/types";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rows = await query<{ email: string }>(
    `SELECT email FROM mandates_housekeeping.ppbd_reviewers WHERE email = $1`,
    [user.email]
  );

  const role: UserRole = rows.length > 0 ? "ppbd" : "focal";
  return NextResponse.json({ role, email: user.email });
}

