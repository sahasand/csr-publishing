# eCTD XML Backbone and Full Publishing System

## Maintenance: Agent Docs (2026-02-04)
- [x] Review repository layout for AGENTS.md accuracy
- [x] Update AGENTS.md repo map and data flow notes

## Phase 1: eCTD XML Backbone Generation (Priority: Critical) ✅ COMPLETE

## Maintenance: Production README (2026-02-05)
- [x] Replace boilerplate README with project-specific local + Railway production steps

## Maintenance: TraceScribe UI Refresh (2026-02-05)
- [x] Replace fonts with Plus Jakarta Sans and JetBrains Mono
- [x] Add design token palette + shadows/animations in `globals.css`
- [x] Update shared UI primitives to semantic tokens
- [x] Restyle dashboard layout and key pages/components with new theme

### 1.1 Create XML Generator Module
- [x] Create `src/lib/packaging/checksum.ts` for MD5 calculation
- [x] Create `src/lib/packaging/xml-generator.ts` with core functions
- [x] Define XML templates for:
  - [x] `index.xml` (main eCTD index) - `xml-templates/index-xml.ts`
  - [x] `us-regional.xml` (FDA-specific) - `xml-templates/us-regional-xml.ts`

### 1.2 Implement Leaf Entry Generation
- [x] Generate `<leaf>` elements for each document
- [x] Calculate MD5 checksums for all files
- [x] Add file size attributes
- [x] Generate proper `xlink:href` paths (relative, forward-slashes)

### 1.3 Study Metadata to XML Mapping
- [x] Map Study model fields to eCTD header elements
- [x] Add sequence number tracking (0000, 0001, etc.)
- [x] Support submission type (original, amendment, supplement)

### 1.4 Integration
- [x] Modify `zip-generator.ts` to include XML files in export
- [x] Update `exporter.ts` to call XML generation with sequence support
- [x] Update types and exports in `index.ts`

### 1.5 Testing
- [x] Unit tests for checksum calculation (`checksum.test.ts` - 12 tests)
- [x] Unit tests for XML generation (`xml-generator.test.ts` - 26 tests)
- [x] All 38 new tests passing

---

## Phase 2: PDF Processing Enhancements (Priority: High) ✅ COMPLETE

### 2.1 Create PDF Writer Module
- [x] Create `src/lib/pdf/writer.ts` - Main orchestration module
- [x] Create `src/lib/pdf/bookmark-writer.ts` - Bookmark injection using low-level pdf-lib API
- [x] Create `src/lib/pdf/hyperlink-processor.ts` - Hyperlink processing for eCTD compliance
- [x] Create `src/lib/pdf/index.ts` - Module exports

### 2.2 Bookmark Processing Features
- [x] Inject hierarchical bookmarks into PDFs
- [x] Support nested bookmark trees (unlimited depth)
- [x] Validate page numbers and skip invalid bookmarks with warnings
- [x] Remove existing bookmarks before adding new ones
- [x] Check if PDF has existing bookmarks
- [x] Count and calculate depth of bookmark entries

### 2.3 Hyperlink Processing Features
- [x] Process URI actions (http/https/ftp/mailto links)
- [x] Process GoToR actions (cross-document links)
- [x] Process Launch actions (file links)
- [x] Convert absolute paths to relative paths
- [x] Use path map for cross-document link resolution
- [x] Optionally remove external links for eCTD compliance
- [x] Optionally remove mailto links
- [x] Flag external links without removing (for reporting)

### 2.4 Testing
- [x] Unit tests for bookmark-writer (`bookmark-writer.test.ts` - 19 tests)
- [x] Unit tests for hyperlink-processor (`hyperlink-processor.test.ts` - 20 tests)
- [x] Unit tests for writer orchestration (`writer.test.ts` - 20 tests)
- [x] All 59 PDF processing tests passing

## Phase 3: Enhanced Validation System (Priority: High) ✅ COMPLETE

