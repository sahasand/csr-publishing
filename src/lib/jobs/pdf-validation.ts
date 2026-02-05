/**
 * PDF Validation Job Processor
 *
 * Validates PDF documents for eCTD compliance using the validation runner.
 * This job processor delegates to the validation runner service which:
 * - Fetches validation rules from the database
 * - Executes check functions for each rule
 * - Stores results in the ValidationResult table
 * - Updates document status and metadata
 */

import { runValidationAndUpdateStatus, type ValidationSummary } from '@/lib/validation/runner';
import type { PDFValidationResultData } from '@/types/jobs';

/**
 * Validates a PDF document and stores results in the database
 *
 * @param documentId - The document ID in the database
 * @param filePath - Relative path to the PDF file (unused, kept for API compatibility)
 * @returns Validation result data
 */
export async function validatePDF(
  documentId: string,
  _filePath: string
): Promise<PDFValidationResultData> {
  try {
    // Run validation using the new runner service
    const summary: ValidationSummary = await runValidationAndUpdateStatus(documentId);

    // Convert summary to legacy result format
    const hasErrors = summary.errors > 0;
    const errors = summary.results
      .filter((r) => !r.passed && r.severity === 'ERROR')
      .map((r) => r.message);
    const warnings = summary.results
      .filter((r) => !r.passed && r.severity === 'WARNING')
      .map((r) => r.message);

    return {
      isValid: !hasErrors,
      pageCount: summary.metadata?.pageCount,
      pdfVersion: summary.metadata?.pdfVersion,
      isPdfA: summary.metadata?.isPdfA,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during PDF validation';
    return {
      isValid: false,
      errors: [errorMessage],
    };
  }
}
