'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Document, pdfjs } from 'react-pdf';
import { PdfPage, PdfPageSkeleton } from './pdf-page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Maximize,
  Columns,
  AlertCircle,
  Loader2,
} from 'lucide-react';

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export type ZoomMode = 'fit-width' | 'fit-page' | 'custom';

export interface PdfViewerProps {
  /** URL of the PDF to display */
  url: string;
  /** Initial page to display (1-indexed) */
  initialPage?: number;
  /** Initial zoom level (percentage, e.g., 100 for 100%) */
  initialZoom?: number;
  /** Additional CSS classes for the container */
  className?: string;
  /** Callback when page changes */
  onPageChange?: (page: number) => void;
  /** Callback when zoom changes */
  onZoomChange?: (zoom: number) => void;
  /** Callback when document loads */
  onDocumentLoad?: (numPages: number) => void;
  /** Callback when an error occurs */
  onError?: (error: Error) => void;
  /** Whether to show the toolbar */
  showToolbar?: boolean;
  /** Whether to render the text layer (for selection) */
  renderTextLayer?: boolean;
  /** Whether to render the annotation layer */
  renderAnnotationLayer?: boolean;
}

const ZOOM_PRESETS = [50, 75, 100, 125, 150, 200, 300];
const MIN_ZOOM = 25;
const MAX_ZOOM = 500;
const ZOOM_STEP = 25;

/**
 * Full-featured PDF viewer component
 * Supports zoom, page navigation, keyboard shortcuts, and scrolling
 */
