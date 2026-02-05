# Data Services - Quick Reference

> **Full analysis**: See [DATA_SERVICES_ANALYSIS.md](./DATA_SERVICES_ANALYSIS.md) for complete details

---

## ⚠️ Important: Documents vs Mandates

**The boundary between "documents" and "mandates" is blurry** because:

- Mandates come FROM documents (PPB citations reference UN documents)
- Document metadata is part of the mandate review workflow
- Document diffs/versions are tools for reviewing mandates

**Solution**: Keep everything under `features/mandates/` with documents nested as supporting infrastructure at `mandates/services/documents/`. Don't create a separate documents feature - it would just create confusion.

---

## TL;DR - The Problem

🔴 **You have a 1010-line monolith** (`housekeeping-actions.ts`) that combines:

- Mandate decisions (7 functions)
- Comments (2 functions)
- Review mode (4 functions)
- Document operations (3 functions)
- User role (1 function)

⚠️ **Inconsistent organization**:

- Auth follows clean pattern: `features/auth/` ✅
- Everything else is scattered across `lib/services/` ❌

---

## Current Service Locations

### Server Actions (`"use server"`)

```
src/lib/services/housekeeping-actions.ts    ← 1010 lines! 🔥
src/features/auth/actions.ts                ← 175 lines ✅
```

### Business Logic Services

```
src/lib/services/mandates/                  ← 7 files
src/lib/services/documents/                 ← 4 files
src/lib/services/export/                    ← 2 files
src/lib/services/client/                    ← 1 file (barely used)
src/features/auth/auth.ts                   ← Auth utilities
```

### API Routes

```
src/app/api/export/                         ← Uses services ✅
src/app/api/realtime/                       ← Direct DB queries ⚠️
src/app/api/documents/                      ← Direct DB queries ⚠️
```

---

## What To Do - Feature-First Refactoring

### Follow the Auth Pattern Everywhere

**Current** (Auth - GOOD ✅):

```
features/auth/
  ├── services/
  │   ├── auth.ts         (pure functions)
  │   └── mail.ts
  ├── actions.ts          ("use server" functions)
  └── ui/                 (components)
```

**Apply to Mandates** (including document operations):

```
features/mandates/          ← NEW - All mandate-related code
  ├── services/
  │   ├── data-service.ts               ← PPB records
  │   ├── transform.ts                  ← Data transformation
  │   ├── warnings.ts                   ← Warnings logic
  │   ├── decision-reasons.ts
  │   └── documents/                    ← Document support (nested!)
  │       ├── metadata.ts               ← Document metadata
  │       ├── metadata-utils.ts
  │       ├── versions.ts
  │       └── newer-versions.ts
  ├── actions/
  │   ├── decisions.ts                  ← Split from housekeeping-actions
  │   ├── comments.ts
  │   ├── review-mode.ts
  │   ├── user.ts
  │   └── documents.ts                  ← Document operations
  └── ui/
      ├── DocumentModal.tsx
      └── DiffModal.tsx
```

**Why nest documents under mandates?**

- Documents are **tools for reviewing mandates**, not a separate feature
- They're tightly coupled to the mandate workflow
- No blurry boundaries - everything mandate-related in one place

---

## Step-by-Step Migration

### 1. Split housekeeping-actions.ts (1010 lines → 5 files)

| New File                                   | Functions to Move    | Lines |
| ------------------------------------------ | -------------------- | ----- |
| `features/mandates/actions/decisions.ts`   | 7 decision functions | ~350  |
| `features/mandates/actions/comments.ts`    | 2 comment functions  | ~120  |
| `features/mandates/actions/review-mode.ts` | 4 review functions   | ~180  |
| `features/mandates/actions/user.ts`        | 1 user function      | ~40   |
| `features/mandates/actions/documents.ts`   | 3 document functions | ~150  |

### 2. Move Mandate Services

```bash
mv src/lib/services/mandates/* src/features/mandates/services/
```

Update imports:

```typescript
// Before
import { fetchPPBRecords } from "@/lib/services/mandates/data-service"

// After
import { fetchPPBRecords } from "@/features/mandates/services/data-service"
```

### 3. Move Document Services (into Mandates)

```bash
mkdir -p src/features/mandates/services/documents
mv src/lib/services/documents/* src/features/mandates/services/documents/
```

Update imports:

```typescript
// Before
import { fetchDocumentMetadata } from "@/lib/services/documents/metadata"

// After
import { fetchDocumentMetadata } from "@/features/mandates/services/documents/metadata"
```

### 4. Clean Up

- Integrate `lib/services/client/` (barely used)
- Delete empty `lib/services/mandates/`
- Delete empty `lib/services/documents/`
- Keep `lib/services/export/` (truly cross-cutting)

---

## Benefits

### Before 😕

- ❌ 1010-line file that's hard to navigate
- ❌ Unclear where to put new code
- ❌ Auth organized differently than everything else
- ⚠️ Services and actions mixed together

### After 😊

- ✅ Small files (<200 lines each)
- ✅ Clear pattern: each feature has services/ + actions/
- ✅ Consistent organization
- ✅ Easy to find related code (all in feature folder)
- ✅ Follows Next.js 16 best practices

---

## Effort: 3-4 hours total 🎯

- Low risk (no logic changes)
- High value (much better maintainability)
- Can be done incrementally across multiple PRs

---

## Key Questions Answered

### Q: Why split services and actions?

**A**: Services = pure business logic (reusable), Actions = server-only API with "use server"

### Q: Why not separate documents and mandates into different features?

**A**: Because the boundary is blurry! Documents are **tools for reviewing mandates**, not a separate business domain. Nesting documents under `mandates/services/documents/` makes this relationship clear.

### Q: What goes in lib/services/ vs features/?

**A**:

- `lib/services/` → Cross-cutting, used by multiple features (export, db)
- `features/` → Domain-specific (auth, mandates)
- Documents → Part of mandates feature (nested under it)

### Q: Should API routes use actions or services?

**A**: Use actions for consistency: Routes → Actions → Services → DB

---

## Next Steps

1. Read full analysis: [DATA_SERVICES_ANALYSIS.md](./DATA_SERVICES_ANALYSIS.md)
2. Decide if you want to refactor
3. If yes, start with Phase 1: Split housekeeping-actions.ts
4. Test incrementally
5. Update imports with search/replace

---

**Questions?** Check the full analysis document for detailed refactoring plan, code examples, and migration checklist.
