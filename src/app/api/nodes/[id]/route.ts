import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { UpdateNodeInput } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const node = await db.structureNode.findUnique({
      where: { id },
      include: {
        children: {
          orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
        },
      },
    });

    if (!node) {
      return NextResponse.json(
        { error: 'Node not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: node });
  } catch (error) {
    console.error('Failed to fetch node:', error);
    return NextResponse.json(
      { error: 'Failed to fetch node' },
      { status: 500 }
    );
  }
}

// Valid fields that can be updated
const VALID_UPDATE_FIELDS = [
  'code',
  'title',
  'documentType',
  'required',
  'sortOrder',
  'validationRules',
  'checklistId',
] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: UpdateNodeInput = await request.json();

    // Validate that at least one valid field is provided
    const hasValidField = VALID_UPDATE_FIELDS.some(
      (field) => body[field] !== undefined
    );

    if (!hasValidField) {
      return NextResponse.json(
        {
          error: `Request body must contain at least one valid field: ${VALID_UPDATE_FIELDS.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Check if node exists
    const existingNode = await db.structureNode.findUnique({
      where: { id },
    });

    if (!existingNode) {
      return NextResponse.json(
        { error: 'Node not found' },
        { status: 404 }
      );
    }

    // If code is being changed, check for uniqueness within template
    if (body.code && body.code !== existingNode.code) {
      const duplicateCode = await db.structureNode.findUnique({
        where: {
          templateId_code: {
            templateId: existingNode.templateId,
            code: body.code,
          },
        },
      });

      if (duplicateCode) {
        return NextResponse.json(
          { error: `A node with code "${body.code}" already exists in this template` },
          { status: 400 }
        );
      }
    }

    const node = await db.structureNode.update({
      where: { id },
      data: {
        code: body.code,
        title: body.title,
        documentType: body.documentType,
        required: body.required,
        sortOrder: body.sortOrder,
        // Store as JSON string for SQLite compatibility
        validationRules: body.validationRules !== undefined
          ? JSON.stringify(body.validationRules)
          : undefined,
        checklistId: body.checklistId,
      },
    });

    return NextResponse.json({ data: node });
  } catch (error) {
    console.error('Failed to update node:', error);
    return NextResponse.json(
      { error: 'Failed to update node' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if node exists
    const existingNode = await db.structureNode.findUnique({
      where: { id },
      include: {
        children: true,
        documents: {
          select: { id: true },
        },
      },
    });

    if (!existingNode) {
      return NextResponse.json(
        { error: 'Node not found' },
        { status: 404 }
      );
    }

    // Check if node has documents
    if (existingNode.documents.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete node that has documents attached' },
        { status: 400 }
      );
    }

    // Fetch all nodes for the template in a single query to avoid N+1 problem
    const allNodes = await db.structureNode.findMany({
      where: { templateId: existingNode.templateId },
      select: { id: true, parentId: true },
    });

    // Build a map for efficient lookup
    const nodesByParent = new Map<string, string[]>();
    for (const node of allNodes) {
      if (node.parentId) {
        const siblings = nodesByParent.get(node.parentId) || [];
        siblings.push(node.id);
        nodesByParent.set(node.parentId, siblings);
      }
    }

    // Find all descendants in memory using BFS
    const getAllDescendantIds = (nodeId: string): string[] => {
      const descendantIds: string[] = [];
      const queue = nodesByParent.get(nodeId) || [];

      while (queue.length > 0) {
        const currentId = queue.shift()!;
        descendantIds.push(currentId);
        const children = nodesByParent.get(currentId) || [];
        queue.push(...children);
      }

      return descendantIds;
    };

    const descendantIds = getAllDescendantIds(id);

    // Check if any descendants have documents
    if (descendantIds.length > 0) {
      const descendantsWithDocs = await db.structureNode.findFirst({
        where: {
          id: { in: descendantIds },
          documents: { some: {} },
        },
      });

      if (descendantsWithDocs) {
        return NextResponse.json(
          { error: 'Cannot delete node: one or more child nodes have documents attached' },
          { status: 400 }
        );
      }
    }

    // Delete all nodes in a transaction to ensure atomicity
    await db.$transaction(async (tx) => {
      // Delete all descendants first (from deepest to shallowest)
      if (descendantIds.length > 0) {
        await tx.structureNode.deleteMany({
          where: { id: { in: descendantIds } },
        });
      }

      // Delete the node itself
      await tx.structureNode.delete({ where: { id } });
    });

    return NextResponse.json({
      data: {
        success: true,
        deletedCount: descendantIds.length + 1,
      },
    });
  } catch (error) {
    console.error('Failed to delete node:', error);
    return NextResponse.json(
      { error: 'Failed to delete node' },
      { status: 500 }
    );
  }
}
