import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { CreateStudyInput } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10) || 20));
    const skip = (page - 1) * pageSize;

    const [studies, total] = await Promise.all([
      db.study.findMany({
        include: {
          activeTemplate: true,
          _count: {
            select: { documents: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: pageSize,
      }),
      db.study.count(),
    ]);

    return NextResponse.json({
      data: studies,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
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
