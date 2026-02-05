/**
 * PDF Bookmark Writer
 *
 * Injects bookmarks (PDF outlines) into PDF documents using pdf-lib.
 * Supports hierarchical bookmark structures for eCTD compliance.
 *
 * Uses low-level pdf-lib API since there's no high-level bookmark writing support.
 */

import {
  PDFDocument,
  PDFDict,
  PDFArray,
  PDFName,
  PDFHexString,
  PDFNull,
  PDFNumber,
  PDFRef,
  PDFPageLeaf,
  PDFObject,
} from 'pdf-lib';

/**
 * Bookmark node structure for injection
 */
export interface BookmarkEntry {
  /** Display title for the bookmark */
  title: string;
  /** Target page number (1-indexed) */
  pageNumber: number;
  /** Child bookmarks */
  children?: BookmarkEntry[];
  /** Whether the bookmark is expanded (default: true) */
  isOpen?: boolean;
}

/**
 * Result of bookmark injection
 */
export interface BookmarkInjectionResult {
  /** Whether injection was successful */
  success: boolean;
  /** Number of bookmarks added */
  bookmarkCount: number;
  /** Maximum depth of bookmark tree */
  maxDepth: number;
  /** Warnings during injection */
  warnings: string[];
  /** Error message if failed */
  error?: string;
}

/**
 * Get page references from a PDF document
 */
function getPageRefs(pdfDoc: PDFDocument): PDFRef[] {
  const pages = pdfDoc.getPages();
  return pages.map((page) => page.ref);
}

/**
 * Create a destination array for a page
 * Format: [pageRef, /XYZ, left, top, zoom]
 * XYZ = position at coordinates with zoom level
 * null values = use default/unchanged
 */
function createDestination(
  context: PDFDocument['context'],
  pageRef: PDFRef
): PDFArray {
  const destArray = PDFArray.withContext(context);
  destArray.push(pageRef);
  destArray.push(PDFName.of('XYZ'));
  destArray.push(PDFNull); // left - null means 0
  destArray.push(PDFNull); // top - null means top of page
  destArray.push(PDFNull); // zoom - null means unchanged
  return destArray;
}

/**
 * Create a single outline item dictionary
 */
function createOutlineItem(
  context: PDFDocument['context'],
  title: string,
  parentRef: PDFRef,
  destArray: PDFArray,
  options: {
    prevRef?: PDFRef;
    nextRef?: PDFRef;
    firstChildRef?: PDFRef;
    lastChildRef?: PDFRef;
    childCount?: number;
    isOpen?: boolean;
  } = {}
): PDFDict {
  const map = new Map<PDFName, PDFObject>();

  // Required fields
  map.set(PDFName.of('Title'), PDFHexString.fromText(title));
  map.set(PDFName.of('Parent'), parentRef);
  map.set(PDFName.of('Dest'), destArray);

  // Sibling links
  if (options.prevRef) {
    map.set(PDFName.of('Prev'), options.prevRef);
  }
  if (options.nextRef) {
    map.set(PDFName.of('Next'), options.nextRef);
  }

  // Child links
  if (options.firstChildRef) {
    map.set(PDFName.of('First'), options.firstChildRef);
  }
  if (options.lastChildRef) {
    map.set(PDFName.of('Last'), options.lastChildRef);
  }

  // Count field: positive = open, negative = closed
  if (options.childCount !== undefined && options.childCount > 0) {
    const count =
      options.isOpen === false
        ? -Math.abs(options.childCount)
        : options.childCount;
    map.set(PDFName.of('Count'), PDFNumber.of(count));
  }

  return PDFDict.fromMapWithContext(map, context);
}

/**
 * Create the root outlines dictionary
 */
function createOutlinesDict(
  context: PDFDocument['context'],
  firstItemRef: PDFRef,
  lastItemRef: PDFRef,
  totalCount: number
): PDFDict {
  const map = new Map<PDFName, PDFObject>();
  map.set(PDFName.of('Type'), PDFName.of('Outlines'));
  map.set(PDFName.of('First'), firstItemRef);
  map.set(PDFName.of('Last'), lastItemRef);
  map.set(PDFName.of('Count'), PDFNumber.of(totalCount));

  return PDFDict.fromMapWithContext(map, context);
}

/**
 * Recursively build outline tree and return refs
 */
