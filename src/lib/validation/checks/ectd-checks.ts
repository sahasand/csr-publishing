/**
 * eCTD-Specific Validation Check Functions
 *
 * Validation checks specific to eCTD (Electronic Common Technical Document)
 * submission requirements per FDA/ICH guidelines.
 */

import { PDFDocument, PDFName, PDFDict, PDFRef, PDFArray, PDFNumber, PDFObject } from 'pdf-lib';
import { readFile, stat } from 'fs/promises';
import { basename } from 'path';
import type { CheckResult } from './index';

/**
 * Check that PDF bookmarks don't exceed maximum depth
 * eCTD requirement: Maximum 4 levels of bookmark hierarchy
 *
 * @param filePath - Full path to the PDF file
 * @param params - { maxDepth: number } - Maximum allowed depth (default: 4)
 */
export async function checkBookmarkDepth(
  filePath: string,
  params: Record<string, unknown>
): Promise<CheckResult> {
  const maxDepth = (params.maxDepth as number) ?? 4;

  try {
    const pdfBytes = await readFile(filePath);
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

    // Check if document has outlines (bookmarks)
    const outlinesRef = pdfDoc.catalog.get(PDFName.of('Outlines'));
    if (!outlinesRef) {
      return {
        passed: true,
        message: 'PDF has no bookmarks',
        details: { hasBookmarks: false, maxDepth, actualDepth: 0 },
      };
    }

    // Resolve outlines dictionary
    let outlines: unknown;
    if (outlinesRef instanceof PDFRef) {
      outlines = pdfDoc.context.lookup(outlinesRef);
    } else {
      outlines = outlinesRef;
    }

    if (!(outlines instanceof PDFDict)) {
      return {
        passed: true,
        message: 'Unable to read bookmark structure',
        details: { hasBookmarks: false, maxDepth },
      };
    }

    // Calculate actual depth by traversing the outline tree
    const actualDepth = calculateOutlineDepth(pdfDoc, outlines, 0);

    if (actualDepth > maxDepth) {
      return {
        passed: false,
        message: `Bookmark depth (${actualDepth}) exceeds eCTD maximum of ${maxDepth} levels`,
        details: { hasBookmarks: true, actualDepth, maxDepth },
      };
    }

    return {
      passed: true,
      message: `Bookmark depth (${actualDepth}) is within allowed ${maxDepth} levels`,
      details: { hasBookmarks: true, actualDepth, maxDepth },
    };
  } catch (error) {
    return {
      passed: false,
      message: `Unable to check bookmark depth: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: { error: String(error) },
    };
  }
}

/**
 * Recursively calculate outline tree depth
 */
function calculateOutlineDepth(
  pdfDoc: PDFDocument,
  outlineDict: PDFDict,
  currentDepth: number
): number {
  let maxChildDepth = currentDepth;

  // Get first child
  const firstRef = outlineDict.get(PDFName.of('First'));
  if (!firstRef) {
    return currentDepth;
  }

  let currentItemRef: PDFObject | undefined = firstRef;
  while (currentItemRef) {
    let currentItem: unknown;
    if (currentItemRef instanceof PDFRef) {
      currentItem = pdfDoc.context.lookup(currentItemRef);
    } else {
      currentItem = currentItemRef;
    }

    if (currentItem instanceof PDFDict) {
      // Check this item's children
      const childDepth = calculateOutlineDepth(pdfDoc, currentItem, currentDepth + 1);
      maxChildDepth = Math.max(maxChildDepth, childDepth);

      // Move to next sibling
      const nextRef = currentItem.get(PDFName.of('Next'));
      currentItemRef = nextRef;
    } else {
      break;
    }
  }

  return maxChildDepth;
}

/**
 * Check that PDF has bookmarks (required for eCTD)
 *
 * @param filePath - Full path to the PDF file
 * @param params - { required: boolean } - Whether bookmarks are required (default: true)
 */
export async function checkBookmarksExist(
  filePath: string,
  params: Record<string, unknown>
): Promise<CheckResult> {
  const required = (params.required as boolean) ?? true;

  try {
    const pdfBytes = await readFile(filePath);
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

    // Check if document has outlines
    const outlinesRef = pdfDoc.catalog.get(PDFName.of('Outlines'));
    const hasBookmarks = !!outlinesRef;

    // Count bookmarks if present
    let bookmarkCount = 0;
    if (hasBookmarks && outlinesRef) {
      let outlines: unknown;
      if (outlinesRef instanceof PDFRef) {
        outlines = pdfDoc.context.lookup(outlinesRef);
      } else {
        outlines = outlinesRef;
      }

      if (outlines instanceof PDFDict) {
        const countObj = outlines.get(PDFName.of('Count'));
        if (countObj instanceof PDFNumber) {
          bookmarkCount = Math.abs(countObj.asNumber());
        }
      }
    }

    if (!hasBookmarks && required) {
      return {
        passed: false,
        message: 'PDF is missing bookmarks. eCTD submissions require navigation bookmarks',
        details: { hasBookmarks: false, bookmarkCount: 0, required },
      };
    }

    if (hasBookmarks && bookmarkCount === 0) {
      return {
        passed: false,
        message: 'PDF has empty bookmark structure (no bookmark entries)',
        details: { hasBookmarks: true, bookmarkCount: 0, required },
      };
    }

    return {
      passed: true,
      message: hasBookmarks
        ? `PDF has ${bookmarkCount} bookmark(s)`
        : 'PDF has no bookmarks (not required)',
      details: { hasBookmarks, bookmarkCount, required },
    };
  } catch (error) {
    return {
      passed: false,
      message: `Unable to check bookmarks: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: { error: String(error) },
    };
  }
}

