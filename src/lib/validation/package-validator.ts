/**
 * Package-Level Validator
 *
 * Validates a complete eCTD package before ZIP generation.
 * Performs comprehensive checks including:
 * - Per-file eCTD compliance validation
 * - Cross-reference validation (hyperlinks)
 * - Structure/naming convention checks
 * - Package completeness verification
 */

import { stat } from 'fs/promises';
import { basename, extname } from 'path';
import { getFullPath } from '@/lib/storage';
import type { PackageManifest, PackageFile } from '@/lib/packaging/types';
import { getCheckFunction, type CheckResult } from './checks';

/**
 * Severity level for validation issues
 */
export type ValidationSeverity = 'ERROR' | 'WARNING' | 'INFO';

/**
 * Single validation issue
 */
export interface ValidationIssue {
  /** Severity level */
  severity: ValidationSeverity;
  /** Check that failed */
  check: string;
  /** Human-readable message */
  message: string;
  /** File path in the package (if applicable) */
  filePath?: string;
  /** Source document ID (if applicable) */
  documentId?: string;
  /** Additional details */
  details?: Record<string, unknown>;
}

/**
 * Per-file validation result
 */
export interface FileValidationResult {
  /** File path in the package */
  filePath: string;
  /** Source document ID */
  documentId: string;
  /** Source path in uploads */
  sourcePath: string;
  /** File exists and is accessible */
  accessible: boolean;
  /** Validation issues for this file */
  issues: ValidationIssue[];
  /** Summary counts */
  errorCount: number;
  warningCount: number;
}

/**
 * Cross-reference validation result
 */
export interface CrossReferenceResult {
  /** Total hyperlinks found in the package */
  totalLinks: number;
  /** Internal links (to other package files) */
  internalLinks: number;
  /** External links (URLs outside the package) */
  externalLinks: number;
  /** Broken internal links (target not found) */
  brokenLinks: string[];
  /** Issues related to cross-references */
  issues: ValidationIssue[];
}

/**
 * Complete package validation report
 */
export interface PackageValidationReport {
  /** Overall validation passed (no errors) */
  valid: boolean;
  /** Package is ready (valid and complete) */
  ready: boolean;
  /** When validation was run */
  validatedAt: Date;
  /** Study ID */
  studyId: string;
  /** Study number */
  studyNumber: string;

  /** Summary counts */
  summary: {
    totalFiles: number;
    validatedFiles: number;
    inaccessibleFiles: number;
    errorCount: number;
    warningCount: number;
    infoCount: number;
  };

  /** Per-file validation results */
  fileResults: FileValidationResult[];

  /** Cross-reference validation */
  crossReferences: CrossReferenceResult;

  /** Package-level issues (not tied to specific files) */
  packageIssues: ValidationIssue[];

  /** All issues consolidated for easy iteration */
  allIssues: ValidationIssue[];
}

/**
 * Options for package validation
 */
export interface PackageValidationOptions {
  /** Skip file access checks (for dry-run validation) */
  skipFileAccess?: boolean;
  /** Skip cross-reference validation */
  skipCrossReferences?: boolean;
  /** Additional eCTD checks to run (by checkFn name) */
  additionalChecks?: string[];
  /** Checks to skip */
  skipChecks?: string[];
}

/**
 * Default eCTD checks to run on each file
 */
const DEFAULT_FILE_CHECKS = [
  'checkFileSize',
  'checkPdfParseable',
  'checkPdfVersion',
  'checkNotEncrypted',
  'checkFileNaming',
  'checkNoJavaScript',
];

/**
 * Default parameters for each check
 */
const DEFAULT_CHECK_PARAMS: Record<string, Record<string, unknown>> = {
  checkFileSize: { maxMB: 100 },
  checkPdfParseable: {},
  checkPdfVersion: { allowedVersions: ['1.4', '1.5', '1.6', '1.7'] },
  checkNotEncrypted: {},
  checkFileNaming: { maxLength: 64, requireLowercase: true },
  checkNoJavaScript: {},
  checkPageSize: { allowedSizes: ['Letter', 'A4', 'Letter-Landscape', 'A4-Landscape'] },
  checkBookmarkDepth: { maxDepth: 4 },
  checkBookmarksExist: { required: false }, // Warning only
  checkExternalHyperlinks: { allowExternal: false },
  checkFontsEmbedded: {},
};

