'use client';

import { useState, memo } from 'react';
import { Page } from 'react-pdf';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

export interface PdfPageProps {
  /** Page number to render (1-indexed) */
  pageNumber: number;
  /** Scale factor for rendering (1.0 = 100%) */
  scale?: number;
  /** Width to render at (overrides scale) */
  width?: number;
  /** Additional CSS classes */
  className?: string;
  /** Callback when page finishes loading */
  onLoadSuccess?: (page: { pageNumber: number }) => void;
  /** Callback when page fails to load */
  onLoadError?: (error: Error) => void;
  /** Whether to render the text layer (for selection) */
  renderTextLayer?: boolean;
  /** Whether to render the annotation layer */
  renderAnnotationLayer?: boolean;
}

/**
 * Component for rendering a single PDF page
 * Handles loading states and error states
 */
export const PdfPage = memo(function PdfPage({
  pageNumber,
  scale = 1.0,
  width,
  className,
  onLoadSuccess,
  onLoadError,
  renderTextLayer = true,
  renderAnnotationLayer = true,
}: PdfPageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleLoadSuccess = (page: { pageNumber: number }) => {
    setIsLoading(false);
    setHasError(false);
    onLoadSuccess?.(page);
  };

  const handleLoadError = (error: Error) => {
    setIsLoading(false);
    setHasError(true);
    onLoadError?.(error);
  };

  return (
    <div
      className={cn(
        'relative bg-white shadow-md',
        className
      )}
      data-page-number={pageNumber}
    >
      {/* Loading state overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            <span className="text-sm text-gray-500">Loading page {pageNumber}...</span>
          </div>
        </div>
      )}

      {/* Error state */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-50 z-10">
          <div className="text-center p-4">
            <p className="text-red-600 font-medium">Failed to load page {pageNumber}</p>
            <p className="text-sm text-red-500 mt-1">Please try refreshing</p>
          </div>
        </div>
      )}

      {/* PDF Page */}
      <Page
        pageNumber={pageNumber}
        scale={scale}
        width={width}
        onLoadSuccess={handleLoadSuccess}
        onLoadError={handleLoadError}
        renderTextLayer={renderTextLayer}
        renderAnnotationLayer={renderAnnotationLayer}
        loading={null} // We handle loading ourselves
        error={null} // We handle errors ourselves
        className="pdf-page"
      />
    </div>
  );
});

/**
 * Loading skeleton for PDF pages
 * Used while the PDF document is loading
 */
export function PdfPageSkeleton({
  width = 612,
  height = 792,
  className,
}: {
  width?: number;
  height?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'bg-gray-100 animate-pulse shadow-md flex items-center justify-center',
        className
      )}
      style={{ width, height }}
    >
      <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
    </div>
  );
}
