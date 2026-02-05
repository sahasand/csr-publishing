import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { UpdateChecklistItemInput } from '@/types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * PATCH /api/checklists/[id]/items/[itemId]
 * Update a checklist item
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id: checklistId, itemId } = await params;

    // Validate UUID formats
    if (!UUID_REGEX.test(checklistId)) {
      return NextResponse.json(
        { error: 'Invalid checklist ID format' },
        { status: 400 }
      );
    }

    if (!UUID_REGEX.test(itemId)) {
      return NextResponse.json(
        { error: 'Invalid item ID format' },
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

    // Check if item exists and belongs to this checklist
    const existingItem = await db.checklistItem.findUnique({
      where: { id: itemId },
      select: { id: true, checklistId: true },
    });

    if (!existingItem) {
      return NextResponse.json(
        { error: 'Checklist item not found' },
        { status: 404 }
      );
    }

    if (existingItem.checklistId !== checklistId) {
      return NextResponse.json(
        { error: 'Checklist item does not belong to this checklist' },
        { status: 400 }
      );
    }

    const body: UpdateChecklistItemInput = await request.json();

    // Validate category if provided
    if (body.category !== undefined) {
      if (typeof body.category !== 'string' || body.category.trim() === '') {
        return NextResponse.json(
          { error: 'Category cannot be empty' },
          { status: 400 }
        );
      }
    }

    // Validate text if provided
    if (body.text !== undefined) {
      if (typeof body.text !== 'string' || body.text.trim() === '') {
        return NextResponse.json(
          { error: 'Text cannot be empty' },
          { status: 400 }
        );
      }
    }

    // Validate sortOrder if provided
    if (body.sortOrder !== undefined && typeof body.sortOrder !== 'number') {
      return NextResponse.json(
        { error: 'sortOrder must be a number' },
        { status: 400 }
      );
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {};

    if (body.category !== undefined) {
      updateData.category = body.category.trim();
    }

    if (body.text !== undefined) {
      updateData.text = body.text.trim();
    }

    if (body.autoCheck !== undefined) {
      updateData.autoCheck = body.autoCheck;
    }

    if (body.autoCheckRule !== undefined) {
      updateData.autoCheckRule = body.autoCheckRule;
    }

    if (body.required !== undefined) {
      updateData.required = body.required;
    }

    if (body.sortOrder !== undefined) {
      updateData.sortOrder = body.sortOrder;
    }

    const item = await db.checklistItem.update({
      where: { id: itemId },
      data: updateData,
    });

    return NextResponse.json({ data: item });
  } catch (error) {
    console.error('Failed to update checklist item:', error);
    return NextResponse.json(
      { error: 'Failed to update checklist item' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/checklists/[id]/items/[itemId]
 * Delete a checklist item
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id: checklistId, itemId } = await params;

    // Validate UUID formats
    if (!UUID_REGEX.test(checklistId)) {
      return NextResponse.json(
        { error: 'Invalid checklist ID format' },
        { status: 400 }
      );
    }

    if (!UUID_REGEX.test(itemId)) {
      return NextResponse.json(
        { error: 'Invalid item ID format' },
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

    // Check if item exists and belongs to this checklist
    const existingItem = await db.checklistItem.findUnique({
      where: { id: itemId },
      select: { id: true, checklistId: true },
    });

    if (!existingItem) {
      return NextResponse.json(
        { error: 'Checklist item not found' },
        { status: 404 }
      );
    }

    if (existingItem.checklistId !== checklistId) {
      return NextResponse.json(
        { error: 'Checklist item does not belong to this checklist' },
        { status: 400 }
      );
    }

    await db.checklistItem.delete({ where: { id: itemId } });

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    console.error('Failed to delete checklist item:', error);
    return NextResponse.json(
      { error: 'Failed to delete checklist item' },
      { status: 500 }
    );
  }
}
