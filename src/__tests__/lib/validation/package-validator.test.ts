/**
 * Tests for Package-Level Validator
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validatePackage,
  formatValidationReport,
  serializeValidationReport,
  type PackageValidationReport,
} from '@/lib/validation/package-validator';
import type { PackageManifest, PackageFile, ReadinessCheck } from '@/lib/packaging/types';

// Mock the storage module
vi.mock('@/lib/storage', () => ({
  getFullPath: (path: string) => `/uploads/${path}`,
}));

// Mock the check functions
vi.mock('@/lib/validation/checks', () => ({
  getCheckFunction: (name: string) => {
    // Return mock check functions
    const mockChecks: Record<string, (path: string, params: Record<string, unknown>) => Promise<{ passed: boolean; message: string; details?: Record<string, unknown> }>> = {
      checkFileSize: async () => ({ passed: true, message: 'File size OK', details: { fileSize: 1024 } }),
      checkPdfParseable: async () => ({ passed: true, message: 'PDF is parseable' }),
      checkPdfVersion: async () => ({ passed: true, message: 'PDF version is 1.7', details: { version: '1.7' } }),
      checkNotEncrypted: async () => ({ passed: true, message: 'PDF is not encrypted' }),
      checkFileNaming: async (path: string) => {
        const hasSpaces = path.includes(' ');
        return hasSpaces
          ? { passed: false, message: 'Filename contains spaces' }
          : { passed: true, message: 'Filename is valid' };
      },
      checkNoJavaScript: async () => ({ passed: true, message: 'No JavaScript found' }),
    };
    return mockChecks[name];
  },
  hasCheckFunction: (name: string) => true,
  getAvailableCheckFunctions: () => ['checkFileSize', 'checkPdfParseable', 'checkPdfVersion'],
}));

// Note: We skip file access checks in tests using skipFileAccess option
// This avoids needing to mock fs/promises which is problematic in vitest browser env

/**
 * Create a mock package manifest
 */
function createMockManifest(overrides: Partial<PackageManifest> = {}): PackageManifest {
  const defaultReadiness: ReadinessCheck = {
    ready: true,
    missingRequired: [],
    pendingApproval: [],
    validationErrors: 0,
    unresolvedAnnotations: 0,
    totalFiles: 2,
    totalRequiredNodes: 5,
  };

  const defaultFiles: PackageFile[] = [
    {
      sourceDocumentId: 'doc-1',
      sourcePath: 'studies/study-1/protocol.pdf',
      targetPath: 'm5/53-csr/protocol.pdf',
      nodeCode: '5.3',
      nodeTitle: 'Clinical Study Reports',
      fileName: 'protocol.pdf',
      version: 1,
      pageCount: 100,
      fileSize: 1024000,
    },
    {
      sourceDocumentId: 'doc-2',
      sourcePath: 'studies/study-1/synopsis.pdf',
      targetPath: 'm2/27-clin-summ/synopsis.pdf',
      nodeCode: '2.7',
      nodeTitle: 'Clinical Summary',
      fileName: 'synopsis.pdf',
      version: 1,
      pageCount: 20,
      fileSize: 512000,
    },
  ];

  return {
    studyId: 'study-1',
    studyNumber: 'STUDY-001',
    generatedAt: new Date(),
    files: defaultFiles,
    readiness: defaultReadiness,
    folderStructure: [],
    ...overrides,
  };
}

