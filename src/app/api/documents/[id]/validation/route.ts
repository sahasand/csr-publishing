import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/documents/[id]/validation
 * Get validation results for a document
 * Returns all ValidationResults sorted by severity (via rule) then by ruleName
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: documentId } = await params;

    // Validate UUID format
    if (!UUID_REGEX.test(documentId)) {
      return NextResponse.json(
        { error: 'Invalid document ID format' },
        { status: 400 }
      );
    }

    // Check if document exists
    const document = await db.document.findUnique({
      where: { id: documentId },
      select: { id: true },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Fetch validation results with rule details for severity sorting
    const results = await db.validationResult.findMany({
      where: { documentId },
      orderBy: [
        { ruleName: 'asc' },
      ],
    });

    // To sort by severity, we need to join with ValidationRule
    // Fetch all rules to get severity information
    const ruleIds = [...new Set(results.map((r) => r.ruleId))];
    const rules = await db.validationRule.findMany({
      where: { id: { in: ruleIds } },
      select: { id: true, severity: true, category: true },
    });

    // Create a map of ruleId -> rule details
    const ruleMap = new Map(rules.map((r) => [r.id, r]));

    // Enrich results with severity and category
    const enrichedResults = results.map((r) => {
      const rule = ruleMap.get(r.ruleId);
      return {
        id: r.id,
        documentId: r.documentId,
        ruleId: r.ruleId,
        ruleName: r.ruleName,
        passed: r.passed,
        message: r.message,
        details: r.details,
        createdAt: r.createdAt,
        // Include rule metadata for sorting and display
        severity: rule?.severity ?? 'INFO',
        category: rule?.category ?? 'CONTENT',
      };
    });

    // Sort by severity (ERROR > WARNING > INFO), then by ruleName
    const severityOrder = { ERROR: 0, WARNING: 1, INFO: 2 };
    enrichedResults.sort((a, b) => {
      const severityDiff =
        (severityOrder[a.severity as keyof typeof severityOrder] ?? 2) -
        (severityOrder[b.severity as keyof typeof severityOrder] ?? 2);
      if (severityDiff !== 0) return severityDiff;
      return a.ruleName.localeCompare(b.ruleName);
    });

    // Calculate summary
    const passed = enrichedResults.filter((r) => r.passed).length;
    const failed = enrichedResults.filter((r) => !r.passed).length;
    const errors = enrichedResults.filter((r) => !r.passed && r.severity === 'ERROR').length;
    const warnings = enrichedResults.filter((r) => !r.passed && r.severity === 'WARNING').length;

    return NextResponse.json({
      data: {
        documentId,
        passed,
        failed,
        errors,
        warnings,
        total: enrichedResults.length,
        results: enrichedResults,
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
