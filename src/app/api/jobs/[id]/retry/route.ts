import { NextRequest, NextResponse } from 'next/server';
import { retryProcessingJob } from '@/lib/process-document';

// UUID format validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/jobs/[id]/retry
 * Retries a failed job by creating a new job and processing synchronously
 * Only failed jobs can be retried
 */
export async function POST(
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

    // Retry the job (this handles all validation and processing)
    const { newJob } = await retryProcessingJob(id);

    return NextResponse.json({
      data: {
        id: newJob.id,
        documentId: newJob.documentId,
        jobType: newJob.jobType,
        status: newJob.status,
        createdAt: newJob.createdAt,
        retriedFrom: id,
      },
    });
  } catch (error) {
    console.error('Failed to retry job:', error);

    // Return appropriate error response based on error type
    const errorMessage = error instanceof Error ? error.message : 'Failed to retry job';

    if (errorMessage === 'Job not found' || errorMessage === 'Associated document not found') {
      return NextResponse.json({ error: errorMessage }, { status: 404 });
    }

    if (errorMessage.includes('Cannot retry job with status')) {
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    return NextResponse.json({ error: 'Failed to retry job' }, { status: 500 });
  }
}
