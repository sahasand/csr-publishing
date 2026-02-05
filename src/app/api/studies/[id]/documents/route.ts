import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { CreateDocumentInput } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const documents = await db.document.findMany({
      where: { studyId: id },
      include: {
        slot: true,
        _count: {
          select: {
            annotations: true,
            validationResults: true,
          },
        },
        processingJobs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: [{ slot: { sortOrder: 'asc' } }, { version: 'desc' }],
    });

    // Transform to include latest processing job at top level
    const documentsWithJobStatus = documents.map((doc) => {
      const latestJob = doc.processingJobs[0] || null;
      return {
        ...doc,
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
      };
    });

    return NextResponse.json({ data: documentsWithJobStatus });
  } catch (error) {
    console.error('Failed to fetch study documents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: studyId } = await params;
    const body: Omit<CreateDocumentInput, 'studyId'> = await request.json();

    // Verify study exists
    const study = await db.study.findUnique({ where: { id: studyId } });
    if (!study) {
      return NextResponse.json({ error: 'Study not found' }, { status: 404 });
    }

    // Verify slot exists
    const slot = await db.structureNode.findUnique({
      where: { id: body.slotId },
    });
    if (!slot) {
      return NextResponse.json(
        { error: 'Structure node not found' },
        { status: 404 }
      );
    }

    // Get next version number for this slot
    const existingDocs = await db.document.count({
      where: { studyId, slotId: body.slotId },
    });

    const document = await db.document.create({
      data: {
        studyId,
        slotId: body.slotId,
        version: existingDocs + 1,
        sourceFileName: body.sourceFileName,
        sourcePath: body.sourcePath,
        mimeType: body.mimeType,
        fileSize: body.fileSize,
        status: 'DRAFT',
      },
      include: { slot: true },
    });

    return NextResponse.json({ data: document }, { status: 201 });
  } catch (error) {
    console.error('Failed to create document:', error);
    return NextResponse.json(
      { error: 'Failed to create document' },
      { status: 500 }
    );
  }
}
