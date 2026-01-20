The architecture in one sentence

> Next.js is the control plane (auth, upload, orchestration, UX). Python is the ingestion engine (DOCX parsing + normalization). Postgres is the source of truth. Azure Blob is file storage.



Upload architecture on Vercel (important)

For reliability on Vercel, the best pattern is:

Direct-to-Blob upload

Next.js requests a short-lived upload permission (SAS) from your backend

Browser uploads DOCX directly to Azure Blob

Next.js records metadata + creates ingestion job in Postgres

---

The core decision

DOCX extraction is CPU/memory spiky, sometimes slow, and can be security-sensitive (untrusted files). So the best practice is:

Next.js handles upload + auth + UX

A dedicated ingestion service handles parsing + validation + normalization

Postgres is the single source of truth

Processing is asynchronous (queue/job), with progress + error visibility


Minimal, solid architecture
Flow

Next.js uploads DOCX to Azure Blob (or temporarily receives it and streams to Blob).

Next.js creates:

a documents row (blob URI, sha256, uploader, etc.)

an ingestion_jobs row with status='queued'

A single Python worker wakes up, claims the next queued job from Postgres, parses DOCX, writes extracted data to Postgres, marks job done/failed.

UI polls /api/jobs/:id every 2–5 seconds (or uses SSE later).