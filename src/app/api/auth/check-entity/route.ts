import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db/db";

interface TokenRow {
  email: string;
}

interface UserRow {
  entity: string | null;
}

export async function POST(req: NextRequest) {
  const { token } = await req.json();
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  // Validate token and get email
  const tokenRows = await query<TokenRow>(
    `SELECT email FROM mandates_housekeeping.magic_tokens 
     WHERE token = $1 AND expires_at > NOW() AND used_at IS NULL`,
    [token],
  );

  if (!tokenRows[0]) {
    return NextResponse.json(
      { error: "Invalid or expired token" },
      { status: 400 },
    );
  }

  const email = tokenRows[0].email;

  // Check if user exists and has entity set
  const userRows = await query<UserRow>(
    `SELECT entity FROM mandates_housekeeping.users WHERE email = $1`,
    [email.toLowerCase()],
  );

  const existingEntity = userRows[0]?.entity || null;

  return NextResponse.json({
    email,
    hasEntity: !!existingEntity,
    entity: existingEntity,
  });
}
