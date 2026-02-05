/**
 * Validation Runner Service
 *
 * Main entry point for running validation on documents.
 * Fetches rules from the database, executes check functions,
 * and stores results.
 */

import { Prisma, ValidationSeverity } from '@/generated/prisma/client';
import { db } from '@/lib/db';
import { getFullPath } from '@/lib/storage';
import { getCheckFunction, type CheckResult } from './checks';

/**
 * Individual validation result item for the summary
 */
export interface ValidationResultItem {
  ruleId: string;
  ruleName: string;
  passed: boolean;
  message: string;
  severity: ValidationSeverity;
  details?: Record<string, unknown>;
}

/**
 * Summary of validation execution
 */
export interface ValidationSummary {
  /** Number of checks that passed */
  passed: number;
  /** Number of checks that failed */
  failed: number;
  /** Number of warnings (failed checks with WARNING severity) */
  warnings: number;
  /** Number of errors (failed checks with ERROR severity) */
  errors: number;
  /** Detailed results for all checks */
  results: ValidationResultItem[];
  /** Metadata extracted during validation */
  metadata?: {
    pageCount?: number;
    pdfVersion?: string;
    isPdfA?: boolean;
    fileSize?: number;
  };
}

/**
 * Run validation on a document
 *
 * @param documentId - The document ID in the database
 * @returns Validation summary with pass/fail counts and detailed results
 */
export async function runValidation(documentId: string): Promise<ValidationSummary> {
  // Fetch document with slot information (for document type)
  const document = await db.document.findUnique({
    where: { id: documentId },
    include: {
      slot: true,
    },
  });

  if (!document) {
    throw new Error(`Document not found: ${documentId}`);
  }

  // Get the full file path
  const filePath = getFullPath(document.sourcePath);

  // Fetch active validation rules
  // In the future, we can filter by document type or slot's validationRules
  const rules = await db.validationRule.findMany({
    where: {
      isActive: true,
    },
    orderBy: [
      { category: 'asc' },
      { name: 'asc' },
    ],
  });

  const results: ValidationResultItem[] = [];
  let passedCount = 0;
  let failedCount = 0;
  let warningCount = 0;
  let errorCount = 0;

  // Metadata to extract during validation
  const metadata: ValidationSummary['metadata'] = {};

  // Execute each rule
  for (const rule of rules) {
    const checkFn = getCheckFunction(rule.checkFn);

    let checkResult: CheckResult;

    if (!checkFn) {
      // Unknown check function - record as failed
      checkResult = {
        passed: false,
        message: `Unknown check function: ${rule.checkFn}`,
        details: { checkFn: rule.checkFn },
      };
    } else {
      try {
        // Execute the check function with rule params (stored as JSON string)
        const params = rule.params ? JSON.parse(rule.params) : {};
        checkResult = await checkFn(filePath, params);
      } catch (error) {
        // Check function threw an error
        checkResult = {
          passed: false,
          message: `Check failed with error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          details: { error: String(error) },
        };
      }
    }

    // Extract metadata from check results
    if (checkResult.details) {
      if ('pageCount' in checkResult.details && typeof checkResult.details.pageCount === 'number') {
        metadata.pageCount = checkResult.details.pageCount;
      }
      if ('version' in checkResult.details && typeof checkResult.details.version === 'string') {
        metadata.pdfVersion = checkResult.details.version;
      }
      if ('isPdfA' in checkResult.details && typeof checkResult.details.isPdfA === 'boolean') {
        metadata.isPdfA = checkResult.details.isPdfA;
      }
      if ('fileSize' in checkResult.details && typeof checkResult.details.fileSize === 'number') {
        metadata.fileSize = checkResult.details.fileSize;
      }
    }

    // Build result item
    const resultItem: ValidationResultItem = {
      ruleId: rule.id,
      ruleName: rule.name,
      passed: checkResult.passed,
      message: checkResult.message,
      severity: rule.severity,
      details: checkResult.details,
    };

    results.push(resultItem);

    // Update counts
    if (checkResult.passed) {
      passedCount++;
    } else {
      failedCount++;
      if (rule.severity === 'WARNING') {
        warningCount++;
      } else if (rule.severity === 'ERROR') {
        errorCount++;
      }
    }
  }

  // Store results in database (atomically delete old results and create new ones)
  await db.$transaction(async (tx) => {
    // Delete existing validation results for this document
    await tx.validationResult.deleteMany({
      where: { documentId },
    });

    // Create new validation results
    if (results.length > 0) {
      await tx.validationResult.createMany({
        data: results.map((result) => ({
          documentId,
          ruleId: result.ruleId,
          ruleName: result.ruleName,
          passed: result.passed,
          message: result.message,
          details: result.details
            ? (result.details as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        })),
      });
    }
  });

  return {
    passed: passedCount,
    failed: failedCount,
    warnings: warningCount,
    errors: errorCount,
    results,
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
  };
}

/**
 * Run validation and update document status
 *
 * This is the main entry point for the validation job processor.
 * It runs validation and updates the document's status and metadata.
 *
 * @param documentId - The document ID in the database
 * @returns Validation summary
 */
export async function runValidationAndUpdateStatus(
  documentId: string
): Promise<ValidationSummary> {
  // Update document status to PROCESSING
  await db.document.update({
    where: { id: documentId },
    data: { status: 'PROCESSING' },
  });

  try {
    // Run validation
    const summary = await runValidation(documentId);

    // Determine final status based on results
    const hasErrors = summary.errors > 0;
    const newStatus = hasErrors ? 'PROCESSING_FAILED' : 'PROCESSED';

    // Build error message if there are failures
    let processingError: string | null = null;
    if (summary.failed > 0) {
      const errorMessages = summary.results
        .filter((r) => !r.passed && r.severity === 'ERROR')
        .map((r) => r.message);
      const warningMessages = summary.results
        .filter((r) => !r.passed && r.severity === 'WARNING')
        .map((r) => r.message);

      const parts: string[] = [];
      if (errorMessages.length > 0) {
        parts.push(errorMessages.join('; '));
      }
      if (warningMessages.length > 0) {
        parts.push(`Warnings: ${warningMessages.join('; ')}`);
      }
      processingError = parts.join(' | ');
    }

    // Update document with metadata and status
    await db.document.update({
      where: { id: documentId },
      data: {
        status: newStatus,
        processingError,
        ...(summary.metadata?.pageCount !== undefined && { pageCount: summary.metadata.pageCount }),
        ...(summary.metadata?.pdfVersion !== undefined && { pdfVersion: summary.metadata.pdfVersion }),
        ...(summary.metadata?.isPdfA !== undefined && { isPdfA: summary.metadata.isPdfA }),
        ...(summary.metadata?.fileSize !== undefined && { fileSize: summary.metadata.fileSize }),
      },
    });

    return summary;
  } catch (error) {
    // Update document status to failed
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during validation';
    await db.document.update({
      where: { id: documentId },
      data: {
        status: 'PROCESSING_FAILED',
        processingError: errorMessage,
      },
    });

    throw error;
  }
}
