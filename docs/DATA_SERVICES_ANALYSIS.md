# Data Services Architecture Analysis

**Date**: February 5, 2026  
**Status**: Current state analysis + refactoring recommendations

---

## Executive Summary

The data services are currently **fragmented across multiple locations** with unclear boundaries between server actions, business logic, and API routes. The main issue is a **1010-line monolithic** `housekeeping-actions.ts` file that needs to be split up, and inconsistent organization between "features" and "lib/services".

**Key Finding**: Auth follows a good pattern (`features/auth/`) but mandates are scattered. Need to consolidate and follow consistent feature-first organization.

---

## Current Service Structure

### 1. Server Actions (Functions marked `"use server"`)

#### ⚠️ `src/lib/services/housekeeping-actions.ts` **(1010 lines - MONOLITH)**

**Purpose**: All housekeeping-related server actions  
**Contains**:

- ✅ User role management (1 function)
- ⚠️ Decision CRUD operations (7 functions)
- ⚠️ Comment CRUD operations (3 functions)
- ⚠️ Review mode operations (4 functions)
- ⚠️ Document versions/metadata/diff (3 functions)
- ⚠️ Clear all decisions (1 function)

**Exported Functions**:

```typescript
// User & Auth
- getUserRoleAction()

// Decisions
- getEntityDecisionsAction(entity)
- getSingleMandateStateAction({documentSymbol, entity, subprogramme})
- getDocumentDecisionsAction(symbol)
- createDecisionAction({...})
- updateDecisionReasonAction({decisionId, decisionReason, otherReason})
- approveDecisionAction(decisionId, approved)
- clearAllEntityDecisionsAction(entity)

// Comments
- createCommentAction({...})
- resolveCommentAction(commentId, resolved)

// Review Mode
- getReviewModeStatusAction(entity)
- startReviewModeAction(entity)
- endReviewModeAction(entity)
- checkReviewModeBlock() // Helper

// Documents
- getDocumentVersionsAction(symbol)
- getDocumentMetadataAction(symbols[])
- computeDocumentDiffAction(original, compare)
```

**Issues**:

- ❌ Too large, mixes multiple domains
- ❌ Hard to navigate and maintain
- ❌ Violates single responsibility principle
- ❌ Combines mandate decisions, documents, and review mode
- ❌ No clear organization principle

---

#### ✅ `src/features/auth/actions.ts` **(175 lines)**

**Purpose**: Authentication server actions  
**Contains**:

- Magic link request/verification
- Entity assignment during login
- User logout/entity updates

**Exported Functions**:

```typescript
- requestMagicLinkAction(email)
- checkEntityForTokenAction(token)
- verifyTokenAndLoginAction({token, entity?})
- updateEntityAction(entity)
- logoutAction()
```

**Status**: ✅ **Well-organized, appropriate size** - This is the pattern to follow!

---

### 2. Business Logic Services (Pure functions, no `"use server"`)

#### ✅ `src/lib/services/mandates/`

| File                  | Purpose                             | Lines | Exports                                                                               | Status  |
| --------------------- | ----------------------------------- | ----- | ------------------------------------------------------------------------------------- | ------- |
| `data-service.ts`     | Fetch PPB records, entities from DB | 199   | `fetchPPBRecords()`, `fetchEntities()`, `getBudgetPartsMeta()`                        | ✅ Good |
| `transformData.ts`    | Transform PPB data to UI structure  | 195   | `transformPPBData()`                                                                  | ✅ Good |
| `mandate-warnings.ts` | Calculate mandate warnings          | ~190  | `getMandateWarnings()`, `hasWarnings()`, `getWarningIcon()`, `getWarningColorClass()` | ✅ Good |
| `decision-reasons.ts` | Decision reason constants/lookup    | ~110  | Constants + `getReasonsForDecision()`, `getReasonLabel()`                             | ✅ Good |
| `reference-data.ts`   | Issuing bodies reference data       | ~30   | `getIssuingBodies()`                                                                  | ✅ Good |
| `age-indicator.ts`    | Age calculation utility             | ~20   | `getAgeIndicator()`                                                                   | ✅ Good |
| `warnings-utils.ts`   | Warning helper functions            | ~30   | `findNewestCitedVersion()`                                                            | ✅ Good |

