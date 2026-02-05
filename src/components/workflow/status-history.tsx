'use client';

import { useQuery } from '@tanstack/react-query';
import { StatusBadge } from './status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight, Clock, User, MessageSquare } from 'lucide-react';
import type { DocumentStatusHistory, DocumentStatusType } from '@/types';

interface StatusHistoryProps {
  documentId: string;
}

async function fetchHistory(documentId: string): Promise<DocumentStatusHistory[]> {
  const res = await fetch(`/api/documents/${documentId}/history`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to fetch history');
  return json.data;
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function StatusHistory({ documentId }: StatusHistoryProps) {
  const { data: history, isLoading, error } = useQuery({
    queryKey: ['document-history', documentId],
    queryFn: () => fetchHistory(documentId),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-destructive">
        Failed to load history
      </p>
    );
  }

  if (!history || history.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No status changes recorded
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {history.map((entry) => (
        <div
          key={entry.id}
          className="p-3 rounded-lg border border-border bg-card"
        >
          <div className="flex items-center gap-2 mb-2">
            <StatusBadge status={entry.fromStatus as DocumentStatusType} />
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <StatusBadge status={entry.toStatus as DocumentStatusType} />
          </div>

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {entry.userName}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDate(entry.createdAt)}
            </span>
          </div>

          {entry.comment && (
            <div className="mt-2 flex items-start gap-1 text-xs text-muted-foreground">
              <MessageSquare className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <span>{entry.comment}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
