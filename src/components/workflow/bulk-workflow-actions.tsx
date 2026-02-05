'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Send, CheckCircle, BookOpen, Loader2 } from 'lucide-react';
import { useBulkTransition } from '@/hooks/use-bulk-transition';
import type { DocumentStatusType } from '@/types';

interface BulkWorkflowActionsProps {
  studyId: string;
  documents: Array<{ id: string; status: string; sourceFileName: string }>;
}

interface BulkAction {
  label: string;
  fromStatuses: DocumentStatusType[];
  toStatus: DocumentStatusType;
  icon: React.ComponentType<{ className?: string }>;
  description: (count: number) => string;
}

const BULK_ACTIONS: BulkAction[] = [
  {
    label: 'Submit all for review',
    fromStatuses: ['DRAFT', 'PROCESSED'],
    toStatus: 'IN_REVIEW',
    icon: Send,
    description: (count) =>
      `This will submit ${count} document${count !== 1 ? 's' : ''} for review. Documents in Draft or Processed status will be moved to In Review.`,
  },
  {
    label: 'Approve all in review',
    fromStatuses: ['IN_REVIEW'],
    toStatus: 'APPROVED',
    icon: CheckCircle,
    description: (count) =>
      `This will approve ${count} document${count !== 1 ? 's' : ''} currently in review.`,
  },
  {
    label: 'Publish all approved',
    fromStatuses: ['APPROVED'],
    toStatus: 'PUBLISHED',
    icon: BookOpen,
    description: (count) =>
      `This will publish ${count} approved document${count !== 1 ? 's' : ''}. Published documents are considered final.`,
  },
];

export function BulkWorkflowActions({ studyId, documents }: BulkWorkflowActionsProps) {
  const [confirmAction, setConfirmAction] = useState<BulkAction | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const mutation = useBulkTransition(studyId);

  // Compute status counts from documents array
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const doc of documents) {
      counts[doc.status] = (counts[doc.status] || 0) + 1;
    }
    return counts;
  }, [documents]);

  // Compute eligible count for each bulk action
  const actionsWithCounts = useMemo(() => {
    return BULK_ACTIONS.map((action) => {
      const eligibleCount = action.fromStatuses.reduce(
        (sum, status) => sum + (statusCounts[status] || 0),
        0
      );
      return { ...action, eligibleCount };
    }).filter((action) => action.eligibleCount > 0);
  }, [statusCounts]);

  const handleConfirm = () => {
    if (!confirmAction) return;
    mutation.mutate(
      {
        toStatus: confirmAction.toStatus,
        fromStatuses: confirmAction.fromStatuses,
      },
      {
        onSuccess: (result) => {
          setConfirmAction(null);
          setSuccessMessage(
            `${result.transitioned} document${result.transitioned !== 1 ? 's' : ''} moved to ${result.toStatus.replace(/_/g, ' ').toLowerCase()}.`
          );
          setTimeout(() => setSuccessMessage(null), 3000);
        },
      }
    );
  };

  const currentEligibleCount = confirmAction
    ? confirmAction.fromStatuses.reduce(
        (sum, status) => sum + (statusCounts[status] || 0),
        0
      )
    : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-foreground/80">
          Bulk Actions
        </CardTitle>
      </CardHeader>
      <CardContent>
        {actionsWithCounts.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No bulk actions available
          </p>
        ) : (
          <div className="space-y-2">
            {successMessage && (
              <p className="text-xs text-success font-medium">{successMessage}</p>
            )}
            {actionsWithCounts.map((action) => {
              const Icon = action.icon;
              return (
                <Button
                  key={action.toStatus}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setConfirmAction(action)}
                >
                  <Icon className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span className="truncate">
                    {action.label.replace('all', String(action.eligibleCount))}
                  </span>
                </Button>
              );
            })}
          </div>
        )}

        <Dialog
          open={!!confirmAction}
          onOpenChange={(open) => {
            if (!open) setConfirmAction(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{confirmAction?.label}</DialogTitle>
              <DialogDescription>
                {confirmAction?.description(currentEligibleCount)}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setConfirmAction(null)}
                disabled={mutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={mutation.isPending}
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Confirm'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
