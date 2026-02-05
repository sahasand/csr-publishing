'use client';

import { useState, useMemo } from 'react';
import { useUpdateNode, useDeleteNode } from '@/hooks/use-nodes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Loader2, Trash2, AlertTriangle } from 'lucide-react';
import type { StructureNode, UpdateNodeInput } from '@/types';

const DOCUMENT_TYPES = ['PDF', 'DATASET', 'LISTING', 'FIGURE', 'OTHER'] as const;

export interface EditNodeDialogProps {
  node: StructureNode | null;
  nodes: StructureNode[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  onDelete?: () => void;
}

/**
 * Wrapper component that uses key to reset internal state when node changes
 */
export function EditNodeDialog({
  node,
  nodes,
  open,
  onOpenChange,
  onSuccess,
  onDelete,
}: EditNodeDialogProps) {
  if (!node || !open) return null;

  // Use node.id as key to reset form state when switching between nodes
  return (
    <EditNodeDialogInner
      key={node.id}
      node={node}
      nodes={nodes}
      open={open}
      onOpenChange={onOpenChange}
      onSuccess={onSuccess}
      onDelete={onDelete}
    />
  );
}

interface EditNodeDialogInnerProps {
  node: StructureNode;
  nodes: StructureNode[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  onDelete?: () => void;
}

function EditNodeDialogInner({
  node,
  nodes,
  open,
  onOpenChange,
  onSuccess,
  onDelete,
}: EditNodeDialogInnerProps) {
  const updateNode = useUpdateNode();
  const deleteNode = useDeleteNode();

  // Initialize state from node props (only happens once per node due to key in parent)
  const [code, setCode] = useState(node.code);
  const [title, setTitle] = useState(node.title);
  const [documentType, setDocumentType] = useState<UpdateNodeInput['documentType']>(node.documentType);
  const [required, setRequired] = useState(node.required);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Check if node has children
  const hasChildren = useMemo(() => {
    return nodes.some((n) => n.parentId === node.id);
  }, [node.id, nodes]);

  // Count total descendants
  const descendantCount = useMemo(() => {
    const countDescendants = (parentId: string): number => {
      const children = nodes.filter((n) => n.parentId === parentId);
      return children.reduce(
        (count, child) => count + 1 + countDescendants(child.id),
        0
      );
    };

    return countDescendants(node.id);
  }, [node.id, nodes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!code.trim() || !title.trim()) return;

    try {
      await updateNode.mutateAsync({
        nodeId: node.id,
        data: {
          code: code.trim(),
          title: title.trim(),
          documentType,
          required,
        },
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to update node:', error);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteNode.mutateAsync({
        nodeId: node.id,
        templateId: node.templateId,
      });
      onDelete?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to delete node:', error);
    }
  };

  const handleClose = () => {
    if (!updateNode.isPending && !deleteNode.isPending) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Node</DialogTitle>
          <DialogDescription>
            Update the properties of this structure node.
          </DialogDescription>
        </DialogHeader>

        {showDeleteConfirm ? (
          <div className="p-6 pt-2 space-y-4">
            <div className="flex items-start gap-3 p-4 bg-red-50 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-red-900">Confirm Delete</h4>
                <p className="text-sm text-red-700 mt-1">
                  Are you sure you want to delete <strong>{node.code} - {node.title}</strong>?
                </p>
                {hasChildren && (
                  <p className="text-sm text-red-700 mt-2">
                    <strong>Warning:</strong> This node has {descendantCount} child node{descendantCount !== 1 ? 's' : ''} that will also be deleted.
                  </p>
                )}
                <p className="text-sm text-red-600 mt-2">
                  This action cannot be undone.
                </p>
              </div>
            </div>

            {deleteNode.error && (
              <div className="text-sm text-red-500 p-2 bg-red-50 rounded-md">
                Error: {deleteNode.error.message}
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleteNode.isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteNode.isPending}
              >
                {deleteNode.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete {hasChildren ? `${descendantCount + 1} Nodes` : 'Node'}
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="p-6 pt-2 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-code">Code *</Label>
                  <Input
                    id="edit-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="e.g., 16.2.1"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-title">Title *</Label>
                  <Input
                    id="edit-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Summary of Clinical Efficacy"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-documentType">Document Type</Label>
                <Select
                  id="edit-documentType"
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value as UpdateNodeInput['documentType'])}
                >
                  {DOCUMENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="edit-required"
                  checked={required}
                  onChange={(e) => setRequired(e.target.checked)}
                />
                <Label htmlFor="edit-required" className="font-normal cursor-pointer">
                  Required document
                </Label>
              </div>

              {updateNode.error && (
                <div className="text-sm text-red-500 p-2 bg-red-50 rounded-md">
                  Error: {updateNode.error.message}
                </div>
              )}
            </div>

            <DialogFooter>
              <div className="flex items-center justify-between w-full">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={updateNode.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleClose}
                    disabled={updateNode.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={updateNode.isPending || !code.trim() || !title.trim()}
                  >
                    {updateNode.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </Button>
                </div>
              </div>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
