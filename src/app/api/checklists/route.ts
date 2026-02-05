import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { CreateChecklistInput } from '@/types';

/**
 * GET /api/checklists
 * List all checklists with item counts
 */
export async function GET() {
  try {
    const checklists = await db.checklist.findMany({
      include: {
        _count: {
          select: { items: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({ data: checklists });
  } catch (error) {
    console.error('Failed to fetch checklists:', error);
    return NextResponse.json(
      { error: 'Failed to fetch checklists' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/checklists
 * Create a new checklist
 * Required: name
 */
export async function POST(request: NextRequest) {
  try {
    const body: CreateChecklistInput = await request.json();

    // Validate required fields
    if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
      return NextResponse.json(
        { error: 'Checklist name is required and cannot be empty' },
        { status: 400 }
      );
    }

    const checklist = await db.checklist.create({
      data: {
        name: body.name.trim(),
      },
      include: {
        _count: {
          select: { items: true },
        },
      },
    });

    return NextResponse.json({ data: checklist }, { status: 201 });
  } catch (error) {
    console.error('Failed to create checklist:', error);
    return NextResponse.json(
      { error: 'Failed to create checklist' },
      { status: 500 }
    );
  }
}
