import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Create hoisted mock functions
const { mocks, mockFsPromises, mockChildProcess } = vi.hoisted(() => {
  const mockFns = {
    stat: vi.fn(),
    mkdir: vi.fn(),
    unlink: vi.fn(),
    rename: vi.fn(),
    dbDocumentUpdate: vi.fn(),
    getFullPath: vi.fn(),
    uuid: vi.fn(),
    spawn: vi.fn(),
  };

  // Create mock fs/promises module
  const fsPromisesMock = {
    stat: mockFns.stat,
    mkdir: mockFns.mkdir,
    unlink: mockFns.unlink,
    rename: mockFns.rename,
    writeFile: vi.fn(),
    readFile: vi.fn(),
    readdir: vi.fn(),
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
    rmdir: vi.fn(),
    symlink: vi.fn(),
    truncate: vi.fn(),
    utimes: vi.fn(),
    watch: vi.fn(),
    rm: vi.fn(),
    cp: vi.fn(),
    constants: {},
  };

  // Create mock child_process module
  const childProcessMock = {
    spawn: mockFns.spawn,
  };

  return {
    mocks: mockFns,
    mockFsPromises: fsPromisesMock,
    mockChildProcess: childProcessMock,
  };
});

// Mock fs/promises
vi.mock('fs/promises', () => ({
  ...mockFsPromises,
  default: mockFsPromises,
}));

// Mock child_process
vi.mock('child_process', () => ({
  ...mockChildProcess,
  default: mockChildProcess,
}));

// Mock uuid
vi.mock('uuid', () => ({
  v4: () => mocks.uuid(),
}));

// Mock db
vi.mock('@/lib/db', () => ({
  db: {
    document: {
      update: (...args: unknown[]) => mocks.dbDocumentUpdate(...args),
    },
  },
}));

// Mock storage
vi.mock('@/lib/storage', () => ({
  getFullPath: (path: string) => mocks.getFullPath(path),
}));

// Import after mocks
import {
  findLibreOffice,
  isConvertible,
  convertDocument,
} from '@/lib/jobs/pdf-conversion';
import { EventEmitter } from 'events';