**Status**: ✅ Well-organized domain logic, clear separation of concerns

---

#### ✅ `src/lib/services/documents/`

| File                   | Purpose                              | Lines | Exports                                                                         | Status  |
| ---------------------- | ------------------------------------ | ----- | ------------------------------------------------------------------------------- | ------- |
| `metadata.ts`          | Fetch document metadata with caching | 148   | `fetchDocumentMetadata()` (cached)                                              | ✅ Good |
| `metadata-utils.ts`    | Metadata resolution utilities        | ~130  | `resolveMetadata()`, `normalizeSymbol()`, `cleanTitle()`, `buildPlaceholders()` | ✅ Good |
| `document-versions.ts` | Fetch document versions              | 74    | `fetchAllVersions()`                                                            | ✅ Good |
| `newer-versions.ts`    | Check for newer versions             | ~100  | `fetchNewerVersions()`, `hasNewerVersion()`                                     | ✅ Good |

**Status**: ✅ Well-organized, clear separation of concerns

**Note**: Why does `getDocumentMetadataAction()` exist if it just wraps `fetchDocumentMetadata()`? 🤔

---

#### ✅ `src/lib/services/export/`

| File              | Purpose                | Exports                                     |
| ----------------- | ---------------------- | ------------------------------------------- |
| `export-docx.ts`  | DOCX export generation | `exportEntityToDocx()`, `exportAllToDocx()` |
| `export-excel.ts` | CSV/XLSX export        | `exportToCsv()`, `exportToXlsx()`           |

**Status**: ✅ Good separation, truly cross-cutting concern

---

#### ⚠️ `src/lib/services/client/`

| File                     | Purpose                                         | Usage                       | Status                           |
| ------------------------ | ----------------------------------------------- | --------------------------- | -------------------------------- |
| `client-data-service.ts` | Client-side paragraph fetching from static JSON | Only in `DocumentModal.tsx` | ⚠️ Has FIXME TODO, minimal usage |

**Exports**:

```typescript
- fetchParagraphs(symbol) // Returns Paragraph[] from /data/paragraphs/{symbol}.json
```

**Status**: ⚠️ Unclear purpose, underutilized, could be inlined or moved to documents feature

---

### 3. Auth Layer (Feature Module Pattern)

#### ✅ `src/features/auth/` - **IDEAL STRUCTURE**

```
features/auth/
  ├── auth.ts           (Service - Auth utilities)
  ├── actions.ts        (Server Actions)
  ├── mail.ts           (Service - Email sending)
  └── ui/               (UI Components)
      ├── LoginForm.tsx
      ├── VerifyForm.tsx
      ├── EntityCombobox.tsx
      └── EntityChangeDialog.tsx
```

| File         | Type           | Purpose                                             |
| ------------ | -------------- | --------------------------------------------------- |
| `auth.ts`    | Service        | Session, tokens, user management, domain validation |
| `actions.ts` | Server Actions | Login, logout, entity updates                       |
| `mail.ts`    | Service        | Magic link email sending                            |
| `ui/*`       | Components     | Auth UI components                                  |

**Status**: ✅ **THIS IS THE PATTERN TO FOLLOW EVERYWHERE**

---

### 4. API Routes (`src/app/api/`)

| Route                                  | Purpose                      | Calls What              | Issue               |
| -------------------------------------- | ---------------------------- | ----------------------- | ------------------- |
| `export/[entity]/[format]/route.ts`    | Export entity data           | ✅ Uses export services | Good                |
| `export/all/[format]/route.ts`         | Export all entities          | ✅ Uses export services | Good                |
| `realtime/decisions/[entity]/route.ts` | Polling for realtime updates | ⚠️ Direct DB queries    | Should use actions? |
| `documents/search/route.ts`            | Document search              | ⚠️ Direct DB queries    | Should use service? |
| `upload/docx/route.ts`                 | DOCX upload                  | File upload logic       | OK                  |
| `verify-link/route.ts`                 | Email link verification      | Unknown                 | Need to check       |

