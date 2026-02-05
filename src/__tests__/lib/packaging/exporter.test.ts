import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Create hoisted mock functions that can be accessed inside vi.mock
const { mocks, mockFsPromises } = vi.hoisted(() => {
  const mockFns = {
    uuid: vi.fn(),
    mkdir: vi.fn(),
    rm: vi.fn(),
    stat: vi.fn(),
    checkReadiness: vi.fn(),
    assemblePackage: vi.fn(),
    generateBookmarkManifest: vi.fn(),
    generateHyperlinkReport: vi.fn(),
    generateExportArtifacts: vi.fn(),
    dbStudyFindUnique: vi.fn(),
  };

  // Create the fs/promises mock module structure
  const fsPromisesMock = {
    mkdir: mockFns.mkdir,
    rm: mockFns.rm,
    stat: mockFns.stat,
    writeFile: vi.fn(),
    readFile: vi.fn(),
    readdir: vi.fn(),
    unlink: vi.fn(),
    access: vi.fn(),
    chmod: vi.fn(),
    chown: vi.fn(),
    copyFile: vi.fn(),
    link: vi.fn(),
    lstat: vi.fn(),
    mkdtemp: vi.fn(),
    open: vi.fn(),
    opendir: vi.fn(),
    realpath: vi.fn(),
    rename: vi.fn(),
    rmdir: vi.fn(),
    symlink: vi.fn(),
    truncate: vi.fn(),
    utimes: vi.fn(),
    watch: vi.fn(),
    cp: vi.fn(),
    constants: {},
  };

  return { mocks: mockFns, mockFsPromises: fsPromisesMock };
});

// Mock uuid
vi.mock('uuid', () => ({
  v4: () => mocks.uuid(),
}));

// Mock fs/promises
vi.mock('fs/promises', () => ({
  ...mockFsPromises,
  default: mockFsPromises,
}));

// Mock assembler
vi.mock('@/lib/packaging/assembler', () => ({
  checkReadiness: () => mocks.checkReadiness(),
  assemblePackage: () => mocks.assemblePackage(),
}));

// Mock bookmarks
vi.mock('@/lib/packaging/bookmarks', () => ({
  generateBookmarkManifest: (manifest: unknown) => mocks.generateBookmarkManifest(manifest),
}));

// Mock hyperlinks
vi.mock('@/lib/packaging/hyperlinks', () => ({
  generateHyperlinkReport: (manifest: unknown) => mocks.generateHyperlinkReport(manifest),
}));

// Mock zip-generator
vi.mock('@/lib/packaging/zip-generator', () => ({
  generateExportArtifacts: (
    manifest: unknown,
    bookmarks: unknown,
    hyperlinks: unknown,
    exportDir: unknown,
    xmlOptions: unknown
  ) => mocks.generateExportArtifacts(manifest, bookmarks, hyperlinks, exportDir, xmlOptions),
}));

// Mock xml-generator
vi.mock('@/lib/packaging/xml-generator', () => ({
  determineSubmissionType: (seq: string) => seq === '0000' ? 'original' : 'amendment',
}));

// Mock db
vi.mock('@/lib/db', () => ({
  db: {
    study: {
      findUnique: () => mocks.dbStudyFindUnique(),
    },
  },
}));

// Import after mocks
import {
  exportPackage,
  getExportDir,
  cleanupExport,
  getPackageZipPath,
  exportExists,
} from '@/lib/packaging/exporter';
import type { PackageManifest, ReadinessCheck } from '@/lib/packaging/types';
import type { BookmarkManifest } from '@/lib/packaging/bookmarks';
import type { HyperlinkReport } from '@/lib/packaging/hyperlinks';

