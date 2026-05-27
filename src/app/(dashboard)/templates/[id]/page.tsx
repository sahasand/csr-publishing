'use client';

import { useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTemplate, useUpdateTemplate } from '@/hooks/use-templates';
import { useReorderNodes } from '@/hooks/use-nodes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { NodeTree } from '@/components/templates/node-tree';
import { EditNodeDialog } from '@/components/templates/edit-node-dialog';
import { AddNodeForm } from '@/components/templates/add-node-form';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { formatDate } from '@/lib/utils';
import type { StructureNode } from '@/types';
import {
  ArrowLeft,
  Loader2,
  Pencil,
  Check,
  X,
  Star,
  Plus,
} from 'lucide-react';

export default function TemplateEditorPage() {
  const params = useParams();
  const id = params.id as string;

  const { data: template, isLoading, error } = useTemplate(id);
  const updateTemplate = useUpdateTemplate();
  const reorderNodes = useReorderNodes(id);

  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [reorderError, setReorderError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>();
  const [editNode, setEditNode] = useState<{ node: StructureNode; mode: 'edit' | 'delete' } | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  // Handle node reordering
  const handleReorder = useCallback(
    (updates: Array<{ id: string; sortOrder: number; parentId?: string | null }>) => {
      setReorderError(null);
      reorderNodes.mutate(
        {
          templateId: id,
          updates,
        },
        {
          onError: (error) => {
            const message = error instanceof Error ? error.message : 'Failed to reorder nodes';
            setReorderError(message);
            console.error('Failed to reorder nodes:', message);
          },
        }
      );
    },
    [id, reorderNodes]
  );

  const startEditing = () => {
    setEditedName(template?.name || '');
    setIsEditingName(true);
  };

  const handleSaveName = async () => {
    if (!editedName.trim()) return;
    setSaveError(null);

    try {
      await updateTemplate.mutateAsync({
        id,
        data: { name: editedName.trim() },
      });
      setIsEditingName(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      setSaveError(message);
      console.error('Failed to save template name:', message);
    }
  };

  const handleCancelEdit = () => {
    setEditedName(template?.name || '');
    setIsEditingName(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/70" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link href="/templates">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Templates
          </Button>
        </Link>
        <div className="text-center py-12 text-destructive">
          Failed to load template: {error.message}
        </div>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="space-y-4">
        <Link href="/templates">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Templates
          </Button>
        </Link>
        <div className="text-center py-12 text-muted-foreground">
          Template not found
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <div className="flex items-center gap-4">
        <Link href="/templates">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
      </div>

      {/* Template info card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              {isEditingName ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      className="max-w-md"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveName();
                        if (e.key === 'Escape') handleCancelEdit();
                      }}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={handleSaveName}
                      disabled={updateTemplate.isPending || !editedName.trim()}
                    >
                      {updateTemplate.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4 text-success" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={handleCancelEdit}
                      disabled={updateTemplate.isPending}
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                  {saveError && (
                    <div className="text-sm text-destructive">
                      Failed to save: {saveError}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <CardTitle className="text-xl">
                    {template.name}
                  </CardTitle>
                  {template.isDefault && (
                    <Star className="h-4 w-4 text-warning fill-warning" />
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={startEditing}
                  >
                    <Pencil className="h-4 w-4 text-muted-foreground/70" />
                  </Button>
                </div>
              )}
              <CardDescription className="mt-1">
                Version {template.version} | Updated {formatDate(template.updatedAt)}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {template.isDefault && (
                <Badge variant="secondary">Default Template</Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            {template.nodes.length} nodes in this template
          </div>
        </CardContent>
      </Card>

      {/* Nodes list */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Structure Nodes</CardTitle>
              <CardDescription>
                Nodes define the hierarchical structure of documents in this template.
                Drag nodes to reorder them.
              </CardDescription>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              {reorderNodes.isPending && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </div>
              )}
              {reorderError && (
                <div className="text-sm text-destructive">
                  {reorderError}
                </div>
              )}
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Node
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <NodeTree
            nodes={template.nodes}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
            onReorder={handleReorder}
            onEditNode={(node) => setEditNode({ node, mode: 'edit' })}
            onDeleteNode={(node) => setEditNode({ node, mode: 'delete' })}
          />
        </CardContent>
      </Card>

      {/* Edit / delete node dialog */}
      <EditNodeDialog
        node={editNode?.node ?? null}
        nodes={template.nodes}
        open={!!editNode}
        initialShowDelete={editNode?.mode === 'delete'}
        onOpenChange={(open) => {
          if (!open) setEditNode(null);
        }}
      />

      {/* Add node dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Node</DialogTitle>
            <DialogDescription>
              Add a new section to this template. Choose a parent to nest it, or
              leave it at the root level.
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 pt-2">
            <AddNodeForm
              templateId={id}
              nodes={template.nodes}
              compact
              onSuccess={() => setAddOpen(false)}
              onCancel={() => setAddOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
