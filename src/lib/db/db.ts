import { Pool, type PoolConfig } from "pg";

const globalForDb = global as unknown as {
  pool: Pool | undefined;
};

/**
 * Ensure sslmode=require is set when connecting via PgBouncer (port 6432).
 * Azure's built-in PgBouncer has a valid cert; rejectUnauthorized handles
 * verification on the Node side, so `require` is sufficient here.
 */
function getConnectionString(): string {
  const url = process.env.DATABASE_URL || "";
  if (!url) return url;
  if (url.includes("sslmode=")) return url;
  return url + (url.includes("?") ? "&" : "?") + "sslmode=require";
}

/**
 * Pool configuration for Vercel Serverless → Azure PgBouncer → Azure Postgres
 *
 * Topology:
 *   Vercel fn  →  PgBouncer :6432 (transaction pooling)  →  Postgres :5432
 *
 * Because PgBouncer multiplexes virtual connections to a small set of real
 * backend connections, each Vercel instance can hold more connections without
 * exhausting Postgres's limit. PgBouncer is the bottleneck, not Postgres.
 *
 * PgBouncer compatibility: the `pg` driver uses unnamed (Parse/Bind/Execute)
 * extended query protocol for parameterized queries — no named prepared
 * statements — so transaction pooling mode works without any extra flags.
 *
 * Settings:
 * - max: 10  — PgBouncer queues excess; safe across many concurrent fn instances
 * - idleTimeoutMillis: 10s — release quickly; serverless fns are short-lived
 * - connectionTimeoutMillis: 5s — fail fast if PgBouncer is overloaded
 * - allowExitOnIdle: true — clean Node exit between invocations
 */
const poolConfig: PoolConfig = {
  connectionString: getConnectionString(),
  max: 10,
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
