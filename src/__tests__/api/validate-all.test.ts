import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/db', () => ({
  db: {
    study: {
      findUnique: vi.fn(),
    },
    document: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/validation/runner', () => ({
  // Status-preserving validation used for bulk validate-all
  runValidation: vi.fn(),
}));

import { POST } from '@/app/api/studies/[id]/validate-all/route';
import { db } from '@/lib/db';
import { runValidation } from '@/lib/validation/runner';

const STUDY_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

function makeRequest() {
  return new NextRequest(`http://localhost:3000/api/studies/${STUDY_ID}/validate-all`, {
    method: 'POST',
  });
}

describe('POST /api/studies/[id]/validate-all', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs status-preserving validation on every document in the study', async () => {
    vi.mocked(db.study.findUnique).mockResolvedValue({ id: STUDY_ID } as never);
    vi.mocked(db.document.findMany).mockResolvedValue([
      { id: 'doc-1' },
      { id: 'doc-2' },
      { id: 'doc-3' },
    ] as never);
    vi.mocked(runValidation).mockResolvedValue({ passed: 1, failed: 0 } as never);

    const response = await POST(makeRequest(), { params: Promise.resolve({ id: STUDY_ID }) });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(runValidation).toHaveBeenCalledTimes(3);
    expect(runValidation).toHaveBeenCalledWith('doc-1');
    expect(runValidation).toHaveBeenCalledWith('doc-2');
    expect(runValidation).toHaveBeenCalledWith('doc-3');
    expect(json.data.total).toBe(3);
    expect(json.data.validated).toBe(3);
  });

  it('returns 400 for an invalid study id', async () => {
    const req = new NextRequest('http://localhost:3000/api/studies/not-a-uuid/validate-all', {
      method: 'POST',
    });
    const response = await POST(req, { params: Promise.resolve({ id: 'not-a-uuid' }) });
    expect(response.status).toBe(400);
    expect(runValidation).not.toHaveBeenCalled();
  });

  it('returns 404 when the study does not exist', async () => {
    vi.mocked(db.study.findUnique).mockResolvedValue(null);

    const response = await POST(makeRequest(), { params: Promise.resolve({ id: STUDY_ID }) });
    expect(response.status).toBe(404);
    expect(runValidation).not.toHaveBeenCalled();
  });

  it('continues past a failing document and reports it', async () => {
    vi.mocked(db.study.findUnique).mockResolvedValue({ id: STUDY_ID } as never);
    vi.mocked(db.document.findMany).mockResolvedValue([
      { id: 'doc-1' },
      { id: 'doc-2' },
    ] as never);
    vi.mocked(runValidation)
      .mockResolvedValueOnce({ passed: 1, failed: 0 } as never)
      .mockRejectedValueOnce(new Error('boom'));

    const response = await POST(makeRequest(), { params: Promise.resolve({ id: STUDY_ID }) });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.total).toBe(2);
    expect(json.data.validated).toBe(1);
    expect(json.data.failed).toBe(1);
  });
});
