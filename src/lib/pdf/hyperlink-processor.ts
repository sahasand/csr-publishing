/**
 * PDF Hyperlink Processor
 *
 * Processes and fixes hyperlinks in PDF documents for eCTD compliance:
 * - Converts absolute URLs to relative paths
 * - Updates cross-document references
 * - Removes external HTTP/HTTPS links (optional)
 *
 * eCTD requires all internal links to use relative paths.
 */

import {
  PDFDocument,
  PDFDict,
  PDFName,
  PDFArray,
  PDFString,
  PDFHexString,
  PDFRef,
} from 'pdf-lib';
import { basename, dirname, relative, normalize } from 'path';

/**
 * Link modification action
 */
export type LinkAction = 'keep' | 'update' | 'remove';

/**
 * Processed link information
 */
export interface ProcessedLink {
  /** Original URI or file reference */
  originalTarget: string;
  /** New target after processing */
  newTarget?: string;
  /** Action taken */
  action: LinkAction;
  /** Page number where link was found */
  pageNumber: number;
  /** Reason for the action */
  reason: string;
}

/**
 * Result of hyperlink processing
 */
export interface HyperlinkProcessingResult {
  /** Whether processing was successful */
  success: boolean;
  /** Total links found */
  totalLinks: number;
  /** Links that were updated */
  updatedCount: number;
  /** Links that were removed */
  removedCount: number;
  /** Links that were kept unchanged */
  keptCount: number;
  /** Details for each processed link */
  processedLinks: ProcessedLink[];
  /** Warnings during processing */
  warnings: string[];
  /** Error message if failed */
  error?: string;
}

/**
 * Options for hyperlink processing
 */
export interface HyperlinkProcessingOptions {
  /** Remove external HTTP/HTTPS links (default: false - just flags them) */
  removeExternalLinks?: boolean;
  /** Base path for calculating relative paths */
  basePath?: string;
  /** Map of old paths to new paths for cross-document references */
  pathMap?: Map<string, string>;
  /** Remove mailto: links */
  removeMailtoLinks?: boolean;
}

/**
 * Default options
 */
const DEFAULT_OPTIONS: Required<HyperlinkProcessingOptions> = {
  removeExternalLinks: false,
  basePath: '',
  pathMap: new Map(),
  removeMailtoLinks: false,
};

/**
 * Check if a URI is an external link
 */
function isExternalLink(uri: string): boolean {
  const lower = uri.toLowerCase();
  return (
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('ftp://') ||
    lower.startsWith('mailto:')
  );
}

/**
 * Check if a URI is a mailto link
 */
function isMailtoLink(uri: string): boolean {
  return uri.toLowerCase().startsWith('mailto:');
}

/**
 * Extract string value from PDF object
 */
function extractString(value: unknown): string | null {
  if (value instanceof PDFString) {
    return value.decodeText();
  }
  if (value instanceof PDFHexString) {
    return value.decodeText();
  }
  return null;
}

/**
 * Convert absolute path to relative path
 */
function toRelativePath(
  absolutePath: string,
  basePath: string,
  targetFile: string
): string {
  if (!basePath) {
    return absolutePath;
  }

  try {
    // Normalize paths
    const normalizedBase = normalize(basePath).replace(/\\/g, '/');
    const normalizedTarget = normalize(absolutePath).replace(/\\/g, '/');

    // Calculate relative path
    const relativePath = relative(dirname(normalizedBase), normalizedTarget);

    // Ensure forward slashes for PDF compatibility
    return relativePath.replace(/\\/g, '/');
  } catch {
    return absolutePath;
  }
}

/**
 * Process a single annotation link
 */
