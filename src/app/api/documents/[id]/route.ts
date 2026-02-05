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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: UpdateDocumentInput = await request.json();

    // Strip status from PATCH body — status changes must go through
    // POST /api/documents/[id]/transition to enforce workflow rules
    const { status, ...safeFields } = body;

    if (status) {
      console.warn(`PATCH /api/documents/${id}: ignored status field "${status}". Use POST /api/documents/${id}/transition instead.`);
    }

    const document = await db.document.update({
      where: { id },
      data: safeFields,
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
