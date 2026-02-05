'use client';

import { useState, useMemo, useCallback } from 'react';
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
} from 'lucide-react';
import type { StructureNode, Document } from '@/types';

// Tree node with children for internal tree building
interface TreeNode extends StructureNode {
  children: TreeNode[];
}

// Flattened node for rendering
interface FlattenedNode extends StructureNode {
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
}

// Status derived from documents in a node
type NodeDocumentStatus = 'empty' | 'has_draft' | 'in_review' | 'all_approved';

export interface StudyTreeProps {
  nodes: StructureNode[];
  documents: Document[];
  selectedNodeId?: string;
  onSelectNode?: (nodeId: string) => void;
}

// Icon mapping for document types
const documentTypeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  PDF: FileText,
  DATASET: Database,
  LISTING: Table,
  FIGURE: BarChart3,
  OTHER: File,
};

/**
 * Determine the aggregate status for a node based on its documents
 */
function getNodeStatus(nodeDocs: Document[]): NodeDocumentStatus {
  if (nodeDocs.length === 0) {
    return 'empty';
  }

  // Check if all documents are approved or published
  const allApproved = nodeDocs.every(
    (doc) => doc.status === 'APPROVED' || doc.status === 'PUBLISHED'
  );
  if (allApproved) {
    return 'all_approved';
  }

  // Check if any document is in review
  const hasInReview = nodeDocs.some((doc) => doc.status === 'IN_REVIEW');
  if (hasInReview) {
    return 'in_review';
  }

  // Otherwise has drafts or processing docs
  return 'has_draft';
}

// Type for pre-computed document map
type DocumentsBySlotId = Map<string, Document[]>;

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
 * Flatten tree into a list for rendering, respecting expanded state
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

export function StudyTree({
  nodes,
  documents,
  selectedNodeId,
  onSelectNode,
}: StudyTreeProps) {
  // Build tree structure from flat array
  const tree = useMemo(() => buildTree(nodes), [nodes]);

  // Pre-compute document lookup map for O(1) access per node
  // This avoids O(n*m) complexity from filtering documents for each node
  const documentsBySlotId = useMemo(() => {
    const map = new Map<string, Document[]>();
    documents.forEach((doc) => {
      const existing = map.get(doc.slotId) || [];
      existing.push(doc);
      map.set(doc.slotId, existing);
    });
    return map;
  }, [documents]);

  // Track which nodes have been explicitly collapsed by the user
  // By default, all nodes are expanded (not in the collapsed set)
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());

  // Compute expanded nodes: all nodes except those explicitly collapsed
  // New nodes are automatically expanded since they won't be in collapsedNodes
  const expandedNodes = useMemo(() => {
    return new Set(nodes.filter((n) => !collapsedNodes.has(n.id)).map((n) => n.id));
  }, [nodes, collapsedNodes]);

  // Flatten tree for rendering
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

  if (nodes.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No nodes in this template yet.
      </div>
    );
  }

  return (
    <div className="space-y-0.5" role="tree" aria-label="Study structure">
      {flattenedNodes.map((node) => (
        <TreeNodeItem
          key={node.id}
          node={node}
          documentsBySlotId={documentsBySlotId}
          selectedNodeId={selectedNodeId}
          onToggleExpanded={toggleExpanded}
          onSelect={handleSelect}
        />
      ))}
    </div>
  );
}

interface TreeNodeItemProps {
  node: FlattenedNode;
  documentsBySlotId: DocumentsBySlotId;
  selectedNodeId?: string;
  onToggleExpanded: (nodeId: string) => void;
  onSelect: (nodeId: string) => void;
}

function TreeNodeItem({
  node,
  documentsBySlotId,
  selectedNodeId,
  onToggleExpanded,
  onSelect,
}: TreeNodeItemProps) {
  const isSelected = selectedNodeId === node.id;
  const nodeDocs = documentsBySlotId.get(node.id) || [];
  const documentCount = nodeDocs.length;
  const nodeStatus = getNodeStatus(nodeDocs);

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

  // Get status badge color based on document status
  const getStatusBadge = () => {
    if (documentCount === 0) {
      return null; // No badge for empty nodes
    }

    const statusConfig: Record<
      NodeDocumentStatus,
      { variant: 'secondary' | 'warning' | 'default' | 'success'; label?: string }
    > = {
      empty: { variant: 'secondary' },
      has_draft: { variant: 'warning' },
      in_review: { variant: 'default', label: 'Review' },
      all_approved: { variant: 'success' },
    };

    const config = statusConfig[nodeStatus];

    return (
      <Badge
        variant={config.variant}
        className={cn(
          'text-[10px] px-1.5 py-0 min-w-[18px] justify-center',
          nodeStatus === 'in_review' && 'bg-blue-500 text-white'
        )}
      >
        {config.label || documentCount}
      </Badge>
    );
  };

  // Get status indicator dot for the node
  const getStatusIndicator = () => {
    const statusColors: Record<NodeDocumentStatus, string> = {
      empty: 'bg-gray-300',
      has_draft: 'bg-yellow-400',
      in_review: 'bg-blue-500',
      all_approved: 'bg-green-500',
    };

    return (
      <span
        className={cn(
          'w-2 h-2 rounded-full flex-shrink-0',
          statusColors[nodeStatus]
        )}
        aria-label={`Status: ${nodeStatus.replace('_', ' ')}`}
      />
    );
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
      role="treeitem"
      aria-expanded={node.hasChildren ? node.isExpanded : undefined}
      aria-selected={isSelected}
    >
      <div
        className={cn(
          'flex items-center gap-1.5 py-1.5 px-2 rounded-md cursor-pointer transition-colors',
          'hover:bg-gray-100',
          isSelected && 'bg-blue-50 hover:bg-blue-100 ring-1 ring-blue-200'
        )}
        style={{ paddingLeft: `${node.depth * 16 + 8}px` }}
        onClick={handleRowClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
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

        {/* Status indicator dot */}
        {getStatusIndicator()}

        {/* Node code */}
        <span className="font-mono text-xs text-gray-500 flex-shrink-0">
          {node.code}
        </span>

        {/* Node title */}
        <span
          className={cn(
            'text-sm truncate flex-1',
            isSelected ? 'text-gray-900 font-medium' : 'text-gray-700'
          )}
          title={node.title}
        >
          {node.title}
        </span>

        {/* Document count / status badge */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {getStatusBadge()}
        </div>
      </div>
    </div>
  );
}