### 3.1 eCTD-Specific Validation Rules
- [x] Create `src/lib/validation/checks/ectd-checks.ts` with new check functions:
  - `checkBookmarkDepth` - Validate bookmark hierarchy depth (max 4 levels)
  - `checkBookmarksExist` - Check if PDF has navigation bookmarks
  - `checkFileNaming` - Validate eCTD file naming conventions
  - `checkPageSize` - Validate page size (Letter/A4)
  - `checkExternalHyperlinks` - Detect external hyperlinks
  - `checkDocumentTitle` - Validate document title metadata
  - `checkNoJavaScript` - Ensure no JavaScript in PDF
- [x] Register all new checks in `src/lib/validation/checks/index.ts`
- [x] Add validation rules to `prisma/seed-validation-rules.ts`

### 3.2 Package-Level Validation
- [x] Create `src/lib/validation/package-validator.ts`:
  - `validatePackage()` - Run all eCTD checks on package files
  - `validateFile()` - Per-file validation with configurable checks
  - `formatValidationReport()` - Human-readable report generation
  - `serializeValidationReport()` - JSON-serializable output
- [x] Comprehensive validation report with:
  - Per-file validation results
  - Cross-reference validation
  - Package-level issues (missing required docs, etc.)
  - Summary statistics (errors, warnings, info counts)

### 3.3 XML Schema Validation
- [x] Create `src/lib/validation/xml-validator.ts`:
  - `validateIndexXml()` - Validate index.xml structure
  - `validateUsRegionalXml()` - Validate us-regional.xml structure
  - `validateEctdXml()` - Combined validation
  - `formatXmlValidationReport()` - Human-readable report
- [x] Validates:
  - Required elements present
  - Proper namespaces
  - Sequence number format
  - Leaf element attributes (ID, href, checksum)
  - Checksum format (MD5)
  - Cross-reference validation against package files

### 3.4 Export Integration
- [x] Update `src/lib/packaging/exporter.ts`:
  - Added `runValidation` option (default: true)
  - Added `failOnValidationError` option
  - Added `validation` to ExportResult with package and XML reports
- [x] Create `src/lib/validation/index.ts` - Module exports

### 3.5 Testing
- [x] `src/__tests__/lib/validation/ectd-checks.test.ts` - 13 tests
- [x] `src/__tests__/lib/validation/package-validator.test.ts` - 17 tests
- [x] `src/__tests__/lib/validation/xml-validator.test.ts` - 21 tests
- [x] All 51 validation tests passing

## Phase 4: Submission Tracking (Priority: Medium)
- [ ] Add Submission model to schema
- [ ] Sequence management API
- [ ] Amendment support with replace/delete operations

---

## Files Created

### Phase 1 (XML Backbone)
| File | Purpose |
|------|---------|
| `src/lib/packaging/checksum.ts` | MD5 checksum calculation for eCTD leaves |
| `src/lib/packaging/xml-generator.ts` | Main XML orchestration module |
| `src/lib/packaging/xml-templates/index-xml.ts` | eCTD index.xml template builder |
| `src/lib/packaging/xml-templates/us-regional-xml.ts` | FDA us-regional.xml template |
| `src/__tests__/lib/packaging/checksum.test.ts` | Checksum tests (12 tests) |
| `src/__tests__/lib/packaging/xml-generator.test.ts` | XML generator tests (26 tests) |

### Phase 2 (PDF Processing)
| File | Purpose |
|------|---------|
| `src/lib/pdf/writer.ts` | Main PDF processing orchestration |
| `src/lib/pdf/bookmark-writer.ts` | Low-level pdf-lib bookmark injection |
| `src/lib/pdf/hyperlink-processor.ts` | Hyperlink processing for eCTD compliance |
| `src/lib/pdf/index.ts` | Module exports |
| `src/__tests__/lib/pdf/bookmark-writer.test.ts` | Bookmark tests (19 tests) |
| `src/__tests__/lib/pdf/hyperlink-processor.test.ts` | Hyperlink tests (20 tests) |
| `src/__tests__/lib/pdf/writer.test.ts` | Writer orchestration tests (20 tests) |

