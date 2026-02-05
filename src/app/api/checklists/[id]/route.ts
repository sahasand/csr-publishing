import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { UpdateChecklistInput } from '@/types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/checklists/[id]
 * Get a single checklist with all items (sorted by sortOrder)
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
        { error: 'Invalid checklist ID format' },
        { status: 400 }
      );
    }

    const checklist = await db.checklist.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!checklist) {
      return NextResponse.json(
        { error: 'Checklist not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: checklist });
  } catch (error) {
    console.error('Failed to fetch checklist:', error);
    return NextResponse.json(
      { error: 'Failed to fetch checklist' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/checklists/[id]
 * Update a checklist name
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
        { error: 'Invalid checklist ID format' },
        { status: 400 }
      );
    }

    // Check if checklist exists
    const existingChecklist = await db.checklist.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingChecklist) {
      return NextResponse.json(
        { error: 'Checklist not found' },
        { status: 404 }
      );
    }

    const body: UpdateChecklistInput = await request.json();

    // Validate name if provided
    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || body.name.trim() === '') {
        return NextResponse.json(
          { error: 'Checklist name cannot be empty' },
          { status: 400 }
        );
      }
    }

    const checklist = await db.checklist.update({
      where: { id },
      data: {
        name: body.name?.trim(),
      },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    return NextResponse.json({ data: checklist });
  } catch (error) {
    console.error('Failed to update checklist:', error);
    return NextResponse.json(
      { error: 'Failed to update checklist' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/checklists/[id]
 * Delete a checklist (cascade deletes items via Prisma)
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
        { error: 'Invalid checklist ID format' },
        { status: 400 }
      );
    }

    // Check if checklist exists
    const existingChecklist = await db.checklist.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingChecklist) {
      return NextResponse.json(
        { error: 'Checklist not found' },
        { status: 404 }
      );
    }

    await db.checklist.delete({ where: { id } });

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    console.error('Failed to delete checklist:', error);
    return NextResponse.json(
      { error: 'Failed to delete checklist' },
      { status: 500 }
    );
  }
}
