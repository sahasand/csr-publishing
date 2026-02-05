# CSR Appendix Publishing Framework - Design Document

**Date**: 2025-01-29
**Status**: Draft
**Author**: Collaborative brainstorm session

---

## Overview

An end-to-end web platform for publishing clinical study report (CSR) appendices. The framework handles document assembly from mixed sources, provides a review workflow with annotations and checklists, and outputs eCTD-ready submission packages.

### Goals

- Assemble appendices from mixed source formats (SAS/R outputs, clinical data, Word/PDF)
- Enforce eCTD technical specifications (PDF/A, bookmarks, hyperlinks, naming)
- Provide annotation-based review and checklist-driven QC
- Output submission-ready packages with proper folder hierarchy

### Target Users

Publishing specialists focused on eCTD compliance, hyperlinking, bookmarking, and final QC.

### Constraints

- Documents provided locally (no external system integrations)
- Medium volume: 100-500 documents per study
- Configurable appendix structures (not fixed to specific modules)

---

## Architecture

### Approach: Structure-First

The eCTD appendix structure is defined first as a template, then documents are slotted into predefined positions. This mirrors how publishing specialists think and enables:

- Early detection of missing documents
- Hyperlink targets exist before linking
- Validation rules attach to structure nodes
- Review checklists can be structure-aware

---

## Data Model

### Study

Top-level container for a CSR submission.

```typescript
interface Study {
  id: string;
  studyId: string;           // Protocol number
  sponsor: string;
  therapeuticArea: string;
  phase: string;
  activeTemplateId: string;  // Current structure template
  status: 'active' | 'archived';
  createdAt: Date;
  updatedAt: Date;
}
```

### Structure Template

Reusable tree representing the eCTD appendix hierarchy.

```typescript
interface StructureTemplate {
  id: string;
  name: string;              // e.g., "Phase 3 FDA Standard"
  version: number;
  nodes: StructureNode[];
  createdAt: Date;
}

interface StructureNode {
  id: string;
  parentId: string | null;
  code: string;              // e.g., "16.2.1"
  title: string;             // e.g., "Listing of Demographic Data"
  documentType: 'pdf' | 'dataset' | 'listing' | 'figure' | 'other';
  required: boolean;
  sortOrder: number;
  validationRules: string[]; // Rule IDs to apply
  checklistId: string | null;
}
```

### Document

An uploaded file slotted into a structure node.

```typescript
interface Document {
  id: string;
  studyId: string;
  slotId: string;            // Structure node ID
  version: number;
  sourceFile: FileReference;
  processedFile: FileReference | null;
  status: 'draft' | 'processing' | 'in_review' | 'corrections_needed' | 'approved' | 'published';
  validationResults: ValidationResult[];
  metadata: DocumentMetadata;
  createdAt: Date;
  updatedAt: Date;
}

interface DocumentMetadata {
  originalName: string;
  mimeType: string;
  pageCount: number;
  fileSize: number;
  pdfVersion: string | null;
  isPdfA: boolean;
}
```

### Annotation

Review comments attached to documents.

```typescript
interface Annotation {
  id: string;
  documentId: string;
  authorId: string;
  type: 'note' | 'question' | 'correction_required' | 'fyi';
  status: 'open' | 'resolved' | 'wont_fix';
  pageNumber: number;
  coordinates: { x: number; y: number; width: number; height: number } | null;
  content: string;
  replies: AnnotationReply[];
  createdAt: Date;
  resolvedAt: Date | null;
}
```

### Checklist

QC checklists attached to structure nodes or document types.

```typescript
interface Checklist {
  id: string;
  name: string;
  items: ChecklistItem[];
}

interface ChecklistItem {
  id: string;
  category: string;          // e.g., "Formatting", "Pagination", "Compliance"
  text: string;
  autoCheck: boolean;        // Auto-populate from validation
  autoCheckRule: string | null;
  required: boolean;
}

interface ChecklistResponse {
  id: string;
  documentId: string;
  checklistId: string;
  responses: {
    itemId: string;
    result: 'pass' | 'fail' | 'na';
    notes: string | null;
  }[];
  completedAt: Date | null;
}
```

### Entity Relationships

```
Study (1) ──────── (1) StructureTemplate (active)
  │                      │
  │                      └── (N) StructureNode (tree)
  │                                  │
  └── (N) Document ─────────────── (1) slot
          │
          ├── (N) Annotation
          │         └── (N) AnnotationReply
          │
          ├── (N) ValidationResult
          │
          └── (1) ChecklistResponse
```

---

## Document Processing Pipeline

### Ingestion Layer

Accepts mixed inputs via drag-and-drop or bulk upload:

| Input Type | Handling |
|------------|----------|
| PDF | Validate, check PDF/A compliance |
| Word (.docx) | Convert to PDF/A via LibreOffice |
| SAS outputs (.lst, .rtf) | Parse and convert to PDF |
| R outputs (.html, .pdf) | Normalize to PDF/A |
| Datasets (.xpt, .csv) | Store as-is for dataset appendices |

