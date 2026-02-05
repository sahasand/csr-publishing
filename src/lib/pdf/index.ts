/**
 * PDF Processing Module
 *
 * Provides tools for PDF manipulation in eCTD packaging:
 * - Bookmark injection and management
 * - Hyperlink processing and fixing
 * - PDF validation and compliance
 */

// Main writer module
export {
  processPdf,
  processPdfFile,
  processPdfToFile,
  loadPdf,
  savePdf,
  addBookmarksToPdf,
  fixHyperlinksInPdf,
  type PdfProcessingOptions,
  type PdfProcessingResult,
} from './writer';

// Bookmark writer
export {
  injectBookmarks,
  removeBookmarks,
  hasBookmarks,
  countBookmarkEntries,
  calculateBookmarkDepth,
  type BookmarkEntry,
  type BookmarkInjectionResult,
} from './bookmark-writer';

// Hyperlink processor
export {
  processHyperlinks,
  buildPathMapFromManifest,
  type HyperlinkProcessingOptions,
  type HyperlinkProcessingResult,
  type ProcessedLink,
  type LinkAction,
} from './hyperlink-processor';
