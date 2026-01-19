import { Pool } from "pg";

const globalForDb = global as unknown as {
  pool: Pool | undefined;
};

// Ensure sslmode=verify-full is explicit to avoid pg security warning
function getConnectionString(): string {
  const url = process.env.DATABASE_URL || "";
  if (!url) return url;
  // Replace any sslmode with verify-full, or add it if not present
  if (url.includes("sslmode=verify-full")) return url;
  if (url.includes("sslmode=")) {
    return url.replace(/sslmode=[^&]+/, "sslmode=verify-full");
  }
  return url + (url.includes("?") ? "&" : "?") + "sslmode=verify-full";
}

export const pool =
  globalForDb.pool ||
  new Pool({
    connectionString: getConnectionString(),
    max: 2, // Vercel Serverless Functions, no PgBouncer on Azure
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    ssl: {
      rejectUnauthorized: true, // equivalent to sslmode=verify-full
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pool = pool;
}

// Helper function for queries
export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result.rows;
  } finally {
    client.release();
  }
}

export default pool;
