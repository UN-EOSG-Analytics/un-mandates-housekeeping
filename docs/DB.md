# Database Notes

Currently: Azure Database for PostgreSQL Flexible Server (v16)

1. Turn on connection pooling on Azure (PgBouncer)

On Azure Flexible Server, PgBouncer is available as a built-in pooler and (per Microsoft) it’s enabled by default on port 6432 and uses the same hostname as your server.

TLS note (Azure)

Microsoft recommends stronger verification like sslmode=verify-full (or verify-ca) when you can manage root certs.

If you don’t want to manage cert files on Vercel right now, sslmode=require is the pragmatic starting point (still encrypted).

--> TLS: prefer verify-full/verify-ca when possible

## A) Runtime URL (Vercel / app traffic) → PgBouncer

Use the same host, but port 6432, and add Prisma’s PgBouncer flag if you use Prisma:

## B) Direct URL (migrations) → Postgres

Port 5432, no PgBouncer

DATABASE_URL = PgBouncer URL (port 6432)

DIRECT_URL = Direct URL (port 5432)


> The server is on the Burstable tier, which doesn't support PgBouncer. PgBouncer is only available on General Purpose and Memory Optimized tiers. The firewall allows all connections, so the issue is simply that port 6432 (PgBouncer) doesn't exist on this server.



---

“migrations” just means “how you create and change your database tables over time in a controlled way.”

## Setup

DB client `src/lib/db.ts` - uses native `pg` (node-postgres) with connection pooling

Use it only in Route Handlers / Server Actions / Server Components (Node runtime).

```typescript
import { query, pool } from "@/lib/db";

// Simple query helper
const docs = await query("SELECT * FROM ppb2026.source_documents LIMIT 5");

// Or use pool directly for more control
const client = await pool.connect();
try {
  const result = await client.query("SELECT NOW()");
  console.log(result.rows);
} finally {
  client.release();
}
```

## Different tables needed

- Users
  - Store identity info from login.
    - Key fields:
      - id (uuid)
      - email (unique)
      - display_name
      - created_at, last_login_at
- Static mandates from last year + metadata
- programmatic housekeeping decisions
  - Decisions (RETAIN/REVIEW/REMOVE) tied to:
    - which mandate (FK)
    - who made it
    - when last edited
  - New mandates added by officers (separate table)
- Entities
- Structure of the PPB
- OPTIONAL: Audit trail (optional but strongly recommended): record every change, not just the latest state

## Open Questions

- What about new subprogrammes?
- what if the overall structure is different this year?
- where to store the PPB structure?

## USAGE

### “See last year’s mandates”

That’s a read query from mandates filtered by year/metadata.

### “Tag them RETAIN/REVIEW/REMOVE”

That’s an **upsert** into mandate_decisions:

if decision exists → update decision + decided_at + decided_by

also insert an audit row in decision_events

### “Add new mandates”

Insert into mandate_additions
Also insert an audit event


## Design decisions

B) One official decision per mandate (good for single source of truth)?



## Pattern: Native PostgreSQL with pg (node-postgres)

Using native SQL for everything:
- Direct control over queries and performance
- No ORM overhead
- Transaction support via pg client
- Connection pooling built-in

For transactional writes:
```typescript
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('INSERT INTO mandate_decisions ...');
  await client.query('INSERT INTO decision_events ...');
  await client.query('COMMIT');
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();
}
```

Use SQL (checked into repo) for:

views/materialized views used by DataGrip/Python

heavier reporting queries

This is a great fit if the web app is CRUD/workflow and your analytics stay SQL-first.



## Use Prisma as:

- a typed client
- a safe transaction wrapper
- a convenient way to read/write rows

while:

- keeping DDL + indexes + constraints for this table in SQL
- managing it in DataGrip / SQL scripts
- versioning that SQL outside Prisma migrations

Prisma should own these tables, not your baseline data:

users

mandate_decisions (single official decision)

mandate_additions

decision_events (audit log)

Those tables:

are app-specific

evolve quickly

benefit from Prisma migrations + type safety

do not have expression indexes

👉 This split is the sweet spot.

> Prisma is appropriate as an application-layer tool, not as a data-modeling authority.