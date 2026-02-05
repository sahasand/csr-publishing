import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// UUID format validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/jobs/[id]
 * Returns job status, progress, result, and associated document info
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate UUID format
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json(
        { error: 'Invalid job ID format' },
        { status: 400 }
      );
    }

    // Get job from database
    const processingJob = await db.processingJob.findUnique({
      where: { id },
      include: {
        document: {
          select: {
            id: true,
            sourceFileName: true,
            status: true,
            studyId: true,
            slotId: true,
          },
        },
      },
    });

    if (!processingJob) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Build response
    const response = {
      id: processingJob.id,
      documentId: processingJob.documentId,
      jobType: processingJob.jobType,
      status: processingJob.status,
      progress: processingJob.progress,
      error: processingJob.error,
      result: processingJob.result,
      createdAt: processingJob.createdAt,
      startedAt: processingJob.startedAt,
      completedAt: processingJob.completedAt,
      document: processingJob.document,
    };

    return NextResponse.json({ data: response });
  } catch (error) {
    console.error('Failed to fetch job:', error);
    return NextResponse.json(
      { error: 'Failed to fetch job' },
      { status: 500 }
    );
  }
}
