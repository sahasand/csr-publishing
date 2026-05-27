'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTemplates, useDeleteTemplate } from '@/hooks/use-templates';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SkeletonList } from '@/components/ui/skeleton';
import { Pagination } from '@/components/ui/pagination';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { formatDate } from '@/lib/utils';
import { Trash2, ExternalLink, Star } from 'lucide-react';
import { toast } from 'sonner';

export function TemplateList() {
  const [page, setPage] = useState(1);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);
  const { data, isLoading, error } = useTemplates({ page, pageSize: 20 });
  const templates = data?.data;
  const pagination = data?.pagination;
  const deleteTemplate = useDeleteTemplate();

  if (isLoading) {
    return (
      <SkeletonList count={3} />
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-destructive">
        Failed to load templates: {error.message}
      </div>
    );
  }

  if (!templates?.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No templates found. Create your first template to get started.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {templates.map((template) => (
        <Card key={template.id}>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                {template.name}
                {template.isDefault && (
                  <Star className="h-4 w-4 text-warning fill-warning" />
                )}
              </CardTitle>
              <CardDescription>
                Version {template.version}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {template.isDefault && (
                <Badge variant="secondary">Default</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                <span>{template._count?.nodes || 0} nodes</span>
                <span className="mx-2">·</span>
                <span>{template._count?.studies || 0} studies using</span>
                <span className="mx-2">·</span>
                <span>Updated {formatDate(template.updatedAt)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Link href={`/templates/${template.id}`}>
                  <Button variant="outline" size="sm">
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setTemplateToDelete(template.id);
                    setDeleteDialogOpen(true);
                  }}
                  disabled={deleteTemplate.isPending || (template._count?.studies || 0) > 0}
                  title={template._count?.studies ? 'Cannot delete: template in use' : 'Delete template'}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      {pagination && (
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={setPage}
          total={pagination.total}
          pageSize={20}
        />
      )}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Template"
        description="Are you sure you want to delete this template? This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        isPending={deleteTemplate.isPending}
        onConfirm={() => {
          if (templateToDelete) {
            deleteTemplate.mutate(templateToDelete, {
              onSuccess: () => {
                toast.success('Template deleted');
                setDeleteDialogOpen(false);
                setTemplateToDelete(null);
              },
            });
          }
        }}
      />
    </div>
  );
}
