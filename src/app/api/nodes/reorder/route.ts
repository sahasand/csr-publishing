import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { ReorderItem, ReorderNodesInput } from '@/types';

/**
 * Batch update sortOrder (and optionally parentId) for multiple nodes
 * Used for drag-and-drop reordering in the tree view
 */
export async function POST(request: NextRequest) {
  try {
    const body: ReorderNodesInput = await request.json();

    if (!body.templateId || !body.updates || !Array.isArray(body.updates)) {
      return NextResponse.json(
        { error: 'templateId and updates array are required' },
        { status: 400 }
      );
    }

    if (body.updates.length === 0) {
      return NextResponse.json({ data: { success: true, updatedCount: 0 } });
    }

    // Validate sortOrder values are non-negative integers
    for (const update of body.updates) {
      if (
        typeof update.sortOrder !== 'number' ||
        !Number.isInteger(update.sortOrder) ||
        update.sortOrder < 0
      ) {
        return NextResponse.json(
          { error: 'sortOrder must be a non-negative integer' },
          { status: 400 }
        );
      }
    }

    // Validate all nodes exist and belong to the template
    const nodeIds = body.updates.map((u) => u.id);
    const existingNodes = await db.structureNode.findMany({
      where: {
        id: { in: nodeIds },
        templateId: body.templateId,
      },
      select: { id: true },
    });

    if (existingNodes.length !== nodeIds.length) {
      return NextResponse.json(
        { error: 'One or more nodes not found or do not belong to this template' },
        { status: 400 }
      );
    }

    // If any updates include parentId changes, validate the new parents exist
    const parentIds = body.updates
      .filter((u) => u.parentId !== undefined && u.parentId !== null)
      .map((u) => u.parentId as string);

    if (parentIds.length > 0) {
      const existingParents = await db.structureNode.findMany({
        where: {
          id: { in: parentIds },
          templateId: body.templateId,
        },
        select: { id: true },
      });

      if (existingParents.length !== new Set(parentIds).size) {
        return NextResponse.json(
          { error: 'One or more parent nodes not found' },
          { status: 400 }
        );
      }

      // Prevent circular references: a node cannot be its own ancestor
      for (const update of body.updates) {
        if (update.parentId !== undefined && update.parentId !== null) {
          // Check if the new parent is a descendant of the node being moved
          const isCircular = await checkCircularReference(
            update.id,
            update.parentId,
            body.templateId
          );
          if (isCircular) {
            return NextResponse.json(
              { error: 'Cannot move a node to be a child of its own descendant' },
              { status: 400 }
            );
          }
        }
      }
    }

    // Perform batch update in a transaction
    await db.$transaction(
      body.updates.map((update) =>
        db.structureNode.update({
          where: { id: update.id },
          data: {
            sortOrder: update.sortOrder,
            ...(update.parentId !== undefined && { parentId: update.parentId }),
          },
        })
      )
    );

    return NextResponse.json({
      data: { success: true, updatedCount: body.updates.length },
    });
  } catch (error) {
    console.error('Failed to reorder nodes:', error);
    return NextResponse.json(
      { error: 'Failed to reorder nodes' },
      { status: 500 }
    );
  }
}

/**
 * Check if moving a node to a new parent would create a circular reference
 */
async function checkCircularReference(
  nodeId: string,
  newParentId: string,
  templateId: string
): Promise<boolean> {
  // Get all nodes in the template to build the tree in memory
  const allNodes = await db.structureNode.findMany({
    where: { templateId },
    select: { id: true, parentId: true },
  });

  const nodeMap = new Map(allNodes.map((n) => [n.id, n.parentId]));

  // Check if newParentId is a descendant of nodeId
  // by traversing from newParentId up to the root
  const visited = new Set<string>();
  let current: string | null = newParentId;

  while (current) {
    if (current === nodeId) {
      return true; // Circular reference detected
    }
    if (visited.has(current)) {
      break; // Already visited, prevent infinite loop
    }
    visited.add(current);
    current = nodeMap.get(current) || null;
  }

  return false;
}