**Status**: ⚠️ Mix of using services and direct DB queries - inconsistent layering

---

## Problems Identified

### 🔴 Critical Issues

#### 1. Monolithic housekeeping-actions.ts

- **1010 lines** combining unrelated domains
- Mixes decisions, comments, review mode, documents
- Hard to maintain, test, and navigate
- No clear organization principle

#### 2. Inconsistent organization pattern

- Auth uses `features/auth/` ✅ (Good!)
- Mandates split between `lib/services/mandates/` and scattered
- Documents split between `lib/services/documents/` and scattered
- **No clear rule** for when to use `features/` vs `lib/services/`

#### 3. Duplicate/parallel structures

Document metadata is fetched in TWO places:

- `services/documents/metadata.ts` - Actual cached implementation
- `housekeeping-actions.ts` → `getDocumentMetadataAction()` - Just wraps above

**Question**: Why wrap if just calling the service? Does it add auth? (No, it doesn't)

---

### ⚠️ Medium Issues

#### 4. Unclear client vs server boundaries

- `client-data-service.ts` only fetches static JSON files
- Only used in ONE component (`DocumentModal.tsx`)
- Has FIXME TODO comment
- Could be inlined or moved to documents feature

#### 5. API routes bypass services

- Some routes do direct DB queries instead of reusing services
- Violates DRY principle
- Makes testing harder

#### 6. Type definitions scattered

- Some in `types/index.ts`
- Some in service files (e.g., `EntityOption` in `data-service.ts`)
- Inconsistent export locations

---

## Recommended Consolidation

### ⚠️ **Important: Documents vs Mandates Boundary**

**The user is right** - the distinction between "documents" and "mandates" is **blurry** because:
- Mandates are **derived from documents** (PPB citations reference UN documents)
- Document metadata is **part of the mandate review workflow**
- Document diffs/versions are **tools for reviewing mandates**
- They're tightly coupled in the business domain

**Better mental model**: 
- **Mandates** = The core business domain (PPB records, decisions, reviews, document lookups)
- **Documents** are NOT a separate feature - they're **supporting infrastructure** for mandate review

---

### ✅ **Option A: Single Mandates Feature** (RECOMMENDED)

Keep everything mandate-related together, including document operations:

```
src/
  features/
    auth/                               ← Already well-structured ✅
      services/
        auth.ts                         ← Pure auth logic
        mail.ts                         ← Email sending
      actions.ts                        ← Server actions only
      ui/                               ← UI components

    mandates/                           ← NEW: ALL mandate review code
      services/
        # Core mandate business logic
        data-service.ts                 ← Fetch PPB records
        transform.ts                    ← Transform to UI structure
        warnings.ts                     ← Calculate warnings
        decision-reasons.ts             ← Decision reason lookups
        reference-data.ts               ← Reference data
        age-indicator.ts                ← Age calculations
        warnings-utils.ts               ← Warning helpers
        
        # Document support (part of mandate workflow)
        documents/
          metadata.ts                   ← Document metadata lookup
          metadata-utils.ts             ← Metadata helpers
          versions.ts                   ← Document version tracking
          newer-versions.ts             ← Check for newer versions
      
      actions/
        decisions.ts                    ← Decision CRUD
        comments.ts                     ← Comment CRUD
        review-mode.ts                  ← Review mode management
        user.ts                         ← User role info
        documents.ts                    ← Document metadata/diff/versions
      
      ui/
        DocumentModal.tsx               ← Document viewer (mandate tool)
        DiffModal.tsx                   ← Document diff viewer (mandate tool)

  lib/
    services/                           ← ONLY truly cross-cutting services
      export/
        excel.ts                        ← Used by API routes
        docx.ts                         ← Used by API routes
    db/
      db.ts                             ← Database infrastructure
    utils.ts                            ← Keep (shared utilities)
    constants.ts                        ← Keep (shared constants)
```

**Why this works**:
- ✅ **No blurry boundaries** - if it's about mandate review, it's in `features/mandates/`
- ✅ Documents clearly "support" the mandate workflow (nested in `services/documents/`)
- ✅ Consistent with auth pattern
- ✅ Easy to find code - everything mandate-related in one place
- ✅ Still breaks up the 1010-line monolith into ~5 action files
- ✅ Clear layering: UI → Actions → Services → DB

---

### 🔄 **Option B: Keep Documents in lib/** (If they feel like infrastructure)

If document operations might be used by other features in the future:

```
src/
  features/
    auth/                               ← Authentication feature
    
    mandates/                           ← NEW: Mandate-specific code only
      services/
        data-service.ts                 ← PPB records
        transform.ts                    ← Data transformation
        warnings.ts                     ← Mandate warnings
        decision-reasons.ts             ← Decision reasons
        reference-data.ts               ← Reference data
      actions/
        decisions.ts                    ← Decision CRUD
        comments.ts                     ← Comment CRUD
        review-mode.ts                  ← Review mode
        user.ts                         ← User role
      ui/
  
  lib/
    services/
      documents/                        ← Keep as reusable infrastructure
        metadata.ts                     ← Could be used by future features
        metadata-utils.ts
        versions.ts                     ← Version tracking
        newer-versions.ts
      export/
        excel.ts
        docx.ts
    db/
```

**Trade-offs**:
- ✅ Reusable if other features need document lookups
- ⚠️ Creates boundary questions (where does DocumentModal go?)
- ⚠️ Documents feel "separate" but are only used for mandates currently

---

### 📊 **Which Option to Choose?**

| Question | Option A (All in Mandates) | Option B (Docs in lib) |
|----------|---------------------------|------------------------|
| Are documents used elsewhere? | ❌ No, only for mandates | ✅ Yes or might be | 
| Is boundary clear? | ✅ Yes - mandate domain | ⚠️ No - still blurry |
| Where do DocumentModal/DiffModal go? | ✅ Obviously mandates/ui | ❓ Unclear (components/?) |
| Easier to navigate? | ✅ Everything in one place | ⚠️ Split between two places |
| Future-proof? | ✅ Can refactor later if needed | ✅ Already separated |

**Recommendation**: **Start with Option A** (single mandates feature)
- Simpler mental model
- Can always extract documents to lib/ later if truly needed elsewhere
- YAGNI principle - don't create abstractions you don't need yet

---

## Detailed Refactoring Plan (Option A)

### Phase 1: Split housekeeping-actions.ts into feature actions

#### Step 1.1: Create `features/mandates/actions/decisions.ts`

```typescript
"use server"

// Move these 7 functions:
export async function createDecisionAction(...)
export async function updateDecisionReasonAction(...)
export async function approveDecisionAction(...)
export async function clearAllEntityDecisionsAction(...)
export async function getDocumentDecisionsAction(...)
export async function getEntityDecisionsAction(...)
export async function getSingleMandateStateAction(...)
```

#### Step 1.2: Create `features/mandates/actions/comments.ts`

```typescript
"use server"

// Move these 2 functions:
export async function createCommentAction(...)
export async function resolveCommentAction(...)
```

#### Step 1.3: Create `features/mandates/actions/review-mode.ts`

```typescript
"use server"

// Move these 4 functions:
export async function getReviewModeStatusAction(...)
export async function startReviewModeAction(...)
export async function endReviewModeAction(...)
async function checkReviewModeBlock(...) // Helper (not exported)
```

#### Step 1.4: Create `features/mandates/actions/user.ts`

```typescript
"use server"

// Move this 1 function:
export async function getUserRoleAction(...)
```

#### Step 1.5: Create `features/mandates/actions/documents.ts`

```typescript
"use server"

// Move these 3 document-related functions:
export async function getDocumentVersionsAction(...)
export async function getDocumentMetadataAction(...)
export async function computeDocumentDiffAction(...)

// These should import from features/mandates/services/documents/
```

**Note**: Documents actions stay in mandates feature because they're part of the mandate review workflow.

#### Step 1.6: Delete `housekeeping-actions.ts`

Once all functions are moved and imports updated.

---

### Phase 2: Consolidate mandate services

#### Step 2.1: Create `features/mandates/services/` directory

#### Step 2.2: Move mandate business logic files

```bash
mv src/lib/services/mandates/*.ts src/features/mandates/services/
```

Files to move:

- `data-service.ts`
- `transformData.ts`
- `mandate-warnings.ts`
- `decision-reasons.ts`
- `reference-data.ts`
- `age-indicator.ts`
- `warnings-utils.ts`

#### Step 2.3: Update all imports

Search/replace:
- `@/lib/services/mandates/` → `@/features/mandates/services/`

---

### Phase 3: Move document services into mandates feature

#### Step 3.1: Create `features/mandates/services/documents/` subdirectory

Document services are part of the mandate workflow, so nest them:

```bash
mkdir -p src/features/mandates/services/documents
```

#### Step 3.2: Move document files

```bash
mv src/lib/services/documents/*.ts src/features/mandates/services/documents/
```

Files to move:
- `metadata.ts` → `features/mandates/services/documents/metadata.ts`
- `metadata-utils.ts` → `features/mandates/services/documents/metadata-utils.ts`
- `document-versions.ts` → `features/mandates/services/documents/versions.ts`
- `newer-versions.ts` → `features/mandates/services/documents/newer-versions.ts`

#### Step 3.3: Update all imports

Search/replace:
- `@/lib/services/documents/` → `@/features/mandates/services/documents/`

**Why nest under mandates?** Documents are tools for reviewing mandates, not a separate business domain.

---

### Phase 4: Clean up client services

#### Option A: Inline into DocumentModal (RECOMMENDED)

The `fetchParagraphs` function is only used once, could be inlined.

#### Option B: Move to mandates feature

```bash
mv src/lib/services/client/client-data-service.ts \
   src/features/mandates/services/documents/paragraph-fetcher.ts
```

#### Step 4.1: Remove `lib/services/client/` directory

---

### Phase 5: Update component imports

#### Files that import from housekeeping-actions:

```typescript
// Before
import { computeDocumentDiffAction } from "@/lib/services/housekeeping-actions"

// After - all actions now in mandates feature
import { computeDocumentDiffAction } from "@/features/mandates/actions/documents"
import { createDecisionAction } from "@/features/mandates/actions/decisions"
import { createCommentAction } from "@/features/mandates/actions/comments"
```

**Files to update**:
- `src/components/DiffModal.tsx` → use `@/features/mandates/actions/documents`
- `src/components/DocumentModal.tsx` → use `@/features/mandates/actions/documents`
- `src/components/EntityDetail.tsx` → use `@/features/mandates/actions/*`
- Any other files using these actions

---

### Phase 6: Move UI components (optional)

Consider moving mandate-specific UI into the feature:

```bash
mv src/components/DocumentModal.tsx src/features/mandates/ui/
mv src/components/DiffModal.tsx src/features/mandates/ui/
```

**Note**: Only move if they're truly mandate-specific. If reusable, can stay in `components/`

---

### Phase 7: Update API routes

Consider updating API routes to use feature actions for consistency:

**Before** (direct DB query):
```typescript
// src/app/api/realtime/decisions/[entity]/route.ts
const rows = await query<ChangeRecord>(`SELECT ...`, [entity])
```

**After** (use action):
```typescript
import { getEntityDecisionsAction } from "@/features/mandates/actions/decisions"

const result = await getEntityDecisionsAction(entity)
```

---

## Migration Impact Assessment

### Import Changes Required

| Current Import | New Import | Files Affected |
|----------------|------------|----------------|
| `@/lib/services/housekeeping-actions` | `@/features/mandates/actions/*` | ~10 files |
| `@/lib/services/mandates/*` | `@/features/mandates/services/*` | ~5 files |
| `@/lib/services/documents/*` | `@/features/mandates/services/documents/*` | ~3 files |
| `@/lib/services/client/*` | Inline or `@/features/mandates/services/documents/*` | 1 file |

**Key simplification**: Everything mandate-related now has `@/features/mandates/` prefix - easy to remember!

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking changes | Low | Medium | TypeScript will catch all import errors |
| Logic bugs | Very Low | High | No logic changes, pure refactoring |
| Missing references | Low | Low | Search/replace + TypeScript check |
| Runtime errors | Very Low | Medium | Test all features after migration |

**Overall Risk**: 🟢 **LOW** - Mostly mechanical refactoring

---

## Questions to Answer Before Refactoring

### 1. Why does `getDocumentMetadataAction()` exist?

```typescript
// housekeeping-actions.ts
export async function getDocumentMetadataAction(symbols: string[]) {
  const result = await fetchDocumentMetadata(symbols)
  return { success: true, data: result }
}
```

- Just wraps the service function
- Doesn't add auth checks
- Doesn't add any business logic
- **Question**: Can components call `fetchDocumentMetadata` directly?

**Options**:

- A) Keep wrapper for consistency (all actions return `{success, data}`)
- B) Remove wrapper, call service directly from server components
- C) Add auth checks to make it meaningful

