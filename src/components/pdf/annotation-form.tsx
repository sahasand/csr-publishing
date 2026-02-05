'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type {
  AnnotationType,
  AnnotationWithReplies,
  CreateAnnotationInput,
  UpdateAnnotationInput,
} from '@/types';

export interface AnnotationFormProps {
  /** Existing annotation for edit mode */
  annotation?: AnnotationWithReplies;
  /** Max page number for validation */
  maxPageNumber?: number;
  /** Called when save button is clicked */
  onSave: (data: CreateAnnotationInput | UpdateAnnotationInput) => void;
  /** Called when cancel button is clicked */
  onCancel: () => void;
  /** Whether the form is submitting */
  isSubmitting?: boolean;
}

const annotationTypes: { value: AnnotationType; label: string }[] = [
  { value: 'NOTE', label: 'Note' },
  { value: 'QUESTION', label: 'Question' },
  { value: 'CORRECTION_REQUIRED', label: 'Correction Required' },
  { value: 'FYI', label: 'FYI' },
];

export function AnnotationForm({
  annotation,
  maxPageNumber,
  onSave,
  onCancel,
  isSubmitting = false,
}: AnnotationFormProps) {
  const isEditMode = !!annotation;

  const [type, setType] = React.useState<AnnotationType>(
    annotation?.type as AnnotationType || 'NOTE'
  );
  const [pageNumber, setPageNumber] = React.useState<number>(
    annotation?.pageNumber || 1
  );
  const [content, setContent] = React.useState<string>(
    annotation?.content || ''
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isEditMode) {
      // For edit mode, only send changed fields
      const updateData: UpdateAnnotationInput = {};
      if (type !== annotation?.type) updateData.type = type;
      if (content !== annotation?.content) updateData.content = content;
      onSave(updateData);
    } else {
      // For create mode, send all required fields
      const createData: CreateAnnotationInput = {
        type,
        pageNumber,
        content,
      };
      onSave(createData);
    }
  };

  const isValid = content.trim().length > 0 && pageNumber >= 1;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">
          {isEditMode ? 'Edit Annotation' : 'Add Annotation'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type Selector */}
          <div className="space-y-1.5">
            <Label htmlFor="annotation-type">Type</Label>
            <Select
              id="annotation-type"
              value={type}
              onChange={(e) => setType(e.target.value as AnnotationType)}
              disabled={isSubmitting}
            >
              {annotationTypes.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          {/* Page Number Input - only show in create mode */}
          {!isEditMode && (
            <div className="space-y-1.5">
              <Label htmlFor="page-number">Page Number</Label>
              <Input
                id="page-number"
                type="number"
                min={1}
                max={maxPageNumber}
                value={pageNumber}
                onChange={(e) => setPageNumber(parseInt(e.target.value, 10) || 1)}
                disabled={isSubmitting}
              />
              {maxPageNumber && (
                <p className="text-xs text-muted-foreground">
                  Pages 1-{maxPageNumber}
                </p>
              )}
            </div>
          )}

          {/* Content Textarea */}
          <div className="space-y-1.5">
            <Label htmlFor="annotation-content">Content</Label>
            <textarea
              id="annotation-content"
              className="flex min-h-[100px] w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 resize-y"
              placeholder="Enter your annotation..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!isValid || isSubmitting}
            >
              {isSubmitting ? 'Saving...' : isEditMode ? 'Update' : 'Save'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
