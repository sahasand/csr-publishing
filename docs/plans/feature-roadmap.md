# CSR Publishing - Feature Roadmap & Improvements

## Codebase Review Summary

**What's built**: A functional CSR document management tool with study management, ICH E3 template structure, PDF upload/processing, annotation/checklist review, document workflow (DRAFT→IN_REVIEW→APPROVED→PUBLISHED), PDF validation, and eCTD packaging with XML generation. The packaging pipeline is the most mature subsystem.

**What's missing**: Authentication, search/filtering, most API tests, component tests, CI/CD, and several critical business logic gaps.

---

## Priority 1: Critical Fixes (Bugs & Data Integrity)

### 1.1 Document PATCH bypasses workflow
- `PATCH /api/documents/[id]` allows setting any status directly, bypassing the transition API
- **Fix**: Strip `status` from PATCH body or validate through the same transition logic

### 1.2 Dashboard "Pending Review" count hardcoded to 0
- `src/app/(dashboard)/page.tsx:153` always shows 0 pending reviews
- **Fix**: Query documents where `status = 'IN_REVIEW'`

### 1.3 File cleanup on document delete
- `DELETE /api/documents/[id]` removes DB record but orphans the PDF file on disk
- **Fix**: Delete the physical file from `UPLOAD_DIR` before/after DB deletion

### 1.4 Document version race condition
- Version numbering uses `db.document.count()` which has a race condition on concurrent uploads to the same slot
- **Fix**: Use a database-level unique constraint or atomic increment

### 1.5 Settings page shows misleading allowed file types
- UI says "PDF, DOCX, DOC, TXT, CSV, RTF, XPT" but only PDF upload is supported
- **Fix**: Update Settings display to match reality (PDF only)

### 1.6 Checkbox API mismatch in export-button.tsx
- Uses `onChange={(e) => e.target.checked}` but Radix Checkbox uses `onCheckedChange(boolean)`
- **Fix**: Switch to `onCheckedChange` callback

### 1.7 Dead code in document-viewer.tsx
- `showAnnotations ? 'mr-0' : 'mr-0'` — both branches identical
- **Fix**: Remove the conditional or implement the intended margin change

### 1.8 Orphaned files at project root
- `nul`, `_ul`, `_ul-CCSLAPTOP1041*`, `test.db`, `test-output/` — Windows artifacts and test residue
- **Fix**: Delete and add to `.gitignore`

---

## Priority 2: Core Clinical Publishing Features

### 2.1 User Identity & Permissions
- Currently no auth — `authorId` and `userName` are hardcoded as "Reviewer"
- **Need**: At minimum, a simple user identity system (name + role) so audit trails are meaningful
- Roles: Admin, Author, Reviewer, QC, Publisher
- Controls: Who can approve, who can publish, who can export

### 2.2 Document Comparison / Version Diff
- Clinical publishers need to compare document versions (v1 vs v2 of same section)
- Show what changed between versions uploaded to the same slot
- Side-by-side PDF viewer or visual diff overlay

### 2.3 Search & Filtering
- No search exists on any page
- Studies: Filter by phase, sponsor, therapeutic area, status
- Documents: Filter by status, section, upload date
- Global search across studies and documents

### 2.4 Pagination
- All list pages load everything — will break with scale
- Add server-side pagination to studies, documents, templates

### 2.5 Bulk Workflow Operations
- Select multiple documents → transition all to IN_REVIEW at once
- "Submit all DRAFT documents for review" action at study level
- Critical for studies with 50+ documents

### 2.6 Document Upload Improvements
- Drag-and-drop upload zone (currently file input only)
- Upload multiple files at once with slot auto-detection from filename
- Upload progress indicator for large PDFs
- File replacement workflow (upload new version to slot that already has a document)

### 2.7 Cross-Reference Validation (TODO in codebase)
- `src/lib/validation/package-validator.ts:356` — stubbed out
- Extract hyperlinks from PDFs, validate they point to real documents in the package
- Critical for eCTD submission quality

### 2.8 Notification System
- Alert reviewers when documents are submitted for review
- Notify authors when corrections are needed
- Study-level notifications for packaging readiness
- Could be in-app initially, email later

---

## Priority 3: Regulatory & Compliance Features

### 3.1 eCTD Sequence Management
- Support multiple submission sequences (0000, 0001, 0002...)
- Track which documents changed between sequences
- Generate lifecycle operations (new, replace, delete, append)
- Sequence comparison view

### 3.2 eCTD Validation Against FDA/EMA Technical Specs
- Current validation is basic (file size, page count, PDF version)
- Need: Full eCTD v4.0 validation rules
  - PDF/A compliance check
  - Font embedding verification
  - Bookmark structure validation
  - Hyperlink target validation
  - File naming convention checks (no special characters, length limits)
  - XML schema validation against published DTDs/XSDs

### 3.3 Submission Readiness Dashboard
- Visual readiness score per study
- Checklist: all sections filled, all documents approved, all validations passed
- Gap analysis: which sections are missing required documents
- Timeline view: submission deadline vs current progress

