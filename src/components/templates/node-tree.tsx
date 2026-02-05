'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileText,
  Database,
  Table,
  BarChart3,
  File,
  GripVertical,
} from 'lucide-react';
import type { StructureNode } from '@/types';

// Tree node with children for internal tree building
interface TreeNode extends StructureNode {
  children: TreeNode[];
}

// Flattened node for sortable list
interface FlattenedNode extends StructureNode {
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
}

export interface NodeTreeProps {
  nodes: StructureNode[];
  selectedNodeId?: string;
  onSelectNode?: (nodeId: string) => void;
  onReorder?: (updates: Array<{ id: string; sortOrder: number; parentId?: string | null }>) => void;
}

// Icon mapping for document types
const documentTypeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  PDF: FileText,
  DATASET: Database,
  LISTING: Table,
  FIGURE: BarChart3,
  OTHER: File,
};

// Badge variant mapping for document types
const documentTypeBadgeVariants: Record<string, 'default' | 'secondary' | 'outline'> = {
  PDF: 'secondary',
  DATASET: 'outline',
  LISTING: 'outline',
  FIGURE: 'outline',
  OTHER: 'outline',
};

/**
 * Build a tree structure from a flat array of nodes using parentId relationships
 */
function buildTree(nodes: StructureNode[]): TreeNode[] {
  // Create a map for O(1) lookup
  const nodeMap = new Map<string, TreeNode>();

  // Initialize all nodes with empty children arrays
  nodes.forEach((node) => {
    nodeMap.set(node.id, { ...node, children: [] });
  });

  // Build the tree by assigning children to parents
  const rootNodes: TreeNode[] = [];

  nodes.forEach((node) => {
    const treeNode = nodeMap.get(node.id)!;

    if (node.parentId && nodeMap.has(node.parentId)) {
      // Add to parent's children
      nodeMap.get(node.parentId)!.children.push(treeNode);
    } else {
      // No parent or parent not found - this is a root node
      rootNodes.push(treeNode);
    }
  });

  // Sort children at each level by sortOrder
  const sortChildren = (nodes: TreeNode[]): TreeNode[] => {
    return nodes
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((node) => ({
        ...node,
        children: sortChildren(node.children),
      }));
  };

  return sortChildren(rootNodes);
}

/**
 * Flatten tree into a list for sortable context, respecting expanded state
 */
function flattenTree(
  tree: TreeNode[],
  expandedNodes: Set<string>,
  depth: number = 0
): FlattenedNode[] {
  const result: FlattenedNode[] = [];

  for (const node of tree) {
    const hasChildren = node.children.length > 0;
    const isExpanded = expandedNodes.has(node.id);

    result.push({
      ...node,
      depth,
      hasChildren,
      isExpanded,
    });

    // Only add children if expanded
    if (hasChildren && isExpanded) {
      result.push(...flattenTree(node.children, expandedNodes, depth + 1));
    }
  }

  return result;
}

/**
 * Get all descendant IDs of a node
 */
function getDescendantIds(nodeId: string, nodes: StructureNode[]): string[] {
  const childrenMap = new Map<string, string[]>();
  nodes.forEach((node) => {
    if (node.parentId) {
      const siblings = childrenMap.get(node.parentId) || [];
      siblings.push(node.id);
      childrenMap.set(node.parentId, siblings);
    }
  });

  const descendants: string[] = [];
  const queue = childrenMap.get(nodeId) || [];

  while (queue.length > 0) {
    const id = queue.shift()!;
    descendants.push(id);
    const children = childrenMap.get(id) || [];
    queue.push(...children);
  }

  return descendants;
}