/**
 * Check file naming conventions for eCTD compliance
 * eCTD requirements:
 * - No spaces in filenames
 * - Only alphanumeric, hyphen, underscore, period allowed
 * - Maximum length (typically 64 or 180 characters)
 * - Must be lowercase
 *
 * @param filePath - Full path to the PDF file
 * @param params - { maxLength?: number, requireLowercase?: boolean }
 */
export async function checkFileNaming(
  filePath: string,
  params: Record<string, unknown>
): Promise<CheckResult> {
  const maxLength = (params.maxLength as number) ?? 64;
  const requireLowercase = (params.requireLowercase as boolean) ?? true;

  try {
    const fileName = basename(filePath);
    const issues: string[] = [];

    // Check for spaces
    if (fileName.includes(' ')) {
      issues.push('contains spaces');
    }

    // Check for invalid characters (only allow alphanumeric, hyphen, underscore, period)
    const invalidChars = fileName.match(/[^a-zA-Z0-9\-_.]/g);
    if (invalidChars) {
      const uniqueInvalid = [...new Set(invalidChars)];
      issues.push(`contains invalid characters: ${uniqueInvalid.join(', ')}`);
    }

    // Check length
    if (fileName.length > maxLength) {
      issues.push(`exceeds maximum length of ${maxLength} characters (${fileName.length} chars)`);
    }

    // Check lowercase requirement
    if (requireLowercase && fileName !== fileName.toLowerCase()) {
      issues.push('contains uppercase letters (should be lowercase)');
    }

    // Check for consecutive periods or hyphens
    if (/\.\.|\-\-|__/.test(fileName)) {
      issues.push('contains consecutive special characters');
    }

    // Check that it starts with alphanumeric
    if (!/^[a-zA-Z0-9]/.test(fileName)) {
      issues.push('must start with alphanumeric character');
    }

    if (issues.length > 0) {
      return {
        passed: false,
        message: `File name "${fileName}" ${issues.join('; ')}`,
        details: { fileName, issues, maxLength, requireLowercase },
      };
    }

    return {
      passed: true,
      message: `File name "${fileName}" meets eCTD naming conventions`,
      details: { fileName, maxLength, requireLowercase },
    };
  } catch (error) {
    return {
      passed: false,
      message: `Unable to check file naming: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: { error: String(error) },
    };
  }
}

/**
 * Check page size is standard for eCTD
 * FDA recommends Letter (8.5x11") or A4 size
 *
 * @param filePath - Full path to the PDF file
 * @param params - { allowedSizes?: string[], tolerancePts?: number }
 */
export async function checkPageSize(
  filePath: string,
  params: Record<string, unknown>
): Promise<CheckResult> {
  const tolerancePts = (params.tolerancePts as number) ?? 5; // 5 point tolerance

  // Standard page sizes in points (72 points = 1 inch)
  const standardSizes: Record<string, { width: number; height: number }> = {
    'Letter': { width: 612, height: 792 },       // 8.5" x 11"
    'A4': { width: 595, height: 842 },           // 210mm x 297mm
    'Legal': { width: 612, height: 1008 },       // 8.5" x 14"
    'Letter-Landscape': { width: 792, height: 612 },
    'A4-Landscape': { width: 842, height: 595 },
  };

  const allowedSizeNames = (params.allowedSizes as string[]) ?? ['Letter', 'A4', 'Letter-Landscape', 'A4-Landscape'];

  try {
    const pdfBytes = await readFile(filePath);
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const pages = pdfDoc.getPages();

    if (pages.length === 0) {
      return {
        passed: false,
        message: 'PDF has no pages',
        details: { pageCount: 0 },
      };
    }

    const nonStandardPages: Array<{ page: number; width: number; height: number; detected: string }> = [];

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const { width, height } = page.getSize();

      let matchedSize: string | null = null;
      for (const sizeName of allowedSizeNames) {
        const size = standardSizes[sizeName];
        if (!size) continue;

        const widthMatch = Math.abs(width - size.width) <= tolerancePts;
        const heightMatch = Math.abs(height - size.height) <= tolerancePts;

        if (widthMatch && heightMatch) {
          matchedSize = sizeName;
          break;
        }
      }

      if (!matchedSize) {
        nonStandardPages.push({
          page: i + 1,
          width: Math.round(width),
          height: Math.round(height),
          detected: `${Math.round(width)}x${Math.round(height)} pts`,
        });
      }
    }

    if (nonStandardPages.length > 0) {
      const pageList = nonStandardPages.slice(0, 5).map(p => `Page ${p.page}: ${p.detected}`).join('; ');
      const additional = nonStandardPages.length > 5 ? ` (and ${nonStandardPages.length - 5} more)` : '';

      return {
        passed: false,
        message: `${nonStandardPages.length} page(s) have non-standard size: ${pageList}${additional}`,
        details: {
          totalPages: pages.length,
          nonStandardCount: nonStandardPages.length,
          nonStandardPages: nonStandardPages.slice(0, 10),
          allowedSizes: allowedSizeNames,
        },
      };
    }

    return {
      passed: true,
      message: `All ${pages.length} page(s) have standard size`,
      details: {
        totalPages: pages.length,
        allowedSizes: allowedSizeNames,
      },
    };
  } catch (error) {
    return {
      passed: false,
      message: `Unable to check page size: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: { error: String(error) },
    };
  }
}

