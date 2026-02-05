/**
 * PDF Writer Service
 *
 * Main orchestration module for PDF modifications in eCTD packaging.
 * Combines bookmark injection and hyperlink processing.
 */

import { PDFDocument } from 'pdf-lib';
import { readFile, writeFile } from 'fs/promises';
import { getFullPath } from '@/lib/storage';
import {
  injectBookmarks,
  removeBookmarks,
  hasBookmarks,
  type BookmarkEntry,
  type BookmarkInjectionResult,
} from './bookmark-writer';
import {
  processHyperlinks,
  buildPathMapFromManifest,
  type HyperlinkProcessingOptions,
  type HyperlinkProcessingResult,
} from './hyperlink-processor';

/**
 * Options for PDF processing
 */
export interface PdfProcessingOptions {
  /** Bookmarks to inject (replaces existing) */
  bookmarks?: BookmarkEntry[];
  /** Whether to remove existing bookmarks without adding new ones */
  removeExistingBookmarks?: boolean;
  /** Hyperlink processing options */
  hyperlinkOptions?: HyperlinkProcessingOptions;
  /** Whether to process hyperlinks */
  processHyperlinks?: boolean;
}

/**
 * Result of PDF processing
 */
export interface PdfProcessingResult {
  /** Whether processing was successful */
  success: boolean;
  /** Bookmark injection result */
  bookmarkResult?: BookmarkInjectionResult;
  /** Hyperlink processing result */
  hyperlinkResult?: HyperlinkProcessingResult;
  /** Combined warnings */
  warnings: string[];
  /** Error message if failed */
  error?: string;
}

/**
 * Process a PDF document with the specified options
 *
 * @param pdfDoc - The PDF document (already loaded)
 * @param options - Processing options
 * @returns Processing result
 */
export async function processPdf(
  pdfDoc: PDFDocument,
  options: PdfProcessingOptions = {}
): Promise<PdfProcessingResult> {
  const warnings: string[] = [];
  let bookmarkResult: BookmarkInjectionResult | undefined;
  let hyperlinkResult: HyperlinkProcessingResult | undefined;

  try {
    // Process bookmarks
    if (options.removeExistingBookmarks && !options.bookmarks) {
      removeBookmarks(pdfDoc);
      bookmarkResult = {
        success: true,
        bookmarkCount: 0,
        maxDepth: 0,
        warnings: ['Existing bookmarks removed'],
      };
    } else if (options.bookmarks && options.bookmarks.length > 0) {
      // Remove existing bookmarks before adding new ones
      if (hasBookmarks(pdfDoc)) {
        removeBookmarks(pdfDoc);
        warnings.push('Existing bookmarks were replaced');
      }
      bookmarkResult = await injectBookmarks(pdfDoc, options.bookmarks);
      warnings.push(...bookmarkResult.warnings);
    }

    // Process hyperlinks
    if (options.processHyperlinks !== false && options.hyperlinkOptions) {
      hyperlinkResult = await processHyperlinks(pdfDoc, options.hyperlinkOptions);
      warnings.push(...hyperlinkResult.warnings);
    }

    return {
      success: true,
      bookmarkResult,
      hyperlinkResult,
      warnings,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      bookmarkResult,
      hyperlinkResult,
      warnings,
      error: `PDF processing failed: ${errorMessage}`,
    };
  }
}

/**
 * Load a PDF file for processing
 *
 * @param filePath - Path to the PDF file (relative to storage root)
 * @returns Loaded PDF document
 */
export async function loadPdf(filePath: string): Promise<PDFDocument> {
  const fullPath = getFullPath(filePath);
  const pdfBytes = await readFile(fullPath);
  return PDFDocument.load(pdfBytes, {
    ignoreEncryption: true,
    updateMetadata: false,
  });
}

/**
 * Save a PDF document to file
 *
 * @param pdfDoc - The PDF document
 * @param filePath - Path to save to (relative to storage root)
 */
export async function savePdf(pdfDoc: PDFDocument, filePath: string): Promise<void> {
  const fullPath = getFullPath(filePath);
  const pdfBytes = await pdfDoc.save();
  await writeFile(fullPath, pdfBytes);
}

/**
 * Process a PDF file in place
 *
 * Loads, processes, and saves the PDF back to the same location.
 *
 * @param filePath - Path to the PDF file
 * @param options - Processing options
 * @returns Processing result
 */
export async function processPdfFile(
  filePath: string,
  options: PdfProcessingOptions = {}
): Promise<PdfProcessingResult> {
  try {
    const pdfDoc = await loadPdf(filePath);
    const result = await processPdf(pdfDoc, options);

    if (result.success) {
      await savePdf(pdfDoc, filePath);
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      warnings: [],
      error: `Failed to process PDF file: ${errorMessage}`,
    };
  }
}

/**
 * Process a PDF file and save to a new location
 *
 * @param inputPath - Path to the source PDF file
 * @param outputPath - Path to save the processed PDF
 * @param options - Processing options
 * @returns Processing result
 */
export async function processPdfToFile(
  inputPath: string,
  outputPath: string,
  options: PdfProcessingOptions = {}
): Promise<PdfProcessingResult> {
  try {
    const pdfDoc = await loadPdf(inputPath);
    const result = await processPdf(pdfDoc, options);

    if (result.success) {
      await savePdf(pdfDoc, outputPath);
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      warnings: [],
      error: `Failed to process PDF file: ${errorMessage}`,
    };
  }
}

/**
 * Add bookmarks to a PDF file
 *
 * Convenience function for just adding bookmarks.
 *
 * @param filePath - Path to the PDF file
 * @param bookmarks - Bookmarks to add
 * @returns Injection result
 */
export async function addBookmarksToPdf(
  filePath: string,
  bookmarks: BookmarkEntry[]
): Promise<BookmarkInjectionResult> {
  try {
    const pdfDoc = await loadPdf(filePath);
    const result = await injectBookmarks(pdfDoc, bookmarks);

    if (result.success) {
      await savePdf(pdfDoc, filePath);
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      bookmarkCount: 0,
      maxDepth: 0,
      warnings: [],
      error: `Failed to add bookmarks: ${errorMessage}`,
    };
  }
}

/**
 * Fix hyperlinks in a PDF file
 *
 * Convenience function for just processing hyperlinks.
 *
 * @param filePath - Path to the PDF file
 * @param options - Hyperlink processing options
 * @returns Processing result
 */
export async function fixHyperlinksInPdf(
  filePath: string,
  options: HyperlinkProcessingOptions = {}
): Promise<HyperlinkProcessingResult> {
  try {
    const pdfDoc = await loadPdf(filePath);
    const result = await processHyperlinks(pdfDoc, options);

    if (result.success) {
      await savePdf(pdfDoc, filePath);
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      totalLinks: 0,
      updatedCount: 0,
      removedCount: 0,
      keptCount: 0,
      processedLinks: [],
      warnings: [],
      error: `Failed to fix hyperlinks: ${errorMessage}`,
    };
  }
}

// Re-export types and functions from submodules
export type {
  BookmarkEntry,
  BookmarkInjectionResult,
} from './bookmark-writer';

export type {
  HyperlinkProcessingOptions,
  HyperlinkProcessingResult,
  ProcessedLink,
  LinkAction,
} from './hyperlink-processor';

export {
  injectBookmarks,
  removeBookmarks,
  hasBookmarks,
  countBookmarkEntries,
  calculateBookmarkDepth,
} from './bookmark-writer';

export {
  processHyperlinks,
  buildPathMapFromManifest,
} from './hyperlink-processor';