---

### 2. Why is `client-data-service.ts` separate?

- Only fetches static JSON files
- One function, one usage
- Has TODO/FIXME comment

**Options**:

- A) Inline into `DocumentModal.tsx`
- B) Move to `features/documents/services/`
- C) Make it part of document metadata service

---

### 3. Should API routes use actions or services?

Currently inconsistent:

- Export routes → Use services ✅
- Realtime route → Direct DB queries ⚠️
- Search route → Direct DB queries ⚠️

**Options**:

- A) Routes → Actions → Services (Most layers, max consistency)
- B) Routes → Services (Fewer layers, actions only for UI)
- C) Keep as-is (Inconsistent but pragmatic)

**Recommendation**: Option A for consistency and testability

---

### 4. Should we keep `features/` pattern or go back to `lib/`?

**Recommend**: Continue `features/` pattern

- Matches modern Next.js conventions
- Auth already uses it successfully
- Clearer domain boundaries
- Better for team collaboration (domains are isolated)

---

## File Structure After Refactoring

```
src/
  features/
    auth/                                       (✅ No changes)
      services/
        auth.ts
        mail.ts
      actions.ts
      ui/
    
    mandates/                                   (✨ NEW - All mandate-related code)
      services/
        # Core mandate business logic
        data-service.ts                         (📦 Moved from lib/services/mandates/)
        transform.ts                            (📦 Moved)
        warnings.ts                             (📦 Moved)
        decision-reasons.ts                     (📦 Moved)
        reference-data.ts                       (📦 Moved)
        age-indicator.ts                        (📦 Moved)
        warnings-utils.ts                       (📦 Moved)
        
        # Document support (nested under mandates)
        documents/                              (✨ NEW subdirectory)
          metadata.ts                           (📦 Moved from lib/services/documents/)
          metadata-utils.ts                     (📦 Moved)
          versions.ts                           (📦 Moved from document-versions.ts)
          newer-versions.ts                     (📦 Moved)
      
      actions/
        decisions.ts                            (✂️ Split from housekeeping-actions)
        comments.ts                             (✂️ Split)
        review-mode.ts                          (✂️ Split)
        user.ts                                 (✂️ Split)
        documents.ts                            (✂️ Split - doc metadata/diff/versions)
      
      ui/ (optional)
        DocumentModal.tsx                       (📦 Moved from components/)
        DiffModal.tsx                           (📦 Moved from components/)
  
  lib/
    services/
      export/                                   (✅ Keep - cross-cutting)
        excel.ts
        docx.ts
    db/
      db.ts                                     (✅ Keep - infrastructure)
    utils.ts                                    (✅ Keep - shared)
    constants.ts                                (✅ Keep - shared)
  
  app/
    api/                                        (⚠️ Maybe update to use actions)
  
  components/                                   (✅ Keep - shared UI)
    core/
    ui/
```

