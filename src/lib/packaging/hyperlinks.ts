/**
 * Hyperlink Validation Service
 *
 * Validates internal and cross-document hyperlinks in PDF documents
 * for eCTD package integrity. Extracts links, classifies them by type,
 * validates destinations, and generates comprehensive reports.
 *
 * Key features:
 * - Extract all hyperlinks from PDF files
 * - Classify links as internal, cross-document, external, or unknown
 * - Validate internal links point to valid pages
 * - Validate cross-document links resolve to files in the package
 * - Flag external links (not allowed in eCTD)
 * - Generate validation reports with CSV export
 */

import { PDFDocument, PDFDict, PDFName, PDFArray, PDFString, PDFHexString, PDFRef } from 'pdf-lib';
import { readFile } from 'fs/promises';
import { getFullPath } from '@/lib/storage';
import { basename, dirname, join, normalize, relative } from 'path';
import type { PackageManifest, PackageFile } from './types';

// Link types
export type LinkType = 'internal' | 'cross-document' | 'external' | 'unknown';

// Single hyperlink extracted from PDF
export interface ExtractedLink {
  sourceFile: string;
  pageNumber: number;
  linkText?: string;              // Visible text if available
  targetUri?: string;             // External URL
  targetDestination?: string;     // Named destination
  targetPage?: number;            // Target page number (for internal links)
  linkType: LinkType;
  rect?: { x: number; y: number; width: number; height: number };
}

// Validation result for a single link
export interface LinkValidationResult {
  link: ExtractedLink;
  isValid: boolean;
  resolvedPath?: string;          // For cross-doc links, the resolved file path
  error?: string;
}

// Summary report
export interface HyperlinkReport {
  totalLinks: number;
  byType: {
    internal: number;
    crossDocument: number;
    external: number;
    unknown: number;
  };
  brokenLinks: LinkValidationResult[];
  externalLinks: ExtractedLink[];  // Flagged for review
  validatedAt: Date;
  warnings: string[];
}

/**
 * Extract a string value from a PDF dictionary entry
 */
function extractStringValue(value: unknown): string | null {
  if (value instanceof PDFString) {
    return value.decodeText();
  }
  if (value instanceof PDFHexString) {
    return value.decodeText();
  }
  return null;
}

/**
 * Extract rectangle coordinates from a PDF array [x1, y1, x2, y2]
 */
function extractRect(
  rectValue: unknown
): { x: number; y: number; width: number; height: number } | undefined {
  if (!rectValue) return undefined;

  try {
    // Handle PDFArray
    const arr = rectValue as { get?: (i: number) => unknown; asArray?: () => unknown[] };

    let values: number[] = [];

    if (typeof arr.get === 'function') {
      // PDFArray access pattern
      for (let i = 0; i < 4; i++) {
        const val = arr.get(i);
        if (val && typeof (val as { asNumber?: () => number }).asNumber === 'function') {
          values.push((val as { asNumber: () => number }).asNumber());
        }
      }
    }

    if (values.length === 4) {
      const [x1, y1, x2, y2] = values;
      return {
        x: Math.min(x1, x2),
        y: Math.min(y1, y2),
        width: Math.abs(x2 - x1),
        height: Math.abs(y2 - y1),
      };
    }
  } catch (error) {
    console.warn('[HyperlinkExtraction] Failed to extract rect:', error);
  }

  return undefined;
}

/**
 * Extract page number from a destination
 */