### Phase 3 (Validation System)
| File | Purpose |
|------|---------|
| `src/lib/validation/checks/ectd-checks.ts` | eCTD-specific validation check functions |
| `src/lib/validation/package-validator.ts` | Package-level validation before export |
| `src/lib/validation/xml-validator.ts` | XML structure validation |
| `src/lib/validation/index.ts` | Module exports |
| `src/__tests__/lib/validation/ectd-checks.test.ts` | eCTD checks tests (13 tests) |
| `src/__tests__/lib/validation/package-validator.test.ts` | Package validator tests (17 tests) |
| `src/__tests__/lib/validation/xml-validator.test.ts` | XML validator tests (21 tests) |

## Files Modified

| File | Changes |
|------|---------|
| `src/lib/packaging/types.ts` | Added eCTD XML types (LeafEntry, SequenceInfo, etc.) |
| `src/lib/packaging/zip-generator.ts` | Integrated XML generation, added XML to QcSummary |
| `src/lib/packaging/exporter.ts` | Added sequence number support, validation integration |
| `src/lib/packaging/index.ts` | Export new modules and types |
| `src/lib/validation/checks/index.ts` | Registered eCTD check functions |
| `prisma/seed-validation-rules.ts` | Added eCTD validation rules to database seed |

## API Changes

### ExportOptions (exporter.ts)
New optional fields:
- `sequenceNumber?: string` - e.g., "0000", "0001"
- `submissionType?: 'original' | 'amendment' | 'supplement'`
- `sponsor?: string` - Override sponsor name
- `applicationNumber?: string` - NDA/IND number
- `applicationType?: string` - "NDA", "IND", etc.
- `productName?: string`

### ExportResult (exporter.ts)
New fields:
- `xmlResult?: XmlGenerationResult` - Generated XML content
- `sequenceNumber?: string` - Sequence used for export

### ExportArtifacts (zip-generator.ts)
New fields:
- `indexXmlPath: string` - Path to generated index.xml
- `regionalXmlPath: string` - Path to generated us-regional.xml
- `xmlResult: XmlGenerationResult` - Full XML generation result

### QcSummary (zip-generator.ts)
New section:
```typescript
xml: {
  leafCount: number;
  hasIndexXml: boolean;
  hasRegionalXml: boolean;
  warnings: number;
}
```

## Usage Example

```typescript
import { exportPackage } from '@/lib/packaging';

const result = await exportPackage(studyId, {
  sequenceNumber: '0000',
  submissionType: 'original',
  sponsor: 'Acme Pharma Inc',
  applicationNumber: 'NDA-123456',
  applicationType: 'NDA',
  productName: 'Drug X',
});

// Result includes:
// - result.zipPath - Path to eCTD ZIP with index.xml
// - result.xmlResult.indexXml - Raw index.xml content
// - result.xmlResult.leafEntries - All leaf entries with checksums
```

### PDF Processing (Phase 2)

```typescript
import {
  processPdf,
  addBookmarksToPdf,
  fixHyperlinksInPdf,
  type BookmarkEntry
} from '@/lib/pdf';
import { PDFDocument } from 'pdf-lib';

// Process a PDF in memory with both bookmarks and hyperlinks
const pdfDoc = await PDFDocument.load(pdfBytes);
const result = await processPdf(pdfDoc, {
  bookmarks: [
    {
      title: 'Module 5: Clinical Study Reports',
      pageNumber: 1,
      children: [
        { title: '16.1 Protocol', pageNumber: 2 },
        { title: '16.2 CRF', pageNumber: 10 },
      ],
    },
  ],
  hyperlinkOptions: {
    removeExternalLinks: true,
    basePath: 'm5/study-001/16-1',
    pathMap: buildPathMapFromManifest(manifest.files),
  },
});

// Or use convenience functions for single operations
await addBookmarksToPdf('path/to/file.pdf', bookmarks);
await fixHyperlinksInPdf('path/to/file.pdf', { removeExternalLinks: true });
```
