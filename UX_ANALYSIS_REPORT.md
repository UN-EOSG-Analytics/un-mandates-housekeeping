# UX Analysis Report

## Executive Summary

This report analyzes the user experience of the UN Mandates Housekeeping Platform, a collaborative tool for reviewing legislative mandate citations in the UN Programme Budget. The application is well-designed overall, with a clear information hierarchy and thoughtful interactions. However, several areas could benefit from improvement.

---

## 1. User Flows

### 1.1 Authentication Flow

**Current State:**
- Magic link authentication via @un.org email
- First-time users must select their organizational entity
- Entity can be changed later via the user menu

**Strengths:**
- ✅ Passwordless authentication is secure and convenient for UN staff
- ✅ Rate limiting prevents spam (14-minute cooldown)
- ✅ Clear feedback when magic link is sent
- ✅ Entity selection uses searchable combobox

**Issues:**
- ⚠️ **Missing redirect after login**: After completing sign-in, users always go to `/` regardless of their intended destination. Consider storing and restoring the original URL.
- ⚠️ **No session expiry warning**: Sessions last 7 days with no visual indicator. Users may be surprised when logged out.
- ⚠️ **"Other – Please Specify" option**: While functional, this creates free-text entities that may be inconsistent. Consider requiring approval or providing guidance.

### 1.2 Entity Selection Flow

**Current State:**
- Home page shows all budget parts with entity cards
- Users can filter/search entities
- "My Entity" card is highlighted at top for logged-in users

**Strengths:**
- ✅ Clear visual hierarchy with budget parts
- ✅ Entity counts provide quick overview
- ✅ Action counts (amber badges) surface items needing attention

**Issues:**
- ⚠️ **No breadcrumb navigation**: When deep in an entity view, returning to the overview requires using browser back or clicking the logo
- ⚠️ **"View Sections" toggle state not persisted**: User preference resets on page reload

### 1.3 Mandate Review Flow

**Current State:**
- Entity detail page shows mandates organized by subprogramme
- Each mandate row shows symbol, title, body, year, age, and decision status
- Sidebar modal provides detailed information and actions

**Strengths:**
- ✅ Sortable columns with visual feedback
- ✅ Age indicators provide immediate context (color-coded <5, >5, >10, >20, >50 years)
- ✅ Warning system surfaces actionable items (newer versions, missing metadata)
- ✅ Foundational mandates clearly marked with star icon
- ✅ Real-time optimistic updates when making decisions

**Issues:**
- ⚠️ **Dense information display**: The 11-column grid may be overwhelming. Consider progressive disclosure or tooltips on mobile.
- ⚠️ **No undo for decisions**: Once a decision is made, users must create a new "cancel" decision. Consider confirmation dialogs for destructive actions.
- ⚠️ **Reason popup appears immediately**: After selecting retain/remove/update, the reason popup appears. Some users might want to skip this.

---

## 2. Interaction Design

### 2.1 Decision Making

**Current State:**
- Dropdown with Retain/Remove/Update/Cancel options
- "Update" triggers document search interface
- Reason selection popup appears after decision

**Strengths:**
- ✅ Clear color coding (blue=retain, red=remove, amber=update, emerald=add)
- ✅ Integrated reason selection with categorized options
- ✅ "Other" option allows free-text reasons

**Issues:**
- ⚠️ **No batch operations**: Users cannot retain/remove multiple mandates at once (except "Approve All" in a section for reviewers)
- ⚠️ **Update flow is multi-step**: Selecting "Update" → Search/Select document → Confirm reason. Consider inline document search.

### 2.2 Document Search

**Current State:**
- Type-ahead search for UN documents
- Manual entry form for documents not in database
- Shows document metadata (symbol, title, year, body)

**Strengths:**
- ✅ Debounced search (200ms) prevents excessive API calls
- ✅ Results sorted by relevance (exact matches first)
- ✅ Manual entry validates all required fields
- ✅ Smart duplicate detection when entering manually

**Issues:**
- ⚠️ **No recent searches**: Users frequently add similar documents. Consider showing recent selections.
- ⚠️ **Search requires 2+ characters**: Very short symbols like "S/1" require typing more. Consider lowering minimum.

### 2.3 Sidebar Modal

**Current State:**
- Four tabs: Info, Decisions, Activity, Paragraphs
- Shows detailed document metadata and history
- Allows inline commenting and decision making

**Strengths:**
- ✅ Comprehensive information without leaving context
- ✅ Activity feed shows all decisions/comments across entities
- ✅ Paragraph filtering by entity is powerful for multi-entity documents
- ✅ Document version comparison (diff view) is well-implemented

**Issues:**
- ⚠️ **No deep linking**: Cannot link directly to a specific document's sidebar
- ⚠️ **Keyboard navigation**: No escape key to close, no tab navigation between sections

---

## 3. Visual Design

### 3.1 Consistency

