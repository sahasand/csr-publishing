'use client';

import { useState, useEffect, useCallback } from 'react';
import { pdfjs } from 'react-pdf';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export interface UsePdfDocumentOptions {
  /** URL of the PDF to load */
  url: string;
  /** Optional callback when PDF is loaded */
  onLoad?: (numPages: number) => void;
  /** Optional callback when an error occurs */
  onError?: (error: Error) => void;
}

export interface UsePdfDocumentReturn {
  /** Number of pages in the PDF */
  numPages: number | null;
  /** Whether the PDF is currently loading */
  isLoading: boolean;
  /** Error that occurred during loading, if any */
  error: Error | null;
  /** Reload the PDF document */
  reload: () => void;
}

/**
 * Hook for loading and managing PDF documents
 *
 * @example
 * ```tsx
 * const { numPages, isLoading, error } = usePdfDocument({
 *   url: '/documents/sample.pdf',
 *   onLoad: (pages) => console.log(`Loaded ${pages} pages`),
 * });
 * ```
 */
export function usePdfDocument({
  url,
  onLoad,
  onError,
}: UsePdfDocumentOptions): UsePdfDocumentReturn {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [reloadKey, setReloadKey] = useState<number>(0);

  const reload = useCallback(() => {
    setReloadKey((prev) => prev + 1);
    setNumPages(null);
    setIsLoading(true);
    setError(null);
  }, []);

  useEffect(() => {
    if (!url) {
      setIsLoading(false);
      setError(new Error('No PDF URL provided'));
      return;
    }

    let isMounted = true;

    const loadDocument = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const loadingTask = pdfjs.getDocument(url);
        const pdf = await loadingTask.promise;

        if (isMounted) {
          const pages = pdf.numPages;
          setNumPages(pages);
          setIsLoading(false);
          onLoad?.(pages);
        }
      } catch (err) {
        if (isMounted) {
          const error = err instanceof Error ? err : new Error('Failed to load PDF');
          setError(error);
          setIsLoading(false);
          onError?.(error);
        }
      }
    };

    loadDocument();

    return () => {
      isMounted = false;
    };
  }, [url, reloadKey, onLoad, onError]);

  return {
    numPages,
    isLoading,
    error,
    reload,
  };
}
