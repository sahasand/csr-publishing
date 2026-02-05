'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Plus,
  MessageSquare,
  Filter,
  Loader2,
} from 'lucide-react';
import { AnnotationItem } from './annotation-item';
import { AnnotationForm } from './annotation-form';
import {
  useDocumentAnnotations,
  useCreateAnnotation,
  useUpdateAnnotation,
  useDeleteAnnotation,
  useCreateReplyWithDocument,
} from '@/hooks/use-annotations';
import type {
  AnnotationType,
  AnnotationStatus,
  AnnotationWithReplies,
  CreateAnnotationInput,
  UpdateAnnotationInput,
} from '@/types';

export interface AnnotationPanelProps {
  /** Document ID to load annotations for */
  documentId: string;
  /** Max page number for annotation form validation */
  maxPageNumber?: number;
  /** Called when an annotation is clicked (for scrolling PDF) */
  onAnnotationClick?: (annotation: AnnotationWithReplies) => void;
  /** Current user name for new annotations */
  currentUserName?: string;
  /** Current user ID for new annotations */
  currentUserId?: string;
  /** Additional class names */
  className?: string;
}

type StatusFilter = 'ALL' | AnnotationStatus;
type TypeFilter = 'ALL' | AnnotationType;

const statusFilterOptions: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: 'All Status' },
  { value: 'OPEN', label: 'Open' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'WONT_FIX', label: "Won't Fix" },
];

const typeFilterOptions: { value: TypeFilter; label: string }[] = [
  { value: 'ALL', label: 'All Types' },
  { value: 'NOTE', label: 'Note' },
  { value: 'QUESTION', label: 'Question' },
  { value: 'CORRECTION_REQUIRED', label: 'Correction Required' },
  { value: 'FYI', label: 'FYI' },
];

export function AnnotationPanel({
  documentId,
  maxPageNumber,
  onAnnotationClick,
  currentUserName = 'User',
  currentUserId,
  className,
}: AnnotationPanelProps) {
  // State
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('ALL');
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>('ALL');
  const [showForm, setShowForm] = React.useState(false);
  const [editingAnnotation, setEditingAnnotation] = React.useState<AnnotationWithReplies | null>(null);

  // Queries and mutations
  const { data: annotations, isLoading, error } = useDocumentAnnotations(documentId);
  const createAnnotation = useCreateAnnotation();
  const updateAnnotation = useUpdateAnnotation();
  const deleteAnnotation = useDeleteAnnotation();
  const createReply = useCreateReplyWithDocument();

  // Filter and sort annotations
  const filteredAnnotations = React.useMemo(() => {
    if (!annotations) return [];

    return annotations
      .filter((annotation) => {
        // Status filter
        if (statusFilter !== 'ALL' && annotation.status !== statusFilter) {
          return false;
        }
        // Type filter
        if (typeFilter !== 'ALL' && annotation.type !== typeFilter) {
          return false;
        }
        return true;
      })
      // Sort by page number
      .sort((a, b) => a.pageNumber - b.pageNumber);
  }, [annotations, statusFilter, typeFilter]);

  // Handlers
  const handleCreateAnnotation = (data: CreateAnnotationInput | UpdateAnnotationInput) => {
    const createData = data as CreateAnnotationInput;
    createAnnotation.mutate(
      {
        documentId,
        data: {
          ...createData,
          authorName: currentUserName,
          authorId: currentUserId,
        },
      },
      {
        onSuccess: () => {
          setShowForm(false);
        },
      }
    );
  };

  const handleUpdateAnnotation = (data: CreateAnnotationInput | UpdateAnnotationInput) => {
    if (!editingAnnotation) return;

    const updateData = data as UpdateAnnotationInput;
    updateAnnotation.mutate(
      {
        id: editingAnnotation.id,
        data: updateData,
      },
      {
        onSuccess: () => {
          setEditingAnnotation(null);
        },
      }
    );
  };

  const handleStatusChange = (annotationId: string, status: AnnotationStatus) => {
    updateAnnotation.mutate({
      id: annotationId,
      data: { status },
    });
  };

  const handleDelete = (annotationId: string) => {
    deleteAnnotation.mutate({
      id: annotationId,
      documentId,
    });
  };

  const handleReply = (annotationId: string, content: string) => {
    createReply.mutate({
      annotationId,
      documentId,
      data: {
        content,
        authorName: currentUserName,
        authorId: currentUserId,
      },
    });
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingAnnotation(null);
  };

  // Stats for display
  const stats = React.useMemo(() => {
    if (!annotations) return { total: 0, open: 0, resolved: 0 };
    return {
      total: annotations.length,
      open: annotations.filter((a) => a.status === 'OPEN').length,
      resolved: annotations.filter((a) => a.status === 'RESOLVED').length,
    };
  }, [annotations]);

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-gray-500" />
          <h2 className="font-semibold text-sm text-gray-700">Annotations</h2>
          {annotations && (
            <span className="text-xs text-gray-400">
              ({stats.open} open, {stats.resolved} resolved)
            </span>
          )}
        </div>

        <Button
          size="sm"
          onClick={() => {
            setEditingAnnotation(null);
            setShowForm(true);
          }}
          disabled={showForm || !!editingAnnotation}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>

      {/* Create/Edit Form */}
      {(showForm || editingAnnotation) && (
        <div className="mb-4">
          <AnnotationForm
            annotation={editingAnnotation || undefined}
            maxPageNumber={maxPageNumber}
            onSave={editingAnnotation ? handleUpdateAnnotation : handleCreateAnnotation}
            onCancel={handleCancelForm}
            isSubmitting={createAnnotation.isPending || updateAnnotation.isPending}
          />
        </div>
      )}

      {/* Filters */}
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs flex items-center gap-1.5">
            <Filter className="h-3 w-3" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-3">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                aria-label="Filter by status"
              >
                {statusFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex-1">
              <Select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
                aria-label="Filter by type"
              >
                {typeFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Annotations List */}
      <div className="flex-1 overflow-y-auto">
        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        )}

        {/* Error State */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="py-4">
              <p className="text-sm text-red-700">
                Failed to load annotations: {error.message}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {!isLoading && !error && filteredAnnotations.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare className="h-12 w-12 text-gray-300 mb-3" />
            <p className="text-sm text-gray-500 mb-1">No annotations</p>
            <p className="text-xs text-gray-400">
              {annotations && annotations.length > 0
                ? 'No annotations match the current filters'
                : 'Add an annotation to get started'}
            </p>
          </div>
        )}

        {/* Annotations */}
        {!isLoading && !error && filteredAnnotations.length > 0 && (
          <div className="space-y-3">
            {filteredAnnotations.map((annotation) => (
              <AnnotationItem
                key={annotation.id}
                annotation={annotation}
                onClick={() => onAnnotationClick?.(annotation)}
                onEdit={() => {
                  setShowForm(false);
                  setEditingAnnotation(annotation);
                }}
                onStatusChange={(status) => handleStatusChange(annotation.id, status)}
                onDelete={() => handleDelete(annotation.id)}
                onReply={(content) => handleReply(annotation.id, content)}
                isUpdating={
                  updateAnnotation.isPending &&
                  updateAnnotation.variables?.id === annotation.id
                }
                isDeleting={
                  deleteAnnotation.isPending &&
                  deleteAnnotation.variables?.id === annotation.id
                }
                isReplying={
                  createReply.isPending &&
                  createReply.variables?.annotationId === annotation.id
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
