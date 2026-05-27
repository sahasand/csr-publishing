import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { UpdateStudyInput } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const study = await db.study.findUnique({
      where: { id },
      include: {
        activeTemplate: {
          include: {
            nodes: {
              orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
            },
          },
        },
        _count: {
          select: { documents: true },
        },
      },
    });

    if (!study) {
      return NextResponse.json({ error: 'Study not found' }, { status: 404 });
    }

    return NextResponse.json({ data: study });
  } catch (error) {
    console.error('Failed to fetch study:', error);
    return NextResponse.json(
      { error: 'Failed to fetch study' },
      { status: 500 }
    );
  }
}

// Fields a client is allowed to update. Anything else (id, studyId, timestamps,
// etc.) is ignored to prevent mass-assignment.
const VALID_UPDATE_FIELDS = [
  'sponsor',
  'therapeuticArea',
  'phase',
  'status',
  'activeTemplateId',
  'title',
  'productName',
  'indication',
  'applicationNumber',
  'applicationType',
  'sponsorAddress',
] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: UpdateStudyInput & Record<string, unknown> = await request.json();

    // Whitelist updatable fields
    const data: Record<string, unknown> = {};
    for (const field of VALID_UPDATE_FIELDS) {
      if (body[field] !== undefined) {
        data[field] = body[field];
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        {
          error: `Request body must contain at least one valid field: ${VALID_UPDATE_FIELDS.join(', ')}`,
        },
        { status: 400 }
      );
    }

    const study = await db.study.update({
      where: { id },
      data,
      include: {
        activeTemplate: true,
      },
    });

    return NextResponse.json({ data: study });
  } catch (error) {
    console.error('Failed to update study:', error);
    return NextResponse.json(
      { error: 'Failed to update study' },
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
    await db.study.delete({ where: { id } });
    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    console.error('Failed to delete study:', error);
    return NextResponse.json(
      { error: 'Failed to delete study' },
      { status: 500 }
    );
  }
}