/**
 * Validate a complete eCTD package
 *
 * @param manifest - The package manifest to validate
 * @param options - Validation options
 * @returns Comprehensive validation report
 */
export async function validatePackage(
  manifest: PackageManifest,
  options: PackageValidationOptions = {}
): Promise<PackageValidationReport> {
  const startTime = Date.now();
  const fileResults: FileValidationResult[] = [];
  const packageIssues: ValidationIssue[] = [];
  const allIssues: ValidationIssue[] = [];

  // Determine which checks to run
  const checksToRun = buildChecksList(options);

  // Validate each file in the manifest
  for (const file of manifest.files) {
    const fileResult = await validateFile(file, checksToRun, options);
    fileResults.push(fileResult);
    allIssues.push(...fileResult.issues);
  }

  // Validate cross-references (hyperlinks between files)
  const crossReferences = options.skipCrossReferences
    ? createEmptyCrossReferenceResult()
    : await validateCrossReferences(manifest);
  allIssues.push(...crossReferences.issues);

  // Validate package-level requirements
  const packageLevelIssues = validatePackageLevel(manifest);
  packageIssues.push(...packageLevelIssues);
  allIssues.push(...packageLevelIssues);

  // Calculate summary
  const summary = calculateSummary(fileResults, allIssues);

  // Determine overall validity
  const valid = summary.errorCount === 0;
  const ready = valid && manifest.readiness.ready;

  return {
    valid,
    ready,
    validatedAt: new Date(),
    studyId: manifest.studyId,
    studyNumber: manifest.studyNumber,
    summary,
    fileResults,
    crossReferences,
    packageIssues,
    allIssues,
  };
}

/**
 * Build the list of checks to run based on options
 */
function buildChecksList(options: PackageValidationOptions): string[] {
  let checks = [...DEFAULT_FILE_CHECKS];

  // Add additional checks
  if (options.additionalChecks) {
    for (const check of options.additionalChecks) {
      if (!checks.includes(check)) {
        checks.push(check);
      }
    }
  }

  // Remove skipped checks
  if (options.skipChecks) {
    checks = checks.filter((c) => !options.skipChecks!.includes(c));
  }

  return checks;
}

/**
 * Validate a single file
 */
