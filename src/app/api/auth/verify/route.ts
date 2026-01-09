import { NextResponse } from "next/server";
import { verifyMagicToken, upsertUser, createSession } from "@/lib/auth";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=missing_token", request.url));
  }

  const email = await verifyMagicToken(token);
  if (!email) {
    return NextResponse.redirect(new URL("/login?error=invalid_token", request.url));
  }

  const userId = await upsertUser(email);
  await createSession(userId);

  return NextResponse.redirect(new URL("/", request.url));
}

