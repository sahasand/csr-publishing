import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { runValidation } from '@/lib/validation/runner';

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/studies/[id]/validate-all
 *
 * Run PDF/eCTD compliance validation on every document in the study.
 *
 * Uses the status-preserving `runValidation` (not the status-changing variant)
 * so that already-APPROVED/PUBLISHED documents keep their workflow status while
 * still getting fresh validation results. Failures on individual documents are
 * collected and reported rather than aborting the whole run.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!UUID_REGEX.test(id)) {
      return NextResponse.json(
        { error: 'Invalid study ID format' },
        { status: 400 }
      );
    }

    const study = await db.study.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!study) {
      return NextResponse.json({ error: 'Study not found' }, { status: 404 });
    }

    const documents = await db.document.findMany({
      where: { studyId: id },
      select: { id: true },
    });

    let validated = 0;
    const failures: { documentId: string; error: string }[] = [];

    for (const doc of documents) {
      try {
        await runValidation(doc.id);
        validated++;
      } catch (error) {
        failures.push({
          documentId: doc.id,
          error: error instanceof Error ? error.message : 'Validation failed',
        });
      }
    }

    return NextResponse.json({
      data: {
        total: documents.length,
        validated,
        failed: failures.length,
        failures,
      },
    });
  } catch (error) {
    console.error('Failed to validate study documents:', error);
    return NextResponse.json(
      { error: 'Failed to validate study documents' },
      { status: 500 }
    );
  }
}
