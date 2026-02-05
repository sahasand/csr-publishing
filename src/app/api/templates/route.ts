import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { STANDARD_CSR_SECTIONS } from '@/lib/standard-sections';
import type { CreateTemplateInput } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10) || 20));
    const skip = (page - 1) * pageSize;

    const [templates, total] = await Promise.all([
      db.structureTemplate.findMany({
        include: {
          _count: {
            select: { nodes: true, studies: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: pageSize,
      }),
      db.structureTemplate.count(),
    ]);

    return NextResponse.json({
      data: templates,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('Failed to fetch templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateTemplateInput & { useStandardSections?: boolean } = await request.json();

    if (!body.name) {
      return NextResponse.json(
        { error: 'Template name is required' },
        { status: 400 }
      );
    }

    const template = await db.structureTemplate.create({
      data: {
        name: body.name,
        isDefault: body.isDefault ?? false,
      },
    });

    // Create standard CSR sections if requested
    if (body.useStandardSections) {
      await db.structureNode.createMany({
        data: STANDARD_CSR_SECTIONS.map((section) => ({
          templateId: template.id,
          code: section.code,
          title: section.title,
          documentType: section.documentType,
          required: section.required,
          sortOrder: section.sortOrder,
        })),
      });
    }

    return NextResponse.json({ data: template }, { status: 201 });
  } catch (error) {
    console.error('Failed to create template:', error);
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    );
  }
}
