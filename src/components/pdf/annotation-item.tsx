'use client';

import * as React from 'react';
import { cn, formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  ChevronDown,
  ChevronRight,
  Edit,
  Trash2,
  CheckCircle,
  User,
  MessageSquare,
  FileText,
  Send,
} from 'lucide-react';
import { AnnotationReplyItem } from './annotation-reply';
import type {
  AnnotationType,
  AnnotationStatus,
  AnnotationWithReplies,
} from '@/types';

export interface AnnotationItemProps {
  annotation: AnnotationWithReplies;
  /** Called when annotation is clicked (for scrolling PDF) */
  onClick?: () => void;
  /** Called when edit button is clicked */
  onEdit?: () => void;
  /** Called when status change is requested */
  onStatusChange?: (status: AnnotationStatus) => void;
  /** Called when delete is confirmed */
  onDelete?: () => void;
  /** Called when a reply is submitted */
  onReply?: (content: string) => void;
  /** Whether status change is in progress */
  isUpdating?: boolean;
  /** Whether delete is in progress */
  isDeleting?: boolean;
  /** Whether reply is being submitted */
  isReplying?: boolean;
}

// Type badge configuration with colors
const typeConfig: Record<
  AnnotationType,
  { className: string; label: string }
> = {
  NOTE: {
    className: 'bg-blue-100 text-blue-700 border-blue-200',
    label: 'Note',
  },
  QUESTION: {
    className: 'bg-purple-100 text-purple-700 border-purple-200',
    label: 'Question',
  },
  CORRECTION_REQUIRED: {
    className: 'bg-red-100 text-red-700 border-red-200',
    label: 'Correction Required',
  },
  FYI: {
    className: 'bg-gray-100 text-gray-700 border-gray-200',
    label: 'FYI',
  },
};

// Status badge configuration
const statusConfig: Record<
  AnnotationStatus,
  { variant: 'default' | 'secondary' | 'success' | 'warning'; label: string }
> = {
  OPEN: { variant: 'warning', label: 'Open' },
  RESOLVED: { variant: 'success', label: 'Resolved' },
  WONT_FIX: { variant: 'secondary', label: "Won't Fix" },
};

// Content truncation length
const CONTENT_TRUNCATE_LENGTH = 150;

export function AnnotationItem({
  annotation,
  onClick,
  onEdit,
  onStatusChange,
  onDelete,
  onReply,
  isUpdating = false,
  isDeleting = false,
  isReplying = false,
}: AnnotationItemProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [showReplies, setShowReplies] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [replyContent, setReplyContent] = React.useState('');

  const type = annotation.type as AnnotationType;
  const status = annotation.status as AnnotationStatus;
  const typeInfo = typeConfig[type] || typeConfig.NOTE;
  const statusInfo = statusConfig[status] || statusConfig.OPEN;
  const replyCount = annotation.replies?.length || 0;

  const isContentLong = annotation.content.length > CONTENT_TRUNCATE_LENGTH;
  const displayContent = isExpanded || !isContentLong
    ? annotation.content
    : annotation.content.slice(0, CONTENT_TRUNCATE_LENGTH) + '...';

  const handleDeleteConfirm = () => {
    onDelete?.();
    setDeleteDialogOpen(false);
  };

  const handleReplySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (replyContent.trim() && onReply) {
      onReply(replyContent.trim());
      setReplyContent('');
    }
  };

  return (
    <>
      <div className="border border-gray-200 rounded-lg bg-white shadow-sm">
        {/* Main Content - Clickable for PDF navigation */}
        <div
          className={cn(
            'p-3 cursor-pointer hover:bg-gray-50 transition-colors',
            onClick && 'cursor-pointer'
          )}
          onClick={onClick}
          role={onClick ? 'button' : undefined}
          tabIndex={onClick ? 0 : undefined}
          onKeyDown={(e) => {
            if (onClick && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              onClick();
            }
          }}
        >
          {/* Header Row */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Type Badge */}
              <span
                className={cn(
                  'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
                  typeInfo.className
                )}
              >
                {typeInfo.label}
              </span>

              {/* Status Badge */}
              <Badge variant={statusInfo.variant} className="text-xs">
                {statusInfo.label}
              </Badge>
            </div>

            {/* Page Number */}
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <FileText className="h-3 w-3" />
              <span>Page {annotation.pageNumber}</span>
            </div>
          </div>

          {/* Author and Timestamp */}
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center justify-center h-5 w-5 rounded-full bg-gray-100">
              <User className="h-3 w-3 text-gray-500" />
            </div>
            <span className="text-xs font-medium text-gray-700">
              {annotation.authorName || 'Anonymous'}
            </span>
            <span className="text-xs text-gray-400">
              {formatDate(annotation.createdAt)}
            </span>
          </div>

          {/* Content */}
          <p className="text-sm text-gray-700 whitespace-pre-wrap">
            {displayContent}
          </p>

          {/* Expand/Collapse for long content */}
          {isContentLong && (
            <button
              type="button"
              className="text-xs text-blue-600 hover:text-blue-700 mt-1"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
            >
              {isExpanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>

        {/* Footer with actions */}
        <div className="px-3 py-2 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between gap-2">
          {/* Reply Count & Toggle */}
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
            onClick={() => setShowReplies(!showReplies)}
          >
            {showReplies ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            <MessageSquare className="h-3 w-3" />
            <span>
              {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
            </span>
          </button>

          {/* Action Buttons */}
          <div className="flex items-center gap-1">
            {/* Edit Button */}
            {onEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                title="Edit annotation"
              >
                <Edit className="h-3.5 w-3.5" />
              </Button>
            )}

            {/* Resolve Button (only if open) */}
            {onStatusChange && status === 'OPEN' && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                onClick={(e) => {
                  e.stopPropagation();
                  onStatusChange('RESOLVED');
                }}
                disabled={isUpdating}
                title="Mark as resolved"
              >
                <CheckCircle className="h-3.5 w-3.5" />
              </Button>
            )}

            {/* Reopen Button (if resolved or won't fix) */}
            {onStatusChange && status !== 'OPEN' && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onStatusChange('OPEN');
                }}
                disabled={isUpdating}
              >
                Reopen
              </Button>
            )}

            {/* Delete Button */}
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteDialogOpen(true);
                }}
                disabled={isDeleting}
                title="Delete annotation"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Replies Section */}
        {showReplies && (
          <div className="px-3 pb-3 border-t border-gray-100">
            {/* Existing Replies */}
            {annotation.replies && annotation.replies.length > 0 && (
              <div className="mt-3 space-y-2">
                {annotation.replies.map((reply) => (
                  <AnnotationReplyItem key={reply.id} reply={reply} />
                ))}
              </div>
            )}

            {/* Reply Form */}
            {onReply && (
              <form onSubmit={handleReplySubmit} className="mt-3">
                <div className="flex items-start gap-2">
                  <textarea
                    className="flex-1 min-h-[60px] rounded-md border border-gray-200 bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                    placeholder="Write a reply..."
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    disabled={isReplying}
                  />
                  <Button
                    type="submit"
                    size="icon"
                    className="h-9 w-9"
                    disabled={!replyContent.trim() || isReplying}
                    title="Send reply"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Annotation</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this annotation? This action cannot
              be undone. All replies will also be deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
