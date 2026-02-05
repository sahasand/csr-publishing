import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { CreateAnnotationReplyInput } from '@/types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/annotations/[id]/replies
 * Get all replies for an annotation
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: annotationId } = await params;

    // Validate UUID format
    if (!UUID_REGEX.test(annotationId)) {
      return NextResponse.json(
        { error: 'Invalid annotation ID format' },
        { status: 400 }
      );
    }

    // Check if annotation exists
    const annotation = await db.annotation.findUnique({
      where: { id: annotationId },
      select: { id: true },
    });

    if (!annotation) {
      return NextResponse.json(
        { error: 'Annotation not found' },
        { status: 404 }
      );
    }

    const replies = await db.annotationReply.findMany({
      where: { annotationId },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ data: replies });
  } catch (error) {
    console.error('Failed to fetch replies:', error);
    return NextResponse.json(
      { error: 'Failed to fetch replies' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/annotations/[id]/replies
 * Add a reply to an annotation
 * Required: content
 * Optional: authorId, authorName
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: annotationId } = await params;

    // Validate UUID format
    if (!UUID_REGEX.test(annotationId)) {
      return NextResponse.json(
        { error: 'Invalid annotation ID format' },
        { status: 400 }
      );
    }

    // Check if annotation exists
    const annotation = await db.annotation.findUnique({
      where: { id: annotationId },
      select: { id: true },
    });

    if (!annotation) {
      return NextResponse.json(
        { error: 'Annotation not found' },
        { status: 404 }
      );
    }

    const body: CreateAnnotationReplyInput = await request.json();

    // Validate required fields
    if (!body.content || typeof body.content !== 'string' || body.content.trim() === '') {
      return NextResponse.json(
        { error: 'Content is required and cannot be empty' },
        { status: 400 }
      );
    }

    const reply = await db.annotationReply.create({
      data: {
        annotationId,
        content: body.content.trim(),
        authorId: body.authorId || 'system',
        authorName: body.authorName || 'Reviewer',
      },
    });

    return NextResponse.json({ data: reply }, { status: 201 });
  } catch (error) {
    console.error('Failed to create reply:', error);
    return NextResponse.json(
      { error: 'Failed to create reply' },
      { status: 500 }
    );
  }
}
