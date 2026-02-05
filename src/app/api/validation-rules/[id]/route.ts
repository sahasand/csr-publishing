import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { UpdateValidationRuleInput } from '@/types';
import { Prisma, ValidationCategory, ValidationSeverity } from '@/generated/prisma/client';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/validation-rules/[id]
 * Get a single validation rule
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate UUID format
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json(
        { error: 'Invalid validation rule ID format' },
        { status: 400 }
      );
    }

    const rule = await db.validationRule.findUnique({
      where: { id },
    });

    if (!rule) {
      return NextResponse.json(
        { error: 'Validation rule not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: rule });
  } catch (error) {
    console.error('Failed to fetch validation rule:', error);
    return NextResponse.json(
      { error: 'Failed to fetch validation rule' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/validation-rules/[id]
 * Update a validation rule
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate UUID format
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json(
        { error: 'Invalid validation rule ID format' },
        { status: 400 }
      );
    }

    // Check if rule exists
    const existingRule = await db.validationRule.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingRule) {
      return NextResponse.json(
        { error: 'Validation rule not found' },
        { status: 404 }
      );
    }

    const body: UpdateValidationRuleInput = await request.json();

    // Validate name if provided
    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || body.name.trim() === '') {
        return NextResponse.json(
          { error: 'Validation rule name cannot be empty' },
          { status: 400 }
        );
      }
    }

    // Validate category if provided
    if (body.category !== undefined) {
      if (!Object.values(ValidationCategory).includes(body.category as ValidationCategory)) {
        return NextResponse.json(
          { error: `Invalid category. Valid values: ${Object.values(ValidationCategory).join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Validate checkFn if provided
    if (body.checkFn !== undefined) {
      if (typeof body.checkFn !== 'string' || body.checkFn.trim() === '') {
        return NextResponse.json(
          { error: 'Check function identifier cannot be empty' },
          { status: 400 }
        );
      }
    }

    // Validate message if provided
    if (body.message !== undefined) {
      if (typeof body.message !== 'string' || body.message.trim() === '') {
        return NextResponse.json(
          { error: 'Validation message cannot be empty' },
          { status: 400 }
        );
      }
    }

    // Validate severity if provided
    if (body.severity !== undefined) {
      if (!Object.values(ValidationSeverity).includes(body.severity as ValidationSeverity)) {
        return NextResponse.json(
          { error: `Invalid severity. Valid values: ${Object.values(ValidationSeverity).join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Validate params is an object if provided
    if (body.params !== undefined && (typeof body.params !== 'object' || body.params === null || Array.isArray(body.params))) {
      return NextResponse.json(
        { error: 'Params must be a JSON object' },
        { status: 400 }
      );
    }

    const rule = await db.validationRule.update({
      where: { id },
      data: {
        name: body.name?.trim(),
        category: body.category as ValidationCategory | undefined,
        checkFn: body.checkFn?.trim(),
        message: body.message?.trim(),
        params: body.params !== undefined ? JSON.stringify(body.params) : undefined,
        severity: body.severity as ValidationSeverity | undefined,
        autoFix: body.autoFix,
        isActive: body.isActive,
      },
    });

    return NextResponse.json({ data: rule });
  } catch (error) {
    console.error('Failed to update validation rule:', error);
    return NextResponse.json(
      { error: 'Failed to update validation rule' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/validation-rules/[id]
 * Soft delete a validation rule (set isActive=false)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate UUID format
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json(
        { error: 'Invalid validation rule ID format' },
        { status: 400 }
      );
    }

    // Check if rule exists
    const existingRule = await db.validationRule.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingRule) {
      return NextResponse.json(
        { error: 'Validation rule not found' },
        { status: 404 }
      );
    }

    // Soft delete by setting isActive to false
    const rule = await db.validationRule.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ data: rule });
  } catch (error) {
    console.error('Failed to delete validation rule:', error);
    return NextResponse.json(
      { error: 'Failed to delete validation rule' },
      { status: 500 }
    );
  }
}
