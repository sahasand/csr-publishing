import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

// Create hoisted mock functions that can be accessed inside vi.mock
const { mocks, mockFs, mockFsPromises, mockXmlGenerator } = vi.hoisted(() => {
  const mockFns = {
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    stat: vi.fn(),
    copyFile: vi.fn(),
    readFile: vi.fn(),
    createWriteStream: vi.fn(),
    createReadStream: vi.fn(),
    archiver: vi.fn(),
    getFullPath: vi.fn(),
    exportReportAsCsv: vi.fn(),
    generateEctdXml: vi.fn(),
  };

  // Create the fs/promises mock module structure
  const fsPromisesMock = {
    mkdir: mockFns.mkdir,
    writeFile: mockFns.writeFile,
    stat: mockFns.stat,
    copyFile: mockFns.copyFile,
    readFile: mockFns.readFile,
    readdir: vi.fn(),
    rm: vi.fn(),
    unlink: vi.fn(),
    access: vi.fn(),
    chmod: vi.fn(),
    chown: vi.fn(),
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

  // Create the fs mock module structure
  const fsMock = {
    createWriteStream: mockFns.createWriteStream,
    createReadStream: mockFns.createReadStream,
    // Include other common fs functions to satisfy module requirements
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    statSync: vi.fn(),
    readdirSync: vi.fn(),
    unlinkSync: vi.fn(),
    rmdirSync: vi.fn(),
    copyFileSync: vi.fn(),
    constants: {},
    promises: fsPromisesMock,
  };

  // Create xml-generator mock
  const xmlGeneratorMock = {
    generateEctdXml: mockFns.generateEctdXml,
  };

  return { mocks: mockFns, mockFs: fsMock, mockFsPromises: fsPromisesMock, mockXmlGenerator: xmlGeneratorMock };
});

// Mock fs/promises with a complete module structure
vi.mock('fs/promises', () => {
  return {
    ...mockFsPromises,
    default: mockFsPromises,
  };
});

// Mock fs with a complete module structure
vi.mock('fs', () => {
  return {
    ...mockFs,
    default: mockFs,
  };
});

// Mock archiver
vi.mock('archiver', () => ({
  default: mocks.archiver,
}));

// Mock storage
vi.mock('@/lib/storage', () => ({
  getFullPath: mocks.getFullPath,
}));

// Mock hyperlinks module
vi.mock('@/lib/packaging/hyperlinks', () => ({
  exportReportAsCsv: mocks.exportReportAsCsv,
}));

// Mock xml-generator module
vi.mock('@/lib/packaging/xml-generator', () => ({
  generateEctdXml: mocks.generateEctdXml,
}));

// Import after mocks
import {
  createEctdStructure,
  createZipArchive,
  buildQcSummary,
  generateExportArtifacts,
} from '@/lib/packaging/zip-generator';
import type { PackageManifest } from '@/lib/packaging/types';
import type { BookmarkManifest } from '@/lib/packaging/bookmarks';
import type { HyperlinkReport } from '@/lib/packaging/hyperlinks';

// Helper to create mock archiver instance
const createMockArchiver = (onClose: () => void) => {
  const archiverInstance = new EventEmitter();
  const archiverWithMethods = archiverInstance as EventEmitter & {
    pipe: ReturnType<typeof vi.fn>;
    directory: ReturnType<typeof vi.fn>;
    finalize: ReturnType<typeof vi.fn>;
    pointer: ReturnType<typeof vi.fn>;
  };

  archiverWithMethods.pipe = vi.fn().mockReturnValue(archiverInstance);
  archiverWithMethods.directory = vi.fn().mockReturnValue(archiverInstance);
  archiverWithMethods.finalize = vi.fn().mockImplementation(() => {
    setImmediate(onClose);
    return Promise.resolve();
  });
  archiverWithMethods.pointer = vi.fn().mockReturnValue(2048);

  return archiverWithMethods;
};

describe('zip-generator', () => {
  let mockWriteStream: EventEmitter;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock write stream
    mockWriteStream = new EventEmitter();

    // Setup default mock implementations
    mocks.mkdir.mockResolvedValue(undefined);
    mocks.writeFile.mockResolvedValue(undefined);
    mocks.stat.mockResolvedValue({ size: 1024 });
    mocks.copyFile.mockResolvedValue(undefined);
    mocks.readFile.mockResolvedValue(Buffer.from('mock pdf'));
    mocks.getFullPath.mockImplementation((path: string) => `/full/path/${path}`);
    mocks.exportReportAsCsv.mockReturnValue('Source File,Page,Link Type,Target,Status,Error\n');

    // Setup createWriteStream to return our mock stream
    mocks.createWriteStream.mockReturnValue(mockWriteStream as any);

    // Setup createReadStream mock
    mocks.createReadStream.mockImplementation(() => {
      const stream = new EventEmitter();
      (stream as any).pipe = (dest: EventEmitter) => {
        setImmediate(() => dest.emit('finish'));
        return dest;
      };
      return stream as any;
    });

    // Setup archiver mock
    mocks.archiver.mockImplementation(() => {
      return createMockArchiver(() => {
        mockWriteStream.emit('close');
      }) as any;
    });

    // Setup xml-generator mock with default response
    mocks.generateEctdXml.mockResolvedValue({
      indexXml: '<?xml version="1.0"?><ectd:ectd></ectd:ectd>',
      regionalXml: '<?xml version="1.0"?><fda:fda></fda:fda>',
      leafEntries: [],
      warnings: [],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Mock data factories
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
      {
        sourceDocumentId: 'doc-2',
        targetPath: 'm5/datasets/file2.pdf',
        sourcePath: 'uploads/file2.pdf',
        fileSize: 2000,
        nodeCode: '16.2',
        nodeTitle: 'Patient Listings',
        fileName: 'file2.pdf',
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
    readiness: {
      ready: true,
      missingRequired: [],
      pendingApproval: [],
      validationErrors: 0,
      unresolvedAnnotations: 0,
      totalFiles: 2,
      totalRequiredNodes: 2,
    },
    ...overrides,
  });

  const createMockBookmarks = (overrides: Partial<BookmarkManifest> = {}): BookmarkManifest => ({
    rootBookmarks: [],
    documentBookmarks: [],
    totalCount: 10,
    maxDepth: 3,
    warnings: [],
    ...overrides,
  });

  const createMockHyperlinks = (overrides: Partial<HyperlinkReport> = {}): HyperlinkReport => ({
    totalLinks: 5,
    byType: { internal: 3, crossDocument: 2, external: 0, unknown: 0 },
    brokenLinks: [],
    externalLinks: [],
    validatedAt: new Date('2024-01-15'),
    warnings: [],
    ...overrides,
  });

  describe('buildQcSummary', () => {
    it('returns correct structure with all fields', () => {
      const manifest = createMockManifest();
      const bookmarks = createMockBookmarks();
      const hyperlinks = createMockHyperlinks();

      const result = buildQcSummary(manifest, bookmarks, hyperlinks);

      expect(result.studyId).toBe('study-1');
      expect(result.studyNumber).toBe('ABC-123');
      expect(result.generatedAt).toBeInstanceOf(Date);
      expect(result.fileCount).toBe(2);
      expect(result.readiness).toBeDefined();
      expect(result.bookmarks).toBeDefined();
      expect(result.hyperlinks).toBeDefined();
    });

    it('calculates totalSize from files', () => {
      const manifest = createMockManifest({
        files: [
          {
            sourceDocumentId: 'doc-1',
            targetPath: 'm5/file1.pdf',
            sourcePath: 'uploads/file1.pdf',
            fileSize: 1500,
            nodeCode: '16.1',
            nodeTitle: 'Section 1',
            fileName: 'file1.pdf',
            version: 1,
          },
          {
            sourceDocumentId: 'doc-2',
            targetPath: 'm5/file2.pdf',
            sourcePath: 'uploads/file2.pdf',
            fileSize: 2500,
            nodeCode: '16.2',
            nodeTitle: 'Section 2',
            fileName: 'file2.pdf',
            version: 1,
          },
          {
            sourceDocumentId: 'doc-3',
            targetPath: 'm5/file3.pdf',
            sourcePath: 'uploads/file3.pdf',
            fileSize: 500,
            nodeCode: '16.3',
            nodeTitle: 'Section 3',
            fileName: 'file3.pdf',
            version: 1,
          },
        ],
      });
      const bookmarks = createMockBookmarks();
      const hyperlinks = createMockHyperlinks();

      const result = buildQcSummary(manifest, bookmarks, hyperlinks);

      expect(result.totalSize).toBe(4500);
    });

    it('counts readiness issues correctly', () => {
      const manifest = createMockManifest({
        readiness: {
          ready: false,
          missingRequired: [
            { code: '16.3', title: 'Missing Section', nodeId: 'node-3' },
            { code: '16.4', title: 'Another Missing', nodeId: 'node-4' },
          ],
          pendingApproval: [
            {
              documentId: 'doc-5',
              fileName: 'draft.pdf',
              status: 'DRAFT',
              nodeCode: '16.5',
              nodeTitle: 'Pending Section',
            },
          ],
          validationErrors: 3,
          unresolvedAnnotations: 2,
          totalFiles: 2,
          totalRequiredNodes: 4,
        },
      });
      const bookmarks = createMockBookmarks();
      const hyperlinks = createMockHyperlinks();

      const result = buildQcSummary(manifest, bookmarks, hyperlinks);

      expect(result.readiness.ready).toBe(false);
      expect(result.readiness.missingRequired).toBe(2);
      expect(result.readiness.pendingApproval).toBe(1);
      expect(result.readiness.validationErrors).toBe(3);
      expect(result.readiness.unresolvedAnnotations).toBe(2);
    });

    it('counts bookmark warnings', () => {
      const manifest = createMockManifest();
      const bookmarks = createMockBookmarks({
        warnings: ['Title truncated', 'Depth exceeded', 'Another warning'],
        totalCount: 15,
        maxDepth: 5,
      });
      const hyperlinks = createMockHyperlinks();

      const result = buildQcSummary(manifest, bookmarks, hyperlinks);

      expect(result.bookmarks.warnings).toBe(3);
      expect(result.bookmarks.totalCount).toBe(15);
      expect(result.bookmarks.maxDepth).toBe(5);
    });

    it('counts hyperlink issues', () => {
      const manifest = createMockManifest();
      const bookmarks = createMockBookmarks();
      const hyperlinks = createMockHyperlinks({
        totalLinks: 20,
        byType: { internal: 10, crossDocument: 5, external: 3, unknown: 2 },
        brokenLinks: [
          {
            link: { sourceFile: 'doc.pdf', pageNumber: 1, targetUri: 'missing.pdf', linkType: 'cross-document' },
            isValid: false,
            error: 'Not found',
          },
          {
            link: { sourceFile: 'doc.pdf', pageNumber: 2, targetUri: 'other.pdf', linkType: 'cross-document' },
            isValid: false,
            error: 'Not found',
          },
        ],
        externalLinks: [
          { sourceFile: 'doc.pdf', pageNumber: 1, targetUri: 'https://example.com', linkType: 'external' },
          { sourceFile: 'doc.pdf', pageNumber: 2, targetUri: 'https://test.com', linkType: 'external' },
          { sourceFile: 'doc.pdf', pageNumber: 3, targetUri: 'https://other.com', linkType: 'external' },
        ],
      });

      const result = buildQcSummary(manifest, bookmarks, hyperlinks);

      expect(result.hyperlinks.totalCount).toBe(20);
      expect(result.hyperlinks.brokenCount).toBe(2);
      expect(result.hyperlinks.externalCount).toBe(3);
    });

    it('handles empty files array', () => {
      const manifest = createMockManifest({ files: [] });
      const bookmarks = createMockBookmarks();
      const hyperlinks = createMockHyperlinks();

      const result = buildQcSummary(manifest, bookmarks, hyperlinks);

      expect(result.fileCount).toBe(0);
      expect(result.totalSize).toBe(0);
    });

    it('handles zero values gracefully', () => {
      const manifest = createMockManifest({
        files: [],
        readiness: {
          ready: true,
          missingRequired: [],
          pendingApproval: [],
          validationErrors: 0,
          unresolvedAnnotations: 0,
          totalFiles: 0,
          totalRequiredNodes: 0,
        },
      });
      const bookmarks = createMockBookmarks({ totalCount: 0, maxDepth: 0, warnings: [] });
      const hyperlinks = createMockHyperlinks({
        totalLinks: 0,
        brokenLinks: [],
        externalLinks: [],
      });

      const result = buildQcSummary(manifest, bookmarks, hyperlinks);

      expect(result.fileCount).toBe(0);
      expect(result.totalSize).toBe(0);
      expect(result.bookmarks.totalCount).toBe(0);
      expect(result.hyperlinks.totalCount).toBe(0);
    });
  });

  describe('createEctdStructure', () => {
    it('creates directories for folder structure', async () => {
      const manifest = createMockManifest();

      await createEctdStructure(manifest, '/output/ectd');

      expect(mocks.mkdir).toHaveBeenCalled();
      const mkdirCalls = mocks.mkdir.mock.calls;
      expect(mkdirCalls.some((call: unknown[]) => String(call[0]).includes('m5'))).toBe(true);
    });

    it('copies files to target locations', async () => {
      const manifest = createMockManifest();

      await createEctdStructure(manifest, '/output/ectd');

      expect(mocks.getFullPath).toHaveBeenCalledWith('uploads/file1.pdf');
      expect(mocks.getFullPath).toHaveBeenCalledWith('uploads/file2.pdf');
    });

    it('creates parent directories for files', async () => {
      const manifest = createMockManifest({
        files: [
          {
            sourceDocumentId: 'doc-1',
            targetPath: 'm5/datasets/16-2-1/deep/file.pdf',
            sourcePath: 'uploads/file.pdf',
            fileSize: 1000,
            nodeCode: '16.2.1',
            nodeTitle: 'Deep Section',
            fileName: 'file.pdf',
            version: 1,
          },
        ],
        folderStructure: [],
      });

      await createEctdStructure(manifest, '/output/ectd');

      const mkdirCalls = mocks.mkdir.mock.calls;
      expect(mkdirCalls.some((call: unknown[]) => call[1] && typeof call[1] === 'object' && (call[1] as { recursive?: boolean }).recursive === true)).toBe(true);
    });

    it('validates target paths - rejects path traversal', async () => {
      const manifest = createMockManifest({
        files: [
          {
            sourceDocumentId: 'doc-1',
            targetPath: '../etc/passwd',
            sourcePath: 'uploads/file.pdf',
            fileSize: 1000,
            nodeCode: '16.1',
            nodeTitle: 'Malicious',
            fileName: 'passwd',
            version: 1,
          },
        ],
      });

      await expect(createEctdStructure(manifest, '/output/ectd')).rejects.toThrow(
        'Invalid target path'
      );
    });

    it('validates target paths - rejects absolute paths', async () => {
      const manifest = createMockManifest({
        files: [
          {
            sourceDocumentId: 'doc-1',
            targetPath: '/absolute/path/file.pdf',
            sourcePath: 'uploads/file.pdf',
            fileSize: 1000,
            nodeCode: '16.1',
            nodeTitle: 'Absolute',
            fileName: 'file.pdf',
            version: 1,
          },
        ],
      });

      await expect(createEctdStructure(manifest, '/output/ectd')).rejects.toThrow(
        'Invalid target path'
      );
    });

    it('handles empty files array', async () => {
      const manifest = createMockManifest({ files: [] });

      await expect(createEctdStructure(manifest, '/output/ectd')).resolves.not.toThrow();
    });

    it('handles empty folder structure', async () => {
      const manifest = createMockManifest({ folderStructure: [] });

      await expect(createEctdStructure(manifest, '/output/ectd')).resolves.not.toThrow();
    });

    it('processes nested folder structure', async () => {
      const manifest = createMockManifest({
        folderStructure: [
          {
            name: 'm5',
            path: 'm5',
            files: [],
            children: [
              {
                name: 'datasets',
                path: 'm5/datasets',
                files: [],
                children: [
                  {
                    name: '16-1',
                    path: 'm5/datasets/16-1',
                    files: [],
                    children: [],
                  },
                ],
              },
            ],
          },
        ],
        files: [],
      });

      await createEctdStructure(manifest, '/output/ectd');

      expect(mocks.mkdir.mock.calls.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('createZipArchive', () => {
    it('creates archive with archiver', async () => {
      const result = await createZipArchive('/source/dir', '/output/package.zip');

      expect(mocks.archiver).toHaveBeenCalledWith('zip', expect.objectContaining({
        zlib: { level: 6 },
      }));
      expect(result).toHaveProperty('size');
    });

    it('returns size from stat', async () => {
      mocks.stat.mockResolvedValue({ size: 5000 } as any);

      const result = await createZipArchive('/source/dir', '/output/package.zip');

      expect(result.size).toBe(5000);
    });

    it('pipes to output stream', async () => {
      await createZipArchive('/source/dir', '/output/package.zip');

      expect(mocks.createWriteStream).toHaveBeenCalledWith('/output/package.zip');
    });

    it('adds directory to archive', async () => {
      await createZipArchive('/source/dir', '/output/package.zip');

      const mockArchiverInstance = mocks.archiver.mock.results[0]?.value;
      expect(mockArchiverInstance.directory).toHaveBeenCalledWith('/source/dir', false);
    });

    it('calls finalize on archive', async () => {
      await createZipArchive('/source/dir', '/output/package.zip');

      const mockArchiverInstance = mocks.archiver.mock.results[0]?.value;
      expect(mockArchiverInstance.finalize).toHaveBeenCalled();
    });

    it('handles archive error events', async () => {
      const errorArchiver = createMockArchiver(() => {});
      mocks.archiver.mockReturnValueOnce(errorArchiver as any);

      errorArchiver.finalize.mockImplementation(() => {
        setImmediate(() => {
          errorArchiver.emit('error', new Error('Archive failed'));
        });
        return Promise.resolve();
      });

      await expect(createZipArchive('/source/dir', '/output/package.zip')).rejects.toThrow(
        'Archive failed'
      );
    });

    it('handles non-ENOENT warning as error', async () => {
      const warningArchiver = createMockArchiver(() => {});
      mocks.archiver.mockReturnValueOnce(warningArchiver as any);

      warningArchiver.finalize.mockImplementation(() => {
        setImmediate(() => {
          const error = new Error('Permission denied') as Error & { code: string };
          error.code = 'EACCES';
          warningArchiver.emit('warning', error);
        });
        return Promise.resolve();
      });

      await expect(createZipArchive('/source/dir', '/output/package.zip')).rejects.toThrow(
        'Permission denied'
      );
    });

    it('handles ENOENT warning gracefully (logs but does not reject)', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const enoentArchiver = createMockArchiver(() => {});
      mocks.archiver.mockReturnValueOnce(enoentArchiver as any);

      enoentArchiver.finalize.mockImplementation(() => {
        setImmediate(() => {
          const error = new Error('File not found') as Error & { code: string };
          error.code = 'ENOENT';
          enoentArchiver.emit('warning', error);
          mockWriteStream.emit('close');
        });
        return Promise.resolve();
      });

      const result = await createZipArchive('/source/dir', '/output/package.zip');

      expect(result).toHaveProperty('size');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[ZipGenerator] Warning:',
        'File not found'
      );

      consoleWarnSpy.mockRestore();
    });

    it('falls back to pointer() when stat fails', async () => {
      mocks.stat.mockRejectedValueOnce(new Error('Stat failed'));

      const fallbackArchiver = createMockArchiver(() => mockWriteStream.emit('close'));
      mocks.archiver.mockReturnValueOnce(fallbackArchiver as any);

      const result = await createZipArchive('/source/dir', '/output/package.zip');

      expect(result.size).toBe(2048);
    });
  });

  describe('generateExportArtifacts', () => {
    it('creates output directory', async () => {
      const manifest = createMockManifest();
      const bookmarks = createMockBookmarks();
      const hyperlinks = createMockHyperlinks();

      await generateExportArtifacts(manifest, bookmarks, hyperlinks, '/output');

      expect(mocks.mkdir).toHaveBeenCalledWith('/output', { recursive: true });
    });

    it('writes bookmark manifest JSON', async () => {
      const manifest = createMockManifest();
      const bookmarks = createMockBookmarks({ totalCount: 25, maxDepth: 4 });
      const hyperlinks = createMockHyperlinks();

      await generateExportArtifacts(manifest, bookmarks, hyperlinks, '/output');

      const writeFileCalls = mocks.writeFile.mock.calls;
      const bookmarkCall = writeFileCalls.find((call: unknown[]) =>
        String(call[0]).includes('bookmark-manifest.json')
      );
      expect(bookmarkCall).toBeDefined();

      const jsonContent = JSON.parse(bookmarkCall![1] as string);
      expect(jsonContent.totalCount).toBe(25);
      expect(jsonContent.maxDepth).toBe(4);
    });

    it('writes hyperlink report CSV', async () => {
      const manifest = createMockManifest();
      const bookmarks = createMockBookmarks();
      const hyperlinks = createMockHyperlinks();

      await generateExportArtifacts(manifest, bookmarks, hyperlinks, '/output');

      expect(mocks.exportReportAsCsv).toHaveBeenCalledWith(hyperlinks);

      const writeFileCalls = mocks.writeFile.mock.calls;
      const csvCall = writeFileCalls.find((call: unknown[]) =>
        String(call[0]).includes('hyperlink-report.csv')
      );
      expect(csvCall).toBeDefined();
    });

    it('writes QC summary JSON', async () => {
      const manifest = createMockManifest();
      const bookmarks = createMockBookmarks();
      const hyperlinks = createMockHyperlinks();

      await generateExportArtifacts(manifest, bookmarks, hyperlinks, '/output');

      const writeFileCalls = mocks.writeFile.mock.calls;
      const qcCall = writeFileCalls.find((call: unknown[]) =>
        String(call[0]).includes('qc-summary.json')
      );
      expect(qcCall).toBeDefined();

      const jsonContent = JSON.parse(qcCall![1] as string);
      expect(jsonContent.studyId).toBe('study-1');
      expect(jsonContent.studyNumber).toBe('ABC-123');
      expect(jsonContent.fileCount).toBe(2);
    });

    it('creates ZIP archive', async () => {
      const manifest = createMockManifest();
      const bookmarks = createMockBookmarks();
      const hyperlinks = createMockHyperlinks();

      await generateExportArtifacts(manifest, bookmarks, hyperlinks, '/output');

      expect(mocks.archiver).toHaveBeenCalled();
    });

    it('returns all artifact paths', async () => {
      const manifest = createMockManifest();
      const bookmarks = createMockBookmarks();
      const hyperlinks = createMockHyperlinks();

      const result = await generateExportArtifacts(
        manifest,
        bookmarks,
        hyperlinks,
        '/output'
      );

      expect(result).toHaveProperty('packageZipPath');
      expect(result).toHaveProperty('bookmarkManifestPath');
      expect(result).toHaveProperty('hyperlinkReportPath');
      expect(result).toHaveProperty('qcSummaryPath');

      expect(result.packageZipPath).toContain('package.zip');
      expect(result.bookmarkManifestPath).toContain('bookmark-manifest.json');
      expect(result.hyperlinkReportPath).toContain('hyperlink-report.csv');
      expect(result.qcSummaryPath).toContain('qc-summary.json');
    });

    it('creates eCTD structure in ectd subdirectory', async () => {
      const manifest = createMockManifest();
      const bookmarks = createMockBookmarks();
      const hyperlinks = createMockHyperlinks();

      await generateExportArtifacts(manifest, bookmarks, hyperlinks, '/output');

      const mkdirCalls = mocks.mkdir.mock.calls;
      expect(mkdirCalls.some((call: unknown[]) => String(call[0]).includes('ectd'))).toBe(true);
    });

    it('handles manifest with no files', async () => {
      const manifest = createMockManifest({ files: [] });
      const bookmarks = createMockBookmarks();
      const hyperlinks = createMockHyperlinks();

      const result = await generateExportArtifacts(
        manifest,
        bookmarks,
        hyperlinks,
        '/output'
      );

      expect(result.packageZipPath).toBeDefined();
    });

    it('uses correct output directory paths', async () => {
      const manifest = createMockManifest();
      const bookmarks = createMockBookmarks();
      const hyperlinks = createMockHyperlinks();

      const result = await generateExportArtifacts(
        manifest,
        bookmarks,
        hyperlinks,
        '/custom/output/path'
      );

      expect(result.packageZipPath).toContain('/custom/output/path');
      expect(result.bookmarkManifestPath).toContain('/custom/output/path');
      expect(result.hyperlinkReportPath).toContain('/custom/output/path');
      expect(result.qcSummaryPath).toContain('/custom/output/path');
    });
  });

  describe('path validation edge cases', () => {
    it('allows valid relative paths', async () => {
      const manifest = createMockManifest({
        files: [
          {
            sourceDocumentId: 'doc-1',
            targetPath: 'm5/section/subsection/file.pdf',
            sourcePath: 'uploads/file.pdf',
            fileSize: 1000,
            nodeCode: '16.1.1',
            nodeTitle: 'Valid Path',
            fileName: 'file.pdf',
            version: 1,
          },
        ],
      });

      await expect(createEctdStructure(manifest, '/output/ectd')).resolves.not.toThrow();
    });

    it('rejects path that escapes output directory via traversal', async () => {
      // Note: m5/../other/file.pdf normalizes to other/file.pdf which is valid
      // This test uses a path that actually escapes the output directory
      const manifest = createMockManifest({
        files: [
          {
            sourceDocumentId: 'doc-1',
            targetPath: '../../etc/passwd',
            sourcePath: 'uploads/file.pdf',
            fileSize: 1000,
            nodeCode: '16.1',
            nodeTitle: 'Traversal',
            fileName: 'file.pdf',
            version: 1,
          },
        ],
      });

      await expect(createEctdStructure(manifest, '/output/ectd')).rejects.toThrow(
        'Invalid target path'
      );
    });
  });
});
