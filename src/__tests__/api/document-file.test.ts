import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { EventEmitter } from 'events';

vi.mock('@/lib/db', () => ({
  db: {
    document: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('fs', () => {
  const mock = {
    statSync: vi.fn(() => ({ size: 10 })),
    createReadStream: vi.fn(() => {
      const emitter = new EventEmitter() as EventEmitter & { destroy: () => void };
      emitter.destroy = vi.fn();
      return emitter;
    }),
  };
  return { ...mock, default: mock };
});

import { GET } from '@/app/api/documents/[id]/file/route';
import { db } from '@/lib/db';

describe('GET /api/documents/[id]/file - path containment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('serves a file whose stored path stays within the upload directory', async () => {
    vi.mocked(db.document.findUnique).mockResolvedValue({
      id: 'd1',
      sourcePath: 'source/ok.pdf',
      processedPath: 'processed/ok.pdf',
      sourceFileName: 'ok.pdf',
      mimeType: 'application/pdf',
    } as any);

    const request = new NextRequest('http://localhost:3000/api/documents/d1/file');
    const response = await GET(request, { params: Promise.resolve({ id: 'd1' }) });

    expect(response.status).toBe(200);
  });

  it('rejects a stored path that escapes the upload directory (traversal)', async () => {
    vi.mocked(db.document.findUnique).mockResolvedValue({
      id: 'd1',
      sourcePath: 'source/ok.pdf',
      processedPath: '../../../etc/passwd',
      sourceFileName: 'ok.pdf',
      mimeType: 'application/pdf',
    } as any);

    const request = new NextRequest('http://localhost:3000/api/documents/d1/file');
    const response = await GET(request, { params: Promise.resolve({ id: 'd1' }) });

    expect(response.status).toBe(404);
  });

  it('rejects an absolute stored path', async () => {
    vi.mocked(db.document.findUnique).mockResolvedValue({
      id: 'd1',
      sourcePath: '/etc/passwd',
      processedPath: null,
      sourceFileName: 'ok.pdf',
      mimeType: 'application/pdf',
    } as any);

    const request = new NextRequest('http://localhost:3000/api/documents/d1/file');
    const response = await GET(request, { params: Promise.resolve({ id: 'd1' }) });

    expect(response.status).toBe(404);
  });
});
