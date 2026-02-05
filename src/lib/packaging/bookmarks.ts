/**
 * Bookmark Generation Service
 *
 * Creates and manages bookmarks (PDF outlines) for eCTD packages.
 * Supports:
 * - Extracting existing bookmarks from PDF documents
 * - Building hierarchical bookmark trees from structure templates
 * - Enforcing FDA depth limits (max 4 levels)
 * - Title truncation for long bookmark names
 */

import { PDFDocument, PDFName, PDFDict, PDFRef, PDFString, PDFHexString } from 'pdf-lib';
import { readFile } from 'fs/promises';
import { getFullPath } from '@/lib/storage';
import type { PackageManifest, PackageFile } from './types';

// Bookmark tree node
export interface BookmarkNode {
  title: string;
  pageNumber?: number;        // Destination page (1-indexed)
  children: BookmarkNode[];
  sourceFile?: string;        // Which file this bookmark came from
  level: number;              // Nesting depth (0 = root)
}

// Bookmark extraction result for a single document
export interface DocumentBookmarks {
  documentId: string;
  fileName: string;
  bookmarks: BookmarkNode[];
  error?: string;
}

// Master bookmark manifest
export interface BookmarkManifest {
  rootBookmarks: BookmarkNode[];
  documentBookmarks: DocumentBookmarks[];
  totalCount: number;
  maxDepth: number;
  warnings: string[];
}

/**
 * Configuration for bookmark generation
 */
export interface BookmarkConfig {
  maxDepth: number;           // Maximum allowed depth (FDA max is 4)
  maxTitleLength: number;     // Maximum bookmark title length
  truncationSuffix: string;   // Suffix for truncated titles (e.g., "...")
}

export const DEFAULT_BOOKMARK_CONFIG: BookmarkConfig = {
  maxDepth: 4,
  maxTitleLength: 120,
  truncationSuffix: '...',
};

/**
 * Extract a string value from a PDF dictionary entry
 */
function extractStringFromDict(dict: PDFDict, key: string): string | null {
  try {
    const value = dict.lookup(PDFName.of(key));
    if (value instanceof PDFString) {
      return value.decodeText();
    }
    if (value instanceof PDFHexString) {
      return value.decodeText();
    }
    return null;
  } catch (error) {
    console.warn('[BookmarkExtraction] Failed to extract string from dict:', error);
    return null;
  }
}

/**
 * Extract a number value from a PDF dictionary entry
 */
function extractNumberFromDict(dict: PDFDict, key: string): number | null {
  try {
    const value = dict.get(PDFName.of(key));
    if (value !== undefined) {
      const valueWithMethod = value as unknown as { asNumber?: () => number };
      if (typeof valueWithMethod.asNumber === 'function') {
        return valueWithMethod.asNumber();
      }
    }
    return null;
  } catch (error) {
    console.warn('[BookmarkExtraction] Failed to extract number from dict:', error);
    return null;
  }
}

/**
 * Recursively traverse the PDF outline tree and extract bookmarks
 */
function traverseOutlineTree(
  pdfDoc: PDFDocument,
  outlineItem: PDFDict,
  level: number,
  sourceFile?: string
): BookmarkNode[] {
  const bookmarks: BookmarkNode[] = [];
  let currentItem: PDFDict | null = outlineItem;

  while (currentItem) {
    // Extract title
    const title = extractStringFromDict(currentItem, 'Title');
    if (!title) {
      // Move to next sibling
      const nextRef = currentItem.get(PDFName.of('Next'));
      currentItem = nextRef instanceof PDFRef
        ? pdfDoc.context.lookup(nextRef) as PDFDict | null
        : null;
      continue;
    }

    // Try to extract destination page number
    let pageNumber: number | undefined;

    // Check for /Dest (direct destination)
    const dest = currentItem.get(PDFName.of('Dest'));
    if (dest) {
      pageNumber = extractPageNumberFromDest(pdfDoc, dest);
    }

    // Check for /A (action dictionary with /D destination)
    if (pageNumber === undefined) {
      const action = currentItem.lookup(PDFName.of('A'));
      if (action instanceof PDFDict) {
        const actionDest = action.get(PDFName.of('D'));
        if (actionDest) {
          pageNumber = extractPageNumberFromDest(pdfDoc, actionDest);
        }
      }
    }

    // Process children (First points to first child)
    const children: BookmarkNode[] = [];
    const firstChildRef = currentItem.get(PDFName.of('First'));
    if (firstChildRef instanceof PDFRef) {
      const firstChild = pdfDoc.context.lookup(firstChildRef);
      if (firstChild instanceof PDFDict) {
        children.push(...traverseOutlineTree(pdfDoc, firstChild, level + 1, sourceFile));
      }
    }

    bookmarks.push({
      title,
      pageNumber,
      children,
      sourceFile,
      level,
    });

    // Move to next sibling
    const nextRef = currentItem.get(PDFName.of('Next'));
    currentItem = nextRef instanceof PDFRef
      ? pdfDoc.context.lookup(nextRef) as PDFDict | null
      : null;
  }

  return bookmarks;
}

