import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const template = await db.structureTemplate.findUnique({
      where: { id },
      include: {
        nodes: {
          orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
        },
      },
    });

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: template });
  } catch (error) {
    console.error('Failed to fetch template:', error);
    return NextResponse.json(
      { error: 'Failed to fetch template' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const template = await db.structureTemplate.update({
      where: { id },
      data: {
        name: body.name,
        isDefault: body.isDefault,
      },
    });

    return NextResponse.json({ data: template });
  } catch (error) {
    console.error('Failed to update template:', error);
    return NextResponse.json(
      { error: 'Failed to update template' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if template is in use
    const studyCount = await db.study.count({
      where: { activeTemplateId: id },
    });

    if (studyCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete template that is in use by studies' },
        { status: 400 }
      );
    }

    await db.structureTemplate.delete({ where: { id } });
    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    console.error('Failed to delete template:', error);
    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 }
    );
  }
}
