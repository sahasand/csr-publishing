import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const studyId = searchParams.get('studyId');
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {};
    if (studyId) where.studyId = studyId;
    if (status) where.status = status;

    const documents = await db.document.findMany({
      where,
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
      orderBy: { updatedAt: 'desc' },
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
    console.error('Failed to fetch documents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}