/**
 * Extract page number from a destination array or name
 */
function extractPageNumberFromDest(
  pdfDoc: PDFDocument,
  dest: unknown
): number | undefined {
  try {
    // Destination can be an array [pageRef, /XYZ, left, top, zoom] or similar
    if (Array.isArray(dest) || (dest && typeof (dest as { get?: (index: number) => unknown }).get === 'function')) {
      const destArray = dest as { get: (index: number) => unknown };
      const pageRef = destArray.get(0);

      if (pageRef instanceof PDFRef) {
        // Find page index
        const pages = pdfDoc.getPages();
        for (let i = 0; i < pages.length; i++) {
          if (pages[i].ref === pageRef) {
            return i + 1; // 1-indexed
          }
        }
      }
    }

    // Handle named destinations - would need to look up in Names dict
    // For now, return undefined for named destinations
    return undefined;
  } catch (error) {
    console.warn('[BookmarkExtraction] Failed to extract page number from destination:', error);
    return undefined;
  }
}

/**
 * Extract bookmarks from a PDF file using pdf-lib
 * Note: pdf-lib has limited bookmark support, returns what's available
 */
export async function extractBookmarksFromPdf(
  filePath: string
): Promise<BookmarkNode[]> {
  try {
    const fullPath = getFullPath(filePath);
    const pdfBytes = await readFile(fullPath);

    const pdfDoc = await PDFDocument.load(pdfBytes, {
      ignoreEncryption: true,
      updateMetadata: false,
    });

    // Access the document catalog to find Outlines
    const catalog = pdfDoc.catalog;
    const outlinesRef = catalog.get(PDFName.of('Outlines'));

    if (!outlinesRef) {
      // No bookmarks in this PDF
      return [];
    }

    const outlines = outlinesRef instanceof PDFRef
      ? pdfDoc.context.lookup(outlinesRef)
      : outlinesRef;

    if (!(outlines instanceof PDFDict)) {
      return [];
    }

    // Get the first outline item
    const firstRef = outlines.get(PDFName.of('First'));
    if (!firstRef || !(firstRef instanceof PDFRef)) {
      return [];
    }

    const firstOutline = pdfDoc.context.lookup(firstRef);
    if (!(firstOutline instanceof PDFDict)) {
      return [];
    }

    // Traverse the outline tree
    return traverseOutlineTree(pdfDoc, firstOutline, 1, filePath);
  } catch (error) {
    console.error(`[BookmarkExtraction] Failed to extract bookmarks from ${filePath}:`, error);
    return [];
  }
}

/**
 * Truncate bookmark title if needed
 */
export function truncateTitle(
  title: string,
  config: BookmarkConfig = DEFAULT_BOOKMARK_CONFIG
): string {
  if (title.length <= config.maxTitleLength) {
    return title;
  }

  const truncateAt = config.maxTitleLength - config.truncationSuffix.length;
  return title.substring(0, truncateAt) + config.truncationSuffix;
}

/**
 * Flatten bookmarks beyond max depth (move deep bookmarks up)
 */
export function enforceMaxDepth(
  bookmarks: BookmarkNode[],
  maxDepth: number = 4,
  currentDepth: number = 0
): BookmarkNode[] {
  if (currentDepth >= maxDepth) {
    // We've reached max depth - flatten all children to this level
    const flattened: BookmarkNode[] = [];

    for (const bookmark of bookmarks) {
      // Add this bookmark without children
      flattened.push({
        ...bookmark,
        children: [],
        level: currentDepth,
      });

      // Add all descendants as siblings (flattened)
      if (bookmark.children.length > 0) {
        const flattenedDescendants = flattenAllDescendants(bookmark.children, currentDepth);
        flattened.push(...flattenedDescendants);
      }
    }

    return flattened;
  }

  // Not at max depth yet - process children recursively
  return bookmarks.map(bookmark => ({
    ...bookmark,
    level: currentDepth,
    children: enforceMaxDepth(bookmark.children, maxDepth, currentDepth + 1),
  }));
}

