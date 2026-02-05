'use client';

import { useState, useMemo } from 'react';
import { cn, formatBytes, formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useDeleteDocument } from '@/hooks/use-documents';
import { useProcessingJobPolling, isJobActive } from '@/hooks/use-processing';
import {
  FileText,
  Trash2,
  Eye,
  Loader2,
  FileQuestion,
  AlertCircle,
} from 'lucide-react';
import type { Document, LatestProcessingJob } from '@/types';

// Extended Document type that includes the processing job
interface DocumentWithProcessing extends Document {
  latestProcessingJob?: LatestProcessingJob | null;
}

export interface DocumentListProps {
  documents: DocumentWithProcessing[];
  slotId: string | null;
}

// Status badge configuration
const statusConfig: Record<
  string,
  { variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'; label: string }
> = {
  DRAFT: { variant: 'secondary', label: 'Draft' },
  PROCESSING: { variant: 'warning', label: 'Processing' },
  PROCESSED: { variant: 'default', label: 'Processed' },
  PROCESSING_FAILED: { variant: 'destructive', label: 'Failed' },
  IN_REVIEW: { variant: 'default', label: 'In Review' },
  CORRECTIONS_NEEDED: { variant: 'warning', label: 'Corrections Needed' },
  APPROVED: { variant: 'success', label: 'Approved' },
  PUBLISHED: { variant: 'success', label: 'Published' },
};

function getStatusBadge(status: string) {
  const config = statusConfig[status] || { variant: 'secondary' as const, label: status };
  return (
    <Badge variant={config.variant}>
      {config.label}
    </Badge>
  );
}

export function DocumentList({ documents, slotId }: DocumentListProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<Document | null>(null);

  const deleteDocument = useDeleteDocument();

  // Filter documents by slotId if provided, then sort by version descending (latest first)
  const sortedDocuments = useMemo(() => {
    const filtered = slotId
      ? documents.filter((doc) => doc.slotId === slotId)
      : documents;
    return [...filtered].sort((a, b) => b.version - a.version);
  }, [documents, slotId]);

  const handleDeleteClick = (document: Document) => {
    setDocumentToDelete(document);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!documentToDelete) return;

    try {
      await deleteDocument.mutateAsync(documentToDelete.id);
      setDeleteDialogOpen(false);
      setDocumentToDelete(null);
    } catch (error) {
      // Error is handled by the mutation
      console.error('Failed to delete document:', error);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setDocumentToDelete(null);
  };

  const handleViewClick = (document: Document) => {
    // Placeholder: In a real implementation, this would open a document viewer
    // or navigate to a document viewer page
    // TODO: Remove console.log and implement document viewer navigation
    console.log('View document:', document.id);
    // Future: navigate to /documents/[id]/view or open a modal viewer
  };

  if (sortedDocuments.length === 0) {
    return (
      <div className="text-center py-12 border-2 border-dashed border-border rounded-lg">
        <FileQuestion className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
        <p className="text-muted-foreground mb-1">No documents uploaded</p>
        <p className="text-sm text-muted-foreground/70">
          {slotId
            ? 'Upload a document to this section to get started'
            : 'Select a section and upload documents'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Document list header */}
      <div className="hidden sm:grid grid-cols-12 gap-4 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider" aria-hidden="true">
        <div className="col-span-4">Filename</div>
        <div className="col-span-2">Version</div>
        <div className="col-span-2">Status</div>
        <div className="col-span-2">Size</div>
        <div className="col-span-2">Uploaded</div>
      </div>

      {/* Document list items */}
      <div className="divide-y divide-border/60" role="list" aria-label="Document list">
        {sortedDocuments.map((document) => (
          <DocumentListItem
            key={document.id}
            document={document}
            onView={handleViewClick}
            onDelete={handleDeleteClick}
          />
        ))}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{documentToDelete?.sourceFileName}&quot;?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleDeleteCancel}
              disabled={deleteDocument.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteDocument.isPending}
            >
              {deleteDocument.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface DocumentListItemProps {
  document: DocumentWithProcessing;
  onView: (document: Document) => void;
  onDelete: (document: Document) => void;
}

function DocumentListItem({ document, onView, onDelete }: DocumentListItemProps) {
  const processingJob = document.latestProcessingJob;
  const isProcessing = document.status === 'PROCESSING';
  const isFailed = document.status === 'PROCESSING_FAILED';

  // Poll for job status updates when processing
  const shouldPoll = !!(isProcessing && processingJob && isJobActive(processingJob.status));
  const { data: jobStatus } = useProcessingJobPolling(
    shouldPoll ? processingJob?.id : null,
    { enabled: shouldPoll }
  );

  // Use polled progress if available, otherwise use the cached value
  const currentProgress = jobStatus?.progress ?? processingJob?.progress ?? 0;

  return (
    <div
      role="listitem"
      className={cn(
        'grid grid-cols-12 gap-4 px-4 py-3 items-center',
        'hover:bg-muted/40 transition-colors rounded-md group',
        isFailed && 'bg-destructive/10'
      )}
    >
      {/* Filename */}
      <div className="col-span-12 sm:col-span-4 flex items-center gap-2 min-w-0">
        {isProcessing ? (
          <Loader2 className="h-4 w-4 flex-shrink-0 text-amber-500 animate-spin" />
        ) : isFailed ? (
          <AlertCircle className="h-4 w-4 flex-shrink-0 text-destructive" />
        ) : (
          <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground/70" />
        )}
        <span className="text-sm font-medium text-foreground truncate" title={document.sourceFileName}>
          {document.sourceFileName}
        </span>
      </div>

      {/* Version */}
      <div className="col-span-4 sm:col-span-2">
        <span className="text-sm text-muted-foreground">v{document.version}</span>
      </div>

      {/* Status */}
      <div className="col-span-4 sm:col-span-2">
        <div className="flex flex-col gap-1">
          {getStatusBadge(document.status)}
          {/* Show processing progress */}
          {isProcessing && (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-muted/60 rounded-full overflow-hidden max-w-[80px]">
                <div
                  className="h-full bg-amber-500 transition-all duration-300"
                  style={{ width: `${currentProgress}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground">{currentProgress}%</span>
            </div>
          )}
        </div>
      </div>

      {/* File Size */}
      <div className="col-span-4 sm:col-span-2">
        <span className="text-sm text-muted-foreground">
          {formatBytes(document.fileSize)}
        </span>
      </div>

      {/* Upload Date */}
      <div className="col-span-8 sm:col-span-2 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {formatDate(document.createdAt)}
        </span>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onView(document)}
            aria-label={`View ${document.sourceFileName}`}
          >
            <Eye className="h-4 w-4 text-muted-foreground" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:text-destructive"
            onClick={() => onDelete(document)}
            aria-label={`Delete ${document.sourceFileName}`}
            disabled={isProcessing}
          >
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </div>
    </div>
  );
}
