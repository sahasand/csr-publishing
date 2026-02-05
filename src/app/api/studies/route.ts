import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { CreateStudyInput } from '@/types';

export async function GET() {
  try {
    const studies = await db.study.findMany({
      include: {
        activeTemplate: true,
        _count: {
          select: { documents: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
    return NextResponse.json({ data: studies });
  } catch (error) {
    console.error('Failed to fetch studies:', error);
    return NextResponse.json(
      { error: 'Failed to fetch studies' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateStudyInput = await request.json();

    if (!body.studyId || !body.sponsor) {
      return NextResponse.json(
        { error: 'studyId and sponsor are required' },
        { status: 400 }
      );
    }

    const existing = await db.study.findUnique({
      where: { studyId: body.studyId },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Study with this ID already exists' },
        { status: 409 }
      );
    }

    // Find default template to auto-assign
    const defaultTemplate = await db.structureTemplate.findFirst({
      where: { isDefault: true },
    });

    const study = await db.study.create({
      data: {
        studyId: body.studyId,
        sponsor: body.sponsor,
        therapeuticArea: body.therapeuticArea,
        phase: body.phase,
        activeTemplateId: defaultTemplate?.id ?? null,
      },
      include: {
        activeTemplate: true,
      },
    });

    return NextResponse.json({ data: study }, { status: 201 });
  } catch (error) {
    console.error('Failed to create study:', error);
    return NextResponse.json(
      { error: 'Failed to create study' },
      { status: 500 }
    );
  }
}
