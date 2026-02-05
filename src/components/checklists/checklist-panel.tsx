'use client';

import * as React from 'react';
import { cn, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChecklistItemRow } from './checklist-item-row';
import {
  useDocumentChecklist,
  useUpdateChecklistResponse,
} from '@/hooks/use-checklist-response';
import {
  Loader2,
  Save,
  CheckCircle,
  AlertCircle,
  ClipboardCheck,
} from 'lucide-react';
import type { ChecklistItem, ChecklistItemResponse, ChecklistItemResult } from '@/types';

export interface ChecklistPanelProps {
  documentId: string;
}

/**
 * Panel displaying all checklist items grouped by category
 * Features:
 * - Progress indicator (X of Y completed)
 * - Save button to submit changes
 * - Mark Complete button (enabled when all required items answered)
 * - Shows completion status if completedAt is set
 */
export function ChecklistPanel({ documentId }: ChecklistPanelProps) {
  const { data: checklistResponse, isLoading, error } = useDocumentChecklist(documentId);
  const updateResponse = useUpdateChecklistResponse();

  // Local state for tracking unsaved changes
  const [localResponses, setLocalResponses] = React.useState<Map<string, ChecklistItemResponse>>(
    new Map()
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);

  // Parse responses from the stored JSON
  const parsedResponses = React.useMemo(() => {
    if (!checklistResponse?.responses) return new Map<string, ChecklistItemResponse>();

    try {
      const responses = checklistResponse.responses as Array<{
        itemId: string;
        result: ChecklistItemResult | null;
        notes?: string;
      }>;
      const map = new Map<string, ChecklistItemResponse>();
      for (const r of responses) {
        map.set(r.itemId, r);
      }
      return map;
    } catch {
      return new Map<string, ChecklistItemResponse>();
    }
  }, [checklistResponse?.responses]);

  // Merge parsed responses with local changes
  const currentResponses = React.useMemo(() => {
    const merged = new Map(parsedResponses);
    for (const [key, value] of localResponses) {
      merged.set(key, value);
    }
    return merged;
  }, [parsedResponses, localResponses]);

  // Reset local state when checklistResponse changes (after save)
  React.useEffect(() => {
    setLocalResponses(new Map());
    setHasUnsavedChanges(false);
  }, [checklistResponse?.updatedAt]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm text-red-600 py-4">
        <AlertCircle className="h-4 w-4" />
        Failed to load checklist: {error.message}
      </div>
    );
  }

  if (!checklistResponse) {
    return (
      <div className="text-sm text-gray-500 py-4">
        No checklist has been initialized for this document.
      </div>
    );
  }

  const checklist = checklistResponse.checklist;
  const items = checklist.items || [];
  const isCompleted = !!checklistResponse.completedAt;

  // Group items by category
  const groupedItems = items.reduce((acc, item) => {
    const category = item.category || 'General';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {} as Record<string, ChecklistItem[]>);

  // Sort categories alphabetically
  const sortedCategories = Object.keys(groupedItems).sort();

  // Calculate progress
  const totalItems = items.length;
  const answeredItems = items.filter((item) => {
    const response = currentResponses.get(item.id);
    return response?.result != null;
  }).length;

  // Check if all required items are answered
  const requiredItems = items.filter((item) => item.required);
  const allRequiredAnswered = requiredItems.every((item) => {
    const response = currentResponses.get(item.id);
    return response?.result != null;
  });

  // Check which items were auto-filled (from validation results)
  const getIsAutoFilled = (itemId: string): boolean => {
    // Check if item has autoCheck enabled and has a result
    const item = items.find((i) => i.id === itemId);
    if (!item?.autoCheck) return false;
    const response = parsedResponses.get(itemId);
    return response?.result != null && !localResponses.has(itemId);
  };

  const handleItemChange = (response: ChecklistItemResponse) => {
    setLocalResponses((prev) => {
      const next = new Map(prev);
      next.set(response.itemId, response);
      return next;
    });
    setHasUnsavedChanges(true);
  };

  const handleSave = async () => {
    // Collect all responses (merged current state)
    const responsesToSave: ChecklistItemResponse[] = [];
    for (const [itemId, response] of currentResponses) {
      if (response.result != null) {
        responsesToSave.push({
          itemId,
          result: response.result,
          notes: response.notes,
        });
      }
    }

    await updateResponse.mutateAsync({
      documentId,
      responses: responsesToSave,
    });
  };

  const handleMarkComplete = async () => {
    // Save and mark as complete by including completedAt trigger
    // For now, just save all responses - completion logic handled by API
    await handleSave();
  };

  return (
    <div className="space-y-4">
      {/* Header with checklist name and completion status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">{checklist.name}</span>
        </div>
        {isCompleted && (
          <Badge variant="success" className="gap-1">
            <CheckCircle className="h-3 w-3" />
            Complete
          </Badge>
        )}
      </div>

      {/* Completion info */}
      {isCompleted && checklistResponse.completedAt && (
        <div className="text-xs text-gray-500 bg-green-50 p-2 rounded-md">
          Completed on {formatDate(checklistResponse.completedAt)}
        </div>
      )}

      {/* Progress indicator */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-gray-600">
          <span>Progress</span>
          <span>
            {answeredItems} of {totalItems} items
          </span>
        </div>
        <div
          className="h-2 bg-gray-200 rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={answeredItems}
          aria-valuemin={0}
          aria-valuemax={totalItems}
        >
          <div
            className={cn(
              'h-full transition-all duration-300',
              answeredItems === totalItems ? 'bg-green-500' : 'bg-blue-500'
            )}
            style={{ width: `${totalItems > 0 ? (answeredItems / totalItems) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Grouped checklist items */}
      <div className="space-y-4">
        {sortedCategories.map((category) => (
          <div key={category} className="space-y-2">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {category}
            </h4>
            <div className="space-y-2">
              {groupedItems[category]
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((item) => (
                  <ChecklistItemRow
                    key={item.id}
                    item={item}
                    response={currentResponses.get(item.id)}
                    onChange={handleItemChange}
                    isAutoFilled={getIsAutoFilled(item.id)}
                  />
                ))}
            </div>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      {!isCompleted && (
        <div className="flex gap-2 pt-2 border-t border-gray-200">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={handleSave}
            disabled={!hasUnsavedChanges || updateResponse.isPending}
          >
            {updateResponse.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save
              </>
            )}
          </Button>
          <Button
            variant="default"
            size="sm"
            className="flex-1"
            onClick={handleMarkComplete}
            disabled={!allRequiredAnswered || updateResponse.isPending}
            title={
              !allRequiredAnswered
                ? 'Complete all required items before marking as complete'
                : undefined
            }
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Mark Complete
          </Button>
        </div>
      )}

      {/* Warning if required items not answered */}
      {!isCompleted && !allRequiredAnswered && (
        <div className="flex items-start gap-2 p-2 bg-amber-50 rounded-md text-xs text-amber-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>
            {requiredItems.length - requiredItems.filter((item) => currentResponses.get(item.id)?.result != null).length} required item(s) need to be answered before marking as complete.
          </span>
        </div>
      )}
    </div>
  );
}