**Legend**:
- ✅ No changes
- ✨ New directory or subdirectory
- 📦 Moved file
- ✂️ Split from monolith
- ⚠️ Needs review/update

**Key insight**: Documents are nested under `mandates/services/documents/` to show they're supporting infrastructure for the mandate review workflow, not a separate feature.

---

## Implementation Checklist

### Preparation
- [ ] Create feature branch: `refactor/consolidate-data-services`
- [ ] Review all current imports in codebase
- [ ] Create new directory structure

### Phase 1: Split Actions (Can be done incrementally)
- [ ] Create `features/mandates/actions/decisions.ts`
- [ ] Create `features/mandates/actions/comments.ts`
- [ ] Create `features/mandates/actions/review-mode.ts`
- [ ] Create `features/mandates/actions/user.ts`
- [ ] Create `features/mandates/actions/documents.ts`
- [ ] Update imports in components
- [ ] Test each action file
- [ ] Delete `housekeeping-actions.ts`

### Phase 2: Move Mandate Services
- [ ] Create `features/mandates/services/`
- [ ] Move all files from `lib/services/mandates/`
- [ ] Update imports across codebase
- [ ] Test mandate features

### Phase 3: Move Document Services into Mandates
- [ ] Create `features/mandates/services/documents/` subdirectory
- [ ] Move all files from `lib/services/documents/` to `features/mandates/services/documents/`
- [ ] Update imports across codebase
- [ ] Test document features

