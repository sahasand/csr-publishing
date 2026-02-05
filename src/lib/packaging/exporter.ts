/**
 * Package Export Service
 *
 * Main orchestration service for exporting eCTD packages.
 * Coordinates assembly, validation, and ZIP generation.
 */

import { v4 as uuid } from 'uuid';
import { mkdir, rm, stat } from 'fs/promises';
import { join, normalize } from 'path';
import { assemblePackage, checkReadiness } from './assembler';
import { generateBookmarkManifest } from './bookmarks';
import { generateHyperlinkReport } from './hyperlinks';
import { generateExportArtifacts } from './zip-generator';
import { determineSubmissionType, type XmlGenerationOptions } from './xml-generator';
import { generateCoverPage } from './cover-page-generator';
import type { PackageManifest, XmlGenerationResult, CoverPageMetadata, CoverPageResult } from './types';
import { db } from '@/lib/db';
import {
  validatePackage,
  validateEctdXml,
  type PackageValidationReport,
} from '@/lib/validation';

/**
 * Export operation result
 */
export interface ExportResult {
  /** Whether the export succeeded */
  success: boolean;
  /** Unique package identifier */
  packageId: string;
  /** Path to the generated ZIP file */
  zipPath?: string;
  /** Size of the ZIP file in bytes */
  zipSize?: number;
  /** The assembled package manifest */
  manifest?: PackageManifest;
  /** XML generation result */
  xmlResult?: XmlGenerationResult;
  /** Sequence number used for export */
  sequenceNumber?: string;
  /** Package validation results (if validation was run) */
  validation?: {
    /** Package-level validation report */
    packageReport: PackageValidationReport;
    /** XML validation passed */
    xmlValid: boolean;
    /** Total validation errors */
    errorCount: number;
    /** Total validation warnings */
    warningCount: number;
  };
  /** Error message if export failed */
  error?: string;
}

/**
 * Options for package export
 */
export interface ExportOptions {
  /** Export even if readiness check fails */
  force?: boolean;
  /** Include JSON manifests in the ZIP archive */
  includeArtifacts?: boolean;
  /** Sequence number for the submission (e.g., "0000", "0001") */
  sequenceNumber?: string;
  /** Submission type override */
  submissionType?: 'original' | 'amendment' | 'supplement';
  /** Sponsor name override */
  sponsor?: string;
  /** Application number (NDA, IND, etc.) */
  applicationNumber?: string;
  /** Application type (e.g., "NDA", "IND") */
  applicationType?: string;
  /** Product name */
  productName?: string;
  /** Run pre-export validation (default: true) */
  runValidation?: boolean;
  /** Fail export if validation has errors (default: false, just includes report) */
  failOnValidationError?: boolean;
  /** Include hyperlinked cover page PDF (default: true) */
  includeCoverPage?: boolean;
}

// Base directory for exports (relative to project root)
const EXPORTS_DIR = process.env.EXPORTS_DIR || './exports';

/**
 * Export a study as an eCTD package
 *
 * Full export workflow:
 * 1. Check readiness (abort if not ready unless force=true)
 * 2. Fetch study metadata for XML generation
 * 3. Assemble package manifest
 * 4. Generate bookmark manifest
 * 5. Generate hyperlink report
 * 6. Generate eCTD XML backbone (index.xml, us-regional.xml)
 * 7. Create eCTD folder structure with files
 * 8. Generate supporting artifacts (JSON, CSV)
 * 9. Create ZIP archive
 * 10. Return result with path to ZIP
 *
 * @param studyId - The study database ID to export
 * @param options - Export options
 * @returns Export result with paths to generated files
 */