function processAnnotation(
  annot: PDFDict,
  pdfDoc: PDFDocument,
  pageNumber: number,
  options: Required<HyperlinkProcessingOptions>,
  results: ProcessedLink[]
): void {
  // Check if this is a Link annotation
  const subtype = annot.get(PDFName.of('Subtype'));
  if (!(subtype instanceof PDFName) || subtype.decodeText() !== 'Link') {
    return;
  }

  // Get the action dictionary
  const action = annot.lookup(PDFName.of('A'));
  if (!(action instanceof PDFDict)) {
    return;
  }

  const actionType = action.get(PDFName.of('S'));
  if (!(actionType instanceof PDFName)) {
    return;
  }

  const actionTypeStr = actionType.decodeText();

  // Process URI actions (external links)
  if (actionTypeStr === 'URI') {
    const uriValue = action.lookup(PDFName.of('URI'));
    const uri = extractString(uriValue);

    if (!uri) {
      return;
    }

    // Handle external links
    if (isExternalLink(uri)) {
      if (isMailtoLink(uri) && options.removeMailtoLinks) {
        // Remove mailto link
        annot.delete(PDFName.of('A'));
        results.push({
          originalTarget: uri,
          action: 'remove',
          pageNumber,
          reason: 'Mailto link removed per options',
        });
      } else if (!isMailtoLink(uri) && options.removeExternalLinks) {
        // Remove HTTP/HTTPS link
        annot.delete(PDFName.of('A'));
        results.push({
          originalTarget: uri,
          action: 'remove',
          pageNumber,
          reason: 'External HTTP/HTTPS link removed per options',
        });
      } else {
        // Flag but keep
        results.push({
          originalTarget: uri,
          action: 'keep',
          pageNumber,
          reason: 'External link flagged (not allowed in eCTD)',
        });
      }
      return;
    }

    // Handle file references in URI (non-HTTP)
    if (uri.endsWith('.pdf') || uri.includes('.pdf#')) {
      const newTarget = processFileReference(uri, options);
      if (newTarget !== uri) {
        // Update the URI
        action.set(PDFName.of('URI'), PDFString.of(newTarget));
        results.push({
          originalTarget: uri,
          newTarget,
          action: 'update',
          pageNumber,
          reason: 'File reference converted to relative path',
        });
      } else {
        results.push({
          originalTarget: uri,
          action: 'keep',
          pageNumber,
          reason: 'File reference already relative',
        });
      }
    }
  }

  // Process GoToR actions (cross-document links)
  if (actionTypeStr === 'GoToR') {
    const fileSpec = action.lookup(PDFName.of('F'));
    let targetFile: string | null = null;

    // Extract file specification
    if (fileSpec instanceof PDFDict) {
      const fValue = fileSpec.lookup(PDFName.of('F')) || fileSpec.lookup(PDFName.of('UF'));
      targetFile = extractString(fValue);
    } else {
      targetFile = extractString(fileSpec);
    }

    if (targetFile) {
      const newTarget = processFileReference(targetFile, options);
      if (newTarget !== targetFile) {
        // Update the file specification
        if (fileSpec instanceof PDFDict) {
          fileSpec.set(PDFName.of('F'), PDFString.of(newTarget));
          if (fileSpec.has(PDFName.of('UF'))) {
            fileSpec.set(PDFName.of('UF'), PDFHexString.fromText(newTarget));
          }
        } else {
          action.set(PDFName.of('F'), PDFString.of(newTarget));
        }

        results.push({
          originalTarget: targetFile,
          newTarget,
          action: 'update',
          pageNumber,
          reason: 'Cross-document reference updated',
        });
      } else {
        results.push({
          originalTarget: targetFile,
          action: 'keep',
          pageNumber,
          reason: 'Cross-document reference already correct',
        });
      }
    }
  }

  // Process Launch actions (file links)
  if (actionTypeStr === 'Launch') {
    const fileSpec = action.lookup(PDFName.of('F'));
    const targetFile = extractString(fileSpec);

    if (targetFile) {
      if (options.removeExternalLinks && isExternalLink(targetFile)) {
        annot.delete(PDFName.of('A'));
        results.push({
          originalTarget: targetFile,
          action: 'remove',
          pageNumber,
          reason: 'Launch action to external resource removed',
        });
      } else {
        const newTarget = processFileReference(targetFile, options);
        if (newTarget !== targetFile) {
          action.set(PDFName.of('F'), PDFString.of(newTarget));
          results.push({
            originalTarget: targetFile,
            newTarget,
            action: 'update',
            pageNumber,
            reason: 'Launch action file reference updated',
          });
        } else {
          results.push({
            originalTarget: targetFile,
            action: 'keep',
            pageNumber,
            reason: 'Launch action file reference unchanged',
          });
        }
      }
    }
  }
}

