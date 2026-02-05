'use client';

import { useState, useMemo } from 'react';
import { useCreateNode } from '@/hooks/use-nodes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Plus, X } from 'lucide-react';
import type { StructureNode, CreateNodeInput } from '@/types';

const DOCUMENT_TYPES = ['PDF', 'DATASET', 'LISTING', 'FIGURE', 'OTHER'] as const;

export interface AddNodeFormProps {
  templateId: string;
  nodes: StructureNode[];
  defaultParentId?: string | null;
  onSuccess?: (node: StructureNode) => void;
  onCancel?: () => void;
  compact?: boolean;
}

export function AddNodeForm({
  templateId,
  nodes,
  defaultParentId = null,
  onSuccess,
  onCancel,
  compact = false,
}: AddNodeFormProps) {
  const createNode = useCreateNode(templateId);

  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [documentType, setDocumentType] = useState<CreateNodeInput['documentType']>('PDF');
  const [required, setRequired] = useState(false);
  const [parentId, setParentId] = useState<string | null>(defaultParentId);

  // Build a sorted list of potential parent nodes
  const parentOptions = useMemo(() => {
    // Build depth map for sorting/display
    const nodeMap = new Map<string, StructureNode>();
    nodes.forEach((node) => nodeMap.set(node.id, node));

    const getDepth = (nodeId: string): number => {
      const node = nodeMap.get(nodeId);
      if (!node || !node.parentId) return 0;
      return 1 + getDepth(node.parentId);
    };

    // Build full code path for sorting
    const getFullPath = (nodeId: string): string => {
      const node = nodeMap.get(nodeId);
      if (!node) return '';
      if (!node.parentId) return node.code;
      return `${getFullPath(node.parentId)}.${node.code}`;
    };

    return nodes
      .map((node) => ({
        id: node.id,
        code: node.code,
        title: node.title,
        depth: getDepth(node.id),
        fullPath: getFullPath(node.id),
      }))
      .sort((a, b) => a.fullPath.localeCompare(b.fullPath));
  }, [nodes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!code.trim() || !title.trim()) return;

    try {
      const newNode = await createNode.mutateAsync({
        code: code.trim(),
        title: title.trim(),
        documentType,
        required,
        parentId: parentId || null,
      });

      // Reset form
      setCode('');
      setTitle('');
      setDocumentType('PDF');
      setRequired(false);
      setParentId(defaultParentId);

      onSuccess?.(newNode);
    } catch (error) {
      // Error is handled by the mutation
      console.error('Failed to create node:', error);
    }
  };

  const handleReset = () => {
    setCode('');
    setTitle('');
    setDocumentType('PDF');
    setRequired(false);
    setParentId(defaultParentId);
    onCancel?.();
  };

  if (compact) {
    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="code">Code *</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g., 16.2.1"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Summary of Clinical Efficacy"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="documentType">Document Type</Label>
            <Select
              id="documentType"
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value as CreateNodeInput['documentType'])}
            >
              {DOCUMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="parentId">Parent Node</Label>
            <Select
              id="parentId"
              value={parentId || ''}
              onChange={(e) => setParentId(e.target.value || null)}
            >
              <option value="">None (root level)</option>
              {parentOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {'  '.repeat(option.depth)}{option.code} - {option.title}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="required"
            checked={required}
            onChange={(e) => setRequired(e.target.checked)}
          />
          <Label htmlFor="required" className="font-normal cursor-pointer">
            Required document
          </Label>
        </div>

        {createNode.error && (
          <div className="text-sm text-destructive">
            {createNode.error.message}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button type="submit" disabled={createNode.isPending || !code.trim() || !title.trim()}>
            {createNode.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Add Node
              </>
            )}
          </Button>
          {onCancel && (
            <Button type="button" variant="outline" onClick={handleReset}>
              Cancel
            </Button>
          )}
        </div>
      </form>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-lg">
          Add New Node
          {onCancel && (
            <Button type="button" variant="ghost" size="icon" onClick={handleReset}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="code">Code *</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g., 16.2.1"
                required
              />
              <p className="text-xs text-muted-foreground">
                The section code (e.g., 16.2.1)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Summary of Clinical Efficacy"
                required
              />
              <p className="text-xs text-muted-foreground">
                A descriptive title for this node
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="documentType">Document Type</Label>
              <Select
                id="documentType"
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value as CreateNodeInput['documentType'])}
              >
                {DOCUMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-muted-foreground">
                The type of document expected at this location
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="parentId">Parent Node</Label>
              <Select
                id="parentId"
                value={parentId || ''}
                onChange={(e) => setParentId(e.target.value || null)}
              >
                <option value="">None (root level)</option>
                {parentOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {'  '.repeat(option.depth)}{option.code} - {option.title}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-muted-foreground">
                Select a parent to nest this node under
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="required"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
            />
            <Label htmlFor="required" className="font-normal cursor-pointer">
              Required document (must be present for submission)
            </Label>
          </div>

          {createNode.error && (
            <div className="text-sm text-destructive p-2 bg-destructive/10 rounded-md">
              Error: {createNode.error.message}
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <Button type="submit" disabled={createNode.isPending || !code.trim() || !title.trim()}>
              {createNode.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding Node...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Node
                </>
              )}
            </Button>
            {onCancel && (
              <Button type="button" variant="outline" onClick={handleReset}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