export function PdfViewer({
  url,
  initialPage = 1,
  initialZoom = 100,
  className,
  onPageChange,
  onZoomChange,
  onDocumentLoad,
  onError,
  showToolbar = true,
  renderTextLayer = true,
  renderAnnotationLayer = true,
}: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [zoom, setZoom] = useState(initialZoom);
  const [zoomMode, setZoomMode] = useState<ZoomMode>('custom');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [pageInputValue, setPageInputValue] = useState(String(initialPage));
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [containerHeight, setContainerHeight] = useState<number>(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Calculate scale from zoom percentage
  const scale = useMemo(() => zoom / 100, [zoom]);

  // Update container dimensions on resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateDimensions = () => {
      setContainerWidth(container.clientWidth);
      setContainerHeight(container.clientHeight);
    };

    updateDimensions();

    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  // Handle document load success
  const handleDocumentLoadSuccess = useCallback(
    ({ numPages: pages }: { numPages: number }) => {
      setNumPages(pages);
      setIsLoading(false);
      setError(null);
      onDocumentLoad?.(pages);
    },
    [onDocumentLoad]
  );

  // Handle document load error
  const handleDocumentLoadError = useCallback(
    (err: Error) => {
      setError(err);
      setIsLoading(false);
      onError?.(err);
    },
    [onError]
  );

  // Navigate to a specific page
  const goToPage = useCallback(
    (page: number) => {
      if (!numPages) return;

      const validPage = Math.max(1, Math.min(page, numPages));
      setCurrentPage(validPage);
      setPageInputValue(String(validPage));
      onPageChange?.(validPage);

      // Scroll to the page
      const pageElement = pageRefs.current.get(validPage);
      if (pageElement && scrollContainerRef.current) {
        pageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    [numPages, onPageChange]
  );

  // Page navigation handlers
  const goToFirstPage = useCallback(() => goToPage(1), [goToPage]);
  const goToLastPage = useCallback(() => goToPage(numPages || 1), [goToPage, numPages]);
  const goToPreviousPage = useCallback(() => goToPage(currentPage - 1), [goToPage, currentPage]);
  const goToNextPage = useCallback(() => goToPage(currentPage + 1), [goToPage, currentPage]);

  // Handle page input change
  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPageInputValue(e.target.value);
  };

  // Handle page input submit
  const handlePageInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const page = parseInt(pageInputValue, 10);
    if (!isNaN(page)) {
      goToPage(page);
    } else {
      setPageInputValue(String(currentPage));
    }
  };

  // Zoom handlers
  const setZoomWithBounds = useCallback(
    (newZoom: number) => {
      const boundedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
      setZoom(boundedZoom);
      setZoomMode('custom');
      onZoomChange?.(boundedZoom);
    },
    [onZoomChange]
  );

  const zoomIn = useCallback(() => {
    setZoomWithBounds(zoom + ZOOM_STEP);
  }, [zoom, setZoomWithBounds]);

  const zoomOut = useCallback(() => {
    setZoomWithBounds(zoom - ZOOM_STEP);
  }, [zoom, setZoomWithBounds]);

  // Fit to width
  const fitWidth = useCallback(() => {
    if (!containerWidth) return;
    // Standard PDF page width is 612 points (8.5 inches at 72 DPI)
    // Subtract padding for scrollbar and margins
    const availableWidth = containerWidth - 48;
    const newZoom = Math.round((availableWidth / 612) * 100);
    setZoom(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom)));
    setZoomMode('fit-width');
    onZoomChange?.(newZoom);
  }, [containerWidth, onZoomChange]);

  // Fit to page
  const fitPage = useCallback(() => {
    if (!containerWidth || !containerHeight) return;
    // Standard PDF page dimensions: 612 x 792 points
    const availableWidth = containerWidth - 48;
    const availableHeight = containerHeight - (showToolbar ? 100 : 48);
    const widthScale = availableWidth / 612;
    const heightScale = availableHeight / 792;
    const newZoom = Math.round(Math.min(widthScale, heightScale) * 100);
    setZoom(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom)));
    setZoomMode('fit-page');
    onZoomChange?.(newZoom);
  }, [containerWidth, containerHeight, showToolbar, onZoomChange]);

  // Track scroll position to update current page
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer || !numPages) return;

    const handleScroll = () => {
      const scrollTop = scrollContainer.scrollTop;
      const containerTop = scrollContainer.getBoundingClientRect().top;

      // Find the page that's most visible
      let mostVisiblePage = 1;
      let maxVisibility = 0;

      pageRefs.current.forEach((element, pageNum) => {
        const rect = element.getBoundingClientRect();
        const visibleTop = Math.max(rect.top, containerTop);
        const visibleBottom = Math.min(rect.bottom, containerTop + scrollContainer.clientHeight);
        const visibility = Math.max(0, visibleBottom - visibleTop);

        if (visibility > maxVisibility) {
          maxVisibility = visibility;
          mostVisiblePage = pageNum;
        }
      });

      if (mostVisiblePage !== currentPage) {
        setCurrentPage(mostVisiblePage);
        setPageInputValue(String(mostVisiblePage));
        onPageChange?.(mostVisiblePage);
      }
    };

    scrollContainer.addEventListener('scroll', handleScroll);
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, [numPages, currentPage, onPageChange]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case 'ArrowUp':
        case 'PageUp':
          e.preventDefault();
          goToPreviousPage();
          break;
        case 'ArrowDown':
        case 'PageDown':
          e.preventDefault();
          goToNextPage();
          break;
        case 'Home':
          e.preventDefault();
          goToFirstPage();
          break;
        case 'End':
          e.preventDefault();
          goToLastPage();
          break;
        case '+':
        case '=':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            zoomIn();
          }
          break;
        case '-':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            zoomOut();
          }
          break;
        case '0':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setZoomWithBounds(100);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToPreviousPage, goToNextPage, goToFirstPage, goToLastPage, zoomIn, zoomOut, setZoomWithBounds]);

  // Store page ref
  const setPageRef = useCallback((pageNum: number, element: HTMLDivElement | null) => {
    if (element) {
      pageRefs.current.set(pageNum, element);
    } else {
      pageRefs.current.delete(pageNum);
    }
  }, []);

  // Generate page numbers array
  const pageNumbers = useMemo(() => {
    if (!numPages) return [];
    return Array.from({ length: numPages }, (_, i) => i + 1);
  }, [numPages]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex flex-col h-full bg-gray-100 overflow-hidden',
        className
      )}
    >
      {/* Toolbar */}
      {showToolbar && (
        <div className="flex items-center justify-between gap-4 px-4 py-2 bg-white border-b border-gray-200 flex-shrink-0">
          {/* Page Navigation */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={goToFirstPage}
              disabled={isLoading || currentPage === 1}
              aria-label="First page"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={goToPreviousPage}
              disabled={isLoading || currentPage === 1}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <form onSubmit={handlePageInputSubmit} className="flex items-center gap-2">
              <Input
                type="text"
                value={pageInputValue}
                onChange={handlePageInputChange}
                onBlur={handlePageInputSubmit}
                className="w-16 text-center h-8"
                disabled={isLoading}
                aria-label="Current page"
              />
              <span className="text-sm text-gray-500">
                / {numPages || '...'}
              </span>
            </form>

            <Button
              variant="ghost"
              size="icon"
              onClick={goToNextPage}
              disabled={isLoading || currentPage === numPages}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={goToLastPage}
              disabled={isLoading || currentPage === numPages}
              aria-label="Last page"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={zoomOut}
              disabled={isLoading || zoom <= MIN_ZOOM}
              aria-label="Zoom out"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>

            <select
              value={zoomMode === 'custom' ? zoom : zoomMode}
              onChange={(e) => {
                const value = e.target.value;
                if (value === 'fit-width') {
                  fitWidth();
                } else if (value === 'fit-page') {
                  fitPage();
                } else {
                  setZoomWithBounds(parseInt(value, 10));
                }
              }}
              className="h-8 px-2 text-sm border border-gray-200 rounded-md bg-white"
              disabled={isLoading}
              aria-label="Zoom level"
            >
              <option value="fit-width">Fit Width</option>
              <option value="fit-page">Fit Page</option>
              {ZOOM_PRESETS.map((preset) => (
                <option key={preset} value={preset}>
                  {preset}%
                </option>
              ))}
              {!ZOOM_PRESETS.includes(zoom) && zoomMode === 'custom' && (
                <option value={zoom}>{zoom}%</option>
              )}
            </select>

            <Button
              variant="ghost"
              size="icon"
              onClick={zoomIn}
              disabled={isLoading || zoom >= MAX_ZOOM}
              aria-label="Zoom in"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>

            <div className="h-4 w-px bg-gray-200 mx-1" />

            <Button
              variant={zoomMode === 'fit-width' ? 'default' : 'ghost'}
              size="icon"
              onClick={fitWidth}
              disabled={isLoading}
              aria-label="Fit to width"
              title="Fit to width"
            >
              <Columns className="h-4 w-4" />
            </Button>
            <Button
              variant={zoomMode === 'fit-page' ? 'default' : 'ghost'}
              size="icon"
              onClick={fitPage}
              disabled={isLoading}
              aria-label="Fit to page"
              title="Fit to page"
            >
              <Maximize className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* PDF Content */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto"
      >
        {/* Error State */}
        {error && (
          <div className="flex flex-col items-center justify-center h-full p-8">
            <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Failed to load PDF
            </h3>
            <p className="text-sm text-gray-500 text-center max-w-md">
              {error.message || 'An error occurred while loading the PDF document.'}
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => {
                setError(null);
                setIsLoading(true);
              }}
            >
              Try Again
            </Button>
          </div>
        )}

        {/* Loading State */}
        {isLoading && !error && (
          <div className="flex flex-col items-center justify-center h-full p-8">
            <Loader2 className="h-12 w-12 animate-spin text-gray-400 mb-4" />
            <p className="text-sm text-gray-500">Loading PDF document...</p>
          </div>
        )}

        {/* PDF Document */}
        {!error && (
          <Document
            file={url}
            onLoadSuccess={handleDocumentLoadSuccess}
            onLoadError={handleDocumentLoadError}
            loading={null}
            error={null}
            className="flex flex-col items-center py-4 gap-4"
          >
            {numPages && pageNumbers.map((pageNum) => (
              <div
                key={pageNum}
                ref={(el) => setPageRef(pageNum, el)}
                className="flex-shrink-0"
              >
                <PdfPage
                  pageNumber={pageNum}
                  scale={scale}
                  renderTextLayer={renderTextLayer}
                  renderAnnotationLayer={renderAnnotationLayer}
                />
              </div>
            ))}
          </Document>
        )}

        {/* Loading skeletons while document loads */}
        {isLoading && !error && (
          <div className="flex flex-col items-center py-4 gap-4">
            {[1, 2, 3].map((i) => (
              <PdfPageSkeleton key={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