### Phase 4: Clean Up
- [ ] Remove `lib/services/client/` (inline or move to mandates)
- [ ] Remove `lib/services/mandates/` (should be empty)
- [ ] Remove `lib/services/documents/` (should be empty)
- [ ] Update API routes (optional)

### Phase 5: Verification
- [ ] Run TypeScript compiler: `pnpm typecheck`
- [ ] Run linter: `pnpm lint`
- [ ] Test all features manually
- [ ] Run build: `pnpm build`
- [ ] Test in dev: `pnpm dev`

### Phase 6: Documentation
- [ ] Update architecture docs
- [ ] Update README if needed
- [ ] Add comments explaining feature structure

---

## Expected Outcomes

### Before (Current State)

```
😕 Scattered organization
❌ 1010-line monolith
❌ Inconsistent patterns
⚠️ Unclear boundaries
✅ Good service logic
```

### After (Proposed State)

```
😊 Feature-first organization
✅ Small focused files (<200 lines)
✅ Consistent patterns everywhere
✅ Clear boundaries (UI → Actions → Services → DB)
✅ Easy to navigate
✅ Follows Next.js 16 best practices
✅ Scalable architecture
```

---

## Effort Estimate

| Phase                           | Effort        | Risk     |
| ------------------------------- | ------------- | -------- |
| Phase 1: Split actions          | 1-2 hours     | Low      |
| Phase 2: Move mandate services  | 30 min        | Low      |
| Phase 3: Move document services | 30 min        | Low      |
| Phase 4: Clean up               | 15 min        | Very Low |
| Phase 5: Testing/verification   | 1 hour        | Low      |
| **Total**                       | **3-4 hours** | **Low**  |

