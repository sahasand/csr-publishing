'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Send,
  CheckCircle,
  XCircle,
  Upload,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import { WORKFLOW_TRANSITIONS, type DocumentStatusType } from '@/types';

interface WorkflowActionsProps {
  documentId: string;
  currentStatus: DocumentStatusType;
  onTransitionComplete?: () => void;
}

interface TransitionConfig {
  toStatus: DocumentStatusType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  variant: 'default' | 'outline' | 'destructive';
  requiresComment: boolean;
}

const TRANSITION_CONFIGS: Partial<Record<DocumentStatusType, TransitionConfig[]>> = {
  DRAFT: [
    { toStatus: 'IN_REVIEW', label: 'Submit for Review', icon: Send, variant: 'default', requiresComment: false },
  ],
  PROCESSED: [
    { toStatus: 'IN_REVIEW', label: 'Submit for Review', icon: Send, variant: 'default', requiresComment: false },
  ],
  PROCESSING_FAILED: [
    { toStatus: 'DRAFT', label: 'Reset to Draft', icon: RotateCcw, variant: 'outline', requiresComment: false },
  ],
  IN_REVIEW: [
    { toStatus: 'APPROVED', label: 'Approve', icon: CheckCircle, variant: 'default', requiresComment: false },
    { toStatus: 'CORRECTIONS_NEEDED', label: 'Request Corrections', icon: XCircle, variant: 'destructive', requiresComment: true },
  ],
  CORRECTIONS_NEEDED: [
    { toStatus: 'IN_REVIEW', label: 'Resubmit for Review', icon: Send, variant: 'default', requiresComment: false },
  ],
  APPROVED: [
    { toStatus: 'PUBLISHED', label: 'Publish', icon: Upload, variant: 'default', requiresComment: false },
    { toStatus: 'CORRECTIONS_NEEDED', label: 'Request Corrections', icon: XCircle, variant: 'destructive', requiresComment: true },
  ],
  PUBLISHED: [
    { toStatus: 'CORRECTIONS_NEEDED', label: 'Revoke (Corrections Needed)', icon: XCircle, variant: 'destructive', requiresComment: true },
  ],
};

async function transitionDocument(
  documentId: string,
  toStatus: DocumentStatusType,
  comment?: string
) {
  const res = await fetch(`/api/documents/${documentId}/transition`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toStatus, comment, userName: 'Reviewer' }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to transition document');
  return json.data;
}

export function WorkflowActions({
  documentId,
  currentStatus,
  onTransitionComplete
}: WorkflowActionsProps) {
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [pendingTransition, setPendingTransition] = useState<TransitionConfig | null>(null);
  const [comment, setComment] = useState('');

  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ toStatus, comment }: { toStatus: DocumentStatusType; comment?: string }) =>
      transitionDocument(documentId, toStatus, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document', documentId] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      setCommentDialogOpen(false);
      setComment('');
      setPendingTransition(null);
      onTransitionComplete?.();
    },
  });

  const availableActions = TRANSITION_CONFIGS[currentStatus] || [];

  // Filter to only valid transitions
  const validTransitions = WORKFLOW_TRANSITIONS[currentStatus] || [];
  const filteredActions = availableActions.filter(
    action => validTransitions.includes(action.toStatus)
  );

  if (filteredActions.length === 0) {
    return null;
  }

  const handleAction = (config: TransitionConfig) => {
    if (config.requiresComment) {
      setPendingTransition(config);
      setCommentDialogOpen(true);
    } else {
      mutation.mutate({ toStatus: config.toStatus });
    }
  };

  const handleConfirmWithComment = () => {
    if (!pendingTransition) return;
    mutation.mutate({
      toStatus: pendingTransition.toStatus,
      comment: comment.trim()
    });
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {filteredActions.map((config) => {
          const Icon = config.icon;
          return (
            <Button
              key={config.toStatus}
              variant={config.variant}
              size="sm"
              onClick={() => handleAction(config)}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Icon className="h-4 w-4 mr-2" />
              )}
              {config.label}
            </Button>
          );
        })}
      </div>

      <Dialog open={commentDialogOpen} onOpenChange={setCommentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pendingTransition?.label}</DialogTitle>
            <DialogDescription>
              Please provide a reason for this action.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="comment">Comment (required)</Label>
            <Input
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Enter reason for this action..."
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCommentDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant={pendingTransition?.variant}
              onClick={handleConfirmWithComment}
              disabled={!comment.trim() || mutation.isPending}
            >
              {mutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