/**
 * Process a file reference path
 */
function processFileReference(
  filePath: string,
  options: Required<HyperlinkProcessingOptions>
): string {
  // Check if we have a mapping for this file
  const fileName = basename(filePath.split('#')[0]);
  const fragment = filePath.includes('#') ? '#' + filePath.split('#')[1] : '';

  // Look up in path map
  for (const [oldPath, newPath] of options.pathMap) {
    if (filePath.includes(oldPath) || fileName === basename(oldPath)) {
      return newPath + fragment;
    }
  }

  // Convert to relative path if base path is provided
  if (options.basePath && !filePath.startsWith('../') && !filePath.startsWith('./')) {
    return toRelativePath(filePath, options.basePath, fileName);
  }

  return filePath;
}

/**
 * Process all hyperlinks in a PDF document
 *
 * @param pdfDoc - The PDF document (already loaded with pdf-lib)
 * @param options - Processing options
 * @returns Processing result with statistics
 */
export async function processHyperlinks(
  pdfDoc: PDFDocument,
  options: HyperlinkProcessingOptions = {}
): Promise<HyperlinkProcessingResult> {
  const fullOptions: Required<HyperlinkProcessingOptions> = {
    ...DEFAULT_OPTIONS,
    ...options,
    pathMap: options.pathMap || new Map(),
  };

  const results: ProcessedLink[] = [];
  const warnings: string[] = [];

  try {
    const pages = pdfDoc.getPages();

    for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
      const page = pages[pageIndex];
      const pageNumber = pageIndex + 1;

      // Access annotations via page node
      const annotsRef = page.node.get(PDFName.of('Annots'));
      if (!annotsRef) {
        continue;
      }

      // Resolve the annotations array
      let annots: unknown;
      if (annotsRef instanceof PDFRef) {
        annots = pdfDoc.context.lookup(annotsRef);
      } else {
        annots = annotsRef;
      }

      if (!annots || !(annots instanceof PDFArray)) {
        continue;
      }

      const annotCount = annots.size();

      for (let i = 0; i < annotCount; i++) {
        const annotRef = annots.get(i);
        let annot: unknown;

        if (annotRef instanceof PDFRef) {
          annot = pdfDoc.context.lookup(annotRef);
        } else {
          annot = annotRef;
        }

        if (annot instanceof PDFDict) {
          try {
            processAnnotation(annot, pdfDoc, pageNumber, fullOptions, results);
          } catch (annotError) {
            const errorMsg = annotError instanceof Error ? annotError.message : 'Unknown error';
            warnings.push(`Error processing annotation on page ${pageNumber}: ${errorMsg}`);
          }
        }
      }
    }

    // Calculate statistics
    const updatedCount = results.filter((r) => r.action === 'update').length;
    const removedCount = results.filter((r) => r.action === 'remove').length;
    const keptCount = results.filter((r) => r.action === 'keep').length;

    return {
      success: true,
      totalLinks: results.length,
      updatedCount,
      removedCount,
      keptCount,
      processedLinks: results,
      warnings,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      totalLinks: 0,
      updatedCount: 0,
      removedCount: 0,
      keptCount: 0,
      processedLinks: [],
      warnings,
      error: `Failed to process hyperlinks: ${errorMessage}`,
    };
  }
}

/**
 * Build a path mapping from package manifest
 *
 * Creates a map from source file paths to target eCTD paths
 * for use in cross-document link resolution.
 */
export function buildPathMapFromManifest(
  files: Array<{
    sourcePath: string;
    targetPath: string;
    fileName: string;
  }>
): Map<string, string> {
  const pathMap = new Map<string, string>();

  for (const file of files) {
    // Map source path to target path
    pathMap.set(file.sourcePath, file.targetPath);
    // Also map by filename for looser matching
    pathMap.set(file.fileName, file.targetPath);
  }

  return pathMap;
}
