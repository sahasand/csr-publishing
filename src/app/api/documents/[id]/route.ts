import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { deleteFile } from '@/lib/storage';
import type { UpdateDocumentInput } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const document = await db.document.findUnique({
      where: { id },
      include: {
        slot: true,
        study: true,
        annotations: {
          include: { replies: true },
          orderBy: { createdAt: 'desc' },
        },
        validationResults: {
          orderBy: { createdAt: 'desc' },
        },
        checklistResponse: true,
        processingJobs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Extract latest processing job for convenience
    const latestJob = document.processingJobs[0] || null;

    return NextResponse.json({
      data: {
        ...document,
        latestProcessingJob: latestJob
          ? {
              id: latestJob.id,
              jobType: latestJob.jobType,
              status: latestJob.status,
              progress: latestJob.progress,
              error: latestJob.error,
              createdAt: latestJob.createdAt,
              completedAt: latestJob.completedAt,
            }
          : null,
      },
    });
  } catch (error) {
    console.error('Failed to fetch document:', error);
    return NextResponse.json(
      { error: 'Failed to fetch document' },
      { status: 500 }
    );
  }
}

// Fields a client is allowed to update via PATCH. Two categories are
// deliberately excluded:
//   - status: workflow transitions must go through
//     POST /api/documents/[id]/transition so rules and audit history are enforced.
//   - sourcePath / processedPath: set only by server-side processing; accepting
//     them from clients would enable path traversal in the file-download route.
const VALID_UPDATE_FIELDS = [
  'processingError',
  'pageCount',
  'pdfVersion',
  'isPdfA',
] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: UpdateDocumentInput & Record<string, unknown> = await request.json();

    // Status changes must go through POST /api/documents/[id]/transition to
    // enforce workflow rules — ignore it here.
    if (body.status !== undefined) {
      console.warn(`PATCH /api/documents/${id}: ignored status field "${body.status}". Use POST /api/documents/${id}/transition instead.`);
    }

    // Whitelist updatable fields
    const data: Record<string, unknown> = {};
    for (const field of VALID_UPDATE_FIELDS) {
      if (body[field] !== undefined) {
        data[field] = body[field];
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        {
          error: `Request body must contain at least one valid field: ${VALID_UPDATE_FIELDS.join(', ')}`,
        },
        { status: 400 }
      );
    }

    const document = await db.document.update({
      where: { id },
      data,
      include: { slot: true },
    });

    return NextResponse.json({ data: document });
  } catch (error) {
    console.error('Failed to update document:', error);
    return NextResponse.json(
      { error: 'Failed to update document' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch document to get file paths before deleting the DB record
    const document = await db.document.findUnique({
      where: { id },
      select: { sourcePath: true, processedPath: true },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Delete DB record first (cascades to annotations, validation results, etc.)
    await db.document.delete({ where: { id } });

    // Clean up physical files from disk
    if (document.sourcePath) {
      await deleteFile(document.sourcePath);
    }
    if (document.processedPath) {
      await deleteFile(document.processedPath);
    }

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    console.error('Failed to delete document:', error);
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    );
  }
}
