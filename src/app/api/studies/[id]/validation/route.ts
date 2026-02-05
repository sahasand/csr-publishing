import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { ValidationSeverity } from '@/generated/prisma/client';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VALID_SEVERITIES = ['ERROR', 'WARNING', 'INFO'] as const;

/**
 * GET /api/studies/[id]/validation
 * Get aggregated validation summary for a study
 *
 * Query params:
 * - severity: Filter results by severity ('ERROR', 'WARNING', 'INFO')
 *
 * Returns:
 * - summary: { totalDocuments, validDocuments, documentsWithErrors, documentsWithWarnings }
 * - documents: Per-document breakdown with { documentId, documentName, slotCode, passed, failed, errors, warnings }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: studyId } = await params;

    // Validate UUID format
    if (!UUID_REGEX.test(studyId)) {
      return NextResponse.json(
        { error: 'Invalid study ID format' },
        { status: 400 }
      );
    }

    // Check if study exists
    const study = await db.study.findUnique({
      where: { id: studyId },
      select: { id: true },
    });

    if (!study) {
      return NextResponse.json(
        { error: 'Study not found' },
        { status: 404 }
      );
    }

    // Parse severity filter from query params
    const { searchParams } = new URL(request.url);
    const severityParam = searchParams.get('severity')?.toUpperCase();
    let severityFilter: ValidationSeverity | undefined;

    if (severityParam) {
      if (!VALID_SEVERITIES.includes(severityParam as ValidationSeverity)) {
        return NextResponse.json(
          { error: `Invalid severity filter. Must be one of: ${VALID_SEVERITIES.join(', ')}` },
          { status: 400 }
        );
      }
      severityFilter = severityParam as ValidationSeverity;
    }

    // Fetch all documents for the study with their validation results
    const documents = await db.document.findMany({
      where: { studyId },
      include: {
        slot: {
          select: { code: true, title: true },
        },
        validationResults: true,
      },
      orderBy: [
        { slot: { sortOrder: 'asc' } },
        { version: 'desc' },
      ],
    });

    // Fetch all validation rules to get severity information
    const allRuleIds = new Set<string>();
    for (const doc of documents) {
      for (const result of doc.validationResults) {
        allRuleIds.add(result.ruleId);
      }
    }

    const rules = await db.validationRule.findMany({
      where: { id: { in: Array.from(allRuleIds) } },
      select: { id: true, severity: true },
    });

    const ruleMap = new Map(rules.map((r) => [r.id, r]));

    // Process each document
    const documentSummaries = documents.map((doc) => {
      // Enrich results with severity
      const enrichedResults = doc.validationResults.map((r) => {
        const rule = ruleMap.get(r.ruleId);
        return {
          ...r,
          severity: rule?.severity ?? ('INFO' as ValidationSeverity),
        };
      });

      // Apply severity filter if provided
      const filteredResults = severityFilter
        ? enrichedResults.filter((r) => r.severity === severityFilter)
        : enrichedResults;

      const passed = filteredResults.filter((r) => r.passed).length;
      const failed = filteredResults.filter((r) => !r.passed).length;
      const errors = filteredResults.filter(
        (r) => !r.passed && r.severity === 'ERROR'
      ).length;
      const warnings = filteredResults.filter(
        (r) => !r.passed && r.severity === 'WARNING'
      ).length;

      return {
        documentId: doc.id,
        documentName: doc.sourceFileName,
        slotCode: doc.slot.code,
        slotTitle: doc.slot.title,
        passed,
        failed,
        errors,
        warnings,
        total: filteredResults.length,
        hasErrors: errors > 0,
        hasWarnings: warnings > 0,
      };
    });

    // Calculate study-level summary
    const totalDocuments = documentSummaries.length;
    const documentsWithErrors = documentSummaries.filter((d) => d.hasErrors).length;
    const documentsWithWarnings = documentSummaries.filter((d) => d.hasWarnings).length;
    const validDocuments = documentSummaries.filter(
      (d) => !d.hasErrors && d.total > 0
    ).length;

    // Documents that have been validated (have any results)
    const validatedDocuments = documentSummaries.filter((d) => d.total > 0).length;

    return NextResponse.json({
      data: {
        studyId,
        summary: {
          totalDocuments,
          validatedDocuments,
          validDocuments,
          documentsWithErrors,
          documentsWithWarnings,
        },
        documents: documentSummaries,
      },
    });
  } catch (error) {
    console.error('Failed to fetch study validation summary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch study validation summary' },
      { status: 500 }
    );
  }
}