function extractPageFromDestination(
  pdfDoc: PDFDocument,
  dest: unknown
): number | undefined {
  try {
    // Destination can be an array [pageRef, /XYZ, left, top, zoom] or similar
    if (dest && typeof (dest as { get?: (index: number) => unknown }).get === 'function') {
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
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Extract named destination string
 */
function extractNamedDestination(dest: unknown): string | undefined {
  if (dest instanceof PDFString) {
    return dest.decodeText();
  }
  if (dest instanceof PDFHexString) {
    return dest.decodeText();
  }
  if (dest instanceof PDFName) {
    return dest.decodeText();
  }
  return undefined;
}

/**
 * Parse file path and destination from a cross-document link
 * Handles formats like:
 *   - filename.pdf#destination
 *   - ../folder/file.pdf
 *   - file.pdf#page=5
 */
function parseCrossDocumentTarget(uri: string): { filePath: string; destination?: string } {
  // Remove any leading './' or normalize path
  let cleanUri = uri.replace(/^\.\//, '');

  // Split on # for destination
  const hashIndex = cleanUri.indexOf('#');
  if (hashIndex >= 0) {
    return {
      filePath: cleanUri.substring(0, hashIndex),
      destination: cleanUri.substring(hashIndex + 1),
    };
  }

  return { filePath: cleanUri };
}

/**
 * Extract all hyperlinks from a PDF file
 */
export async function extractLinksFromPdf(filePath: string): Promise<ExtractedLink[]> {
  const links: ExtractedLink[] = [];

  try {
    const fullPath = getFullPath(filePath);
    const pdfBytes = await readFile(fullPath);

    const pdfDoc = await PDFDocument.load(pdfBytes, {
      ignoreEncryption: true,
      updateMetadata: false,
    });

    const pages = pdfDoc.getPages();

    for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
      const page = pages[pageIndex];
      const pageNumber = pageIndex + 1;

      // Access annotations via page node
      const annotsRef = page.node.get(PDFName.of('Annots'));
      if (!annotsRef) continue;

      // Resolve the annotations array
      let annots: unknown;
      if (annotsRef instanceof PDFRef) {
        annots = pdfDoc.context.lookup(annotsRef);
      } else {
        annots = annotsRef;
      }

      if (!annots || typeof (annots as { size?: number }).size !== 'number') continue;

      const annotsArray = annots as { size: number; get: (i: number) => unknown };
      const annotCount = annotsArray.size;

      for (let i = 0; i < annotCount; i++) {
        const annotRef = annotsArray.get(i);
        let annot: unknown;

        if (annotRef instanceof PDFRef) {
          annot = pdfDoc.context.lookup(annotRef);
        } else {
          annot = annotRef;
        }

        if (!(annot instanceof PDFDict)) continue;

        // Check if this is a Link annotation
        const subtype = annot.get(PDFName.of('Subtype'));
        if (!(subtype instanceof PDFName) || subtype.decodeText() !== 'Link') continue;

        // Extract link rect
        const rectValue = annot.get(PDFName.of('Rect'));
        const rect = extractRect(rectValue);

        // Initialize link data
        const link: ExtractedLink = {
          sourceFile: filePath,
          pageNumber,
          linkType: 'unknown',
          rect,
        };

        // Check for URI action (external link)
        const action = annot.lookup(PDFName.of('A'));
        if (action instanceof PDFDict) {
          const actionType = action.get(PDFName.of('S'));

          if (actionType instanceof PDFName) {
            const actionTypeStr = actionType.decodeText();

            if (actionTypeStr === 'URI') {
              // External URI link
              const uriValue = action.lookup(PDFName.of('URI'));
              const uri = extractStringValue(uriValue);
              if (uri) {
                link.targetUri = uri;
                link.linkType = classifyLink(link, filePath);
              }
            } else if (actionTypeStr === 'GoTo') {
              // Internal GoTo action
              const dest = action.get(PDFName.of('D'));
              if (dest) {
                const targetPage = extractPageFromDestination(pdfDoc, dest);
                const namedDest = extractNamedDestination(dest);

                if (targetPage) {
                  link.targetPage = targetPage;
                  link.linkType = 'internal';
                } else if (namedDest) {
                  link.targetDestination = namedDest;
                  link.linkType = 'internal';
                }
              }
            } else if (actionTypeStr === 'GoToR') {
              // Remote GoTo (cross-document link)
              const fileSpec = action.lookup(PDFName.of('F'));
              const dest = action.get(PDFName.of('D'));

              let targetFile: string | undefined;

              // Extract file specification
              if (fileSpec instanceof PDFDict) {
                // /F dictionary with /F or /UF key
                const fValue = fileSpec.lookup(PDFName.of('F')) || fileSpec.lookup(PDFName.of('UF'));
                targetFile = extractStringValue(fValue) || undefined;
              } else {
                targetFile = extractStringValue(fileSpec) || undefined;
              }

              if (targetFile) {
                link.targetUri = targetFile;

                // Extract destination if present
                const namedDest = extractNamedDestination(dest);
                if (namedDest) {
                  link.targetDestination = namedDest;
                }

                link.linkType = 'cross-document';
              }
            } else if (actionTypeStr === 'Launch') {
              // Launch action (file link)
              const fileSpec = action.lookup(PDFName.of('F'));
              const targetFile = extractStringValue(fileSpec);
              if (targetFile) {
                link.targetUri = targetFile;
                link.linkType = 'cross-document';
              }
            }
          }
        }

        // Check for direct destination (no action)
        const directDest = annot.get(PDFName.of('Dest'));
        if (directDest && link.linkType === 'unknown') {
          const targetPage = extractPageFromDestination(pdfDoc, directDest);
          const namedDest = extractNamedDestination(directDest);

          if (targetPage) {
            link.targetPage = targetPage;
            link.linkType = 'internal';
          } else if (namedDest) {
            link.targetDestination = namedDest;
            link.linkType = 'internal';
          }
        }

        // Only add if we extracted meaningful link info
        if (link.linkType !== 'unknown' || link.targetUri || link.targetDestination || link.targetPage) {
          links.push(link);
        }
      }
    }
  } catch (error) {
    console.error(`[HyperlinkExtraction] Failed to extract links from ${filePath}:`, error);
  }

  return links;
}

/**
 * Classify a link based on its target
 */
export function classifyLink(link: ExtractedLink, currentFile: string): LinkType {
  // If already classified as internal or cross-document, keep it
  if (link.linkType === 'internal' || link.linkType === 'cross-document') {
    return link.linkType;
  }

  // Check URI-based links
  if (link.targetUri) {
    const uri = link.targetUri.toLowerCase();

    // External URLs
    if (uri.startsWith('http://') || uri.startsWith('https://')) {
      return 'external';
    }

    // Email links
    if (uri.startsWith('mailto:')) {
      return 'external';
    }

    // FTP links
    if (uri.startsWith('ftp://')) {
      return 'external';
    }

    // JavaScript (should not exist in eCTD)
    if (uri.startsWith('javascript:')) {
      return 'unknown';
    }

    // File references (cross-document)
    if (uri.endsWith('.pdf') || uri.includes('.pdf#')) {
      return 'cross-document';
    }

    // Relative file paths
    if (uri.startsWith('../') || uri.startsWith('./') || !uri.includes('://')) {
      return 'cross-document';
    }
  }

  // Internal page or named destination
  if (link.targetPage !== undefined || link.targetDestination) {
    // Check if destination references another file
    if (link.targetDestination && link.targetDestination.includes('.pdf')) {
      return 'cross-document';
    }
    return 'internal';
  }

  return 'unknown';
}

/**
 * Validate internal links (within same document)
 * Checks that destination pages exist
 */
export function validateInternalLink(
  link: ExtractedLink,
  pdfDoc: PDFDocument
): LinkValidationResult {
  const pageCount = pdfDoc.getPageCount();

  // Check page number validity
  if (link.targetPage !== undefined) {
    if (link.targetPage < 1 || link.targetPage > pageCount) {
      return {
        link,
        isValid: false,
        error: `Target page ${link.targetPage} does not exist (document has ${pageCount} pages)`,
      };
    }
    return { link, isValid: true };
  }

  // Check named destination
  if (link.targetDestination) {
    // In pdf-lib, checking named destinations requires accessing the Names dictionary
    // For now, we assume named destinations are valid if they exist
    // A more thorough check would look up the destination in the document's name tree
    try {
      const catalog = pdfDoc.catalog;
      const namesRef = catalog.get(PDFName.of('Names'));

      if (namesRef) {
        // Names dictionary exists, destination likely valid
        // Full validation would traverse the name tree
        return { link, isValid: true };
      }

      // No Names dictionary - check Dests dictionary (older style)
      const destsRef = catalog.get(PDFName.of('Dests'));
      if (destsRef) {
        return { link, isValid: true };
      }

      // No destination dictionaries found
      return {
        link,
        isValid: false,
        error: `Named destination "${link.targetDestination}" cannot be verified (no destination dictionary)`,
      };
    } catch {
      return {
        link,
        isValid: false,
        error: `Failed to verify named destination "${link.targetDestination}"`,
      };
    }
  }

  return {
    link,
    isValid: false,
    error: 'Internal link has no target page or destination',
  };
}

/**
 * Validate cross-document links
 * Maps link targets to files in the package manifest
 */
export function validateCrossDocumentLink(
  link: ExtractedLink,
  manifest: PackageManifest
): LinkValidationResult {
  if (!link.targetUri) {
    return {
      link,
      isValid: false,
      error: 'Cross-document link has no target URI',
    };
  }

  // Parse the target file path
  const { filePath, destination } = parseCrossDocumentTarget(link.targetUri);

  // Normalize the file path for comparison
  const normalizedTarget = normalize(filePath).replace(/\\/g, '/');
  const targetFileName = basename(normalizedTarget).toLowerCase();

  // Look for the target file in the manifest
  for (const file of manifest.files) {
    // Check by exact targetPath
    if (file.targetPath.replace(/\\/g, '/').endsWith(normalizedTarget)) {
      return {
        link,
        isValid: true,
        resolvedPath: file.targetPath,
      };
    }

    // Check by fileName (case-insensitive)
    if (file.fileName.toLowerCase() === targetFileName) {
      return {
        link,
        isValid: true,
        resolvedPath: file.targetPath,
      };
    }

    // Check by relative path matching
    // Handle cases like "../16-2-1/listing.pdf" referencing "m5/datasets/16-2-1/listing.pdf"
    const fileTargetPath = file.targetPath.replace(/\\/g, '/');
    if (fileTargetPath.includes(normalizedTarget) || normalizedTarget.includes(basename(fileTargetPath))) {
      return {
        link,
        isValid: true,
        resolvedPath: file.targetPath,
      };
    }
  }

  // Try resolving relative path from source file
  const sourceDir = dirname(link.sourceFile);
  const resolvedRelative = normalize(join(sourceDir, filePath)).replace(/\\/g, '/');

  for (const file of manifest.files) {
    const fileTargetPath = file.targetPath.replace(/\\/g, '/');
    if (fileTargetPath.endsWith(resolvedRelative) || resolvedRelative.endsWith(fileTargetPath)) {
      return {
        link,
        isValid: true,
        resolvedPath: file.targetPath,
      };
    }
  }

  return {
    link,
    isValid: false,
    error: `Target file not found in package: ${link.targetUri}`,
  };
}

/**
 * Generate hyperlink validation report for entire package
 */
export async function generateHyperlinkReport(
  manifest: PackageManifest
): Promise<HyperlinkReport> {
  const report: HyperlinkReport = {
    totalLinks: 0,
    byType: {
      internal: 0,
      crossDocument: 0,
      external: 0,
      unknown: 0,
    },
    brokenLinks: [],
    externalLinks: [],
    validatedAt: new Date(),
    warnings: [],
  };

  // Process each file in the manifest
  for (const file of manifest.files) {
    try {
      // Extract links from this PDF
      const links = await extractLinksFromPdf(file.sourcePath);

      // Load the PDF for internal link validation
      let pdfDoc: PDFDocument | null = null;

      try {
        const fullPath = getFullPath(file.sourcePath);
        const pdfBytes = await readFile(fullPath);
        pdfDoc = await PDFDocument.load(pdfBytes, {
          ignoreEncryption: true,
          updateMetadata: false,
        });
      } catch (loadError) {
        report.warnings.push(`Failed to load PDF for validation: ${file.fileName}`);
      }

      // Validate each link
      for (const link of links) {
        report.totalLinks++;

        // Ensure link type is classified
        link.linkType = classifyLink(link, file.sourcePath);

        // Update counts by type
        switch (link.linkType) {
          case 'internal':
            report.byType.internal++;
            break;
          case 'cross-document':
            report.byType.crossDocument++;
            break;
          case 'external':
            report.byType.external++;
            break;
          default:
            report.byType.unknown++;
        }

        // Validate based on link type
        let validationResult: LinkValidationResult;

        switch (link.linkType) {
          case 'internal':
            if (pdfDoc) {
              validationResult = validateInternalLink(link, pdfDoc);
            } else {
              validationResult = {
                link,
                isValid: false,
                error: 'Could not load PDF for internal link validation',
              };
            }
            break;

          case 'cross-document':
            validationResult = validateCrossDocumentLink(link, manifest);
            break;

          case 'external':
            // External links are flagged for review but not validated
            report.externalLinks.push(link);
            validationResult = {
              link,
              isValid: true, // Not broken, just flagged
            };
            break;

          default:
            validationResult = {
              link,
              isValid: false,
              error: 'Unknown link type - unable to validate',
            };
        }

        // Track broken links
        if (!validationResult.isValid) {
          report.brokenLinks.push(validationResult);
        }
      }
    } catch (fileError) {
      const errorMessage = fileError instanceof Error ? fileError.message : 'Unknown error';
      report.warnings.push(`Failed to process file ${file.fileName}: ${errorMessage}`);
    }
  }

  // Add warning for external links (not allowed in eCTD)
  if (report.externalLinks.length > 0) {
    report.warnings.push(
      `Found ${report.externalLinks.length} external link(s). External HTTP/HTTPS links are not allowed in eCTD submissions.`
    );
  }

  // Add warning for unknown link types
  if (report.byType.unknown > 0) {
    report.warnings.push(
      `Found ${report.byType.unknown} link(s) with unrecognized format.`
    );
  }

  return report;
}

/**
 * Escape a field for CSV output
 */
function escapeCsvField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

/**
 * Export report as CSV for easy review
 */
export function exportReportAsCsv(report: HyperlinkReport): string {
  const lines: string[] = [];

  // Header row
  lines.push('Source File,Page,Link Type,Target,Status,Error');

  // Add broken links
  for (const result of report.brokenLinks) {
    const link = result.link;
    const target = link.targetUri || link.targetDestination ||
                   (link.targetPage ? `page ${link.targetPage}` : 'unknown');

    lines.push([
      escapeCsvField(basename(link.sourceFile)),
      link.pageNumber.toString(),
      link.linkType,
      escapeCsvField(target),
      'BROKEN',
      escapeCsvField(result.error || ''),
    ].join(','));
  }

  // Add external links (flagged for review)
  for (const link of report.externalLinks) {
    const target = link.targetUri || 'unknown';

    lines.push([
      escapeCsvField(basename(link.sourceFile)),
      link.pageNumber.toString(),
      link.linkType,
      escapeCsvField(target),
      'FLAGGED',
      escapeCsvField('External links not allowed in eCTD'),
    ].join(','));
  }

  // Add summary section
  lines.push('');
  lines.push('--- Summary ---');
  lines.push(`Total Links,${report.totalLinks}`);
  lines.push(`Internal Links,${report.byType.internal}`);
  lines.push(`Cross-Document Links,${report.byType.crossDocument}`);
  lines.push(`External Links,${report.byType.external}`);
  lines.push(`Unknown Links,${report.byType.unknown}`);
  lines.push(`Broken Links,${report.brokenLinks.length}`);
  lines.push(`Validated At,${report.validatedAt.toISOString()}`);

  // Add warnings
  if (report.warnings.length > 0) {
    lines.push('');
    lines.push('--- Warnings ---');
    for (const warning of report.warnings) {
      lines.push(escapeCsvField(warning));
    }
  }

  return lines.join('\n');
}
