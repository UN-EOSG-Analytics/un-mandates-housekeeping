import { cookies } from "next/headers";
import { randomBytes, createHmac, timingSafeEqual } from "crypto";
import { query } from "./db";

const AUTH_SECRET = process.env.AUTH_SECRET;
if (!AUTH_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("AUTH_SECRET must be set in production");
}
const SECRET = AUTH_SECRET || "dev-secret-change-me";
const COOKIE_NAME = "auth_session";

export function isValidUnEmail(email: string): boolean {
  return email.toLowerCase().endsWith("@un.org");
}

export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export async function recentTokenExists(email: string): Promise<boolean> {
  const rows = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM mandates_housekeeping.magic_tokens 
     WHERE email = $1 AND expires_at > NOW() - INTERVAL '14 minutes'`,
    [email.toLowerCase()]
  );
  return parseInt(rows[0]?.count || "0") > 0;
}

export async function createMagicToken(email: string): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  await query(
    `INSERT INTO mandates_housekeeping.magic_tokens (token, email, expires_at) VALUES ($1, $2, $3)`,
    [token, email.toLowerCase(), expiresAt]
  );

  return token;
}

export async function verifyMagicToken(token: string): Promise<string | null> {
  const rows = await query<{ email: string }>(
    `UPDATE mandates_housekeeping.magic_tokens 
     SET used_at = NOW() 
     WHERE token = $1 AND expires_at > NOW() AND used_at IS NULL 
     RETURNING email`,
    [token]
  );
  return rows[0]?.email || null;
}

export async function upsertUser(email: string, entity?: string): Promise<string> {
  const rows = await query<{ id: string }>(
    entity
      ? `INSERT INTO mandates_housekeeping.users (email, entity, last_login_at) 
         VALUES ($1, $2, NOW()) 
         ON CONFLICT (email) DO UPDATE SET entity = COALESCE(mandates_housekeeping.users.entity, $2), last_login_at = NOW()
         RETURNING id`
      : `INSERT INTO mandates_housekeeping.users (email, last_login_at) 
         VALUES ($1, NOW()) 
         ON CONFLICT (email) DO UPDATE SET last_login_at = NOW()
         RETURNING id`,
    entity ? [email.toLowerCase(), entity] : [email.toLowerCase()]
  );
  return rows[0].id;
}

function signSession(userId: string): string {
  const payload = JSON.stringify({ userId, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 }); // 7 days
  const sig = createHmac("sha256", SECRET).update(payload).digest("hex");
  return Buffer.from(payload).toString("base64") + "." + sig;
}

export function verifySession(token: string): { userId: string } | null {
  try {
    const [payloadB64, sig] = token.split(".");
    if (!payloadB64 || !sig) return null;

    const payload = Buffer.from(payloadB64, "base64").toString();
    const expectedSig = createHmac("sha256", SECRET).update(payload).digest("hex");
    
    // Timing-safe comparison
    const sigBuf = Buffer.from(sig, "hex");
    const expectedBuf = Buffer.from(expectedSig, "hex");
    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return null;

    const data = JSON.parse(payload);
    if (data.exp < Date.now()) return null;

    return { userId: data.userId };
  } catch {
    return null;
  }
}

export async function createSession(userId: string) {
  const token = signSession(userId);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: "/",
  });
}

export async function getSession(): Promise<{ userId: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;

  const rows = await query<{ id: string; email: string; entity: string | null; is_ppbd: boolean }>(
    `SELECT u.id, u.email, u.entity, (p.email IS NOT NULL) as is_ppbd
     FROM mandates_housekeeping.users u
     LEFT JOIN mandates_housekeeping.ppbd_reviewers p ON u.email = p.email
     WHERE u.id = $1`,
    [session.userId]
  );
  if (!rows[0]) return null;
  return { id: rows[0].id, email: rows[0].email, entity: rows[0].entity, isPpbd: rows[0].is_ppbd };
}