describe('package-validator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validatePackage', () => {
    it('should validate a valid package successfully', async () => {
      const manifest = createMockManifest();
      const report = await validatePackage(manifest, { skipFileAccess: true });

      expect(report.valid).toBe(true);
      expect(report.ready).toBe(true);
      expect(report.studyId).toBe('study-1');
      expect(report.studyNumber).toBe('STUDY-001');
      expect(report.summary.totalFiles).toBe(2);
    });

    it('should report errors for missing required documents', async () => {
      const manifest = createMockManifest({
        readiness: {
          ready: false,
          missingRequired: [
            { code: '5.3.1', title: 'Protocol', nodeId: 'node-1' },
          ],
          pendingApproval: [],
          validationErrors: 0,
          unresolvedAnnotations: 0,
          totalFiles: 1,
          totalRequiredNodes: 5,
        },
      });

      const report = await validatePackage(manifest, { skipFileAccess: true });

      expect(report.valid).toBe(false);
      expect(report.summary.errorCount).toBeGreaterThan(0);
      expect(report.packageIssues.some((i) => i.check === 'missing-required')).toBe(true);
    });

    it('should report error for empty package', async () => {
      const manifest = createMockManifest({ files: [] });
      const report = await validatePackage(manifest, { skipFileAccess: true });

      expect(report.valid).toBe(false);
      expect(report.packageIssues.some((i) => i.check === 'package-empty')).toBe(true);
    });

    it('should report error for validation errors in documents', async () => {
      const manifest = createMockManifest({
        readiness: {
          ready: false,
          missingRequired: [],
          pendingApproval: [],
          validationErrors: 3,
          unresolvedAnnotations: 0,
          totalFiles: 2,
          totalRequiredNodes: 5,
        },
      });

      const report = await validatePackage(manifest, { skipFileAccess: true });

      expect(report.valid).toBe(false);
      expect(report.packageIssues.some((i) => i.check === 'document-validation-errors')).toBe(true);
    });

    it('should report warning for unresolved annotations', async () => {
      const manifest = createMockManifest({
        readiness: {
          ready: false,
          missingRequired: [],
          pendingApproval: [],
          validationErrors: 0,
          unresolvedAnnotations: 2,
          totalFiles: 2,
          totalRequiredNodes: 5,
        },
      });

      const report = await validatePackage(manifest, { skipFileAccess: true });

      // No errors, just warning
      expect(report.summary.warningCount).toBeGreaterThan(0);
      expect(report.packageIssues.some((i) => i.check === 'unresolved-annotations')).toBe(true);
    });

    it('should detect duplicate filenames', async () => {
      const manifest = createMockManifest({
        files: [
          {
            sourceDocumentId: 'doc-1',
            sourcePath: 'studies/study-1/protocol.pdf',
            targetPath: 'm5/53-csr/protocol.pdf',
            nodeCode: '5.3',
            nodeTitle: 'Clinical Study Reports',
            fileName: 'protocol.pdf',
            version: 1,
            fileSize: 1024000,
          },
          {
            sourceDocumentId: 'doc-2',
            sourcePath: 'studies/study-1/protocol-v2.pdf',
            targetPath: 'm5/53-csr/v2/protocol.pdf', // Same filename different path
            nodeCode: '5.3.1',
            nodeTitle: 'Protocol Amendment',
            fileName: 'protocol.pdf', // Duplicate
            version: 1,
            fileSize: 1024000,
          },
        ],
      });

      const report = await validatePackage(manifest, { skipFileAccess: true });

      expect(report.packageIssues.some((i) => i.check === 'duplicate-filenames')).toBe(true);
    });

    it('should warn about missing study number', async () => {
      const manifest = createMockManifest({ studyNumber: '' });
      const report = await validatePackage(manifest, { skipFileAccess: true });

      expect(report.packageIssues.some((i) => i.check === 'study-number')).toBe(true);
    });

    it('should report info for pending documents', async () => {
      const manifest = createMockManifest({
        readiness: {
          ready: true,
          missingRequired: [],
          pendingApproval: [
            {
              documentId: 'doc-3',
              fileName: 'draft.pdf',
              status: 'DRAFT',
              nodeCode: '5.3.2',
              nodeTitle: 'Draft Document',
            },
          ],
          validationErrors: 0,
          unresolvedAnnotations: 0,
          totalFiles: 2,
          totalRequiredNodes: 5,
        },
      });

      const report = await validatePackage(manifest, { skipFileAccess: true });

      expect(report.packageIssues.some((i) => i.check === 'pending-documents')).toBe(true);
      expect(report.summary.infoCount).toBeGreaterThan(0);
    });

    // Note: File accessibility tests are skipped in unit tests because
    // mocking fs/promises is problematic in vitest browser environment.
    // File access is tested via integration tests with real files.
    it.skip('should check file accessibility when not skipped', async () => {
      const manifest = createMockManifest({
        files: [
          {
            sourceDocumentId: 'doc-missing',
            sourcePath: 'studies/study-1/missing-file.pdf',
            targetPath: 'm5/53-csr/missing-file.pdf',
            nodeCode: '5.3',
            nodeTitle: 'Missing File',
            fileName: 'missing-file.pdf',
            version: 1,
            fileSize: 0,
          },
        ],
      });

      const report = await validatePackage(manifest, { skipFileAccess: false });

      expect(report.summary.inaccessibleFiles).toBe(1);
      expect(report.fileResults[0].accessible).toBe(false);
    });

    it('should skip cross-reference validation when option set', async () => {
      const manifest = createMockManifest();
      const report = await validatePackage(manifest, {
        skipFileAccess: true,
        skipCrossReferences: true,
      });

      expect(report.crossReferences.totalLinks).toBe(0);
    });

    it('should allow adding additional checks', async () => {
      const manifest = createMockManifest();
      const report = await validatePackage(manifest, {
        skipFileAccess: true,
        additionalChecks: ['checkBookmarkDepth'],
      });

      // Should have validated with default + additional checks
      expect(report.valid).toBe(true);
    });

    it('should allow skipping specific checks', async () => {
      const manifest = createMockManifest();
      const report = await validatePackage(manifest, {
        skipFileAccess: true,
        skipChecks: ['checkFileSize'],
      });

      expect(report.valid).toBe(true);
    });
  });

  describe('formatValidationReport', () => {
    it('should format a valid report', async () => {
      const manifest = createMockManifest();
      const report = await validatePackage(manifest, { skipFileAccess: true });
      const formatted = formatValidationReport(report);

      expect(formatted).toContain('eCTD Package Validation Report');
      expect(formatted).toContain('STUDY-001');
      expect(formatted).toContain('VALID');
      expect(formatted).toContain('READY');
    });

    it('should format an invalid report with errors', async () => {
      const manifest = createMockManifest({
        files: [],
        readiness: {
          ready: false,
          missingRequired: [{ code: '5.3', title: 'CSR', nodeId: 'n1' }],
          pendingApproval: [],
          validationErrors: 0,
          unresolvedAnnotations: 0,
          totalFiles: 0,
          totalRequiredNodes: 5,
        },
      });

      const report = await validatePackage(manifest, { skipFileAccess: true });
      const formatted = formatValidationReport(report);

      expect(formatted).toContain('INVALID');
      expect(formatted).toContain('NOT READY');
      expect(formatted).toContain('ERRORS:');
    });
  });

  describe('serializeValidationReport', () => {
    it('should serialize report to JSON-friendly format', async () => {
      const manifest = createMockManifest();
      const report = await validatePackage(manifest, { skipFileAccess: true });
      const serialized = serializeValidationReport(report);

      expect(serialized.valid).toBe(true);
      expect(serialized.studyNumber).toBe('STUDY-001');
      expect(typeof serialized.validatedAt).toBe('string');
      expect(serialized.issueCount).toBeDefined();
    });

    it('should include file results without full issue details', async () => {
      const manifest = createMockManifest();
      const report = await validatePackage(manifest, { skipFileAccess: true });
      const serialized = serializeValidationReport(report);

      expect(Array.isArray(serialized.fileResults)).toBe(true);
      const fileResults = serialized.fileResults as Array<{ filePath: string }>;
      expect(fileResults.length).toBe(2);
      expect(fileResults[0].filePath).toBeDefined();
    });
  });

  describe('file validation', () => {
    it('should run all default checks on each file', async () => {
      const manifest = createMockManifest();
      const report = await validatePackage(manifest, { skipFileAccess: true });

      // Each file should have been validated
      expect(report.fileResults.length).toBe(2);
      expect(report.fileResults[0].filePath).toBe('m5/53-csr/protocol.pdf');
      expect(report.fileResults[1].filePath).toBe('m2/27-clin-summ/synopsis.pdf');
    });

    it('should report check failures as issues', async () => {
      // Mock a file with spaces (should fail checkFileNaming)
      const manifest = createMockManifest({
        files: [
          {
            sourceDocumentId: 'doc-bad',
            sourcePath: 'studies/study-1/bad file.pdf',
            targetPath: 'm5/53-csr/bad file.pdf',
            nodeCode: '5.3',
            nodeTitle: 'Bad Filename',
            fileName: 'bad file.pdf',
            version: 1,
            fileSize: 1024,
          },
        ],
      });

      const report = await validatePackage(manifest, { skipFileAccess: true });

      expect(report.fileResults[0].issues.length).toBeGreaterThan(0);
      expect(report.fileResults[0].issues.some((i) => i.check === 'checkFileNaming')).toBe(true);
    });
  });
});
