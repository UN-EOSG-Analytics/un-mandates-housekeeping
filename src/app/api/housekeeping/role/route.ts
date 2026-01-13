import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import type { UserRole } from "@/types";

export async function GET() {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const role: UserRole = user.entity === "DMSPC" ? "ppbd" : "focal";
  return NextResponse.json({ role, email: user.email });
}