export async function exportPackage(
  studyId: string,
  options: ExportOptions = {}
): Promise<ExportResult> {
  const packageId = uuid();
  const exportDir = getExportDir(studyId, packageId);

  try {
    // 1. Check readiness
    const readiness = await checkReadiness(studyId);

    if (!readiness.ready && !options.force) {
      return {
        success: false,
        packageId,
        error: buildReadinessErrorMessage(readiness),
      };
    }

    // 2. Fetch study metadata for XML generation
    const study = await db.study.findUnique({
      where: { id: studyId },
      select: {
        sponsor: true,
        studyId: true,
        therapeuticArea: true,
      },
    });

    if (!study) {
      return {
        success: false,
        packageId,
        error: `Study not found: ${studyId}`,
      };
    }

    // 3. Assemble package manifest
    // When force=true, include drafts/processed documents too
    const manifest = await assemblePackage(studyId, {
      includeApproved: true,
      includePublished: true,
      includeDrafts: options.force ?? false,
    });

    // Check if there are any files to export
    if (manifest.files.length === 0) {
      return {
        success: false,
        packageId,
        error: 'No documents available for export',
      };
    }

    // Create export directory
    await mkdir(exportDir, { recursive: true });

    // 4. Generate bookmark manifest
    const bookmarks = await generateBookmarkManifest(manifest);

    // 5. Generate hyperlink report
    const hyperlinks = await generateHyperlinkReport(manifest);

    // Determine sequence number and submission type
    const sequenceNumber = options.sequenceNumber || '0000';
    const submissionType = options.submissionType || determineSubmissionType(sequenceNumber);

    // Build XML generation options
    const xmlOptions: XmlGenerationOptions = {
      sequence: {
        number: sequenceNumber,
        type: submissionType,
      },
      metadata: {
        sponsor: options.sponsor || study.sponsor,
        studyNumber: study.studyId,
        applicationNumber: options.applicationNumber,
        applicationType: options.applicationType,
        productName: options.productName,
        therapeuticArea: study.therapeuticArea || undefined,
        submissionDate: new Date(),
      },
    };

    // 6. Generate cover page (if enabled)
    let coverPageResult: CoverPageResult | undefined;
    if (options.includeCoverPage !== false && manifest.files.length > 0) {
      const coverMetadata: CoverPageMetadata = {
        studyNumber: study.studyId,
        sponsor: options.sponsor || study.sponsor,
        therapeuticArea: study.therapeuticArea || undefined,
        applicationNumber: options.applicationNumber,
        applicationType: options.applicationType,
        productName: options.productName,
        submissionType: submissionType.charAt(0).toUpperCase() + submissionType.slice(1),
        sequenceNumber,
        generatedAt: new Date(),
      };

      coverPageResult = await generateCoverPage(manifest, coverMetadata);
    }

    // 7-10. Generate all export artifacts (XML, structure, files, ZIP)
    const artifacts = await generateExportArtifacts(
      manifest,
      bookmarks,
      hyperlinks,
      exportDir,
      xmlOptions,
      coverPageResult
    );

    // 10. Run validation (default: true)
    let validation: ExportResult['validation'] | undefined;
    if (options.runValidation !== false) {
      // Package-level validation
      const packageReport = await validatePackage(manifest, {
        skipFileAccess: false, // Verify files exist
        skipCrossReferences: false,
      });

      // XML validation
      const xmlValidation = validateEctdXml(
        artifacts.xmlResult.indexXml,
        artifacts.xmlResult.regionalXml,
        { packageFiles: manifest.files }
      );

      validation = {
        packageReport,
        xmlValid: xmlValidation.combinedValid,
        errorCount: packageReport.summary.errorCount + xmlValidation.totalErrors,
        warningCount: packageReport.summary.warningCount + xmlValidation.totalWarnings,
      };

      // Fail export if validation errors and failOnValidationError is set
      if (options.failOnValidationError && validation.errorCount > 0) {
        return {
          success: false,
          packageId,
          manifest,
          xmlResult: artifacts.xmlResult,
          validation,
          error: `Export blocked: ${validation.errorCount} validation error(s)`,
        };
      }
    }

    // Get ZIP file size
    const zipStats = await stat(artifacts.packageZipPath);

    return {
      success: true,
      packageId,
      zipPath: artifacts.packageZipPath,
      zipSize: zipStats.size,
      manifest,
      xmlResult: artifacts.xmlResult,
      sequenceNumber,
      validation,
    };
  } catch (error) {
    // Clean up partial export on failure
    try {
      await cleanupExport(exportDir);
    } catch {
      // Ignore cleanup errors
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown export error';
    console.error(`[Exporter] Export failed for study ${studyId}:`, error);

    return {
      success: false,
      packageId,
      error: errorMessage,
    };
  }
}

/**
 * Build a descriptive error message from readiness check results
 */
function buildReadinessErrorMessage(readiness: {
  ready: boolean;
  missingRequired: { code: string; title: string }[];
  pendingApproval: { fileName: string; status: string }[];
  validationErrors: number;
  unresolvedAnnotations: number;
}): string {
  const issues: string[] = [];

  if (readiness.missingRequired.length > 0) {
    issues.push(
      `${readiness.missingRequired.length} required document(s) missing`
    );
  }

  if (readiness.validationErrors > 0) {
    issues.push(`${readiness.validationErrors} validation error(s)`);
  }

  if (readiness.unresolvedAnnotations > 0) {
    issues.push(
      `${readiness.unresolvedAnnotations} unresolved correction(s)`
    );
  }

  if (issues.length === 0) {
    return 'Package is not ready for export';
  }

  return `Package not ready: ${issues.join(', ')}`;
}

/**
 * Get export directory for a study
 *
 * Format: exports/{studyId}/{packageId}/
 *
 * @param studyId - The study database ID
 * @param packageId - Unique package identifier
 * @returns Absolute path to the export directory
 */
export function getExportDir(studyId: string, packageId: string): string {
  return join(EXPORTS_DIR, studyId, packageId);
}

/**
 * Clean up export directory after download or on failure
 *
 * Removes the entire export directory and all contents.
 *
 * @param exportDir - Path to the export directory to clean up
 */
export async function cleanupExport(exportDir: string): Promise<void> {
  // Validate export dir is within EXPORTS_DIR before deletion
  const normalizedPath = normalize(exportDir);
  const normalizedBase = normalize(EXPORTS_DIR);
  if (!normalizedPath.startsWith(normalizedBase)) {
    throw new Error('Cannot clean up directory outside exports folder');
  }

  try {
    await rm(exportDir, { recursive: true, force: true });
  } catch (error) {
    console.error(`[Exporter] Failed to cleanup export directory: ${exportDir}`, error);
    throw error;
  }
}

/**
 * Get the ZIP file path for a completed export
 *
 * @param studyId - The study database ID
 * @param packageId - Unique package identifier
 * @returns Path to the ZIP file
 */
export function getPackageZipPath(studyId: string, packageId: string): string {
  return join(getExportDir(studyId, packageId), 'package.zip');
}

/**
 * Check if an export exists
 *
 * @param studyId - The study database ID
 * @param packageId - Unique package identifier
 * @returns True if the export ZIP file exists
 */
export async function exportExists(
  studyId: string,
  packageId: string
): Promise<boolean> {
  const zipPath = getPackageZipPath(studyId, packageId);
  try {
    await stat(zipPath);
    return true;
  } catch {
    return false;
  }
}