**Recommendation**: Can be done incrementally over multiple PRs if preferred.

---

## Conclusion

The current data services structure has organically grown in an inconsistent pattern. The auth feature (`features/auth/`) demonstrates a clean, maintainable structure that should be replicated.

### Key Insight: Don't Separate Documents and Mandates

The user correctly identified that **the boundary between documents and mandates is blurry**. This is because:
- Documents are not a separate business domain
- They're infrastructure for the mandate review workflow
- Creating separate features would just create confusion about where code belongs

### Solution: Single Mandates Feature

**Main action items**:
1. ✂️ Split the 1010-line `housekeeping-actions.ts` monolith into 5 focused files
2. 📦 Consolidate all mandate-related code into `features/mandates/`
3. 🏗️ Nest document services under `features/mandates/services/documents/` to show they're supporting infrastructure
4. 🗑️ Remove parallel/duplicate structures
5. ✅ Follow consistent feature-first organization (matching auth pattern)

**Result**: A cleaner, more maintainable codebase with:
- ✅ No blurry boundaries - if it's about mandate review, it's in `features/mandates/`
- ✅ Clear mental model - documents support mandates
- ✅ Consistent with auth pattern
- ✅ Easier for the team to work with
- ✅ Scales better

**The key**: Organize by **business domain** (mandate review), not by data type (documents vs mandates).
