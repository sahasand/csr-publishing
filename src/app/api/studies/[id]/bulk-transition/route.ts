import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DocumentStatus } from '@/generated/prisma/client';

// Valid transitions map (same as single-document transition)
const VALID_TRANSITIONS: Record<DocumentStatus, DocumentStatus[]> = {
  DRAFT: [DocumentStatus.IN_REVIEW],
  PROCESSING: [],
  PROCESSED: [DocumentStatus.IN_REVIEW],
  PROCESSING_FAILED: [DocumentStatus.DRAFT],
  IN_REVIEW: [DocumentStatus.APPROVED, DocumentStatus.CORRECTIONS_NEEDED],
  CORRECTIONS_NEEDED: [DocumentStatus.DRAFT, DocumentStatus.IN_REVIEW],
  APPROVED: [DocumentStatus.PUBLISHED, DocumentStatus.CORRECTIONS_NEEDED],
  PUBLISHED: [DocumentStatus.CORRECTIONS_NEEDED],
};

// Transitions that require a comment
const REQUIRES_COMMENT: DocumentStatus[] = [
  DocumentStatus.CORRECTIONS_NEEDED,
];

interface BulkTransitionBody {
  toStatus: DocumentStatus;
  fromStatuses: DocumentStatus[];
  comment?: string;
  userName?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: studyId } = await params;
    const body: BulkTransitionBody = await request.json();
    const { toStatus, fromStatuses, comment, userName = 'System' } = body;

    // Validate toStatus is a valid enum value
    if (!Object.values(DocumentStatus).includes(toStatus)) {
      return NextResponse.json(
        { error: `Invalid target status: ${toStatus}` },
        { status: 400 }
      );
    }

    // Validate fromStatuses are valid enum values
    for (const fs of fromStatuses) {
      if (!Object.values(DocumentStatus).includes(fs)) {
        return NextResponse.json(
          { error: `Invalid source status: ${fs}` },
          { status: 400 }
        );
      }
    }

    // Check if comment is required
    if (REQUIRES_COMMENT.includes(toStatus) && !comment?.trim()) {
      return NextResponse.json(
        { error: 'Comment is required for this transition' },
        { status: 400 }
      );
    }

    // Validate study exists
    const study = await db.study.findUnique({
      where: { id: studyId },
      select: { id: true },
    });

    if (!study) {
      return NextResponse.json(
        { error: 'Study not found' },
        { status: 404 }
      );
    }

    // Find all documents in the study matching any of the fromStatuses
    const documents = await db.document.findMany({
      where: {
        studyId,
        status: { in: fromStatuses },
      },
      select: { id: true, status: true },
    });

    if (documents.length === 0) {
      return NextResponse.json({
        data: { transitioned: 0, toStatus, documentIds: [] },
      });
    }

    // Validate each document's transition is allowed
    const eligibleDocs = documents.filter((doc) => {
      const allowedTransitions = VALID_TRANSITIONS[doc.status] || [];
      return allowedTransitions.includes(toStatus);
    });

    if (eligibleDocs.length === 0) {
      return NextResponse.json({
        data: { transitioned: 0, toStatus, documentIds: [] },
      });
    }

    // Perform all transitions + history entries in a single transaction
    const operations = eligibleDocs.flatMap((doc) => [
      db.document.update({
        where: { id: doc.id },
        data: { status: toStatus },
      }),
      db.documentStatusHistory.create({
        data: {
          documentId: doc.id,
          fromStatus: doc.status,
          toStatus,
          userName,
          comment: comment?.trim() || null,
        },
      }),
    ]);

    await db.$transaction(operations);

    const documentIds = eligibleDocs.map((doc) => doc.id);

    return NextResponse.json({
      data: {
        transitioned: eligibleDocs.length,
        toStatus,
        documentIds,
      },
    });
  } catch (error) {
    console.error('Failed to bulk transition documents:', error);
    return NextResponse.json(
      { error: 'Failed to bulk transition documents' },
      { status: 500 }
    );
  }
}
