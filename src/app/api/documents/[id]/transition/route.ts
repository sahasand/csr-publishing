import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DocumentStatus } from '@/generated/prisma/client';

// Valid transitions map
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

interface TransitionBody {
  toStatus: DocumentStatus;
  comment?: string;
  userName?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: TransitionBody = await request.json();
    const { toStatus, comment, userName = 'Reviewer' } = body;

    // Validate toStatus is a valid enum value
    if (!Object.values(DocumentStatus).includes(toStatus)) {
      return NextResponse.json(
        { error: `Invalid status: ${toStatus}` },
        { status: 400 }
      );
    }

    // Get current document
    const document = await db.document.findUnique({
      where: { id },
      select: { id: true, status: true, sourceFileName: true },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    const fromStatus = document.status;

    // Validate transition is allowed
    const allowedTransitions = VALID_TRANSITIONS[fromStatus] || [];
    if (!allowedTransitions.includes(toStatus)) {
      return NextResponse.json(
        {
          error: `Invalid transition from ${fromStatus} to ${toStatus}`,
          allowedTransitions,
        },
        { status: 400 }
      );
    }

    // Check if comment is required
    if (REQUIRES_COMMENT.includes(toStatus) && !comment?.trim()) {
      return NextResponse.json(
        { error: 'Comment is required for this transition' },
        { status: 400 }
      );
    }

    // Perform transition in a transaction
    const [updatedDocument, historyEntry] = await db.$transaction([
      db.document.update({
        where: { id },
        data: { status: toStatus },
        include: { slot: true },
      }),
      db.documentStatusHistory.create({
        data: {
          documentId: id,
          fromStatus,
          toStatus,
          userName,
          comment: comment?.trim() || null,
        },
      }),
    ]);

    return NextResponse.json({
      data: {
        document: updatedDocument,
        transition: historyEntry,
      },
    });
  } catch (error) {
    console.error('Failed to transition document:', error);
    return NextResponse.json(
      { error: 'Failed to transition document status' },
      { status: 500 }
    );
  }
}
