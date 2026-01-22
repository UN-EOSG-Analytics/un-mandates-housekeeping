import { Pool, type PoolConfig } from "pg";

const globalForDb = global as unknown as {
  pool: Pool | undefined;
};

/**
 * Ensure sslmode=verify-full is explicit to avoid pg security warning.
 * Azure Postgres Flexible Server requires SSL.
 */
function getConnectionString(): string {
  const url = process.env.DATABASE_URL || "";
  if (!url) return url;
  if (url.includes("sslmode=verify-full")) return url;
  if (url.includes("sslmode=")) {
    return url.replace(/sslmode=[^&]+/, "sslmode=verify-full");
  }
  return url + (url.includes("?") ? "&" : "?") + "sslmode=verify-full";
}

/**
 * Pool configuration optimized for Vercel Serverless + Azure Postgres
 *
 * Key considerations:
 * - Vercel serverless functions are ephemeral (cold starts, short-lived)
 * - Azure Postgres Flexible Server has connection limits (~50-200 depending on tier)
 * - No PgBouncer in standard Azure Postgres setup
 * - Each Vercel function instance maintains its own pool
 *
 * Settings:
 * - max: 3 - Low to avoid exhausting Azure connection limit across instances
 * - idleTimeoutMillis: 10s - Release idle connections quickly (serverless is short-lived)
 * - connectionTimeoutMillis: 5s - Fail fast on connection issues
 * - allowExitOnIdle: true - Let Node exit cleanly when idle
 */
const poolConfig: PoolConfig = {
  connectionString: getConnectionString(),
  max: 3,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
  allowExitOnIdle: true,
  ssl: {
    rejectUnauthorized: true,
  },
};

// Reuse pool across hot reloads in development
export const pool = globalForDb.pool || new Pool(poolConfig);

if (process.env.NODE_ENV !== "production") {
  globalForDb.pool = pool;
}

/**
 * Execute a SQL query with automatic connection management.
 * Connection is acquired from pool and released after query completes.
 */
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

/**
 * Query function type for use in transactions
 */
type TransactionQueryFn = <R = Record<string, unknown>>(
  text: string,
  params?: unknown[],
) => Promise<R[]>;

/**
 * Execute a transaction with automatic rollback on error.
 * Useful for multi-statement operations that must be atomic.
 */
export async function transaction<T>(
  fn: (query: TransactionQueryFn) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const txQuery: TransactionQueryFn = async (text, params) => {
      const result = await client.query(text, params);
      return result.rows;
    };
    const result = await fn(txQuery);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export default pool;