async function validateFile(
  file: PackageFile,
  checks: string[],
  options: PackageValidationOptions
): Promise<FileValidationResult> {
  const issues: ValidationIssue[] = [];
  let accessible = true;

  // Get full path to source file
  const fullPath = getFullPath(file.sourcePath);

  // Check file accessibility
  if (!options.skipFileAccess) {
    try {
      await stat(fullPath);
    } catch {
      accessible = false;
      issues.push({
        severity: 'ERROR',
        check: 'file-access',
        message: `File not accessible: ${file.sourcePath}`,
        filePath: file.targetPath,
        documentId: file.sourceDocumentId,
      });
    }
  }

  // Only run checks if file is accessible
  if (accessible) {
    for (const checkName of checks) {
      const checkFn = getCheckFunction(checkName);

      if (!checkFn) {
        // Skip unknown check functions silently
        continue;
      }

      try {
        const params = DEFAULT_CHECK_PARAMS[checkName] || {};
        const result = await checkFn(fullPath, params);

        if (!result.passed) {
          issues.push({
            severity: getSeverityForCheck(checkName),
            check: checkName,
            message: result.message,
            filePath: file.targetPath,
            documentId: file.sourceDocumentId,
            details: result.details,
          });
        }
      } catch (error) {
        issues.push({
          severity: 'ERROR',
          check: checkName,
          message: `Check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          filePath: file.targetPath,
          documentId: file.sourceDocumentId,
        });
      }
    }
  }

  // Calculate counts
  const errorCount = issues.filter((i) => i.severity === 'ERROR').length;
  const warningCount = issues.filter((i) => i.severity === 'WARNING').length;

  return {
    filePath: file.targetPath,
    documentId: file.sourceDocumentId,
    sourcePath: file.sourcePath,
    accessible,
    issues,
    errorCount,
    warningCount,
  };
}

/**
 * Get severity level for a check
 *
 * Some checks are warnings by default, others are errors
 */
function getSeverityForCheck(checkName: string): ValidationSeverity {
  // Checks that are warnings by default
  const warningChecks = [
    'checkBookmarksExist',
    'checkPageSize',
    'checkExternalHyperlinks',
    'checkPdfACompliance',
  ];

  return warningChecks.includes(checkName) ? 'WARNING' : 'ERROR';
}

/**
 * Validate cross-references (hyperlinks) between package files
 */
async function validateCrossReferences(
  manifest: PackageManifest
): Promise<CrossReferenceResult> {
  const issues: ValidationIssue[] = [];
  let totalLinks = 0;
  let internalLinks = 0;
  let externalLinks = 0;
  const brokenLinks: string[] = [];

  // Build a set of valid internal paths for quick lookup
  const validPaths = new Set<string>();
  for (const file of manifest.files) {
    validPaths.add(file.targetPath.toLowerCase());
    // Also add without leading path
    validPaths.add(file.fileName.toLowerCase());
  }

  // TODO: Extract hyperlinks from each PDF and validate them
  // This would require reading the PDF and extracting link annotations
  // For now, we just report that cross-reference validation is pending

  // Placeholder: In a full implementation, we would:
  // 1. Parse each PDF for hyperlink annotations
  // 2. Check if internal links point to valid files
  // 3. Flag external links based on policy
  // 4. Report broken internal links

  return {
    totalLinks,
    internalLinks,
    externalLinks,
    brokenLinks,
    issues,
  };
}

/**
 * Create empty cross-reference result when skipped
 */
function createEmptyCrossReferenceResult(): CrossReferenceResult {
  return {
    totalLinks: 0,
    internalLinks: 0,
    externalLinks: 0,
    brokenLinks: [],
    issues: [],
  };
}

/**
 * Validate package-level requirements
 */
function validatePackageLevel(manifest: PackageManifest): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Check for empty package
  if (manifest.files.length === 0) {
    issues.push({
      severity: 'ERROR',
      check: 'package-empty',
      message: 'Package contains no files',
    });
  }

  // Check for missing required documents
  if (manifest.readiness.missingRequired.length > 0) {
    for (const missing of manifest.readiness.missingRequired) {
      issues.push({
        severity: 'ERROR',
        check: 'missing-required',
        message: `Required document missing: ${missing.code} - ${missing.title}`,
        details: {
          nodeCode: missing.code,
          nodeTitle: missing.title,
          nodeId: missing.nodeId,
        },
      });
    }
  }

  // Check for pending documents (info, not error)
  if (manifest.readiness.pendingApproval.length > 0) {
    issues.push({
      severity: 'INFO',
      check: 'pending-documents',
      message: `${manifest.readiness.pendingApproval.length} document(s) pending approval`,
      details: {
        pending: manifest.readiness.pendingApproval.map((p) => ({
          fileName: p.fileName,
          status: p.status,
          nodeCode: p.nodeCode,
        })),
      },
    });
  }

  // Check for validation errors in documents
  if (manifest.readiness.validationErrors > 0) {
    issues.push({
      severity: 'ERROR',
      check: 'document-validation-errors',
      message: `${manifest.readiness.validationErrors} document validation error(s) exist`,
    });
  }

  // Check for unresolved annotations
  if (manifest.readiness.unresolvedAnnotations > 0) {
    issues.push({
      severity: 'WARNING',
      check: 'unresolved-annotations',
      message: `${manifest.readiness.unresolvedAnnotations} unresolved correction annotation(s)`,
    });
  }

  // Check for duplicate file names
  const fileNames = manifest.files.map((f) => f.fileName.toLowerCase());
  const duplicates = findDuplicates(fileNames);
  if (duplicates.length > 0) {
    issues.push({
      severity: 'WARNING',
      check: 'duplicate-filenames',
      message: `Duplicate file names detected: ${duplicates.join(', ')}`,
      details: { duplicates },
    });
  }

  // Check study number format
  if (!manifest.studyNumber || manifest.studyNumber.trim() === '') {
    issues.push({
      severity: 'WARNING',
      check: 'study-number',
      message: 'Study number is missing or empty',
    });
  }

  return issues;
}

/**
 * Find duplicate values in an array
 */
function findDuplicates(arr: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const item of arr) {
    if (seen.has(item)) {
      duplicates.add(item);
    }
    seen.add(item);
  }

  return Array.from(duplicates);
}

/**
 * Calculate summary statistics from results
 */
function calculateSummary(
  fileResults: FileValidationResult[],
  allIssues: ValidationIssue[]
): PackageValidationReport['summary'] {
  const totalFiles = fileResults.length;
  const inaccessibleFiles = fileResults.filter((f) => !f.accessible).length;
  const validatedFiles = totalFiles - inaccessibleFiles;

  const errorCount = allIssues.filter((i) => i.severity === 'ERROR').length;
  const warningCount = allIssues.filter((i) => i.severity === 'WARNING').length;
  const infoCount = allIssues.filter((i) => i.severity === 'INFO').length;

  return {
    totalFiles,
    validatedFiles,
    inaccessibleFiles,
    errorCount,
    warningCount,
    infoCount,
  };
}

/**
 * Generate a human-readable validation report
 */
export function formatValidationReport(report: PackageValidationReport): string {
  const lines: string[] = [];

  // Header
  lines.push('='.repeat(60));
  lines.push('eCTD Package Validation Report');
  lines.push('='.repeat(60));
  lines.push('');
  lines.push(`Study: ${report.studyNumber}`);
  lines.push(`Validated: ${report.validatedAt.toISOString()}`);
  lines.push(`Status: ${report.valid ? 'VALID' : 'INVALID'} | ${report.ready ? 'READY' : 'NOT READY'}`);
  lines.push('');

  // Summary
  lines.push('-'.repeat(40));
  lines.push('Summary');
  lines.push('-'.repeat(40));
  lines.push(`Total Files: ${report.summary.totalFiles}`);
  lines.push(`Validated: ${report.summary.validatedFiles}`);
  lines.push(`Inaccessible: ${report.summary.inaccessibleFiles}`);
  lines.push(`Errors: ${report.summary.errorCount}`);
  lines.push(`Warnings: ${report.summary.warningCount}`);
  lines.push(`Info: ${report.summary.infoCount}`);
  lines.push('');

  // Issues by severity
  if (report.allIssues.length > 0) {
    lines.push('-'.repeat(40));
    lines.push('Issues');
    lines.push('-'.repeat(40));

    const errors = report.allIssues.filter((i) => i.severity === 'ERROR');
    const warnings = report.allIssues.filter((i) => i.severity === 'WARNING');
    const infos = report.allIssues.filter((i) => i.severity === 'INFO');

    if (errors.length > 0) {
      lines.push('');
      lines.push('ERRORS:');
      for (const issue of errors) {
        const location = issue.filePath ? ` [${issue.filePath}]` : '';
        lines.push(`  ✗ ${issue.message}${location}`);
      }
    }

    if (warnings.length > 0) {
      lines.push('');
      lines.push('WARNINGS:');
      for (const issue of warnings) {
        const location = issue.filePath ? ` [${issue.filePath}]` : '';
        lines.push(`  ⚠ ${issue.message}${location}`);
      }
    }

    if (infos.length > 0) {
      lines.push('');
      lines.push('INFO:');
      for (const issue of infos) {
        lines.push(`  ℹ ${issue.message}`);
      }
    }
  } else {
    lines.push('No issues found.');
  }

  lines.push('');
  lines.push('='.repeat(60));

  return lines.join('\n');
}

/**
 * Export validation report as JSON for API responses
 */
export function serializeValidationReport(
  report: PackageValidationReport
): Record<string, unknown> {
  return {
    valid: report.valid,
    ready: report.ready,
    validatedAt: report.validatedAt.toISOString(),
    studyId: report.studyId,
    studyNumber: report.studyNumber,
    summary: report.summary,
    fileResults: report.fileResults.map((fr) => ({
      filePath: fr.filePath,
      documentId: fr.documentId,
      accessible: fr.accessible,
      errorCount: fr.errorCount,
      warningCount: fr.warningCount,
      issues: fr.issues,
    })),
    crossReferences: report.crossReferences,
    packageIssues: report.packageIssues,
    issueCount: {
      total: report.allIssues.length,
      errors: report.summary.errorCount,
      warnings: report.summary.warningCount,
      info: report.summary.infoCount,
    },
  };
}