Files are queued for background processing via BullMQ.

### Normalization Step

All documents targeting PDF output:

1. Convert to PDF/A-1b or PDF/A-2b
2. Verify font embedding
3. Standardize page size (Letter/A4 configurable)
4. Strip/rewrite metadata (title, author fields)

### Extraction Step

For documents with structure:

- Extract existing bookmarks (preserve or remap)
- Extract internal links for hyperlink validation
- OCR if needed for scanned documents
- Log page count and dimensions

### Validation Step

Run eCTD technical checks immediately:

- File size under limits
- No security/encryption
- No embedded multimedia
- Fonts embedded
- Color space compliance

Failed validations flag the document but don't block upload.

### Processing Status Flow

```
Uploaded → Queued → Processing → Processed (success)
                              → Processing Failed (error)
```

---

## Review Workflow

### Annotation System

Built on a PDF viewer component (PDF.js or PSPDFKit):

- Comments anchored to specific pages/regions
- Comment types: Note, Question, Correction Required, FYI
- Status tracking: Open → Resolved / Won't Fix
- Threaded replies for discussion
- Stored as JSON overlay, not embedded in PDF

### Checklist System

Configurable QC checklists:

- Pass/Fail/NA responses per item
- Grouped by category (Formatting, Pagination, Compliance, Hyperlinks)
- Some items auto-populate from validation results
- Manual items require human verification

Example checklist item:

```json
{
  "id": "fmt-001",
  "category": "Formatting",
  "text": "Headers and footers consistent across all pages",
  "autoCheck": false,
  "required": true
}
```

### Document Status Flow

```
Draft → In Review → Corrections Needed → Approved
                         ↑______|
```

Approval requires:
- All required checklist items pass
- All "Correction Required" annotations resolved

---

## eCTD Packaging & Output

### Structure Assembly

Walk the structure template tree and:

1. Collect approved document version for each populated node
2. Generate eCTD folder hierarchy (module 5 subfolders)
3. Apply file naming conventions (configurable)
4. Create placeholder entries for empty optional nodes

### Bookmark Generation

Build master bookmark tree:

- Top-level bookmarks mirror eCTD section codes and titles
- Nested bookmarks from individual document bookmarks
- Validate bookmark depth (FDA max 4 levels, configurable)
- Truncate bookmark text to character limits

### Hyperlink Processing

Resolve cross-document hyperlinks at package time:

- Validate internal links for target existence
- Map cross-reference links to final file paths
- Flag external links for review
- Generate broken link report

### Output Artifacts

Package export produces:

```
/export/
├── ectd/
│   └── m5/
│       └── [study-folder]/
│           ├── 16-1-protocol/
│           ├── 16-2-listings/
│           └── ...
├── index.xml (stub or full)
├── bookmark-manifest.json
├── hyperlink-report.csv
├── qc-summary-report.pdf
└── package.zip
```

---

## User Interface

### Main Layout

Three-panel design optimized for publishing specialists:

```
┌─────────────────────────────────────────────────────────────┐
│  Header: Study selector, user menu, notifications           │
├──────────────┬──────────────────────────┬───────────────────┤
│              │                          │                   │
│  Structure   │   Document Workspace     │   Context         │
│  Tree        │                          │   Sidebar         │
│              │   - PDF viewer           │                   │
│  - eCTD      │   - Annotation toolbar   │   - Metadata      │
│    hierarchy │   - Annotation list      │   - Validation    │
│  - Status    │   - Checklist panel      │   - Activity      │
│    badges    │                          │                   │
│  - Drag/drop │                          │                   │
│              │                          │                   │
├──────────────┴──────────────────────────┴───────────────────┤
│  Footer: Package readiness indicator, export button          │
└─────────────────────────────────────────────────────────────┘
```

### Structure Tree View

- Visual hierarchy with status indicators (empty, draft, in review, approved)
- Document count badges per section
- Validation warning badges
- Drag-and-drop document reassignment
- Right-click context menu for actions

### Document Workspace

- PDF viewer with zoom, page navigation, rotation
- Annotation toolbar (comment, highlight, draw)
- Filterable annotation list
- Expandable checklist panel
- Version comparison (side-by-side)

### Dashboard Views

| View | Purpose |
|------|---------|
| Study Overview | Progress by section, document counts, validation summary |
| Review Queue | Documents awaiting review, sorted by priority |
| Validation Report | All issues across study, filterable and exportable |
| Package Readiness | Requirements checklist before export enabled |

---

## Technical Architecture

### Stack Overview

