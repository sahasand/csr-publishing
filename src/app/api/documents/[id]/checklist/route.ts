import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { Prisma } from '@/generated/prisma/client';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VALID_RESULTS = ['pass', 'fail', 'na'] as const;
type ChecklistItemResult = typeof VALID_RESULTS[number];

interface ItemResponse {
  itemId: string;
  result: ChecklistItemResult | null;
  notes?: string;
}

interface CreateChecklistResponseInput {
  checklistId: string;
}

interface UpdateChecklistResponseInput {
  responses: Array<{
    itemId: string;
    result: ChecklistItemResult;
    notes?: string;
  }>;
}

/**
 * GET /api/documents/[id]/checklist
 * Get checklist response for a document
 * Returns null if no response exists
 * If response exists, includes the checklist with all items for context
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

    // Fetch checklist response with checklist and items
    const checklistResponse = await db.checklistResponse.findUnique({
      where: { documentId },
      include: {
        checklist: {
          include: {
            items: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
    });

    // Return null if no response exists
    if (!checklistResponse) {
      return NextResponse.json({ data: null });
    }

    return NextResponse.json({ data: checklistResponse });
  } catch (error) {
    console.error('Failed to fetch checklist response:', error);
    return NextResponse.json(
      { error: 'Failed to fetch checklist response' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/documents/[id]/checklist
 * Create/initialize checklist response for a document
 * Required: checklistId
 * Auto-populates responses from validation results for items with autoCheck=true
 */
export async function POST(
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

    const body: CreateChecklistResponseInput = await request.json();

    // Validate required field
    if (!body.checklistId) {
      return NextResponse.json(
        { error: 'checklistId is required' },
        { status: 400 }
      );
    }

    // Validate checklistId UUID format
    if (!UUID_REGEX.test(body.checklistId)) {
      return NextResponse.json(
        { error: 'Invalid checklist ID format' },
        { status: 400 }
      );
    }

    // Check if checklist exists and get its items
    const checklist = await db.checklist.findUnique({
      where: { id: body.checklistId },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!checklist) {
      return NextResponse.json(
        { error: 'Checklist not found' },
        { status: 404 }
      );
    }

    // Check if response already exists
    const existingResponse = await db.checklistResponse.findUnique({
      where: { documentId },
      select: { id: true },
    });

    if (existingResponse) {
      return NextResponse.json(
        { error: 'Checklist response already exists for this document' },
        { status: 409 }
      );
    }

    // Get validation results for this document to auto-populate
    const validationResults = await db.validationResult.findMany({
      where: { documentId },
    });

    // Create a map of ruleId -> passed for quick lookup
    const validationMap = new Map<string, boolean>();
    for (const result of validationResults) {
      validationMap.set(result.ruleId, result.passed);
    }

    // Build initial responses array, auto-populating from validation results
    const responses: ItemResponse[] = checklist.items.map((item) => {
      let result: ChecklistItemResult | null = null;

      // Auto-populate if item has autoCheck enabled and autoCheckRule set
      if (item.autoCheck && item.autoCheckRule) {
        const validationPassed = validationMap.get(item.autoCheckRule);
        if (validationPassed !== undefined) {
          result = validationPassed ? 'pass' : 'fail';
        }
        // If no validation result found, leave as null
      }

      return {
        itemId: item.id,
        result,
      };
    });

    // Create the checklist response
    const checklistResponse = await db.checklistResponse.create({
      data: {
        documentId,
        checklistId: body.checklistId,
        responses: responses as unknown as Prisma.InputJsonValue,
      },
      include: {
        checklist: {
          include: {
            items: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
    });

    return NextResponse.json({ data: checklistResponse }, { status: 201 });
  } catch (error) {
    console.error('Failed to create checklist response:', error);
    return NextResponse.json(
      { error: 'Failed to create checklist response' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/documents/[id]/checklist
 * Update checklist responses for a document
 * Required: responses array of { itemId, result, notes? }
 * Merges with existing responses
 * Sets completedAt when ALL required items have a result
 */
export async function PATCH(
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

    // Check if checklist response exists
    const existingResponse = await db.checklistResponse.findUnique({
      where: { documentId },
      include: {
        checklist: {
          include: {
            items: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
    });

    if (!existingResponse) {
      return NextResponse.json(
        { error: 'Checklist response not found for this document' },
        { status: 404 }
      );
    }

    const body: UpdateChecklistResponseInput = await request.json();

    // Validate responses array
    if (!body.responses || !Array.isArray(body.responses)) {
      return NextResponse.json(
        { error: 'responses array is required' },
        { status: 400 }
      );
    }

    // Validate each response in the array
    for (const response of body.responses) {
      if (!response.itemId) {
        return NextResponse.json(
          { error: 'Each response must have an itemId' },
          { status: 400 }
        );
      }

      if (!UUID_REGEX.test(response.itemId)) {
        return NextResponse.json(
          { error: `Invalid itemId format: ${response.itemId}` },
          { status: 400 }
        );
      }

      if (!VALID_RESULTS.includes(response.result)) {
        return NextResponse.json(
          { error: `Invalid result value: ${response.result}. Must be one of: ${VALID_RESULTS.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Get existing responses as array
    const existingResponses = (existingResponse.responses as unknown as ItemResponse[]) || [];
    const responsesMap = new Map<string, ItemResponse>();

    // Add existing responses to map
    for (const resp of existingResponses) {
      responsesMap.set(resp.itemId, resp);
    }

    // Merge with new responses (update matching itemIds, add new ones)
    for (const newResp of body.responses) {
      responsesMap.set(newResp.itemId, {
        itemId: newResp.itemId,
        result: newResp.result,
        notes: newResp.notes,
      });
    }

    // Convert map back to array
    const mergedResponses = Array.from(responsesMap.values());

    // Determine completedAt based on required items
    const requiredItemIds = new Set(
      existingResponse.checklist.items
        .filter((item) => item.required)
        .map((item) => item.id)
    );

    // Check if all required items have a result (pass/fail/na)
    let allRequiredComplete = true;
    for (const itemId of requiredItemIds) {
      const response = responsesMap.get(itemId);
      if (!response || response.result === null) {
        allRequiredComplete = false;
        break;
      }
    }

    // Set completedAt: current timestamp if all required items complete, null otherwise
    const completedAt = allRequiredComplete ? new Date() : null;

    // Update the checklist response
    const updatedResponse = await db.checklistResponse.update({
      where: { documentId },
      data: {
        responses: mergedResponses as unknown as Prisma.InputJsonValue,
        completedAt,
      },
      include: {
        checklist: {
          include: {
            items: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
    });

    return NextResponse.json({ data: updatedResponse });
  } catch (error) {
    console.error('Failed to update checklist response:', error);
    return NextResponse.json(
      { error: 'Failed to update checklist response' },
      { status: 500 }
    );
  }
}