export function NodeTree({ nodes, selectedNodeId, onSelectNode, onReorder }: NodeTreeProps) {
  // Build tree structure from flat array
  const tree = useMemo(() => buildTree(nodes), [nodes]);

  // Track which nodes have been explicitly collapsed by the user
  // By default, all nodes are expanded (not in the collapsed set)
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());

  // Compute expanded nodes: all nodes except those explicitly collapsed
  // New nodes are automatically expanded since they won't be in collapsedNodes
  const expandedNodes = useMemo(() => {
    return new Set(nodes.filter((n) => !collapsedNodes.has(n.id)).map((n) => n.id));
  }, [nodes, collapsedNodes]);

  // Track the currently dragged node
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  // Flatten tree for sortable context
  const flattenedNodes = useMemo(
    () => flattenTree(tree, expandedNodes),
    [tree, expandedNodes]
  );

  const toggleExpanded = useCallback((nodeId: string) => {
    setCollapsedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        // Was collapsed, now expand (remove from collapsed set)
        next.delete(nodeId);
      } else {
        // Was expanded, now collapse (add to collapsed set)
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const handleSelect = useCallback(
    (nodeId: string) => {
      onSelectNode?.(nodeId);
    },
    [onSelectNode]
  );

  // Configure sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required to start drag
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    setOverId(event.over?.id as string | null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverId(null);

    if (!over || active.id === over.id || !onReorder) {
      return;
    }

    const activeNode = nodes.find((n) => n.id === active.id);
    const overNode = nodes.find((n) => n.id === over.id);

    if (!activeNode || !overNode) {
      return;
    }

    // Get descendants of the active node - cannot drop onto own descendants
    const activeDescendants = getDescendantIds(activeNode.id, nodes);
    if (activeDescendants.includes(overNode.id)) {
      return;
    }

    // Determine if we're reordering within same parent or moving to different parent
    const activeParentId = activeNode.parentId;
    const overParentId = overNode.parentId;

    // Get siblings (nodes with same parent)
    const getSiblings = (parentId: string | null) =>
      nodes
        .filter((n) => n.parentId === parentId)
        .sort((a, b) => a.sortOrder - b.sortOrder);

    if (activeParentId === overParentId) {
      // Reordering within same parent
      const siblings = getSiblings(activeParentId);
      const oldIndex = siblings.findIndex((n) => n.id === activeNode.id);
      const newIndex = siblings.findIndex((n) => n.id === overNode.id);

      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
        return;
      }

      // Reorder siblings
      const reordered = [...siblings];
      reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, activeNode);

      // Generate updates with new sortOrder values
      const updates = reordered.map((node, index) => ({
        id: node.id,
        sortOrder: index,
      }));

      onReorder(updates);
    } else {
      // Moving to a different parent
      // Remove from old parent's siblings
      const oldSiblings = getSiblings(activeParentId).filter(
        (n) => n.id !== activeNode.id
      );
      const oldSiblingsUpdates = oldSiblings.map((node, index) => ({
        id: node.id,
        sortOrder: index,
      }));

      // Add to new parent's siblings at the position of overNode
      const newSiblings = getSiblings(overParentId);
      const overIndex = newSiblings.findIndex((n) => n.id === overNode.id);

      // Insert active node at the over position
      const newSiblingsWithActive = [...newSiblings];
      newSiblingsWithActive.splice(overIndex, 0, activeNode);

      const newSiblingsUpdates = newSiblingsWithActive.map((node, index) => ({
        id: node.id,
        sortOrder: index,
        ...(node.id === activeNode.id && { parentId: overParentId }),
      }));

      onReorder([...oldSiblingsUpdates, ...newSiblingsUpdates]);
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setOverId(null);
  };

  // Find the active node for the drag overlay
  const activeNode = activeId
    ? flattenedNodes.find((n) => n.id === activeId)
    : null;

  if (nodes.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No nodes in this template yet. Add nodes to define the document structure.
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="space-y-1" role="tree" aria-label="Template structure">
        <SortableContext
          items={flattenedNodes.map((n) => n.id)}
          strategy={verticalListSortingStrategy}
        >
          {flattenedNodes.map((node) => (
            <SortableTreeNodeItem
              key={node.id}
              node={node}
              selectedNodeId={selectedNodeId}
              onToggleExpanded={toggleExpanded}
              onSelect={handleSelect}
              isOver={overId === node.id}
              isDragging={activeId === node.id}
            />
          ))}
        </SortableContext>
      </div>

      {/* Drag overlay - shows a ghost of the dragged item */}
      <DragOverlay dropAnimation={null}>
        {activeNode ? (
          <TreeNodeOverlay node={activeNode} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

interface SortableTreeNodeItemProps {
  node: FlattenedNode;
  selectedNodeId?: string;
  onToggleExpanded: (nodeId: string) => void;
  onSelect: (nodeId: string) => void;
  isOver: boolean;
  isDragging: boolean;
}

function SortableTreeNodeItem({
  node,
  selectedNodeId,
  onToggleExpanded,
  onSelect,
  isOver,
  isDragging,
}: SortableTreeNodeItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: node.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isSelected = selectedNodeId === node.id;

  // Determine icon based on whether node has children (folder) or document type
  const getIcon = () => {
    if (node.hasChildren) {
      return node.isExpanded ? (
        <FolderOpen className="h-4 w-4 text-blue-500 flex-shrink-0" />
      ) : (
        <Folder className="h-4 w-4 text-blue-500 flex-shrink-0" />
      );
    }

    // Use document type icon if available
    if (node.documentType) {
      const IconComponent = documentTypeIcons[node.documentType] || File;
      return <IconComponent className="h-4 w-4 text-gray-400 flex-shrink-0" />;
    }

    // Default to folder for nodes without document type (container nodes)
    return <Folder className="h-4 w-4 text-blue-500 flex-shrink-0" />;
  };

  const handleChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleExpanded(node.id);
  };

  const handleRowClick = () => {
    onSelect(node.id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(node.id);
    } else if (e.key === 'ArrowRight' && node.hasChildren && !node.isExpanded) {
      e.preventDefault();
      onToggleExpanded(node.id);
    } else if (e.key === 'ArrowLeft' && node.hasChildren && node.isExpanded) {
      e.preventDefault();
      onToggleExpanded(node.id);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      role="treeitem"
      aria-expanded={node.hasChildren ? node.isExpanded : undefined}
      aria-selected={isSelected}
    >
      <div
        className={cn(
          'flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer transition-colors',
          'hover:bg-gray-100',
          isSelected && 'bg-blue-50 hover:bg-blue-100 ring-1 ring-blue-200',
          isOver && !isDragging && 'bg-blue-100 ring-2 ring-blue-400',
          isDragging && 'opacity-50'
        )}
        style={{ paddingLeft: `${node.depth * 20 + 8}px` }}
        onClick={handleRowClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        {/* Drag handle */}
        <button
          type="button"
          className="flex items-center justify-center w-5 h-5 rounded hover:bg-gray-200 flex-shrink-0 cursor-grab active:cursor-grabbing touch-none"
          {...attributes}
          {...listeners}
          tabIndex={-1}
          aria-label="Drag to reorder"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-4 w-4 text-gray-400" />
        </button>

        {/* Expand/collapse chevron - only show if has children */}
        <button
          type="button"
          className={cn(
            'flex items-center justify-center w-5 h-5 rounded hover:bg-gray-200 flex-shrink-0',
            !node.hasChildren && 'invisible'
          )}
          onClick={handleChevronClick}
          tabIndex={-1}
          aria-label={node.isExpanded ? 'Collapse' : 'Expand'}
        >
          {node.isExpanded ? (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-500" />
          )}
        </button>

        {/* Node icon */}
        {getIcon()}

        {/* Node code */}
        <span className="font-mono text-sm text-gray-600 flex-shrink-0">
          {node.code}
        </span>

        {/* Node title */}
        <span
          className={cn(
            'text-sm truncate',
            isSelected ? 'text-gray-900 font-medium' : 'text-gray-700'
          )}
          title={node.title}
        >
          {node.title}
        </span>

        {/* Status indicators */}
        <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
          {node.required && (
            <Badge variant="warning" className="text-[10px] px-1.5 py-0">
              Required
            </Badge>
          )}
          {node.documentType && (
            <Badge
              variant={documentTypeBadgeVariants[node.documentType] || 'outline'}
              className="text-[10px] px-1.5 py-0"
            >
              {node.documentType}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Drag overlay component - shown while dragging
 */
function TreeNodeOverlay({ node }: { node: FlattenedNode }) {
  const getIcon = () => {
    if (node.hasChildren) {
      return <Folder className="h-4 w-4 text-blue-500 flex-shrink-0" />;
    }
    if (node.documentType) {
      const IconComponent = documentTypeIcons[node.documentType] || File;
      return <IconComponent className="h-4 w-4 text-gray-400 flex-shrink-0" />;
    }
    return <Folder className="h-4 w-4 text-blue-500 flex-shrink-0" />;
  };

  return (
    <div
      className="flex items-center gap-2 py-1.5 px-2 rounded-md bg-white shadow-lg border border-blue-300 cursor-grabbing"
      style={{ paddingLeft: '8px', width: 'max-content', maxWidth: '400px' }}
    >
      <GripVertical className="h-4 w-4 text-gray-400 flex-shrink-0" />
      {getIcon()}
      <span className="font-mono text-sm text-gray-600 flex-shrink-0">
        {node.code}
      </span>
      <span className="text-sm truncate text-gray-700">
        {node.title}
      </span>
    </div>
  );
}