```
┌─────────────────────────────────────────────┐
│                  Frontend                    │
│         Next.js (App Router, RSC)           │
│    TanStack Query, Zustand, PDF.js          │
├─────────────────────────────────────────────┤
│                  Backend                     │
│       Next.js API Routes / Node.js          │
│              BullMQ + Redis                 │
├─────────────────────────────────────────────┤
│               Processing                     │
│  LibreOffice (Docker), Ghostscript, pdf-lib │
├─────────────────────────────────────────────┤
│                 Storage                      │
│     PostgreSQL (data), S3/Local (files)     │
└─────────────────────────────────────────────┘
```

### Frontend

- **Next.js App Router** for page structure
- **React Server Components** for initial data loading
- **Client components** for interactive elements
- **Zustand** for client state (annotations, tree selection)
- **TanStack Query** for server state sync

### Backend

- **API routes** for CRUD operations
- **BullMQ + Redis** for background job processing
- **Streaming uploads** to local storage or S3
- **WebSocket/SSE** for real-time progress updates

### Database Schema (PostgreSQL)

Core tables:
- `studies`
- `structure_templates`
- `structure_nodes` (with `ltree` for hierarchy)
- `documents`
- `annotations`
- `annotation_replies`
- `checklists`
- `checklist_items`
- `checklist_responses`
- `validation_rules`
- `validation_results`

JSONB columns for flexible metadata and validation results.

### File Processing Services

| Service | Purpose |
|---------|---------|
| LibreOffice (headless) | Word → PDF conversion |
| Ghostscript / QPDF | PDF/A conversion, manipulation |
| pdf-lib | Bookmark/hyperlink manipulation (JS) |
| Sharp | Thumbnail generation |

### Deployment

- **Development**: Docker Compose (app + Postgres + Redis + LibreOffice)
- **Production**: Single container + managed Postgres + Redis (Upstash optional)

---

## Validation Rules

### Rule Configuration

```typescript
interface ValidationRule {
  id: string;
  name: string;
  category: 'pdf_compliance' | 'ectd_technical' | 'formatting' | 'content';
  check: string;             // Check function identifier
  params: Record<string, any>;
  severity: 'error' | 'warning' | 'info';
  autoFix: boolean;
  message: string;
}
```

### Rule Attachment Levels

1. **Global** - Applies to all documents
2. **Document type** - Applies to all PDFs, all datasets, etc.
3. **Structure node** - Specific sections have specific rules

### Built-in Rule Categories

**PDF/A Compliance**
- PDF version check
- Font embedding
- Color space validation
- Encryption detection

**eCTD Technical**
- File size limits (configurable, default 100MB)
- File naming conventions
- Bookmark depth (max 4 levels for FDA)
- Hyperlink protocol validation (no external HTTP)

**Formatting**
- Page dimensions
- Margin compliance
- Orientation consistency

**Content**
- Required metadata fields
- Title page presence detection

### Validation Execution

- Runs automatically on upload (async, non-blocking)
- Re-runs on document replacement
- Full study validation on-demand before packaging
- Results stored per document, aggregated at study level

---

## Error Handling

| Scenario | Handling |
|----------|----------|
| Upload failure | Retry queue with exponential backoff, user notification |
| Processing failure | Document marked "Processing Failed" with error details |
| Validation failure | Don't block workflow, surface in UI for specialist decision |
| Package failure | Detailed error report, no partial export |

---

## Future Considerations

Items explicitly out of scope but may be added later:

- **Role-based approval gates** - Formal sign-off workflows
- **External integrations** - Veeva, SharePoint, eCTD publishing tools
- **Multi-region templates** - FDA vs EMA vs PMDA specific rules
- **Audit trail / 21 CFR Part 11** - Full compliance tracking
- **Batch/CLI processing** - Headless pipeline mode

---

## Appendix: Example Validation Rules

```json
[
  {
    "id": "ectd-pdf-size",
    "name": "PDF file size limit",
    "category": "ectd_technical",
    "check": "fileSize",
    "params": { "maxMB": 100 },
    "severity": "error",
    "autoFix": false,
    "message": "File exceeds 100MB eCTD limit"
  },
  {
    "id": "ectd-bookmark-depth",
    "name": "Bookmark depth limit",
    "category": "ectd_technical",
    "check": "bookmarkDepth",
    "params": { "maxDepth": 4 },
    "severity": "error",
    "autoFix": false,
    "message": "Bookmark hierarchy exceeds 4 levels"
  },
  {
    "id": "pdfa-compliance",
    "name": "PDF/A compliance",
    "category": "pdf_compliance",
    "check": "pdfaVersion",
    "params": { "allowedVersions": ["1b", "2b"] },
    "severity": "error",
    "autoFix": true,
    "message": "Document is not PDF/A compliant"
  },
  {
    "id": "font-embedding",
    "name": "All fonts embedded",
    "category": "pdf_compliance",
    "check": "fontsEmbedded",
    "params": {},
    "severity": "error",
    "autoFix": false,
    "message": "Document contains non-embedded fonts"
  }
]
```
