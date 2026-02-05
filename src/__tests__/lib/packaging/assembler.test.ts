import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database before importing assembler
vi.mock('@/lib/db', () => ({
  db: {
    study: {
      findUnique: vi.fn(),
    },
  },
}));

import { checkReadiness, assemblePackage, getPackageSummary } from '@/lib/packaging/assembler';
import { db } from '@/lib/db';

describe('assembler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper to create mock study data
  const createMockStudy = (overrides = {}) => ({
    id: 'study-1',
    studyId: 'STUDY-001',
    status: 'ACTIVE',
    activeTemplate: {
      id: 'template-1',
      nodes: [
        { id: 'node-1', code: '16.1', title: 'Study Info', required: true, parentId: null },
        { id: 'node-2', code: '16.2', title: 'Listings', required: false, parentId: null },
      ],
    },
    documents: [],
    ...overrides,
  });

  // Helper to create mock document
  const createMockDocument = (overrides = {}) => ({
    id: 'doc-1',
    slotId: 'node-1',
    status: 'APPROVED',
    version: 1,
    sourcePath: '/uploads/doc.pdf',
    sourceFileName: 'document.pdf',
    fileSize: 1000,
    pageCount: 10,
    slot: { id: 'node-1', code: '16.1', title: 'Study Info' },
    validationResults: [],
    annotations: [],
    ...overrides,
  });

  describe('checkReadiness', () => {
    it('returns ready when all required nodes have approved documents', async () => {
      const mockStudy = createMockStudy({
        documents: [
          createMockDocument({ slotId: 'node-1', status: 'APPROVED' }),
        ],
      });
      vi.mocked(db.study.findUnique).mockResolvedValue(mockStudy);

      const result = await checkReadiness('study-1');

      expect(result.ready).toBe(true);
      expect(result.missingRequired).toHaveLength(0);
    });

    it('returns not ready when required documents are missing', async () => {
      const mockStudy = createMockStudy({
        documents: [], // No documents
      });
      vi.mocked(db.study.findUnique).mockResolvedValue(mockStudy);

      const result = await checkReadiness('study-1');

      expect(result.ready).toBe(false);
      expect(result.missingRequired).toHaveLength(1);
      expect(result.missingRequired[0].code).toBe('16.1');
    });

    it('returns not ready when there are validation errors', async () => {
      const mockStudy = createMockStudy({
        documents: [
          createMockDocument({
            slotId: 'node-1',
            validationResults: [{ id: 'vr-1', passed: false }],
          }),
        ],
      });
      vi.mocked(db.study.findUnique).mockResolvedValue(mockStudy);

      const result = await checkReadiness('study-1');

      expect(result.ready).toBe(false);
      expect(result.validationErrors).toBe(1);
    });

    it('returns not ready when there are unresolved annotations', async () => {
      const mockStudy = createMockStudy({
        documents: [
          createMockDocument({
            slotId: 'node-1',
            annotations: [{ id: 'ann-1', status: 'OPEN', type: 'CORRECTION_REQUIRED' }],
          }),
        ],
      });
      vi.mocked(db.study.findUnique).mockResolvedValue(mockStudy);

      const result = await checkReadiness('study-1');

      expect(result.ready).toBe(false);
      expect(result.unresolvedAnnotations).toBe(1);
    });

    it('throws error when study not found', async () => {
      vi.mocked(db.study.findUnique).mockResolvedValue(null);

      await expect(checkReadiness('invalid-id')).rejects.toThrow('Study not found');
    });

    it('throws error when study has no template', async () => {
      const mockStudy = createMockStudy({ activeTemplate: null });
      vi.mocked(db.study.findUnique).mockResolvedValue(mockStudy);

      await expect(checkReadiness('study-1')).rejects.toThrow('no active template');
    });

    it('accepts published documents as ready', async () => {
      const mockStudy = createMockStudy({
        documents: [
          createMockDocument({ slotId: 'node-1', status: 'PUBLISHED' }),
        ],
      });
      vi.mocked(db.study.findUnique).mockResolvedValue(mockStudy);

      const result = await checkReadiness('study-1');

      expect(result.ready).toBe(true);
    });

    it('tracks pending documents', async () => {
      const mockStudy = createMockStudy({
        documents: [
          createMockDocument({ slotId: 'node-1', status: 'APPROVED' }),
          createMockDocument({ id: 'doc-2', slotId: 'node-2', status: 'DRAFT', slot: { id: 'node-2', code: '16.2', title: 'Listings' } }),
        ],
      });
      vi.mocked(db.study.findUnique).mockResolvedValue(mockStudy);

      const result = await checkReadiness('study-1');

      expect(result.pendingApproval).toHaveLength(1);
      expect(result.pendingApproval[0].status).toBe('DRAFT');
    });

    it('prefers higher version documents for the same status', async () => {
      const mockStudy = createMockStudy({
        documents: [
          createMockDocument({ id: 'doc-1', slotId: 'node-1', status: 'APPROVED', version: 1 }),
          createMockDocument({ id: 'doc-2', slotId: 'node-1', status: 'APPROVED', version: 2 }),
        ],
      });
      vi.mocked(db.study.findUnique).mockResolvedValue(mockStudy);

      const result = await checkReadiness('study-1');

      expect(result.ready).toBe(true);
      expect(result.totalFiles).toBe(1);
    });

    it('counts total files correctly with multiple slots', async () => {
      const mockStudy = createMockStudy({
        documents: [
          createMockDocument({ id: 'doc-1', slotId: 'node-1', status: 'APPROVED' }),
          createMockDocument({ id: 'doc-2', slotId: 'node-2', status: 'APPROVED', slot: { id: 'node-2', code: '16.2', title: 'Listings' } }),
        ],
      });
      vi.mocked(db.study.findUnique).mockResolvedValue(mockStudy);

      const result = await checkReadiness('study-1');

      expect(result.totalFiles).toBe(2);
    });

    it('tracks PROCESSED status as pending', async () => {
      const mockStudy = createMockStudy({
        documents: [
          createMockDocument({ slotId: 'node-1', status: 'APPROVED' }),
          createMockDocument({ id: 'doc-2', slotId: 'node-2', status: 'PROCESSED', slot: { id: 'node-2', code: '16.2', title: 'Listings' } }),
        ],
      });
      vi.mocked(db.study.findUnique).mockResolvedValue(mockStudy);

      const result = await checkReadiness('study-1');

      expect(result.pendingApproval).toHaveLength(1);
      expect(result.pendingApproval[0].status).toBe('PROCESSED');
    });

    it('tracks IN_REVIEW status as pending', async () => {
      const mockStudy = createMockStudy({
        documents: [
          createMockDocument({ slotId: 'node-1', status: 'APPROVED' }),
          createMockDocument({ id: 'doc-2', slotId: 'node-2', status: 'IN_REVIEW', slot: { id: 'node-2', code: '16.2', title: 'Listings' } }),
        ],
      });
      vi.mocked(db.study.findUnique).mockResolvedValue(mockStudy);

      const result = await checkReadiness('study-1');

      expect(result.pendingApproval).toHaveLength(1);
      expect(result.pendingApproval[0].status).toBe('IN_REVIEW');
    });

    it('tracks CORRECTIONS_NEEDED status as pending', async () => {
      const mockStudy = createMockStudy({
        documents: [
          createMockDocument({ slotId: 'node-1', status: 'APPROVED' }),
          createMockDocument({ id: 'doc-2', slotId: 'node-2', status: 'CORRECTIONS_NEEDED', slot: { id: 'node-2', code: '16.2', title: 'Listings' } }),
        ],
      });
      vi.mocked(db.study.findUnique).mockResolvedValue(mockStudy);

      const result = await checkReadiness('study-1');

      expect(result.pendingApproval).toHaveLength(1);
      expect(result.pendingApproval[0].status).toBe('CORRECTIONS_NEEDED');
    });

    it('returns totalRequiredNodes count', async () => {
      const mockStudy = createMockStudy({
        activeTemplate: {
          id: 'template-1',
          nodes: [
            { id: 'node-1', code: '16.1', title: 'Study Info', required: true, parentId: null },
            { id: 'node-2', code: '16.2', title: 'Listings', required: true, parentId: null },
            { id: 'node-3', code: '16.3', title: 'Optional', required: false, parentId: null },
          ],
        },
        documents: [
          createMockDocument({ slotId: 'node-1', status: 'APPROVED' }),
          createMockDocument({ id: 'doc-2', slotId: 'node-2', status: 'APPROVED', slot: { id: 'node-2', code: '16.2', title: 'Listings' } }),
        ],
      });
      vi.mocked(db.study.findUnique).mockResolvedValue(mockStudy);

      const result = await checkReadiness('study-1');

      expect(result.totalRequiredNodes).toBe(2);
    });
  });

  describe('assemblePackage', () => {
    it('assembles manifest with files', async () => {
      const mockStudy = createMockStudy({
        documents: [
          createMockDocument({ slotId: 'node-1', status: 'APPROVED' }),
        ],
      });
      vi.mocked(db.study.findUnique).mockResolvedValue(mockStudy);

      const manifest = await assemblePackage('study-1');

      expect(manifest.studyId).toBe('study-1');
      expect(manifest.studyNumber).toBe('STUDY-001');
      expect(manifest.files).toHaveLength(1);
      expect(manifest.files[0].nodeCode).toBe('16.1');
    });

    it('prefers published over approved documents', async () => {
      const mockStudy = createMockStudy({
        documents: [
          createMockDocument({ id: 'doc-1', slotId: 'node-1', status: 'APPROVED', version: 1 }),
          createMockDocument({ id: 'doc-2', slotId: 'node-1', status: 'PUBLISHED', version: 2 }),
        ],
      });
      vi.mocked(db.study.findUnique).mockResolvedValue(mockStudy);

      const manifest = await assemblePackage('study-1');

      expect(manifest.files).toHaveLength(1);
      expect(manifest.files[0].version).toBe(2);
    });

    it('generates correct target paths', async () => {
      const mockStudy = createMockStudy({
        documents: [
          createMockDocument({ slotId: 'node-1', status: 'APPROVED' }),
        ],
      });
      vi.mocked(db.study.findUnique).mockResolvedValue(mockStudy);

      const manifest = await assemblePackage('study-1');

      expect(manifest.files[0].targetPath).toContain('m5');
      expect(manifest.files[0].targetPath).toContain('16-1');
    });

    it('builds folder structure', async () => {
      const mockStudy = createMockStudy({
        documents: [
          createMockDocument({ slotId: 'node-1', status: 'APPROVED' }),
        ],
      });
      vi.mocked(db.study.findUnique).mockResolvedValue(mockStudy);

      const manifest = await assemblePackage('study-1');

      expect(manifest.folderStructure).toBeDefined();
      expect(manifest.folderStructure.length).toBeGreaterThan(0);
    });

    it('throws error when study not found', async () => {
      vi.mocked(db.study.findUnique).mockResolvedValue(null);

      await expect(assemblePackage('invalid-id')).rejects.toThrow('Study not found');
    });

    it('throws error when study has no template', async () => {
      const mockStudy = createMockStudy({ activeTemplate: null });
      vi.mocked(db.study.findUnique).mockResolvedValue(mockStudy);

      await expect(assemblePackage('study-1')).rejects.toThrow('no active template');
    });

    it('includes readiness check in manifest', async () => {
      const mockStudy = createMockStudy({
        documents: [
          createMockDocument({ slotId: 'node-1', status: 'APPROVED' }),
        ],
      });
      vi.mocked(db.study.findUnique).mockResolvedValue(mockStudy);

      const manifest = await assemblePackage('study-1');

      expect(manifest.readiness).toBeDefined();
      expect(manifest.readiness.ready).toBe(true);
    });

    it('includes generatedAt timestamp', async () => {
      const mockStudy = createMockStudy({
        documents: [
          createMockDocument({ slotId: 'node-1', status: 'APPROVED' }),
        ],
      });
      vi.mocked(db.study.findUnique).mockResolvedValue(mockStudy);

      const before = new Date();
      const manifest = await assemblePackage('study-1');
      const after = new Date();

      expect(manifest.generatedAt).toBeInstanceOf(Date);
      expect(manifest.generatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(manifest.generatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('sorts files by node code', async () => {
      const mockStudy = createMockStudy({
        activeTemplate: {
          id: 'template-1',
          nodes: [
            { id: 'node-1', code: '16.2', title: 'Listings', required: false, parentId: null },
            { id: 'node-2', code: '16.1', title: 'Study Info', required: true, parentId: null },
            { id: 'node-3', code: '16.1.1', title: 'Sub Info', required: false, parentId: 'node-2' },
          ],
        },
        documents: [
          createMockDocument({ id: 'doc-1', slotId: 'node-1', status: 'APPROVED', slot: { id: 'node-1', code: '16.2', title: 'Listings' } }),
          createMockDocument({ id: 'doc-2', slotId: 'node-2', status: 'APPROVED', slot: { id: 'node-2', code: '16.1', title: 'Study Info' } }),
          createMockDocument({ id: 'doc-3', slotId: 'node-3', status: 'APPROVED', slot: { id: 'node-3', code: '16.1.1', title: 'Sub Info' } }),
        ],
      });
      vi.mocked(db.study.findUnique).mockResolvedValue(mockStudy);

      const manifest = await assemblePackage('study-1');

      expect(manifest.files[0].nodeCode).toBe('16.1');
      expect(manifest.files[1].nodeCode).toBe('16.1.1');
      expect(manifest.files[2].nodeCode).toBe('16.2');
    });

    it('excludes drafts by default', async () => {
      const mockStudy = createMockStudy({
        documents: [
          createMockDocument({ id: 'doc-1', slotId: 'node-1', status: 'DRAFT' }),
        ],
      });
      vi.mocked(db.study.findUnique).mockResolvedValue(mockStudy);

      const manifest = await assemblePackage('study-1');

      expect(manifest.files).toHaveLength(0);
    });

    it('includes drafts when option is enabled', async () => {
      const mockStudy = createMockStudy({
        documents: [
          createMockDocument({ id: 'doc-1', slotId: 'node-1', status: 'DRAFT' }),
        ],
      });
      vi.mocked(db.study.findUnique).mockResolvedValue(mockStudy);

      const manifest = await assemblePackage('study-1', {
        includeApproved: true,
        includePublished: true,
        includeDrafts: true
      });

      expect(manifest.files).toHaveLength(1);
    });

    it('sanitizes file names in target path', async () => {
      const mockStudy = createMockStudy({
        documents: [
          createMockDocument({
            slotId: 'node-1',
            status: 'APPROVED',
            sourceFileName: 'My Document (Final).pdf',
          }),
        ],
      });
      vi.mocked(db.study.findUnique).mockResolvedValue(mockStudy);

      const manifest = await assemblePackage('study-1');

      expect(manifest.files[0].fileName).toBe('my-document-final.pdf');
      expect(manifest.files[0].targetPath).toContain('my-document-final.pdf');
    });

    it('includes file metadata in manifest', async () => {
      const mockStudy = createMockStudy({
        documents: [
          createMockDocument({
            slotId: 'node-1',
            status: 'APPROVED',
            fileSize: 2000,
            pageCount: 15,
            sourcePath: '/uploads/doc.pdf',
          }),
        ],
      });
      vi.mocked(db.study.findUnique).mockResolvedValue(mockStudy);

      const manifest = await assemblePackage('study-1');

      expect(manifest.files[0].fileSize).toBe(2000);
      expect(manifest.files[0].pageCount).toBe(15);
      expect(manifest.files[0].sourcePath).toBe('/uploads/doc.pdf');
    });
  });

  describe('getPackageSummary', () => {
    it('returns summary with counts', async () => {
      const mockStudy = createMockStudy({
        documents: [
          createMockDocument({ slotId: 'node-1', status: 'APPROVED' }),
        ],
      });
      vi.mocked(db.study.findUnique).mockResolvedValue(mockStudy);

      const summary = await getPackageSummary('study-1');

      expect(summary.studyNumber).toBe('STUDY-001');
      expect(summary.totalNodes).toBe(2);
      expect(summary.requiredNodes).toBe(1);
      expect(summary.readiness).toBeDefined();
    });

    it('throws error when study not found', async () => {
      vi.mocked(db.study.findUnique).mockResolvedValue(null);

      await expect(getPackageSummary('invalid-id')).rejects.toThrow('Study not found');
    });

    it('throws error when study has no template', async () => {
      const mockStudy = createMockStudy({ activeTemplate: null });
      vi.mocked(db.study.findUnique).mockResolvedValue(mockStudy);

      await expect(getPackageSummary('study-1')).rejects.toThrow('no active template');
    });

    it('returns documentsReady count', async () => {
      const mockStudy = createMockStudy({
        documents: [
          createMockDocument({ slotId: 'node-1', status: 'APPROVED' }),
          createMockDocument({ id: 'doc-2', slotId: 'node-2', status: 'PUBLISHED', slot: { id: 'node-2', code: '16.2', title: 'Listings' } }),
        ],
      });
      vi.mocked(db.study.findUnique).mockResolvedValue(mockStudy);

      const summary = await getPackageSummary('study-1');

      expect(summary.documentsReady).toBe(2);
    });

    it('includes full readiness check', async () => {
      const mockStudy = createMockStudy({
        documents: [], // No documents - not ready
      });
      vi.mocked(db.study.findUnique).mockResolvedValue(mockStudy);

      const summary = await getPackageSummary('study-1');

      expect(summary.readiness.ready).toBe(false);
      expect(summary.readiness.missingRequired).toHaveLength(1);
    });
  });
});
