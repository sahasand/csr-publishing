import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: {
    document: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    validationRule: {
      findMany: vi.fn(),
    },
    validationResult: {
      findMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { GET } from '@/app/api/documents/[id]/validation/route';
import { db } from '@/lib/db';

describe('Validation API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/documents/[id]/validation', () => {
    it('returns validation results for a document', async () => {
      const documentId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

      const mockDocument = { id: documentId };
      const mockResults = [
        {
          id: '1',
          documentId,
          ruleId: 'rule-1',
          ruleName: 'File Size Check',
          passed: true,
          message: null,
          details: null,
          createdAt: new Date(),
        },
      ];
      const mockRules = [
        {
          id: 'rule-1',
          severity: 'WARNING',
          category: 'CONTENT',
        },
      ];

      vi.mocked(db.document.findUnique).mockResolvedValue(mockDocument as any);
      vi.mocked(db.validationResult.findMany).mockResolvedValue(mockResults as any);
      vi.mocked(db.validationRule.findMany).mockResolvedValue(mockRules as any);

      const request = new Request(`http://localhost:3000/api/documents/${documentId}/validation`);
      const response = await GET(request as any, {
        params: Promise.resolve({ id: documentId }),
      });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data).toBeDefined();
      expect(json.data.documentId).toBe(documentId);
      expect(json.data.results).toHaveLength(1);
    });

    it('returns 400 for invalid UUID', async () => {
      const request = new Request('http://localhost:3000/api/documents/invalid/validation');
      const response = await GET(request as any, {
        params: Promise.resolve({ id: 'invalid-uuid' }),
      });
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toContain('Invalid');
    });

    it('returns 404 for non-existent document', async () => {
      const documentId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

      vi.mocked(db.document.findUnique).mockResolvedValue(null);

      const request = new Request(`http://localhost:3000/api/documents/${documentId}/validation`);
      const response = await GET(request as any, {
        params: Promise.resolve({ id: documentId }),
      });
      const json = await response.json();

      expect(response.status).toBe(404);
      expect(json.error).toContain('not found');
    });

    it('handles database errors gracefully', async () => {
      const documentId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

      vi.mocked(db.document.findUnique).mockRejectedValue(new Error('DB error'));

      const request = new Request(`http://localhost:3000/api/documents/${documentId}/validation`);
      const response = await GET(request as any, {
        params: Promise.resolve({ id: documentId }),
      });
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.error).toBe('Failed to fetch validation results');
    });

    it('sorts results by severity (ERROR > WARNING > INFO)', async () => {
      const documentId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

      const mockDocument = { id: documentId };
      const mockResults = [
        { id: '1', documentId, ruleId: 'rule-1', ruleName: 'Info Check', passed: false, message: null, details: null, createdAt: new Date() },
        { id: '2', documentId, ruleId: 'rule-2', ruleName: 'Error Check', passed: false, message: null, details: null, createdAt: new Date() },
        { id: '3', documentId, ruleId: 'rule-3', ruleName: 'Warning Check', passed: false, message: null, details: null, createdAt: new Date() },
      ];
      const mockRules = [
        { id: 'rule-1', severity: 'INFO', category: 'CONTENT' },
        { id: 'rule-2', severity: 'ERROR', category: 'CONTENT' },
        { id: 'rule-3', severity: 'WARNING', category: 'CONTENT' },
      ];

      vi.mocked(db.document.findUnique).mockResolvedValue(mockDocument as any);
      vi.mocked(db.validationResult.findMany).mockResolvedValue(mockResults as any);
      vi.mocked(db.validationRule.findMany).mockResolvedValue(mockRules as any);

      const request = new Request(`http://localhost:3000/api/documents/${documentId}/validation`);
      const response = await GET(request as any, {
        params: Promise.resolve({ id: documentId }),
      });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.results[0].severity).toBe('ERROR');
      expect(json.data.results[1].severity).toBe('WARNING');
      expect(json.data.results[2].severity).toBe('INFO');
    });
  });
});