**Strengths:**
- ✅ Consistent UN blue (#009edb) branding throughout
- ✅ Uniform button styles and spacing
- ✅ Clear typography hierarchy

**Issues:**
- ⚠️ **Inconsistent icon usage**: Some tooltips use ⓘ emoji, others use Lucide icons
- ⚠️ **Mixed tooltip implementations**: Some use custom `Tooltip` component, others use `title` attribute

### 3.2 Information Hierarchy

**Strengths:**
- ✅ Clear section headers with uppercase styling
- ✅ Card-based layout for grouping related content
- ✅ Subtle backgrounds differentiate decision states

**Issues:**
- ⚠️ **Symbol truncation at 18 characters**: Long symbols show "..." but tooltip is only shown on hover

### 3.3 Feedback & States

**Strengths:**
- ✅ Loading spinners during async operations
- ✅ Color-coded decision states
- ✅ Optimistic updates provide immediate feedback

**Issues:**
- ⚠️ **No empty states for some views**: When search returns no results in global search, the list simply shows nothing
- ⚠️ **Error state is generic**: The error.tsx page shows minimal information

---

## 4. Accessibility

### 4.1 Current State

**Strengths:**
- ✅ Semantic HTML with proper heading hierarchy
- ✅ Combobox has proper ARIA attributes
- ✅ Focusable interactive elements

**Issues:**
- 🔴 **Focus rings disabled globally**: `globals.css` removes all focus outlines, which is problematic for keyboard navigation
- ⚠️ **No skip links**: No way to skip repetitive navigation
- ⚠️ **Color-only indicators**: Age and decision colors have text labels, but some warning icons rely solely on color
- ⚠️ **Modal focus trap**: Sidebar modal doesn't trap focus or manage focus return

### 4.2 Recommendations

1. **Re-enable focus indicators**: Replace `outline: none !important` with styled focus rings that match the design
2. **Add skip-to-content link**: Allow keyboard users to bypass header
3. **Implement focus trap in modals**: Use `focus-trap-react` or similar

---

## 5. Mobile Responsiveness

### 5.1 Current State

The application has limited mobile optimization with only 18 responsive breakpoint usages across the codebase.

**Issues:**
- 🔴 **Fixed column grid**: The mandate table uses a fixed 11-column grid that doesn't adapt to mobile
- 🔴 **Sidebar is full-screen but not touch-optimized**: Close button is small, swipe-to-dismiss not implemented
- ⚠️ **Entity cards grid**: Uses responsive classes but the grid doesn't collapse well on very small screens

### 5.2 Recommendations

1. **Redesign mandate list for mobile**: Consider card-based layout with expandable details
2. **Add touch-friendly interactions**: Larger tap targets, swipe gestures
3. **Test on actual devices**: The current implementation appears primarily desktop-focused

---

## 6. Performance Considerations

### 6.1 Strengths

- ✅ Server-side rendering for initial page load
- ✅ Client-side data fetching for interactions
- ✅ Debounced search inputs

### 6.2 Issues

- ⚠️ **Large components**: EntityDetail.tsx (2000 lines) and DocumentSymbol.tsx (1865 lines) may impact bundle size
- ⚠️ **No pagination**: Entity with many mandates loads all at once
- ⚠️ **Re-fetching on every entity page**: `getData()` is duplicated and could be cached

---

## 7. Error Handling

### 7.1 Current State

**Strengths:**
- ✅ Server actions return structured `{ success, data/error }` results
- ✅ Form validation with helpful error messages

**Issues:**
- ⚠️ **Silent failures in some places**: `.catch(() => {})` hides errors in several useEffect hooks
- ⚠️ **Generic error page**: No error boundary at component level, only page level
- ⚠️ **No retry mechanism**: Failed operations require manual refresh

---

## 8. Recommendations Summary

### High Priority

| Issue | Impact | Effort |
|-------|--------|--------|
| Re-enable accessible focus indicators | High | Low |
| Add mobile-responsive mandate list | High | Medium |
| Add confirmation for destructive actions | Medium | Low |
| Implement focus trap in sidebar modal | Medium | Low |

### Medium Priority

| Issue | Impact | Effort |
|-------|--------|--------|
| Add breadcrumb navigation | Medium | Low |
| Persist user preferences (section view toggle) | Low | Low |
| Add empty states for search results | Low | Low |
| Implement deep linking to document sidebar | Medium | Medium |

### Low Priority

| Issue | Impact | Effort |
|-------|--------|--------|
| Add batch operations for decisions | Medium | High |
| Implement recent searches | Low | Low |
| Add skip-to-content link | Low | Low |
| Component-level error boundaries | Low | Medium |

---

## 9. Conclusion

The UN Mandates Housekeeping Platform is a well-crafted application with thoughtful UX decisions for its core use case: desktop users reviewing legislative mandates. The warning system, decision workflow, and document comparison features are particularly well-implemented.

The primary areas for improvement are:
1. **Accessibility**: Focus management needs attention
2. **Mobile support**: The application is effectively desktop-only
3. **Progressive disclosure**: Some screens have high information density

The codebase demonstrates good practices with TypeScript, consistent styling, and clear component boundaries. Addressing the high-priority items above would significantly improve the experience for all users.
