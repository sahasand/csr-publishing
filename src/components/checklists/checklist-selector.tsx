'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useChecklists } from '@/hooks/use-checklists';
import { Loader2, ClipboardList } from 'lucide-react';
import type { ChecklistWithCount } from '@/types';

export interface ChecklistSelectorProps {
  documentId: string;
  currentChecklistName?: string;
  onInitialize: (checklistId: string) => void;
  isInitializing?: boolean;
}

/**
 * Dropdown to select which checklist to use for a document
 * Shows "Initialize Checklist" button after selection
 * Shows current checklist name if already initialized
 */
export function ChecklistSelector({
  documentId,
  currentChecklistName,
  onInitialize,
  isInitializing = false,
}: ChecklistSelectorProps) {
  const { data: checklists, isLoading, error } = useChecklists();
  const [selectedChecklistId, setSelectedChecklistId] = React.useState<string>('');

  // If already has a checklist assigned, show current state
  if (currentChecklistName) {
    return (
      <div className="flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-gray-500" />
        <span className="text-sm text-gray-600">Current checklist:</span>
        <Badge variant="secondary">{currentChecklistName}</Badge>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading checklists...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-600">
        Failed to load checklists: {error.message}
      </div>
    );
  }

  if (!checklists || checklists.length === 0) {
    return (
      <div className="text-sm text-gray-500">
        No checklists available. Create one in the admin panel.
      </div>
    );
  }

  const handleInitialize = () => {
    if (selectedChecklistId) {
      onInitialize(selectedChecklistId);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <label htmlFor="checklist-select" className="text-xs text-gray-500">
          Select Checklist
        </label>
        <Select
          id="checklist-select"
          value={selectedChecklistId}
          onChange={(e) => setSelectedChecklistId(e.target.value)}
          aria-label="Select checklist"
        >
          <option value="">Choose a checklist...</option>
          {checklists.map((checklist: ChecklistWithCount) => (
            <option key={checklist.id} value={checklist.id}>
              {checklist.name} ({checklist._count.items} items)
            </option>
          ))}
        </Select>
      </div>

      <Button
        variant="default"
        size="sm"
        className="w-full"
        onClick={handleInitialize}
        disabled={!selectedChecklistId || isInitializing}
      >
        {isInitializing ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Initializing...
          </>
        ) : (
          <>
            <ClipboardList className="h-4 w-4 mr-2" />
            Initialize Checklist
          </>
        )}
      </Button>
    </div>
  );
}
