import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock the db module before importing routes
vi.mock('@/lib/db', () => ({
  db: {
    study: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { GET, POST } from '@/app/api/studies/route';
import { db } from '@/lib/db';

describe('Studies API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/studies', () => {
    it('returns list of studies', async () => {
      const mockStudies = [
        {
          id: '123',
          studyId: 'TEST-001',
          sponsor: 'Test Pharma',
          status: 'ACTIVE',
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { documents: 5 },
        },
      ];

      vi.mocked(db.study.findMany).mockResolvedValue(mockStudies);

      const response = await GET();
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data).toHaveLength(1);
      expect(json.data[0].studyId).toBe('TEST-001');
      expect(json.data[0].sponsor).toBe('Test Pharma');
      expect(db.study.findMany).toHaveBeenCalledOnce();
    });

    it('handles database errors', async () => {
      vi.mocked(db.study.findMany).mockRejectedValue(new Error('DB error'));

      const response = await GET();
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.error).toBe('Failed to fetch studies');
    });
  });

  describe('POST /api/studies', () => {
    it('returns 400 for missing required fields', async () => {
      const request = new NextRequest('http://localhost:3000/api/studies', {
        method: 'POST',
        body: JSON.stringify({ studyId: 'TEST-003' }), // missing sponsor
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toContain('required');
    });

    it('returns 409 for duplicate study ID', async () => {
      vi.mocked(db.study.findUnique).mockResolvedValue({ id: 'existing' } as any);

      const request = new NextRequest('http://localhost:3000/api/studies', {
        method: 'POST',
        body: JSON.stringify({
          studyId: 'EXISTING',
          sponsor: 'Test',
        }),
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(409);
      expect(json.error).toContain('already exists');
    });
  });
});
