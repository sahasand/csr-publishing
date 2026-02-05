import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { exportPackage } from '@/lib/packaging/exporter';
import { checkReadiness } from '@/lib/packaging/assembler';
import { serializeValidationReport } from '@/lib/validation';

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/studies/[id]/package
 *
 * Get package readiness status for a study.
 * Returns detailed information about what's blocking the package export.
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
        { error: 'Invalid study ID format' },
        { status: 400 }
      );
    }

    // Check if study exists
    const study = await db.study.findUnique({
      where: { id },
      select: {
        id: true,
        studyId: true,
        sponsor: true,
        activeTemplateId: true,
      },
    });

    if (!study) {
      return NextResponse.json(
        { error: 'Study not found' },
        { status: 404 }
      );
    }

    if (!study.activeTemplateId) {
      return NextResponse.json(
        { error: 'Study has no active template' },
        { status: 400 }
      );
    }

    // Check readiness
    const readiness = await checkReadiness(id);

    return NextResponse.json({
      data: {
        studyId: study.id,
        studyNumber: study.studyId,
        sponsor: study.sponsor,
        readiness,
      },
    });
  } catch (error) {
    console.error('Failed to check package readiness:', error);
    return NextResponse.json(
      { error: 'Failed to check package readiness' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/studies/[id]/package
 *
 * Trigger package export for a study.
 * Creates a ZIP archive with all approved/published documents.
 *
 * Request body:
 * - force?: boolean - Export even if not ready
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate UUID format
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json(
        { error: 'Invalid study ID format' },
        { status: 400 }
      );
    }

    // Parse request body
    let body: { force?: boolean } = {};
    try {
      const text = await request.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch {
      // Empty body is acceptable
    }

    // Check if study exists
    const study = await db.study.findUnique({
      where: { id },
      select: {
        id: true,
        studyId: true,
        sponsor: true,
        activeTemplateId: true,
      },
    });

    if (!study) {
      return NextResponse.json(
        { error: 'Study not found' },
        { status: 404 }
      );
    }

    if (!study.activeTemplateId) {
      return NextResponse.json(
        { error: 'Study has no active template' },
        { status: 400 }
      );
    }

    // Execute export
    const result = await exportPackage(id, {
      force: body.force ?? false,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error || 'Export failed',
          packageId: result.packageId,
        },
        { status: 422 }
      );
    }

    // Build response with validation data if available
    const responseData: Record<string, unknown> = {
      packageId: result.packageId,
      studyId: study.id,
      studyNumber: study.studyId,
      sponsor: study.sponsor,
      zipSize: result.zipSize,
      fileCount: result.manifest?.files.length ?? 0,
      downloadUrl: `/api/studies/${id}/package/${result.packageId}`,
    };

    // Include validation results if present
    if (result.validation) {
      responseData.validation = {
        xmlValid: result.validation.xmlValid,
        errorCount: result.validation.errorCount,
        warningCount: result.validation.warningCount,
        packageReport: serializeValidationReport(result.validation.packageReport),
      };
    }

    return NextResponse.json({ data: responseData });
  } catch (error) {
    console.error('Failed to export package:', error);
    return NextResponse.json(
      { error: 'Failed to export package' },
      { status: 500 }
    );
  }
}
