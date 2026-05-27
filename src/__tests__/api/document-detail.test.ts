import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/db', () => ({
  db: {
    document: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { PATCH } from '@/app/api/documents/[id]/route';
import { db } from '@/lib/db';

describe('PATCH /api/documents/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates whitelisted metadata fields', async () => {
    vi.mocked(db.document.update).mockResolvedValue({ id: 'd1', pageCount: 12 } as any);

    const request = new NextRequest('http://localhost:3000/api/documents/d1', {
      method: 'PATCH',
      body: JSON.stringify({ pageCount: 12, pdfVersion: '1.7' }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: 'd1' }) });

    expect(response.status).toBe(200);
    const updateArg = vi.mocked(db.document.update).mock.calls[0][0];
    expect(updateArg.data).toEqual({ pageCount: 12, pdfVersion: '1.7' });
  });

  it('ignores status (must go through transition endpoint)', async () => {
    vi.mocked(db.document.update).mockResolvedValue({ id: 'd1' } as any);

    const request = new NextRequest('http://localhost:3000/api/documents/d1', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'APPROVED', pageCount: 12 }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: 'd1' }) });

    expect(response.status).toBe(200);
    const updateArg = vi.mocked(db.document.update).mock.calls[0][0];
    expect(updateArg.data).toEqual({ pageCount: 12 });
    expect(updateArg.data).not.toHaveProperty('status');
  });

  it('strips processedPath/sourcePath (path-traversal guard)', async () => {
    vi.mocked(db.document.update).mockResolvedValue({ id: 'd1' } as any);

    const request = new NextRequest('http://localhost:3000/api/documents/d1', {
      method: 'PATCH',
      body: JSON.stringify({
        pageCount: 12,
        processedPath: '../../../etc/passwd',
        sourcePath: '../../secrets',
        studyId: 'other-study',
      }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: 'd1' }) });

    expect(response.status).toBe(200);
    const updateArg = vi.mocked(db.document.update).mock.calls[0][0];
    expect(updateArg.data).toEqual({ pageCount: 12 });
    expect(updateArg.data).not.toHaveProperty('processedPath');
    expect(updateArg.data).not.toHaveProperty('sourcePath');
    expect(updateArg.data).not.toHaveProperty('studyId');
  });

  it('returns 400 when no whitelisted field is provided', async () => {
    const request = new NextRequest('http://localhost:3000/api/documents/d1', {
      method: 'PATCH',
      body: JSON.stringify({ processedPath: '../../../etc/passwd' }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: 'd1' }) });

    expect(response.status).toBe(400);
    expect(db.document.update).not.toHaveBeenCalled();
  });
});
