import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/db', () => ({
  db: {
    study: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { PATCH } from '@/app/api/studies/[id]/route';
import { db } from '@/lib/db';

describe('PATCH /api/studies/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates whitelisted fields', async () => {
    vi.mocked(db.study.update).mockResolvedValue({ id: 's1', sponsor: 'New' } as any);

    const request = new NextRequest('http://localhost:3000/api/studies/s1', {
      method: 'PATCH',
      body: JSON.stringify({ sponsor: 'New', activeTemplateId: 't1' }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: 's1' }) });

    expect(response.status).toBe(200);
    const updateArg = vi.mocked(db.study.update).mock.calls[0][0];
    expect(updateArg.data).toEqual({ sponsor: 'New', activeTemplateId: 't1' });
  });

  it('strips non-whitelisted fields (mass-assignment guard)', async () => {
    vi.mocked(db.study.update).mockResolvedValue({ id: 's1' } as any);

    const request = new NextRequest('http://localhost:3000/api/studies/s1', {
      method: 'PATCH',
      body: JSON.stringify({
        sponsor: 'New',
        studyId: 'HIJACKED-PROTOCOL',
        id: 'evil-id',
        createdAt: '2000-01-01T00:00:00Z',
      }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: 's1' }) });

    expect(response.status).toBe(200);
    const updateArg = vi.mocked(db.study.update).mock.calls[0][0];
    expect(updateArg.data).toEqual({ sponsor: 'New' });
    expect(updateArg.data).not.toHaveProperty('studyId');
    expect(updateArg.data).not.toHaveProperty('id');
    expect(updateArg.data).not.toHaveProperty('createdAt');
  });

  it('returns 400 when no whitelisted field is provided', async () => {
    const request = new NextRequest('http://localhost:3000/api/studies/s1', {
      method: 'PATCH',
      body: JSON.stringify({ id: 'evil', studyId: 'HIJACK' }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: 's1' }) });

    expect(response.status).toBe(400);
    expect(db.study.update).not.toHaveBeenCalled();
  });
});
