import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { runValidationAndUpdateStatus } from '@/lib/validation/runner';

/**
 * POST /api/documents/[id]/validate
 * Trigger on-demand validation for a document
 *
 * Returns the validation summary with pass/fail counts and detailed results.
 * Also updates the document status based on validation outcome.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if document exists
    const document = await db.document.findUnique({
      where: { id },
      select: { id: true, status: true, sourcePath: true },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Run validation and update document status
    const summary = await runValidationAndUpdateStatus(id);

    return NextResponse.json({
      data: summary,
    });
  } catch (error) {
    console.error('Failed to run validation:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to run validation' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/documents/[id]/validate
 * Get the latest validation results for a document
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if document exists
    const document = await db.document.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Fetch validation results
    const results = await db.validationResult.findMany({
      where: { documentId: id },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate summary
    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;

    // We don't have severity stored in results, so we can't calculate warnings/errors
    // This is a limitation of the current schema
    return NextResponse.json({
      data: {
        passed,
        failed,
        total: results.length,
        results: results.map((r) => ({
          ruleId: r.ruleId,
          ruleName: r.ruleName,
          passed: r.passed,
          message: r.message,
          details: r.details,
          createdAt: r.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error('Failed to fetch validation results:', error);
    return NextResponse.json(
      { error: 'Failed to fetch validation results' },
      { status: 500 }
    );
  }
}