/**
 * Check for external hyperlinks in PDF
 * eCTD requirement: No external HTTP/HTTPS links (except to official resources)
 *
 * @param filePath - Full path to the PDF file
 * @param params - { allowExternal?: boolean, allowedDomains?: string[] }
 */
export async function checkExternalHyperlinks(
  filePath: string,
  params: Record<string, unknown>
): Promise<CheckResult> {
  const allowExternal = (params.allowExternal as boolean) ?? false;
  const allowedDomains = (params.allowedDomains as string[]) ?? [];

  try {
    const pdfBytes = await readFile(filePath);
    const pdfString = pdfBytes.toString('latin1');

    // Look for URI patterns in the PDF
    const uriMatches = pdfString.match(/\/URI\s*\(([^)]+)\)/g) || [];
    const httpMatches = pdfString.match(/https?:\/\/[^\s\)>]+/gi) || [];

    // Combine and deduplicate
    const allUrls = new Set<string>();

    for (const match of uriMatches) {
      const urlMatch = match.match(/\(([^)]+)\)/);
      if (urlMatch && urlMatch[1]) {
        allUrls.add(urlMatch[1]);
      }
    }

    for (const url of httpMatches) {
      allUrls.add(url);
    }

    // Filter to external URLs
    const externalUrls = Array.from(allUrls).filter(url => {
      const lower = url.toLowerCase();
      return lower.startsWith('http://') || lower.startsWith('https://');
    });

    // Check against allowed domains
    const disallowedUrls = externalUrls.filter(url => {
      if (allowExternal) return false;
      if (allowedDomains.length === 0) return true;

      try {
        const urlObj = new URL(url);
        return !allowedDomains.some(domain =>
          urlObj.hostname === domain || urlObj.hostname.endsWith('.' + domain)
        );
      } catch {
        return true;
      }
    });

    if (disallowedUrls.length > 0) {
      const urlList = disallowedUrls.slice(0, 5).join(', ');
      const additional = disallowedUrls.length > 5 ? ` (and ${disallowedUrls.length - 5} more)` : '';

      return {
        passed: false,
        message: `PDF contains ${disallowedUrls.length} external hyperlink(s): ${urlList}${additional}`,
        details: {
          totalExternalLinks: externalUrls.length,
          disallowedCount: disallowedUrls.length,
          disallowedUrls: disallowedUrls.slice(0, 10),
          allowExternal,
          allowedDomains,
        },
      };
    }

    return {
      passed: true,
      message: externalUrls.length > 0
        ? `PDF has ${externalUrls.length} external link(s) (all allowed)`
        : 'PDF has no external hyperlinks',
      details: {
        totalExternalLinks: externalUrls.length,
        allowExternal,
        allowedDomains,
      },
    };
  } catch (error) {
    return {
      passed: false,
      message: `Unable to check hyperlinks: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: { error: String(error) },
    };
  }
}

/**
 * Check that document title metadata is set
 * eCTD recommendation: PDFs should have meaningful title metadata
 *
 * @param filePath - Full path to the PDF file
 * @param params - { required?: boolean }
 */
export async function checkDocumentTitle(
  filePath: string,
  params: Record<string, unknown>
): Promise<CheckResult> {
  const required = (params.required as boolean) ?? false;

  try {
    const pdfBytes = await readFile(filePath);
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

    const title = pdfDoc.getTitle();
    const hasTitle = title !== undefined && title.trim().length > 0;

    if (!hasTitle && required) {
      return {
        passed: false,
        message: 'PDF is missing document title metadata',
        details: { hasTitle: false, title: null, required },
      };
    }

    return {
      passed: true,
      message: hasTitle
        ? `PDF has title: "${title}"`
        : 'PDF has no title metadata (not required)',
      details: { hasTitle, title: title || null, required },
    };
  } catch (error) {
    return {
      passed: false,
      message: `Unable to check document title: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: { error: String(error) },
    };
  }
}

