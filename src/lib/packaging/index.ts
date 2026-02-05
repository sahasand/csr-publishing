/**
 * Package Assembly Module
 *
 * Core services for assembling eCTD packages from study documents.
 */

// Types
export type {
  PackageFile,
  MissingRequiredNode,
  PendingDocument,
  ReadinessCheck,
  FolderNode,
  PackageManifest,
  AssemblyOptions,
} from './types';

export { DEFAULT_ASSEMBLY_OPTIONS } from './types';

// Folder structure utilities
export {
  codeToFolderPath,
  sanitizePathComponent,
  sanitizeFileName,
  buildFolderTree,
  getTargetPath,
  parseTargetPath,
} from './folder-structure';

// Assembly service
export {
  checkReadiness,
  assemblePackage,
  getPackageSummary,
} from './assembler';

// Bookmark generation
export type {
  BookmarkNode,
  DocumentBookmarks,
  BookmarkManifest,
  BookmarkConfig,
} from './bookmarks';

export {
  DEFAULT_BOOKMARK_CONFIG,
  extractBookmarksFromPdf,
  truncateTitle,
  enforceMaxDepth,
  buildSectionBookmarks,
  generateBookmarkManifest,
  calculateMaxDepth,
  countBookmarks,
} from './bookmarks';

// Hyperlink validation
export type {
  LinkType,
  ExtractedLink,
  LinkValidationResult,
  HyperlinkReport,
} from './hyperlinks';

export {
  extractLinksFromPdf,
  classifyLink,
  validateInternalLink,
  validateCrossDocumentLink,
  generateHyperlinkReport,
  exportReportAsCsv,
} from './hyperlinks';

// ZIP generation
export type {
  ExportArtifacts,
  QcSummary,
} from './zip-generator';

export {
  generateExportArtifacts,
  createEctdStructure,
  createZipArchive,
  buildQcSummary,
} from './zip-generator';

// Package exporter
export type {
  ExportResult,
  ExportOptions,
} from './exporter';

export {
  exportPackage,
  getExportDir,
  cleanupExport,
  getPackageZipPath,
  exportExists,
} from './exporter';

// Checksum calculation
export {
  calculateMd5,
  calculateMd5Sync,
  calculateMd5FromBuffer,
  calculateChecksums,
  verifyChecksum,
} from './checksum';

// XML generation
export type {
  LeafEntry,
  SequenceInfo,
  SubmissionMetadata,
  EctdXmlConfig,
  XmlGenerationResult,
  LeafOperation,
  SubmissionType,
  RegionalFormat,
} from './types';

export { DEFAULT_ECTD_CONFIG } from './types';

export type {
  XmlGenerationOptions,
} from './xml-generator';

export {
  generateEctdXml,
  formatSequenceNumber,
  parseSequenceNumber,
  getNextSequence,
  isValidSequence,
  determineSubmissionType,
} from './xml-generator';

export type { FdaMetadata } from './xml-templates/us-regional-xml';

export {
  generateIndexXml,
  generateMinimalIndexXml,
} from './xml-templates/index-xml';

export {
  generateUsRegionalXml,
  generateMinimalUsRegionalXml,
} from './xml-templates/us-regional-xml';

// Cover page generation
export type {
  CoverPageConfig,
  CoverPageMetadata,
  CoverPageResult,
  TocEntry,
} from './types';

export { DEFAULT_COVER_PAGE_CONFIG } from './types';

export {
  generateCoverPage,
  buildTocFromManifest,
  calculateRelativePath,
  getCoverPagePath,
} from './cover-page-generator';