/**
 * Flatten all descendants to a single level
 */
function flattenAllDescendants(
  bookmarks: BookmarkNode[],
  targetLevel: number
): BookmarkNode[] {
  const result: BookmarkNode[] = [];

  for (const bookmark of bookmarks) {
    result.push({
      ...bookmark,
      children: [],
      level: targetLevel,
    });

    if (bookmark.children.length > 0) {
      result.push(...flattenAllDescendants(bookmark.children, targetLevel));
    }
  }

  return result;
}

/**
 * Parse a section code into its hierarchical parts
 * e.g., "16.2.1" -> ["16", "16.2", "16.2.1"]
 */
function parseCodeHierarchy(code: string): string[] {
  const parts = code.split('.');
  const hierarchy: string[] = [];

  for (let i = 1; i <= parts.length; i++) {
    hierarchy.push(parts.slice(0, i).join('.'));
  }

  return hierarchy;
}

/**
 * Build section bookmarks from structure nodes
 * Creates top-level bookmarks like:
 *   16.1 - Protocol and Amendments
 *   16.2 - Sample CRFs
 *     16.2.1 - Demographics Listing
 */
export function buildSectionBookmarks(
  files: PackageFile[],
  config: BookmarkConfig = DEFAULT_BOOKMARK_CONFIG
): BookmarkNode[] {
  if (files.length === 0) {
    return [];
  }

  // Build a map of section codes to their titles and files
  const sectionMap = new Map<string, { title: string; files: PackageFile[] }>();

  for (const file of files) {
    // Add entries for all parent sections
    const hierarchy = parseCodeHierarchy(file.nodeCode);

    for (const code of hierarchy) {
      if (!sectionMap.has(code)) {
        // Determine the title for this code
        let title: string;
        if (code === file.nodeCode) {
          title = file.nodeTitle;
        } else {
          // For parent sections, find if any file matches this code directly
          const directMatch = files.find(f => f.nodeCode === code);
          title = directMatch?.nodeTitle || `Section ${code}`;
        }

        sectionMap.set(code, { title, files: [] });
      }
    }

    // Add file to its direct section
    const section = sectionMap.get(file.nodeCode);
    if (section) {
      section.files.push(file);
    }
  }

  // Sort sections by code
  const sortedCodes = Array.from(sectionMap.keys()).sort((a, b) => {
    const aParts = a.split('.').map(Number);
    const bParts = b.split('.').map(Number);

    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aVal = aParts[i] ?? 0;
      const bVal = bParts[i] ?? 0;
      if (aVal !== bVal) {
        return aVal - bVal;
      }
    }
    return 0;
  });

  // Build hierarchical bookmark tree
  const rootBookmarks: BookmarkNode[] = [];
  const nodeMap = new Map<string, BookmarkNode>();

  for (const code of sortedCodes) {
    const section = sectionMap.get(code)!;
    const parts = code.split('.');
    const level = parts.length;

    // Format title: "16.2.1 - Demographics Listing"
    const fullTitle = `${code} - ${section.title}`;
    const truncatedTitle = truncateTitle(fullTitle, config);

    const bookmark: BookmarkNode = {
      title: truncatedTitle,
      children: [],
      level,
    };

    nodeMap.set(code, bookmark);

    if (parts.length === 1) {
      // Root level section
      rootBookmarks.push(bookmark);
    } else {
      // Find parent and add as child
      const parentCode = parts.slice(0, -1).join('.');
      const parent = nodeMap.get(parentCode);
      if (parent) {
        parent.children.push(bookmark);
      } else {
        // Parent not found, add to root
        rootBookmarks.push(bookmark);
      }
    }
  }

  return rootBookmarks;
}

/**
 * Calculate the maximum depth in a bookmark tree
 */
export function calculateMaxDepth(bookmarks: BookmarkNode[]): number {
  if (bookmarks.length === 0) {
    return 0;
  }

  let maxDepth = 0;

  for (const bookmark of bookmarks) {
    const currentDepth = bookmark.level;
    const childMaxDepth = calculateMaxDepth(bookmark.children);
    maxDepth = Math.max(maxDepth, currentDepth, childMaxDepth);
  }

  return maxDepth;
}

/**
 * Count total bookmarks in a tree
 */
export function countBookmarks(bookmarks: BookmarkNode[]): number {
  let count = 0;

  for (const bookmark of bookmarks) {
    count += 1;
    count += countBookmarks(bookmark.children);
  }

  return count;
}