describe('pdf-conversion', () => {
  // Save original env and platform
  const originalEnv = { ...process.env };
  const originalPlatform = process.platform;

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mocks.uuid.mockReturnValue('test-uuid-123');
    mocks.getFullPath.mockImplementation((path: string) => `./uploads/${path}`);
    mocks.mkdir.mockResolvedValue(undefined);
    mocks.unlink.mockResolvedValue(undefined);
    mocks.rename.mockResolvedValue(undefined);
    mocks.dbDocumentUpdate.mockResolvedValue({ id: 'doc-1' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Restore env
    process.env = { ...originalEnv };
    // Restore platform
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
    });
  });

  describe('findLibreOffice', () => {
    it('returns path when LibreOffice is found on Windows', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });

      // First path doesn't exist, second does
      mocks.stat
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockResolvedValueOnce({ size: 1000 });

      const result = await findLibreOffice();

      expect(result).toBe('C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe');
    });

    it('returns path when LibreOffice is found on macOS', async () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      mocks.stat.mockResolvedValueOnce({ size: 1000 });

      const result = await findLibreOffice();

      expect(result).toBe('/Applications/LibreOffice.app/Contents/MacOS/soffice');
    });

    it('returns path when LibreOffice is found on Linux', async () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });

      mocks.stat.mockResolvedValueOnce({ size: 1000 });

      const result = await findLibreOffice();

      expect(result).toBe('/usr/bin/soffice');
    });

    it('returns null when LibreOffice is not installed', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });

      mocks.stat.mockRejectedValue(new Error('ENOENT'));

      const result = await findLibreOffice();

      expect(result).toBeNull();
    });

    it('uses Linux paths for unknown platforms', async () => {
      Object.defineProperty(process, 'platform', { value: 'freebsd' });

      mocks.stat.mockResolvedValueOnce({ size: 1000 });

      const result = await findLibreOffice();

      expect(result).toBe('/usr/bin/soffice');
    });
  });

  describe('isConvertible', () => {
    it('returns true for .doc files', () => {
      expect(isConvertible('document.doc')).toBe(true);
    });

    it('returns true for .docx files', () => {
      expect(isConvertible('document.docx')).toBe(true);
    });

    it('returns true for .rtf files', () => {
      expect(isConvertible('document.rtf')).toBe(true);
    });

    it('returns true for .odt files', () => {
      expect(isConvertible('document.odt')).toBe(true);
    });

    it('returns false for .pdf files', () => {
      expect(isConvertible('document.pdf')).toBe(false);
    });

    it('returns false for .txt files', () => {
      expect(isConvertible('document.txt')).toBe(false);
    });

    it('returns false for .xlsx files', () => {
      expect(isConvertible('spreadsheet.xlsx')).toBe(false);
    });

    it('handles uppercase extensions', () => {
      expect(isConvertible('DOCUMENT.DOCX')).toBe(true);
    });

    it('handles mixed case extensions', () => {
      expect(isConvertible('document.DocX')).toBe(true);
    });
  });

  describe('convertDocument', () => {
    // Helper to create a mock spawn process
    const createMockProcess = () => {
      const mockProcess = new EventEmitter() as EventEmitter & {
        stdout: EventEmitter;
        stderr: EventEmitter;
        kill: ReturnType<typeof vi.fn>;
      };
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();
      mockProcess.kill = vi.fn();
      return mockProcess;
    };

    it('returns error for unsupported file type', async () => {
      const result = await convertDocument('doc-1', 'source/file.pdf');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported file type');
      expect(result.error).toContain('.pdf');
    });

    it('returns error when LibreOffice is not installed', async () => {
      // LibreOffice not found
      mocks.stat.mockRejectedValue(new Error('ENOENT'));

      const result = await convertDocument('doc-1', 'source/document.docx');

      expect(result.success).toBe(false);
      expect(result.error).toContain('LibreOffice not installed');
    });

    it('converts document successfully', async () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });

      // LibreOffice exists
      mocks.stat
        .mockResolvedValueOnce({ size: 1000 }) // findLibreOffice
        .mockResolvedValueOnce({ size: 5000 }); // verify output

      const mockProcess = createMockProcess();
      mocks.spawn.mockReturnValue(mockProcess);

      const conversionPromise = convertDocument('doc-1', 'source/document.docx');

      // Simulate successful conversion
      setImmediate(() => {
        mockProcess.emit('close', 0);
      });

      const result = await conversionPromise;

      expect(result.success).toBe(true);
      // Path separator varies by platform
      expect(result.outputPath).toMatch(/processed[\\/]test-uuid-123\.pdf$/);
      expect(mocks.dbDocumentUpdate).toHaveBeenCalledWith({
        where: { id: 'doc-1' },
        data: { processedPath: expect.stringMatching(/processed[\\/]test-uuid-123\.pdf$/) },
      });
    });

    it('handles conversion failure with exit code', async () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });

      // LibreOffice exists
      mocks.stat.mockResolvedValueOnce({ size: 1000 });

      const mockProcess = createMockProcess();
      mocks.spawn.mockReturnValue(mockProcess);

      const conversionPromise = convertDocument('doc-1', 'source/document.docx');

      // Simulate failed conversion
      setImmediate(() => {
        mockProcess.stderr.emit('data', Buffer.from('Error: file corrupted'));
        mockProcess.emit('close', 1);
      });

      const result = await conversionPromise;

      expect(result.success).toBe(false);
      expect(result.error).toContain('LibreOffice conversion failed');
      expect(result.error).toContain('file corrupted');
    });

    it('handles spawn error (LibreOffice binary missing)', async () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });

      // LibreOffice exists (stat passes)
      mocks.stat.mockResolvedValueOnce({ size: 1000 });

      const mockProcess = createMockProcess();
      mocks.spawn.mockReturnValue(mockProcess);

      const conversionPromise = convertDocument('doc-1', 'source/document.docx');

      // Simulate spawn error
      setImmediate(() => {
        mockProcess.emit('error', new Error('ENOENT: soffice not found'));
      });

      const result = await conversionPromise;

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to start LibreOffice');
    });

    it('handles conversion timeout', async () => {
      vi.useFakeTimers();

      Object.defineProperty(process, 'platform', { value: 'linux' });

      // LibreOffice exists
      mocks.stat.mockResolvedValueOnce({ size: 1000 });

      const mockProcess = createMockProcess();
      mocks.spawn.mockReturnValue(mockProcess);

      const conversionPromise = convertDocument('doc-1', 'source/document.docx');

      // Fast-forward past timeout (30 seconds)
      await vi.advanceTimersByTimeAsync(31000);

      // Simulate process being killed (timeout handler emits close after kill)
      mockProcess.emit('close', null);

      const result = await conversionPromise;

      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
      expect(result.success).toBe(false);
      expect(result.error).toContain('timed out');

      vi.useRealTimers();
    });

    it('returns error when output file is not created', async () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });

      // LibreOffice exists, but output doesn't
      mocks.stat
        .mockResolvedValueOnce({ size: 1000 }) // findLibreOffice
        .mockRejectedValueOnce(new Error('ENOENT')); // verify output - file not found

      const mockProcess = createMockProcess();
      mocks.spawn.mockReturnValue(mockProcess);

      const conversionPromise = convertDocument('doc-1', 'source/document.docx');

      setImmediate(() => {
        mockProcess.emit('close', 0);
      });

      const result = await conversionPromise;

      expect(result.success).toBe(false);
      expect(result.error).toContain('output file not found');
    });

    it('cleans up partial output on error', async () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });

      mocks.stat.mockResolvedValueOnce({ size: 1000 });

      const mockProcess = createMockProcess();
      mocks.spawn.mockReturnValue(mockProcess);

      const conversionPromise = convertDocument('doc-1', 'source/document.docx');

      setImmediate(() => {
        mockProcess.emit('error', new Error('Test error'));
      });

      await conversionPromise;

      // Verify cleanup was attempted
      expect(mocks.unlink).toHaveBeenCalled();
    });

    it('uses correct LibreOffice arguments', async () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });

      mocks.stat
        .mockResolvedValueOnce({ size: 1000 })
        .mockResolvedValueOnce({ size: 5000 });

      const mockProcess = createMockProcess();
      mocks.spawn.mockReturnValue(mockProcess);

      const conversionPromise = convertDocument('doc-1', 'source/document.docx');

      setImmediate(() => {
        mockProcess.emit('close', 0);
      });

      await conversionPromise;

      expect(mocks.spawn).toHaveBeenCalledWith(
        '/usr/bin/soffice',
        expect.arrayContaining([
          '--headless',
          '--convert-to', 'pdf',
          '--outdir', expect.any(String),
          expect.stringContaining('document.docx'),
        ]),
        expect.objectContaining({
          stdio: ['ignore', 'pipe', 'pipe'],
        })
      );
    });

    it('creates processed directory if it does not exist', async () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });

      mocks.stat
        .mockResolvedValueOnce({ size: 1000 })
        .mockResolvedValueOnce({ size: 5000 });

      const mockProcess = createMockProcess();
      mocks.spawn.mockReturnValue(mockProcess);

      const conversionPromise = convertDocument('doc-1', 'source/document.docx');

      setImmediate(() => {
        mockProcess.emit('close', 0);
      });

      await conversionPromise;

      expect(mocks.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('processed'),
        { recursive: true }
      );
    });
  });
});