describe('exporter', () => {
  // Save original env
  const originalEnv = process.env.EXPORTS_DIR;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset EXPORTS_DIR to default
    delete process.env.EXPORTS_DIR;

    // Setup default mock implementations
    mocks.uuid.mockReturnValue('pkg-test-123');
    mocks.mkdir.mockResolvedValue(undefined);
    mocks.rm.mockResolvedValue(undefined);
    mocks.stat.mockResolvedValue({ size: 5000 });
    mocks.dbStudyFindUnique.mockResolvedValue({
      sponsor: 'Test Pharma Inc',
      studyId: 'ABC-123',
      therapeuticArea: 'Oncology',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Restore original env
    if (originalEnv) {
      process.env.EXPORTS_DIR = originalEnv;
    } else {
      delete process.env.EXPORTS_DIR;
    }
  });

  // Mock data factories
  const createMockReadiness = (overrides: Partial<ReadinessCheck> = {}): ReadinessCheck => ({
    ready: true,
    missingRequired: [],
    pendingApproval: [],
    validationErrors: 0,
    unresolvedAnnotations: 0,
    totalFiles: 2,
    totalRequiredNodes: 2,
    ...overrides,
  });

  const createMockManifest = (overrides: Partial<PackageManifest> = {}): PackageManifest => ({
    studyId: 'study-1',
    studyNumber: 'ABC-123',
    generatedAt: new Date('2024-01-15'),
    files: [
      {
        sourceDocumentId: 'doc-1',
        targetPath: 'm5/datasets/file1.pdf',
        sourcePath: 'uploads/file1.pdf',
        fileSize: 1000,
        nodeCode: '16.1',
        nodeTitle: 'Study Information',
        fileName: 'file1.pdf',
        version: 1,
      },
    ],
    folderStructure: [
      {
        name: 'm5',
        path: 'm5',
        files: [],
        children: [{ name: 'datasets', path: 'm5/datasets', files: [], children: [] }],
      },
    ],
    readiness: createMockReadiness(),
    ...overrides,
  });

  const createMockBookmarks = (overrides: Partial<BookmarkManifest> = {}): BookmarkManifest => ({
    rootBookmarks: [],
    documentBookmarks: [],
    totalCount: 5,
    maxDepth: 2,
    warnings: [],
    ...overrides,
  });

  const createMockHyperlinks = (overrides: Partial<HyperlinkReport> = {}): HyperlinkReport => ({
    totalLinks: 3,
    byType: { internal: 2, crossDocument: 1, external: 0, unknown: 0 },
    brokenLinks: [],
    externalLinks: [],
    validatedAt: new Date('2024-01-15'),
    warnings: [],
    ...overrides,
  });

  const createMockArtifacts = (exportDir: string) => ({
    packageZipPath: `${exportDir}/package.zip`,
    bookmarkManifestPath: `${exportDir}/bookmark-manifest.json`,
    hyperlinkReportPath: `${exportDir}/hyperlink-report.csv`,
    qcSummaryPath: `${exportDir}/qc-summary.json`,
    indexXmlPath: `${exportDir}/ectd/index.xml`,
    regionalXmlPath: `${exportDir}/ectd/us-regional.xml`,
    xmlResult: {
      indexXml: '<?xml version="1.0"?>',
      regionalXml: '<?xml version="1.0"?>',
      leafEntries: [],
      warnings: [],
    },
  });

  // Mock study data for db.study.findUnique
  const createMockStudy = () => ({
    sponsor: 'Test Pharma Inc',
    studyId: 'ABC-123',
    therapeuticArea: 'Oncology',
  });

  describe('exportPackage', () => {
    it('returns success with paths on successful export', async () => {
      const mockManifest = createMockManifest();
      const mockBookmarks = createMockBookmarks();
      const mockHyperlinks = createMockHyperlinks();

      mocks.checkReadiness.mockResolvedValue(createMockReadiness());
      mocks.assemblePackage.mockResolvedValue(mockManifest);
      mocks.generateBookmarkManifest.mockResolvedValue(mockBookmarks);
      mocks.generateHyperlinkReport.mockResolvedValue(mockHyperlinks);
      mocks.generateExportArtifacts.mockImplementation(
        (_manifest, _bookmarks, _hyperlinks, exportDir, _xmlOptions) =>
          Promise.resolve(createMockArtifacts(exportDir as string))
      );

      const result = await exportPackage('study-1');

      expect(result.success).toBe(true);
      expect(result.packageId).toBe('pkg-test-123');
      expect(result.zipPath).toContain('package.zip');
      expect(result.zipSize).toBe(5000);
      expect(result.manifest).toBe(mockManifest);
      expect(result.error).toBeUndefined();
    });

    it('returns error with issues when not ready and no force option', async () => {
      mocks.checkReadiness.mockResolvedValue(
        createMockReadiness({
          ready: false,
          missingRequired: [{ code: '16.1', title: 'Study Info', nodeId: 'node-1' }],
          validationErrors: 2,
        })
      );

      const result = await exportPackage('study-1');

      expect(result.success).toBe(false);
      expect(result.packageId).toBe('pkg-test-123');
      expect(result.error).toContain('not ready');
      expect(result.error).toContain('1 required document(s) missing');
      expect(result.error).toContain('2 validation error(s)');
      expect(result.zipPath).toBeUndefined();
    });

    it('proceeds with export when not ready but force=true', async () => {
      const mockManifest = createMockManifest();
      const mockBookmarks = createMockBookmarks();
      const mockHyperlinks = createMockHyperlinks();

      mocks.checkReadiness.mockResolvedValue(
        createMockReadiness({
          ready: false,
          missingRequired: [{ code: '16.1', title: 'Study Info', nodeId: 'node-1' }],
        })
      );
      mocks.assemblePackage.mockResolvedValue(mockManifest);
      mocks.generateBookmarkManifest.mockResolvedValue(mockBookmarks);
      mocks.generateHyperlinkReport.mockResolvedValue(mockHyperlinks);
      mocks.generateExportArtifacts.mockImplementation(
        (_manifest, _bookmarks, _hyperlinks, exportDir, _xmlOptions) =>
          Promise.resolve(createMockArtifacts(exportDir as string))
      );

      const result = await exportPackage('study-1', { force: true });

      expect(result.success).toBe(true);
      expect(result.zipPath).toContain('package.zip');
    });

    it('returns error when no files to export', async () => {
      const mockManifest = createMockManifest({ files: [] });

      mocks.checkReadiness.mockResolvedValue(createMockReadiness());
      mocks.assemblePackage.mockResolvedValue(mockManifest);

      const result = await exportPackage('study-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No documents available for export');
    });

    it('cleans up and returns error on assembly error', async () => {
      mocks.checkReadiness.mockResolvedValue(createMockReadiness());
      mocks.assemblePackage.mockRejectedValue(new Error('Assembly failed'));

      const result = await exportPackage('study-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Assembly failed');
      expect(mocks.rm).toHaveBeenCalled();
    });

    it('cleans up and returns error on bookmark generation error', async () => {
      const mockManifest = createMockManifest();

      mocks.checkReadiness.mockResolvedValue(createMockReadiness());
      mocks.assemblePackage.mockResolvedValue(mockManifest);
      mocks.generateBookmarkManifest.mockRejectedValue(new Error('Bookmark generation failed'));

      const result = await exportPackage('study-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Bookmark generation failed');
      expect(mocks.rm).toHaveBeenCalled();
    });

    it('cleans up and returns error on hyperlink generation error', async () => {
      const mockManifest = createMockManifest();
      const mockBookmarks = createMockBookmarks();

      mocks.checkReadiness.mockResolvedValue(createMockReadiness());
      mocks.assemblePackage.mockResolvedValue(mockManifest);
      mocks.generateBookmarkManifest.mockResolvedValue(mockBookmarks);
      mocks.generateHyperlinkReport.mockRejectedValue(new Error('Hyperlink validation failed'));

      const result = await exportPackage('study-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Hyperlink validation failed');
      expect(mocks.rm).toHaveBeenCalled();
    });

    it('cleans up and returns error on ZIP generation error', async () => {
      const mockManifest = createMockManifest();
      const mockBookmarks = createMockBookmarks();
      const mockHyperlinks = createMockHyperlinks();

      mocks.checkReadiness.mockResolvedValue(createMockReadiness());
      mocks.assemblePackage.mockResolvedValue(mockManifest);
      mocks.generateBookmarkManifest.mockResolvedValue(mockBookmarks);
      mocks.generateHyperlinkReport.mockResolvedValue(mockHyperlinks);
      mocks.generateExportArtifacts.mockRejectedValue(new Error('ZIP creation failed'));

      const result = await exportPackage('study-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('ZIP creation failed');
      expect(mocks.rm).toHaveBeenCalled();
    });

    it('swallows cleanup error and still returns main error', async () => {
      mocks.checkReadiness.mockResolvedValue(createMockReadiness());
      mocks.assemblePackage.mockRejectedValue(new Error('Assembly failed'));
      mocks.rm.mockRejectedValue(new Error('Cleanup failed'));

      const result = await exportPackage('study-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Assembly failed');
      // Should not throw due to cleanup error
    });

    it('includes unresolved annotations in error message', async () => {
      mocks.checkReadiness.mockResolvedValue(
        createMockReadiness({
          ready: false,
          unresolvedAnnotations: 3,
        })
      );

      const result = await exportPackage('study-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('3 unresolved correction(s)');
    });

    it('returns generic message when readiness fails but no specific issues', async () => {
      mocks.checkReadiness.mockResolvedValue(
        createMockReadiness({
          ready: false,
          missingRequired: [],
          validationErrors: 0,
          unresolvedAnnotations: 0,
        })
      );

      const result = await exportPackage('study-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Package is not ready for export');
    });

    it('creates export directory before generating artifacts', async () => {
      const mockManifest = createMockManifest();
      const mockBookmarks = createMockBookmarks();
      const mockHyperlinks = createMockHyperlinks();

      mocks.checkReadiness.mockResolvedValue(createMockReadiness());
      mocks.assemblePackage.mockResolvedValue(mockManifest);
      mocks.generateBookmarkManifest.mockResolvedValue(mockBookmarks);
      mocks.generateHyperlinkReport.mockResolvedValue(mockHyperlinks);
      mocks.generateExportArtifacts.mockImplementation(
        (_manifest, _bookmarks, _hyperlinks, exportDir, _xmlOptions) =>
          Promise.resolve(createMockArtifacts(exportDir as string))
      );

      await exportPackage('study-1');

      expect(mocks.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('study-1'),
        expect.objectContaining({ recursive: true })
      );
    });

    it('handles non-Error thrown objects', async () => {
      mocks.checkReadiness.mockResolvedValue(createMockReadiness());
      mocks.assemblePackage.mockRejectedValue('string error');

      const result = await exportPackage('study-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown export error');
    });
  });

  describe('getExportDir', () => {
    it('returns correct path format', () => {
      const result = getExportDir('study-123', 'pkg-456');

      expect(result).toBe('exports/study-123/pkg-456');
    });

    it('uses EXPORTS_DIR environment variable', () => {
      // Note: The module reads process.env.EXPORTS_DIR at import time,
      // so we need to test with the default value or mock the module differently.
      // This test verifies the default behavior.
      const result = getExportDir('study-1', 'pkg-1');

      expect(result).toContain('exports');
      expect(result).toContain('study-1');
      expect(result).toContain('pkg-1');
    });

    it('constructs path with join', () => {
      const result = getExportDir('test-study', 'test-package');

      // Path should be properly joined, not concatenated
      expect(result).not.toContain('//');
      expect(result).toMatch(/exports[\\/]test-study[\\/]test-package/);
    });
  });

  describe('cleanupExport', () => {
    it('removes directory with recursive and force options', async () => {
      await cleanupExport('./exports/study-1/pkg-1');

      expect(mocks.rm).toHaveBeenCalledWith('./exports/study-1/pkg-1', {
        recursive: true,
        force: true,
      });
    });

    it('rejects paths outside exports folder (path traversal protection)', async () => {
      await expect(cleanupExport('../etc/passwd')).rejects.toThrow(
        'Cannot clean up directory outside exports folder'
      );

      expect(mocks.rm).not.toHaveBeenCalled();
    });

    it('rejects absolute paths outside exports', async () => {
      await expect(cleanupExport('/tmp/exports/study-1')).rejects.toThrow(
        'Cannot clean up directory outside exports folder'
      );

      expect(mocks.rm).not.toHaveBeenCalled();
    });

    it('propagates errors from rm', async () => {
      mocks.rm.mockRejectedValue(new Error('Permission denied'));

      await expect(cleanupExport('./exports/study-1/pkg-1')).rejects.toThrow('Permission denied');
    });

    it('allows valid paths within exports folder', async () => {
      await cleanupExport('./exports/study-1/pkg-1/subfolder');

      expect(mocks.rm).toHaveBeenCalled();
    });
  });

  describe('getPackageZipPath', () => {
    it('returns correct path to package.zip', () => {
      const result = getPackageZipPath('study-1', 'pkg-1');

      expect(result).toBe('exports/study-1/pkg-1/package.zip');
    });

    it('uses getExportDir for base path', () => {
      const result = getPackageZipPath('my-study', 'my-package');

      expect(result).toContain('my-study');
      expect(result).toContain('my-package');
      expect(result).toMatch(/package\.zip$/);
    });
  });

  describe('exportExists', () => {
    it('returns true when stat succeeds', async () => {
      mocks.stat.mockResolvedValue({ size: 1000 });

      const result = await exportExists('study-1', 'pkg-1');

      expect(result).toBe(true);
      expect(mocks.stat).toHaveBeenCalled();
    });

    it('returns false when stat throws', async () => {
      mocks.stat.mockRejectedValue(new Error('ENOENT: no such file or directory'));

      const result = await exportExists('study-1', 'pkg-1');

      expect(result).toBe(false);
    });

    it('checks the correct path', async () => {
      mocks.stat.mockResolvedValue({ size: 1000 });

      await exportExists('study-abc', 'pkg-xyz');

      expect(mocks.stat).toHaveBeenCalledWith(
        expect.stringContaining('study-abc')
      );
      expect(mocks.stat).toHaveBeenCalledWith(
        expect.stringContaining('pkg-xyz')
      );
      expect(mocks.stat).toHaveBeenCalledWith(
        expect.stringContaining('package.zip')
      );
    });
  });

  describe('edge cases', () => {
    it('generates unique package ID for each export', async () => {
      const mockManifest = createMockManifest();
      const mockBookmarks = createMockBookmarks();
      const mockHyperlinks = createMockHyperlinks();

      mocks.checkReadiness.mockResolvedValue(createMockReadiness());
      mocks.assemblePackage.mockResolvedValue(mockManifest);
      mocks.generateBookmarkManifest.mockResolvedValue(mockBookmarks);
      mocks.generateHyperlinkReport.mockResolvedValue(mockHyperlinks);
      mocks.generateExportArtifacts.mockImplementation(
        (_manifest, _bookmarks, _hyperlinks, exportDir, _xmlOptions) =>
          Promise.resolve(createMockArtifacts(exportDir as string))
      );

      mocks.uuid.mockReturnValueOnce('uuid-1').mockReturnValueOnce('uuid-2');

      const result1 = await exportPackage('study-1');
      const result2 = await exportPackage('study-1');

      expect(result1.packageId).toBe('uuid-1');
      expect(result2.packageId).toBe('uuid-2');
    });

    it('passes correct arguments to generateExportArtifacts', async () => {
      const mockManifest = createMockManifest();
      const mockBookmarks = createMockBookmarks();
      const mockHyperlinks = createMockHyperlinks();

      mocks.checkReadiness.mockResolvedValue(createMockReadiness());
      mocks.assemblePackage.mockResolvedValue(mockManifest);
      mocks.generateBookmarkManifest.mockResolvedValue(mockBookmarks);
      mocks.generateHyperlinkReport.mockResolvedValue(mockHyperlinks);
      mocks.generateExportArtifacts.mockImplementation(
        (_manifest, _bookmarks, _hyperlinks, exportDir, _xmlOptions) =>
          Promise.resolve(createMockArtifacts(exportDir as string))
      );

      await exportPackage('study-1');

      expect(mocks.generateExportArtifacts).toHaveBeenCalledWith(
        mockManifest,
        mockBookmarks,
        mockHyperlinks,
        expect.stringContaining('study-1'),
        expect.objectContaining({
          sequence: expect.objectContaining({
            number: '0000',
            type: 'original',
          }),
          metadata: expect.objectContaining({
            sponsor: 'Test Pharma Inc',
          }),
        })
      );
    });

    it('logs error on export failure', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mocks.checkReadiness.mockResolvedValue(createMockReadiness());
      mocks.assemblePackage.mockRejectedValue(new Error('Test error'));

      await exportPackage('study-test');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Exporter] Export failed for study study-test'),
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('cleans up on checkReadiness failure', async () => {
      mocks.checkReadiness.mockRejectedValue(new Error('Database connection failed'));

      const result = await exportPackage('study-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection failed');
      expect(mocks.rm).toHaveBeenCalled();
    });

    it('includes all readiness issues in combined error message', async () => {
      mocks.checkReadiness.mockResolvedValue(
        createMockReadiness({
          ready: false,
          missingRequired: [
            { code: '16.1', title: 'Study Info', nodeId: 'node-1' },
            { code: '16.2', title: 'Listings', nodeId: 'node-2' },
          ],
          validationErrors: 5,
          unresolvedAnnotations: 3,
        })
      );

      const result = await exportPackage('study-1');

      expect(result.error).toContain('2 required document(s) missing');
      expect(result.error).toContain('5 validation error(s)');
      expect(result.error).toContain('3 unresolved correction(s)');
    });
  });
});
