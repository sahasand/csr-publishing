import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { CreateAnnotationInput } from '@/types';
import type { Prisma } from '@/generated/prisma/client';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VALID_ANNOTATION_TYPES = ['NOTE', 'QUESTION', 'CORRECTION_REQUIRED', 'FYI'] as const;

/**
 * GET /api/documents/[id]/annotations
 * List all annotations for a document with nested replies
 * Sorted by page number, then creation date
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: documentId } = await params;

    // Validate UUID format
    if (!UUID_REGEX.test(documentId)) {
      return NextResponse.json(
        { error: 'Invalid document ID format' },
        { status: 400 }
      );
    }

    // Check if document exists
    const document = await db.document.findUnique({
      where: { id: documentId },
      select: { id: true },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Fetch annotations with replies, sorted by pageNumber then createdAt
    const annotations = await db.annotation.findMany({
      where: { documentId },
      include: {
        replies: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: [
        { pageNumber: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    return NextResponse.json({ data: annotations });
  } catch (error) {
    console.error('Failed to fetch annotations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch annotations' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/documents/[id]/annotations
 * Create a new annotation for a document
 * Required: type, pageNumber, content
 * Optional: coordinates, authorId, authorName
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: documentId } = await params;

    // Validate UUID format
    if (!UUID_REGEX.test(documentId)) {
      return NextResponse.json(
        { error: 'Invalid document ID format' },
        { status: 400 }
      );
    }

    // Check if document exists
    const document = await db.document.findUnique({
      where: { id: documentId },
      select: { id: true },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    const body: CreateAnnotationInput = await request.json();

    // Validate required fields
    if (!body.type) {
      return NextResponse.json(
        { error: 'Annotation type is required' },
        { status: 400 }
      );
    }

    if (!VALID_ANNOTATION_TYPES.includes(body.type as typeof VALID_ANNOTATION_TYPES[number])) {
      return NextResponse.json(
        { error: `Invalid annotation type. Must be one of: ${VALID_ANNOTATION_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    if (body.pageNumber === undefined || body.pageNumber === null) {
      return NextResponse.json(
        { error: 'Page number is required' },
        { status: 400 }
      );
    }

    if (typeof body.pageNumber !== 'number' || !Number.isInteger(body.pageNumber) || body.pageNumber < 1) {
      return NextResponse.json(
        { error: 'Page number must be a positive integer' },
        { status: 400 }
      );
    }

    if (!body.content || typeof body.content !== 'string' || body.content.trim() === '') {
      return NextResponse.json(
        { error: 'Content is required and cannot be empty' },
        { status: 400 }
      );
    }

    // Create annotation with default status OPEN
    const createData: Prisma.AnnotationCreateInput = {
      document: { connect: { id: documentId } },
      type: body.type as typeof VALID_ANNOTATION_TYPES[number],
      pageNumber: body.pageNumber,
      content: body.content.trim(),
      authorId: body.authorId || 'system',
      authorName: body.authorName || 'Reviewer',
      status: 'OPEN',
    };

    // Add coordinates if provided
    if (body.coordinates) {
      createData.coordinates = body.coordinates as unknown as Prisma.InputJsonValue;
    }

    const annotation = await db.annotation.create({
      data: createData,
      include: {
        replies: true,
      },
    });

    return NextResponse.json({ data: annotation }, { status: 201 });
  } catch (error) {
    console.error('Failed to create annotation:', error);
    return NextResponse.json(
      { error: 'Failed to create annotation' },
      { status: 500 }
    );
  }
}
