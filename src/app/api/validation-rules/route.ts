import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { CreateValidationRuleInput } from '@/types';
import { Prisma, ValidationCategory, ValidationSeverity } from '@/generated/prisma/client';

/**
 * GET /api/validation-rules
 * List all validation rules
 * Query params:
 *   - category: Filter by validation category
 *   - active: Filter by isActive (true/false)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const active = searchParams.get('active');

    // Build where clause
    const where: {
      category?: ValidationCategory;
      isActive?: boolean;
    } = {};

    if (category) {
      // Validate category is a valid enum value
      if (!Object.values(ValidationCategory).includes(category as ValidationCategory)) {
        return NextResponse.json(
          { error: `Invalid category. Valid values: ${Object.values(ValidationCategory).join(', ')}` },
          { status: 400 }
        );
      }
      where.category = category as ValidationCategory;
    }

    if (active !== null && active !== undefined && active !== '') {
      where.isActive = active === 'true';
    }

    const rules = await db.validationRule.findMany({
      where,
      orderBy: [
        { category: 'asc' },
        { name: 'asc' },
      ],
    });

    return NextResponse.json({ data: rules });
  } catch (error) {
    console.error('Failed to fetch validation rules:', error);
    return NextResponse.json(
      { error: 'Failed to fetch validation rules' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/validation-rules
 * Create a new validation rule
 * Required: name, category, checkFn, message
 * Optional: params (JSON object), severity (default ERROR), autoFix (default false), isActive (default true)
 */
export async function POST(request: NextRequest) {
  try {
    const body: CreateValidationRuleInput = await request.json();

    // Validate required fields
    if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
      return NextResponse.json(
        { error: 'Validation rule name is required and cannot be empty' },
        { status: 400 }
      );
    }

    if (!body.category || typeof body.category !== 'string') {
      return NextResponse.json(
        { error: 'Validation category is required' },
        { status: 400 }
      );
    }

    // Validate category is a valid enum value
    if (!Object.values(ValidationCategory).includes(body.category as ValidationCategory)) {
      return NextResponse.json(
        { error: `Invalid category. Valid values: ${Object.values(ValidationCategory).join(', ')}` },
        { status: 400 }
      );
    }

    if (!body.checkFn || typeof body.checkFn !== 'string' || body.checkFn.trim() === '') {
      return NextResponse.json(
        { error: 'Check function identifier is required and cannot be empty' },
        { status: 400 }
      );
    }

    if (!body.message || typeof body.message !== 'string' || body.message.trim() === '') {
      return NextResponse.json(
        { error: 'Validation message is required and cannot be empty' },
        { status: 400 }
      );
    }

    // Validate optional severity if provided
    if (body.severity && !Object.values(ValidationSeverity).includes(body.severity as ValidationSeverity)) {
      return NextResponse.json(
        { error: `Invalid severity. Valid values: ${Object.values(ValidationSeverity).join(', ')}` },
        { status: 400 }
      );
    }

    // Validate params is an object if provided
    if (body.params !== undefined && (typeof body.params !== 'object' || body.params === null || Array.isArray(body.params))) {
      return NextResponse.json(
        { error: 'Params must be a JSON object' },
        { status: 400 }
      );
    }

    const rule = await db.validationRule.create({
      data: {
        name: body.name.trim(),
        category: body.category as ValidationCategory,
        checkFn: body.checkFn.trim(),
        message: body.message.trim(),
        params: JSON.stringify(body.params ?? {}),
        severity: (body.severity as ValidationSeverity) ?? 'ERROR',
        autoFix: body.autoFix ?? false,
        isActive: body.isActive ?? true,
      },
    });

    return NextResponse.json({ data: rule }, { status: 201 });
  } catch (error) {
    console.error('Failed to create validation rule:', error);
    return NextResponse.json(
      { error: 'Failed to create validation rule' },
      { status: 500 }
    );
  }
}
