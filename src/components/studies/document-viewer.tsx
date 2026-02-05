'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

// Dynamically import PDF components to avoid SSR issues with DOMMatrix
const PdfViewer = dynamic(
  () => import('@/components/pdf').then((mod) => mod.PdfViewer),
  {
    ssr: false,
    loading: () => <Skeleton className="w-full h-full min-h-[400px]" />
  }
);

const AnnotationPanel = dynamic(
  () => import('@/components/pdf').then((mod) => mod.AnnotationPanel),
  { ssr: false }
);
import {
  PanelRightClose,
  PanelRightOpen,
  Loader2,
  AlertCircle,
  FileX,
  Trash2,
} from 'lucide-react';
import type { Document, AnnotationWithReplies } from '@/types';

export interface DocumentViewerProps {
  /** ID of the document to display */
  documentId: string;
  /** Additional CSS classes */
  className?: string;
  /** Callback when delete is requested */
  onDeleteClick?: (document: Document) => void;
}

async function fetchDocument(documentId: string): Promise<Document> {
  const res = await fetch(`/api/documents/${documentId}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to fetch document');
  return json.data;
}

/**
 * Full document viewing experience with PDF viewer and annotations panel
 */
export function DocumentViewer({ documentId, className, onDeleteClick }: DocumentViewerProps) {
  // State
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [totalPages, setTotalPages] = useState<number | null>(null);

  // Fetch document details
  const {
    data: document,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['document', documentId],
    queryFn: () => fetchDocument(documentId),
    enabled: !!documentId,
  });

  // Build PDF URL
  const pdfUrl = `/api/documents/${documentId}/file`;

  // Handle page change from PDF viewer
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  // Handle zoom change from PDF viewer
  const handleZoomChange = useCallback((newZoom: number) => {
    setZoom(newZoom);
  }, []);

  // Handle document load
  const handleDocumentLoad = useCallback((numPages: number) => {
    setTotalPages(numPages);
  }, []);

  // Handle annotation click - scroll to the page
  const handleAnnotationClick = useCallback((annotation: AnnotationWithReplies) => {
    // The PDF viewer will scroll to the page when we update currentPage
    // We need to trigger a page navigation in the PDF viewer
    setCurrentPage(annotation.pageNumber);
  }, []);

  // Toggle annotation panel visibility
  const toggleAnnotations = useCallback(() => {
    setShowAnnotations((prev) => !prev);
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center h-full', className)}>
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/70" />
          <p className="text-sm text-muted-foreground">Loading document...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={cn('flex items-center justify-center h-full', className)}>
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <h3 className="text-lg font-medium text-foreground">
            Failed to load document
          </h3>
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : 'An error occurred while loading the document.'}
          </p>
        </div>
      </div>
    );
  }

  // Document not found
  if (!document) {
    return (
      <div className={cn('flex items-center justify-center h-full', className)}>
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <FileX className="h-12 w-12 text-muted-foreground/70" />
          <h3 className="text-lg font-medium text-foreground">
            Document not found
          </h3>
          <p className="text-sm text-muted-foreground">
            The requested document could not be found.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-border flex-shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-sm font-medium text-foreground truncate max-w-[300px]" title={document.sourceFileName}>
            {document.sourceFileName}
          </h2>
          <span className="text-xs text-muted-foreground">
            v{document.version}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Page info display */}
          <span className="text-xs text-muted-foreground">
            Page {currentPage} of {totalPages || '...'}
          </span>

          {/* Zoom info display */}
          <span className="text-xs text-muted-foreground mx-2">
            {zoom}%
          </span>

          {/* Annotation panel toggle */}
          <Button
            variant={showAnnotations ? 'default' : 'outline'}
            size="sm"
            onClick={toggleAnnotations}
            title={showAnnotations ? 'Hide annotations' : 'Show annotations'}
          >
            {showAnnotations ? (
              <PanelRightClose className="h-4 w-4 mr-2" />
            ) : (
              <PanelRightOpen className="h-4 w-4 mr-2" />
            )}
            Annotations
          </Button>

          {/* Delete button */}
          {onDeleteClick && document && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDeleteClick(document)}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              title="Delete document"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* PDF Viewer - Left side */}
        <div className={cn(
          'flex-1 overflow-hidden transition-all duration-200',
          showAnnotations ? 'mr-0' : 'mr-0'
        )}>
          <PdfViewer
            url={pdfUrl}
            initialPage={currentPage}
            initialZoom={zoom}
            onPageChange={handlePageChange}
            onZoomChange={handleZoomChange}
            onDocumentLoad={handleDocumentLoad}
            showToolbar={true}
            renderTextLayer={true}
            renderAnnotationLayer={true}
          />
        </div>

        {/* Annotation Panel - Right side (collapsible) */}
        {showAnnotations && (
          <aside className="w-[320px] flex-shrink-0 border-l border-border bg-muted/40 overflow-hidden">
            <div className="h-full overflow-y-auto p-4">
              <AnnotationPanel
                documentId={documentId}
                maxPageNumber={totalPages || undefined}
                onAnnotationClick={handleAnnotationClick}
                currentUserName="Reviewer"
              />
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
