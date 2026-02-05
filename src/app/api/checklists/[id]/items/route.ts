import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { CreateChecklistItemInput } from '@/types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/checklists/[id]/items
 * List all items for a checklist (sorted by sortOrder)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: checklistId } = await params;

    // Validate UUID format
    if (!UUID_REGEX.test(checklistId)) {
      return NextResponse.json(
        { error: 'Invalid checklist ID format' },
        { status: 400 }
      );
    }

    // Check if checklist exists
    const checklist = await db.checklist.findUnique({
      where: { id: checklistId },
      select: { id: true },
    });

    if (!checklist) {
      return NextResponse.json(
        { error: 'Checklist not found' },
        { status: 404 }
      );
    }

    const items = await db.checklistItem.findMany({
      where: { checklistId },
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json({ data: items });
  } catch (error) {
    console.error('Failed to fetch checklist items:', error);
    return NextResponse.json(
      { error: 'Failed to fetch checklist items' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/checklists/[id]/items
 * Create a new checklist item
 * Required: category, text
 * Optional: autoCheck, autoCheckRule, required, sortOrder
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: checklistId } = await params;

    // Validate UUID format
    if (!UUID_REGEX.test(checklistId)) {
      return NextResponse.json(
        { error: 'Invalid checklist ID format' },
        { status: 400 }
      );
    }

    // Check if checklist exists
    const checklist = await db.checklist.findUnique({
      where: { id: checklistId },
      select: { id: true },
    });

    if (!checklist) {
      return NextResponse.json(
        { error: 'Checklist not found' },
        { status: 404 }
      );
    }

    const body: CreateChecklistItemInput = await request.json();

    // Validate required fields
    if (!body.category || typeof body.category !== 'string' || body.category.trim() === '') {
      return NextResponse.json(
        { error: 'Category is required and cannot be empty' },
        { status: 400 }
      );
    }

    if (!body.text || typeof body.text !== 'string' || body.text.trim() === '') {
      return NextResponse.json(
        { error: 'Text is required and cannot be empty' },
        { status: 400 }
      );
    }

    // Validate sortOrder if provided
    if (body.sortOrder !== undefined && typeof body.sortOrder !== 'number') {
      return NextResponse.json(
        { error: 'sortOrder must be a number' },
        { status: 400 }
      );
    }

    const item = await db.checklistItem.create({
      data: {
        checklistId,
        category: body.category.trim(),
        text: body.text.trim(),
        autoCheck: body.autoCheck ?? false,
        autoCheckRule: body.autoCheckRule ?? null,
        required: body.required ?? true,
        sortOrder: body.sortOrder ?? 0,
      },
    });

    return NextResponse.json({ data: item }, { status: 201 });
  } catch (error) {
    console.error('Failed to create checklist item:', error);
    return NextResponse.json(
      { error: 'Failed to create checklist item' },
      { status: 500 }
    );
  }
}
