import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { CreateNodeInput } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const nodes = await db.structureNode.findMany({
      where: { templateId: id },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });
    return NextResponse.json({ data: nodes });
  } catch (error) {
    console.error('Failed to fetch nodes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch nodes' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: templateId } = await params;
    const body: CreateNodeInput = await request.json();

    if (!body.code || !body.title) {
      return NextResponse.json(
        { error: 'code and title are required' },
        { status: 400 }
      );
    }

    // Check template exists
    const template = await db.structureTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    const node = await db.structureNode.create({
      data: {
        templateId,
        parentId: body.parentId ?? null,
        code: body.code,
        title: body.title,
        documentType: body.documentType ?? 'PDF',
        required: body.required ?? false,
        sortOrder: body.sortOrder ?? 0,
        // Store as JSON string for SQLite compatibility
        validationRules: JSON.stringify(body.validationRules ?? []),
        checklistId: body.checklistId ?? null,
      },
    });

    return NextResponse.json({ data: node }, { status: 201 });
  } catch (error) {
    console.error('Failed to create node:', error);
    return NextResponse.json(
      { error: 'Failed to create node' },
      { status: 500 }
    );
  }
}
