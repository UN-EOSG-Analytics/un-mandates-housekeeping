# About Page Concept – Mandate Housekeeping Platform

## Purpose
A feature showcase page for non-technical focal point users from UN entities to understand all platform capabilities. Hybrid style: approachable like a startup landing page, but respectful and professional in the UN tradition.

## Target Audience
- Programme Officers (focal points from entities)
- Budget coordinators
- DMSPC reviewers
- Non-technical staff who need to understand the tool

## Visual Style
- Clean, modern card-based layout
- UN blue (#009edb) as accent color
- Light backgrounds with subtle shadows
- Professional iconography (Lucide icons)
- Generous whitespace
- Feature screenshots in rounded frames
- No corporate fluff language

---

## Feature Sections

### 1. Entity Overview & Navigation
**Headline:** Find Your Entity Quickly
**Description:** Browse all entities organized by budget part. Search by entity name, view by section groupings, or jump directly to your assigned entity.
- My Entity card for quick access
- Search box with instant filtering
- Section groupings toggle
- Export all entities at once

### 2. Mandate List & Organization
**Headline:** All Mandates at a Glance
**Description:** See every mandate citation for your entity, organized by subprogramme. Sort by symbol, title, issuing body, year, or how many other entities cite the same document.
- Sortable columns
- Subprogramme sections (Programme Level first)
- Background/foundational mandates section
- Count indicators

### 3. Document Lookup & Validated Citations
**Headline:** Search the UN Library Database
**Description:** Add or update mandate citations using our built-in database of UN documents. Search by symbol or title to get validated document metadata including title, year, issuing body, and direct PDF link.
- Live search results
- Document metadata preview
- Manual entry fallback for non-indexed documents
- Instant symbol validation

### 4. Decision Making
**Headline:** Mark Your Housekeeping Decisions
**Description:** For each mandate, decide whether to Retain, Remove, or Update the citation. Add a reason for your decision to help reviewers understand your rationale.
- Retain / Remove / Update dropdown
- Decision reason selection
- Color-coded visual feedback
- Decision attribution (who, when)

### 5. Update Flow with New Document Selection
**Headline:** Seamlessly Update Citations
**Description:** When updating a citation, search for the replacement document right in place. The platform pre-fills suggested newer versions when available.
- Inline search for replacement
- Pre-selected suggestions
- Side-by-side comparison available
- Preserves decision history

### 6. Newer Version Alerts
**Headline:** Never Miss an Updated Resolution
**Description:** The platform automatically detects when newer versions of your cited documents exist. Smart alerts prompt you to update to the latest version.
- Automatic version detection
- Blue notification badges
- One-click update action
- "Already cited" detection prevents duplicates

### 7. Document Version Comparison
**Headline:** Compare Document Texts Side-by-Side
**Description:** Not sure what changed between versions? Use the built-in diff viewer to see exactly what text was added, removed, or modified between any two document versions.
- Visual diff highlighting
- Additions in green, removals in red
- Compare with any version
- Full paragraph context

### 8. Cross-Cutting Entity Views
**Headline:** Discover Shared Citations
**Description:** See which mandates are cited by multiple entities. Filter to show only documents shared with a specific entity—useful for coordination and consistency.
- Entity citation counts
- Filter by co-citing entity
- Shared mandate highlighting
- Quick entity switching

### 9. Document Detail Sidebar
**Headline:** Deep Dive Into Any Document
**Description:** Click any document to open a detailed sidebar with full metadata, version history, paragraph text, and all activity from across entities.
- Four tabs: Info, Decisions, Activity, Paragraphs
- Version timeline with diff buttons
- Cross-entity decision overview
- Direct PDF links

### 10. Paragraph Analysis
**Headline:** See Exactly Where Your Entity is Mentioned
**Description:** View the full document text with your entity name automatically highlighted. Collapse irrelevant paragraphs to focus on what matters to you.
- Entity name highlighting
- Collapsible non-relevant sections
- Preambular/operative separation
- AI relevance comments

### 11. Collaborative Comments
**Headline:** Discuss and Coordinate
**Description:** Add comments on any mandate to flag issues, ask questions, or coordinate with colleagues. Reviewer comments can be marked as resolved when addressed.
- Per-mandate comments
- Comment attribution
- Resolve/reopen functionality
- Reviewer highlighting

### 12. Activity Timeline
**Headline:** Track Every Change
**Description:** The activity log shows all decisions and comments across all entities for each document. Filter by entity or show only comments.
- Chronological timeline
- Decision color coding
- Entity filter pills
- Approval tracking

### 13. Reviewer Approval Workflow
**Headline:** Built-In Review Process
**Description:** DMSPC reviewers can approve entity decisions with a single click. Approval status is visible to all, ensuring transparency in the review process.
- Per-decision approval checkboxes
- Bulk approval option
- Approval attribution
- Reviewer mode indicator

### 14. Smart Warnings
**Headline:** Proactive Issue Detection
**Description:** The platform flags potential issues: missing document metadata, unavailable PDF links, or newer versions already cited elsewhere. Each warning suggests an action.
- Warning badges on rows
- Expandable warning details
- Suggested actions (update/remove)
- Stacked warnings with count

### 15. Export Capabilities
**Headline:** Take Your Data Anywhere
**Description:** Export your entity's mandates and decisions to CSV, Excel, or Word format. Perfect for reports, offline review, or sharing with colleagues.
- CSV for data analysis
- Excel for spreadsheets
- Word for formal documents
- Entity or all-entity export

### 16. Magic Link Authentication
**Headline:** Secure Access, No Password Required
**Description:** Sign in with your UN email address. We'll send you a secure link—click it and you're in. No passwords to remember.
- Email-based authentication
- Secure one-time links
- Entity auto-assignment
- Session persistence

### 17. Foundational Mandates
**Headline:** Know Your Core Citations
**Description:** Mandates that appear in both your subprogramme list and the "Mandates and Background" section are marked with a star. These foundational citations deserve special attention.
- Star indicator
- Dual-section visibility
- Foundation tooltip
- Easy identification

### 18. Age Indicators
**Headline:** At-a-Glance Citation Age
**Description:** Color-coded badges show how old each mandate is: Fresh (≤5 years), Mature (6-10 years), or Aged (11+ years). Helps prioritize review of older citations.
- Color-coded age badges
- Tooltip with exact age
- Year column sorting
- Visual prioritization

---

## Page Structure

```
[Hero Section]
- UN Logo + Platform Name
- Tagline: "Streamline your PPB 2027 mandate review"
- Brief intro paragraph

[Feature Grid] - 2 columns
- Each feature: Icon + Title + Description + Screenshot

[Getting Started Section]
- 3 simple steps
- Link to login

[Footer]
- Contact: support@eosg.dev
- Technical support info
```

## Screenshots Needed
1. Entity overview with search and sections
2. Entity detail page with mandate list
3. Document search dropdown with results
4. Decision dropdown with reason
5. Newer version alert badge
6. Diff modal showing comparison
7. Cross-entity filter pills
8. Document sidebar (Info tab)
9. Document sidebar (Paragraphs tab with highlighting)
10. Activity timeline with comments
11. Export dropdown
12. Warning tooltip expanded

## Implementation Notes
- Use existing component styles
- Route: `/about`
- No authentication required
- Link from header
- Screenshots stored in `/public/screenshots/`
