/**
 * Check Function Registry
 *
 * Central registry mapping checkFn strings to their implementations.
 * Used by the validation runner to execute validation rules.
 */

import {
  checkFileSize,
  checkPdfParseable,
  checkPdfVersion,
  checkNotEncrypted,
  checkFontsEmbedded,
  checkPdfACompliance,
  checkPageCount,
} from './pdf-checks';

import {
  checkBookmarkDepth,
  checkBookmarksExist,
  checkFileNaming,
  checkPageSize,
  checkExternalHyperlinks,
  checkDocumentTitle,
  checkNoJavaScript,
} from './ectd-checks';

/**
 * Result from a validation check function
 */
export interface CheckResult {
  /** Whether the check passed */
  passed: boolean;
  /** Human-readable message describing the result */
  message: string;
  /** Optional additional details about the check */
  details?: Record<string, unknown>;
}

/**
 * Signature for all check functions
 * @param filePath - Full path to the file to validate
 * @param params - Parameters from the validation rule
 * @returns Promise resolving to the check result
 */
export type CheckFunction = (
  filePath: string,
  params: Record<string, unknown>
) => Promise<CheckResult>;

/**
 * Registry mapping checkFn identifier strings to their implementations
 */
const checkRegistry: Record<string, CheckFunction> = {
  // PDF compliance checks
  'checkFileSize': checkFileSize,
  'checkPdfParseable': checkPdfParseable,
  'checkPdfVersion': checkPdfVersion,
  'checkNotEncrypted': checkNotEncrypted,
  'checkFontsEmbedded': checkFontsEmbedded,
  'checkPdfACompliance': checkPdfACompliance,
  'checkPageCount': checkPageCount,

  // eCTD-specific checks
  'checkBookmarkDepth': checkBookmarkDepth,
  'checkBookmarksExist': checkBookmarksExist,
  'checkFileNaming': checkFileNaming,
  'checkPageSize': checkPageSize,
  'checkExternalHyperlinks': checkExternalHyperlinks,
  'checkDocumentTitle': checkDocumentTitle,
  'checkNoJavaScript': checkNoJavaScript,

  // Legacy identifiers (for backwards compatibility)
  'pdf-file-size': checkFileSize,
  'pdf-parseable': checkPdfParseable,
  'pdf-version': checkPdfVersion,
  'pdf-not-encrypted': checkNotEncrypted,
  'pdf-fonts-embedded': checkFontsEmbedded,
  'pdf-a-compliance': checkPdfACompliance,
  'pdf-page-count': checkPageCount,
  'ectd-bookmark-depth': checkBookmarkDepth,
  'ectd-bookmarks-exist': checkBookmarksExist,
  'ectd-file-naming': checkFileNaming,
  'ectd-page-size': checkPageSize,
  'ectd-external-hyperlinks': checkExternalHyperlinks,
  'ectd-document-title': checkDocumentTitle,
  'ectd-no-javascript': checkNoJavaScript,
};

/**
 * Get a check function by its identifier
 * @param checkFn - The check function identifier from the validation rule
 * @returns The check function, or undefined if not found
 */
export function getCheckFunction(checkFn: string): CheckFunction | undefined {
  return checkRegistry[checkFn];
}

/**
 * Check if a check function exists in the registry
 * @param checkFn - The check function identifier
 * @returns True if the function exists
 */
export function hasCheckFunction(checkFn: string): boolean {
  return checkFn in checkRegistry;
}

/**
 * Get all available check function identifiers
 * @returns Array of check function identifiers
 */
export function getAvailableCheckFunctions(): string[] {
  return Object.keys(checkRegistry);
}

// Re-export check result type
export type { CheckResult as ValidationCheckResult };