### 3.4 Audit Trail Enhancement
- Currently only tracks document status transitions
- Need: Log all significant actions (uploads, deletes, template changes, export attempts)
- 21 CFR Part 11 compliance considerations: electronic signatures, tamper-evident logs
- Export audit trail as PDF report for regulatory submissions

### 3.5 Document Lifecycle / Effective Dates
- Track when a document version becomes "effective"
- Support document expiry/supersession
- Link related documents across sections (e.g., protocol amendment affects multiple sections)

### 3.6 Multi-Region Submission Support
- Currently generates US-regional XML only
- Add support for EU (EMA), Japan (PMDA), Health Canada CTD formats
- Region-specific folder structures and naming conventions
- Region-specific validation rules

---

## Priority 4: UX & Productivity

### 4.1 Sidebar Active State
- Navigation links don't highlight current route
- **Fix**: Use `usePathname()` to style active link

### 4.2 Breadcrumb Navigation
- Add breadcrumbs: Dashboard > Studies > Study ABC > Section 16.1.1
- Especially needed in the deep study workspace views

### 4.3 Keyboard Shortcuts
- `Ctrl+U` to upload, `Ctrl+S` to save, arrow keys for section navigation
- `Ctrl+Enter` to submit for review
- Document viewer: page navigation, zoom

### 4.4 Status History in Document Viewer
- `StatusHistory` component exists but isn't wired into the document viewer
- Add a tab or expandable section showing the full audit trail

### 4.5 Drag-and-Drop Section Reorder Preview
- Template editor has drag-and-drop but no visual preview of where the node will land
- Add insertion line indicator and smooth animation

### 4.6 Dark Mode
- Support system preference and manual toggle
- Already using Tailwind — add `dark:` variants

### 4.7 Responsive Design
- 3-panel study workspace is fixed-width
- Add collapsible panels and mobile-friendly layout

### 4.8 Document Preview Thumbnails
- Show PDF first-page thumbnail in document lists
- Quick visual identification of documents

---

## Priority 5: Testing & Quality

### 5.1 Component Tests
- Zero React component tests despite testing-library being installed
- Priority targets: DocumentViewer, WorkflowActions, ExportButton, StudyWorkspace

### 5.2 API Route Tests
- Only Studies GET and Validation GET have tests
- Missing: Documents CRUD, Upload, Transition, Annotations, Checklists, Templates, Nodes, Package
- The transition API is the most critical untested path

### 5.3 Integration Tests
- All tests mock the DB — no tests against real SQLite
- Need at least: upload → process → validate → transition → export end-to-end test

### 5.4 CI/CD Pipeline
- No GitHub Actions, no automated testing on PR
- Setup: lint → typecheck → test → build on every push/PR

### 5.5 Pre-Commit Hooks
- Add Husky + lint-staged for formatting and lint checks before commit

### 5.6 Test Coverage Tracking
- `test:coverage` script exists but no thresholds
- Set minimum coverage targets for lib/ and API routes

---

## Priority 6: Operational & Infrastructure

### 6.1 Soft Delete
- All deletes are hard deletes — no recovery possible
- Add `deletedAt` timestamp for studies, documents, templates
- Show "Recently Deleted" with restore option

### 6.2 Input Validation Hardening
- Document PATCH has no input validation
- Study routes don't validate UUID format
- Add Zod schema validation on all API inputs

### 6.3 Rate Limiting
- No rate limiting on any endpoint
- Add basic rate limiting especially on upload and package generation

### 6.4 Error Monitoring
- No error tracking (Sentry, etc.)
- Add structured logging beyond console.log

### 6.5 Database Backup Strategy
- SQLite is a single file — need automated backup
- Scheduled copy of `dev.db` / `csr.db` to backup location
- Consider migration to PostgreSQL for production scale

### 6.6 API Documentation
- No OpenAPI/Swagger docs
- Document all endpoints, request/response schemas, status codes

---

## Recommended Implementation Order

**Phase 1 — Fix & Stabilize** (Priority 1)
All critical fixes — these are bugs and data integrity issues.

**Phase 2 — Make It Usable** (Priority 2.1, 2.3, 2.4, 2.5, 2.6 + Priority 4.1, 4.2, 4.4)
User identity, search/filter, pagination, bulk ops, upload UX, sidebar fix, breadcrumbs, status history wiring.

**Phase 3 — Testing Foundation** (Priority 5.1–5.4)
Component tests, API tests, integration test, CI/CD pipeline.

**Phase 4 — Regulatory Depth** (Priority 2.7, 3.1–3.4)
Cross-reference validation, sequence management, FDA/EMA validation, audit trail.

**Phase 5 — Polish & Scale** (Priority 3.5, 3.6, 4.3–4.8, 6.1–6.6)
Multi-region, lifecycle management, keyboard shortcuts, dark mode, soft delete, operational hardening.