/**
 * Generate complete bookmark manifest for a package
 * 1. Build section bookmarks from structure
 * 2. Extract bookmarks from each document
 * 3. Nest document bookmarks under their section
 * 4. Enforce depth limits
 * 5. Track warnings for any issues
 */
export async function generateBookmarkManifest(
  manifest: PackageManifest,
  config: BookmarkConfig = DEFAULT_BOOKMARK_CONFIG
): Promise<BookmarkManifest> {
  const warnings: string[] = [];
  const documentBookmarks: DocumentBookmarks[] = [];

  // 1. Build section bookmarks from structure
  let rootBookmarks = buildSectionBookmarks(manifest.files, config);

  // 2. Extract bookmarks from each document
  for (const file of manifest.files) {
    try {
      const bookmarks = await extractBookmarksFromPdf(file.sourcePath);

      // Process each bookmark title
      const processedBookmarks = processBookmarkTitles(bookmarks, config, warnings, file.fileName);

      documentBookmarks.push({
        documentId: file.sourceDocumentId,
        fileName: file.fileName,
        bookmarks: processedBookmarks,
      });

      // 3. Nest document bookmarks under their section
      if (processedBookmarks.length > 0) {
        const sectionBookmark = findSectionBookmark(rootBookmarks, file.nodeCode);
        if (sectionBookmark) {
          // Adjust levels for nested document bookmarks
          const adjustedBookmarks = adjustBookmarkLevels(
            processedBookmarks,
            sectionBookmark.level + 1
          );
          sectionBookmark.children.push(...adjustedBookmarks);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      documentBookmarks.push({
        documentId: file.sourceDocumentId,
        fileName: file.fileName,
        bookmarks: [],
        error: errorMessage,
      });
      warnings.push(`Failed to extract bookmarks from ${file.fileName}: ${errorMessage}`);
    }
  }

  // 4. Enforce depth limits
  const depthBeforeEnforcement = calculateMaxDepth(rootBookmarks);
  if (depthBeforeEnforcement > config.maxDepth) {
    warnings.push(
      `Bookmark depth (${depthBeforeEnforcement}) exceeded maximum (${config.maxDepth}). ` +
      `Some bookmarks were flattened.`
    );
    rootBookmarks = enforceMaxDepth(rootBookmarks, config.maxDepth, 1);
  }

  // Calculate final stats
  const totalCount = countBookmarks(rootBookmarks);
  const maxDepth = calculateMaxDepth(rootBookmarks);

  return {
    rootBookmarks,
    documentBookmarks,
    totalCount,
    maxDepth,
    warnings,
  };
}

/**
 * Process bookmark titles (truncate if needed) and track warnings
 */
function processBookmarkTitles(
  bookmarks: BookmarkNode[],
  config: BookmarkConfig,
  warnings: string[],
  sourceFile: string
): BookmarkNode[] {
  return bookmarks.map(bookmark => {
    const originalTitle = bookmark.title;
    const truncatedTitle = truncateTitle(originalTitle, config);

    if (truncatedTitle !== originalTitle) {
      warnings.push(
        `Bookmark title truncated in ${sourceFile}: "${originalTitle.substring(0, 30)}..." ` +
        `exceeded ${config.maxTitleLength} characters`
      );
    }

    return {
      ...bookmark,
      title: truncatedTitle,
      sourceFile,
      children: processBookmarkTitles(bookmark.children, config, warnings, sourceFile),
    };
  });
}

/**
 * Find a section bookmark by its code
 */
function findSectionBookmark(
  bookmarks: BookmarkNode[],
  nodeCode: string
): BookmarkNode | null {
  for (const bookmark of bookmarks) {
    // Check if this bookmark's title starts with the code
    if (bookmark.title.startsWith(nodeCode + ' ') || bookmark.title.startsWith(nodeCode + ' -')) {
      return bookmark;
    }

    // Search children
    const found = findSectionBookmark(bookmark.children, nodeCode);
    if (found) {
      return found;
    }
  }

  return null;
}

/**
 * Adjust bookmark levels to nest under a parent
 */
function adjustBookmarkLevels(
  bookmarks: BookmarkNode[],
  startLevel: number
): BookmarkNode[] {
  return bookmarks.map(bookmark => ({
    ...bookmark,
    level: startLevel,
    children: adjustBookmarkLevels(bookmark.children, startLevel + 1),
  }));
}