/**
 * Check PDF for JavaScript (security concern)
 * eCTD requirement: No embedded JavaScript
 *
 * @param filePath - Full path to the PDF file
 */
export async function checkNoJavaScript(
  filePath: string,
  _params: Record<string, unknown>
): Promise<CheckResult> {
  try {
    const pdfBytes = await readFile(filePath);
    const pdfString = pdfBytes.toString('latin1');

    // Look for JavaScript indicators
    const jsIndicators = [
      '/JavaScript',
      '/JS',
      '/OpenAction',
      '/AA',  // Additional Actions
    ];

    const foundIndicators: string[] = [];
    for (const indicator of jsIndicators) {
      if (pdfString.includes(indicator)) {
        // Check if it's followed by JavaScript-related content
        const regex = new RegExp(`${indicator.replace('/', '\\/')}\\s*<<`, 'g');
        if (regex.test(pdfString)) {
          foundIndicators.push(indicator);
        }
      }
    }

    // More specific check for JavaScript streams
    const hasJsStream = pdfString.includes('/S /JavaScript') ||
                        pdfString.includes('/S/JavaScript');

    if (hasJsStream || foundIndicators.length > 0) {
      return {
        passed: false,
        message: 'PDF contains JavaScript or actions. eCTD submissions must not contain executable content',
        details: {
          hasJavaScript: true,
          indicators: foundIndicators,
          hasJsStream,
        },
      };
    }

    return {
      passed: true,
      message: 'PDF contains no JavaScript',
      details: { hasJavaScript: false },
    };
  } catch (error) {
    return {
      passed: false,
      message: `Unable to check for JavaScript: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: { error: String(error) },
    };
  }
}
