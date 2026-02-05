import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { UpdateAnnotationInput } from '@/types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VALID_ANNOTATION_TYPES = ['NOTE', 'QUESTION', 'CORRECTION_REQUIRED', 'FYI'] as const;
const VALID_ANNOTATION_STATUSES = ['OPEN', 'RESOLVED', 'WONT_FIX'] as const;

/**
 * GET /api/annotations/[id]
 * Get a single annotation with its replies
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
        { error: 'Invalid annotation ID format' },
        { status: 400 }
      );
    }

    const annotation = await db.annotation.findUnique({
      where: { id },
      include: {
        replies: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!annotation) {
      return NextResponse.json(
        { error: 'Annotation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: annotation });
  } catch (error) {
    console.error('Failed to fetch annotation:', error);
    return NextResponse.json(
      { error: 'Failed to fetch annotation' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/annotations/[id]
 * Update an annotation
 * Can update: content, status, type
 * Automatically sets resolvedAt when status changes to RESOLVED
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate UUID format
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json(
        { error: 'Invalid annotation ID format' },
        { status: 400 }
      );
    }

    // Check if annotation exists
    const existingAnnotation = await db.annotation.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!existingAnnotation) {
      return NextResponse.json(
        { error: 'Annotation not found' },
        { status: 404 }
      );
    }

    const body: UpdateAnnotationInput = await request.json();

    // Validate type if provided
    if (body.type !== undefined) {
      if (!VALID_ANNOTATION_TYPES.includes(body.type as typeof VALID_ANNOTATION_TYPES[number])) {
        return NextResponse.json(
          { error: `Invalid annotation type. Must be one of: ${VALID_ANNOTATION_TYPES.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Validate status if provided
    if (body.status !== undefined) {
      if (!VALID_ANNOTATION_STATUSES.includes(body.status as typeof VALID_ANNOTATION_STATUSES[number])) {
        return NextResponse.json(
          { error: `Invalid annotation status. Must be one of: ${VALID_ANNOTATION_STATUSES.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Validate content if provided
    if (body.content !== undefined) {
      if (typeof body.content !== 'string' || body.content.trim() === '') {
        return NextResponse.json(
          { error: 'Content cannot be empty' },
          { status: 400 }
        );
      }
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {};

    if (body.content !== undefined) {
      updateData.content = body.content.trim();
    }

    if (body.type !== undefined) {
      updateData.type = body.type;
    }

    if (body.status !== undefined) {
      updateData.status = body.status;

      // Set resolvedAt when status changes to RESOLVED
      if (body.status === 'RESOLVED' && existingAnnotation.status !== 'RESOLVED') {
        updateData.resolvedAt = new Date();
      }
      // Clear resolvedAt if status changes from RESOLVED to something else
      if (body.status !== 'RESOLVED' && existingAnnotation.status === 'RESOLVED') {
        updateData.resolvedAt = null;
      }
    }

    const annotation = await db.annotation.update({
      where: { id },
      data: updateData,
      include: {
        replies: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return NextResponse.json({ data: annotation });
  } catch (error) {
    console.error('Failed to update annotation:', error);
    return NextResponse.json(
      { error: 'Failed to update annotation' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/annotations/[id]
 * Hard delete an annotation
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate UUID format
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json(
        { error: 'Invalid annotation ID format' },
        { status: 400 }
      );
    }

    // Check if annotation exists
    const existingAnnotation = await db.annotation.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingAnnotation) {
      return NextResponse.json(
        { error: 'Annotation not found' },
        { status: 404 }
      );
    }

    await db.annotation.delete({ where: { id } });

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    console.error('Failed to delete annotation:', error);
    return NextResponse.json(
      { error: 'Failed to delete annotation' },
      { status: 500 }
    );
  }
}