function buildOutlineTree(
  pdfDoc: PDFDocument,
  bookmarks: BookmarkEntry[],
  pageRefs: PDFRef[],
  parentRef: PDFRef,
  warnings: string[],
  currentDepth: number = 1
): { refs: PDFRef[]; count: number; maxDepth: number } {
  const context = pdfDoc.context;
  const itemRefs: PDFRef[] = [];
  let totalCount = 0;
  let maxDepth = currentDepth;

  // Filter valid bookmarks and create refs
  const validBookmarks: { bookmark: BookmarkEntry; ref: PDFRef }[] = [];

  for (const bookmark of bookmarks) {
    // Validate page number
    if (bookmark.pageNumber < 1 || bookmark.pageNumber > pageRefs.length) {
      warnings.push(
        `Bookmark "${bookmark.title}" targets page ${bookmark.pageNumber} which doesn't exist (document has ${pageRefs.length} pages). Skipping.`
      );
      continue;
    }

    validBookmarks.push({
      bookmark,
      ref: context.nextRef(),
    });
  }

  if (validBookmarks.length === 0) {
    return { refs: [], count: 0, maxDepth: currentDepth - 1 };
  }

  // Build each outline item
  for (let i = 0; i < validBookmarks.length; i++) {
    const { bookmark, ref } = validBookmarks[i];
    const pageRef = pageRefs[bookmark.pageNumber - 1];

    let firstChildRef: PDFRef | undefined;
    let lastChildRef: PDFRef | undefined;
    let childCount = 0;
    let childMaxDepth = currentDepth;

    // Process children recursively
    if (bookmark.children && bookmark.children.length > 0) {
      const childResult = buildOutlineTree(
        pdfDoc,
        bookmark.children,
        pageRefs,
        ref,
        warnings,
        currentDepth + 1
      );

      if (childResult.refs.length > 0) {
        firstChildRef = childResult.refs[0];
        lastChildRef = childResult.refs[childResult.refs.length - 1];
        childCount = childResult.count;
        childMaxDepth = childResult.maxDepth;
      }
    }

    maxDepth = Math.max(maxDepth, childMaxDepth);

    // Create destination
    const destArray = createDestination(context, pageRef);

    // Create outline item
    const outlineItem = createOutlineItem(context, bookmark.title, parentRef, destArray, {
      prevRef: i > 0 ? validBookmarks[i - 1].ref : undefined,
      nextRef: i < validBookmarks.length - 1 ? validBookmarks[i + 1].ref : undefined,
      firstChildRef,
      lastChildRef,
      childCount: childCount > 0 ? childCount : undefined,
      isOpen: bookmark.isOpen,
    });

    // Assign to context
    context.assign(ref, outlineItem);
    itemRefs.push(ref);
    totalCount += 1 + childCount;
  }

  return { refs: itemRefs, count: totalCount, maxDepth };
}

/**
 * Inject bookmarks into a PDF document
 *
 * Note: This will replace any existing bookmarks in the PDF.
 *
 * @param pdfDoc - The PDF document (already loaded with pdf-lib)
 * @param bookmarks - Array of bookmark entries to inject
 * @returns Injection result with statistics
 */
export async function injectBookmarks(
  pdfDoc: PDFDocument,
  bookmarks: BookmarkEntry[]
): Promise<BookmarkInjectionResult> {
  const warnings: string[] = [];

  try {
    if (bookmarks.length === 0) {
      return {
        success: true,
        bookmarkCount: 0,
        maxDepth: 0,
        warnings: ['No bookmarks to inject'],
      };
    }

    const pageRefs = getPageRefs(pdfDoc);

    if (pageRefs.length === 0) {
      return {
        success: false,
        bookmarkCount: 0,
        maxDepth: 0,
        warnings,
        error: 'PDF has no pages',
      };
    }

    const context = pdfDoc.context;

    // Create ref for outlines root
    const outlinesRef = context.nextRef();

    // Build the outline tree
    const { refs, count, maxDepth } = buildOutlineTree(
      pdfDoc,
      bookmarks,
      pageRefs,
      outlinesRef,
      warnings
    );

    if (refs.length === 0) {
      return {
        success: true,
        bookmarkCount: 0,
        maxDepth: 0,
        warnings: [...warnings, 'No valid bookmarks to inject after validation'],
      };
    }

    // Create and assign outlines root dictionary
    const outlinesDict = createOutlinesDict(
      context,
      refs[0],
      refs[refs.length - 1],
      count
    );
    context.assign(outlinesRef, outlinesDict);

    // Set on document catalog
    pdfDoc.catalog.set(PDFName.of('Outlines'), outlinesRef);

    // Also set PageMode to show outlines panel when opening
    // (Optional - can be removed if not desired)
    pdfDoc.catalog.set(PDFName.of('PageMode'), PDFName.of('UseOutlines'));

    return {
      success: true,
      bookmarkCount: count,
      maxDepth,
      warnings,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      bookmarkCount: 0,
      maxDepth: 0,
      warnings,
      error: `Failed to inject bookmarks: ${errorMessage}`,
    };
  }
}

/**
 * Remove existing bookmarks from a PDF document
 *
 * @param pdfDoc - The PDF document
 */
export function removeBookmarks(pdfDoc: PDFDocument): void {
  try {
    pdfDoc.catalog.delete(PDFName.of('Outlines'));
  } catch {
    // No outlines to remove
  }
}

/**
 * Check if a PDF has existing bookmarks
 *
 * @param pdfDoc - The PDF document
 * @returns True if bookmarks exist
 */
export function hasBookmarks(pdfDoc: PDFDocument): boolean {
  try {
    const outlines = pdfDoc.catalog.get(PDFName.of('Outlines'));
    return outlines !== undefined;
  } catch {
    return false;
  }
}

/**
 * Count bookmarks in a hierarchical structure
 */
export function countBookmarkEntries(bookmarks: BookmarkEntry[]): number {
  let count = 0;
  for (const bookmark of bookmarks) {
    count += 1;
    if (bookmark.children) {
      count += countBookmarkEntries(bookmark.children);
    }
  }
  return count;
}

/**
 * Calculate max depth of bookmark tree
 */
export function calculateBookmarkDepth(
  bookmarks: BookmarkEntry[],
  currentDepth: number = 1
): number {
  let maxDepth = bookmarks.length > 0 ? currentDepth : 0;

  for (const bookmark of bookmarks) {
    if (bookmark.children && bookmark.children.length > 0) {
      const childDepth = calculateBookmarkDepth(bookmark.children, currentDepth + 1);
      maxDepth = Math.max(maxDepth, childDepth);
    }
  }

  return maxDepth;
}
