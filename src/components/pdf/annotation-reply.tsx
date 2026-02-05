'use client';

import * as React from 'react';
import { cn, formatDate } from '@/lib/utils';
import { User } from 'lucide-react';
import type { AnnotationReply } from '@/types';

export interface AnnotationReplyProps {
  reply: AnnotationReply;
  className?: string;
}

export function AnnotationReplyItem({ reply, className }: AnnotationReplyProps) {
  return (
    <div
      className={cn(
        'pl-4 border-l-2 border-border py-2',
        className
      )}
    >
      {/* Reply Header */}
      <div className="flex items-center gap-2 mb-1">
        <div className="flex items-center justify-center h-5 w-5 rounded-full bg-muted">
          <User className="h-3 w-3 text-muted-foreground" />
        </div>
        <span className="text-xs font-medium text-foreground/80">
          {reply.authorName || 'Anonymous'}
        </span>
        <span className="text-xs text-muted-foreground/70">
          {formatDate(reply.createdAt)}
        </span>
      </div>

      {/* Reply Content */}
      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
        {reply.content}
      </p>
    </div>
  );
}
