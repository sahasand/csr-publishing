'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, Check, X, Minus, Zap } from 'lucide-react';
import type { ChecklistItem, ChecklistItemResult, ChecklistItemResponse } from '@/types';

export interface ChecklistItemRowProps {
  item: ChecklistItem;
  response: ChecklistItemResponse | undefined;
  onChange: (response: ChecklistItemResponse) => void;
  isAutoFilled?: boolean;
}

/**
 * Display a single checklist item with:
 * - Item text and category badge
 * - Pass/Fail/N/A button group
 * - Collapsible notes textarea
 * - Auto badge if auto-filled
 * - Required indicator (*) on required items
 */
export function ChecklistItemRow({
  item,
  response,
  onChange,
  isAutoFilled = false,
}: ChecklistItemRowProps) {
  const [isNotesExpanded, setIsNotesExpanded] = React.useState(false);
  const [notes, setNotes] = React.useState(response?.notes || '');

  // Sync notes from response when it changes
  React.useEffect(() => {
    setNotes(response?.notes || '');
  }, [response?.notes]);

  const currentResult = response?.result ?? null;

  const handleResultChange = (result: ChecklistItemResult) => {
    onChange({
      itemId: item.id,
      result,
      notes: notes || undefined,
    });
  };

  const handleNotesChange = (newNotes: string) => {
    setNotes(newNotes);
    // Only update if we have a result selected
    if (currentResult) {
      onChange({
        itemId: item.id,
        result: currentResult,
        notes: newNotes || undefined,
      });
    }
  };

  const handleNotesBlur = () => {
    // Save notes even if no result yet
    if (notes && !currentResult) {
      onChange({
        itemId: item.id,
        result: null,
        notes: notes || undefined,
      });
    }
  };

  const resultButtonStyles = {
    pass: {
      active: 'bg-green-500 text-white border-green-500 hover:bg-green-600',
      inactive: 'bg-white text-green-600 border-green-300 hover:bg-green-50',
    },
    fail: {
      active: 'bg-red-500 text-white border-red-500 hover:bg-red-600',
      inactive: 'bg-white text-red-600 border-red-300 hover:bg-red-50',
    },
    na: {
      active: 'bg-gray-500 text-white border-gray-500 hover:bg-gray-600',
      inactive: 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50',
    },
  };

  return (
    <div className="border border-gray-200 rounded-lg p-3 space-y-2">
      {/* Header row with badges */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs">
            {item.category}
          </Badge>
          {item.required && (
            <span className="text-red-500 text-sm font-medium" title="Required">
              *
            </span>
          )}
          {isAutoFilled && (
            <Badge variant="secondary" className="text-xs gap-1">
              <Zap className="h-3 w-3" />
              Auto
            </Badge>
          )}
        </div>
      </div>

      {/* Item text */}
      <p className="text-sm text-gray-800">{item.text}</p>

      {/* Button group and notes toggle */}
      <div className="flex items-center justify-between gap-2">
        {/* Pass/Fail/N/A buttons */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleResultChange('pass')}
            className={cn(
              'inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium rounded-l-md border transition-colors',
              currentResult === 'pass'
                ? resultButtonStyles.pass.active
                : resultButtonStyles.pass.inactive
            )}
            aria-pressed={currentResult === 'pass'}
          >
            <Check className="h-3 w-3" />
            Pass
          </button>
          <button
            type="button"
            onClick={() => handleResultChange('fail')}
            className={cn(
              'inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium border-y border-r transition-colors',
              currentResult === 'fail'
                ? resultButtonStyles.fail.active
                : resultButtonStyles.fail.inactive
            )}
            aria-pressed={currentResult === 'fail'}
          >
            <X className="h-3 w-3" />
            Fail
          </button>
          <button
            type="button"
            onClick={() => handleResultChange('na')}
            className={cn(
              'inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium rounded-r-md border-y border-r transition-colors',
              currentResult === 'na'
                ? resultButtonStyles.na.active
                : resultButtonStyles.na.inactive
            )}
            aria-pressed={currentResult === 'na'}
          >
            <Minus className="h-3 w-3" />
            N/A
          </button>
        </div>

        {/* Notes toggle button */}
        <button
          type="button"
          onClick={() => setIsNotesExpanded(!isNotesExpanded)}
          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
        >
          {isNotesExpanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          Notes
          {notes && <span className="text-gray-400">(1)</span>}
        </button>
      </div>

      {/* Collapsible notes textarea */}
      {isNotesExpanded && (
        <div className="mt-2">
          <textarea
            value={notes}
            onChange={(e) => handleNotesChange(e.target.value)}
            onBlur={handleNotesBlur}
            placeholder="Add notes about this item..."
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md resize-none focus:outline-none focus:ring-1 focus:ring-gray-400"
            rows={2}
          />
        </div>
      )}
    </div>
  );
}
