'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { cn, formatBytes } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Upload,
  X,
  FileText,
  AlertCircle,
  CheckCircle,
  Loader2,
  Circle,
} from 'lucide-react';
import type { Document } from '@/types';

// Only PDF files are allowed
const ALLOWED_TYPES = ['application/pdf'];

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export interface DocumentUploadProps {
  studyId: string;
  slotId: string;
  onUploadComplete?: (document: Document) => void;
  disabled?: boolean;
}

interface FileUploadItem {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error: string | null;
}

/**
 * Validates a file against allowed types and size limits
 */
function validateFile(file: File): { valid: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File exceeds maximum size of ${formatBytes(MAX_FILE_SIZE)}`,
    };
  }

  if (ALLOWED_TYPES.includes(file.type)) {
    return { valid: true };
  }

  return {
    valid: false,
    error: 'Only PDF files are accepted',
  };
}

/**
 * Gets the accept string for the file input
 */
function getAcceptString(): string {
  return ALLOWED_TYPES.join(',');
}

export function DocumentUpload({
  studyId,
  slotId,
  onUploadComplete,
  disabled = false,
}: DocumentUploadProps) {
  const [fileQueue, setFileQueue] = useState<FileUploadItem[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const clearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref to track whether an upload is currently in progress, preventing
  // the useEffect from starting duplicate uploads on re-renders.
  const isUploadingRef = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (xhrRef.current) {
        xhrRef.current.abort();
        xhrRef.current = null;
      }
      if (clearTimeoutRef.current) {
        clearTimeout(clearTimeoutRef.current);
        clearTimeoutRef.current = null;
      }
    };
  }, []);

  /**
   * Updates a single item in the queue by id.
   */
  const updateItem = useCallback(
    (id: string, updates: Partial<Omit<FileUploadItem, 'id' | 'file'>>) => {
      setFileQueue((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, ...updates } : item
        )
      );
    },
    []
  );

  /**
   * Removes an item from the queue (only pending or error items).
   */
  const removeItem = useCallback((id: string) => {
    setFileQueue((prev) => prev.filter((item) => item.id !== id));
  }, []);

  /**
   * Uploads a single file. Returns a promise that resolves when done.
   */
  const uploadSingleFile = useCallback(
    (item: FileUploadItem): Promise<void> => {
      return new Promise<void>((resolve) => {
        updateItem(item.id, { status: 'uploading', progress: 0 });

        const formData = new FormData();
        formData.append('file', item.file);
        formData.append('studyId', studyId);
        formData.append('slotId', slotId);

        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;

        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100);
            updateItem(item.id, { progress });
          }
        });

        xhr.addEventListener('load', () => {
          xhrRef.current = null;
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              if (response.error) {
                updateItem(item.id, {
                  status: 'error',
                  progress: 0,
                  error: response.error,
                });
              } else {
                updateItem(item.id, { status: 'success', progress: 100 });
                onUploadComplete?.(response.data as Document);
              }
            } catch {
              updateItem(item.id, {
                status: 'error',
                progress: 0,
                error: 'Invalid response from server',
              });
            }
          } else {
            try {
              const response = JSON.parse(xhr.responseText);
              updateItem(item.id, {
                status: 'error',
                progress: 0,
                error: response.error || `Upload failed with status ${xhr.status}`,
              });
            } catch {
              updateItem(item.id, {
                status: 'error',
                progress: 0,
                error: `Upload failed with status ${xhr.status}`,
              });
            }
          }
          resolve();
        });

        xhr.addEventListener('error', () => {
          xhrRef.current = null;
          updateItem(item.id, {
            status: 'error',
            progress: 0,
            error: 'Network error during upload',
          });
          resolve();
        });

        xhr.addEventListener('abort', () => {
          xhrRef.current = null;
          updateItem(item.id, {
            status: 'error',
            progress: 0,
            error: 'Upload was cancelled',
          });
          resolve();
        });

        xhr.open('POST', '/api/upload');
        xhr.send(formData);
      });
    },
    [studyId, slotId, onUploadComplete, updateItem]
  );

  // Queue processor: pick up the next pending item when nothing is uploading
  useEffect(() => {
    if (isUploadingRef.current) return;

    const hasUploading = fileQueue.some((item) => item.status === 'uploading');
    if (hasUploading) return;

    const nextPending = fileQueue.find((item) => item.status === 'pending');
    if (!nextPending) return;

    isUploadingRef.current = true;
    uploadSingleFile(nextPending).then(() => {
      isUploadingRef.current = false;
    });
  }, [fileQueue, uploadSingleFile]);

  // Auto-clear: when all items are terminal (success or error), clear after 3 seconds
  useEffect(() => {
    if (fileQueue.length === 0) return;

    const allDone = fileQueue.every(
      (item) => item.status === 'success' || item.status === 'error'
    );

    if (allDone) {
      clearTimeoutRef.current = setTimeout(() => {
        clearTimeoutRef.current = null;
        setFileQueue([]);
      }, 3000);
    }

    return () => {
      if (clearTimeoutRef.current) {
        clearTimeout(clearTimeoutRef.current);
        clearTimeoutRef.current = null;
      }
    };
  }, [fileQueue]);

  /**
   * Accepts multiple files, validates each, and adds them to the queue.
   */
  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;

    // Cancel any pending auto-clear timeout when new files arrive
    if (clearTimeoutRef.current) {
      clearTimeout(clearTimeoutRef.current);
      clearTimeoutRef.current = null;
    }

    const newItems: FileUploadItem[] = Array.from(files).map((file) => {
      const validation = validateFile(file);
      return {
        id: crypto.randomUUID(),
        file,
        status: validation.valid ? 'pending' : 'error',
        progress: 0,
        error: validation.valid ? null : (validation.error ?? 'Invalid file'),
      } as FileUploadItem;
    });

    setFileQueue((prev) => [...prev, ...newItems]);
  }, []);

  // --- Drag-and-drop handlers (unchanged logic) ---

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) {
        setIsDragOver(true);
      }
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) {
        setIsDragOver(true);
      }
    },
    [disabled]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (disabled) return;

      const { files } = e.dataTransfer;
      handleFiles(files);
    },
    [disabled, handleFiles]
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files);
      // Reset the input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [handleFiles]
  );

  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleCancelUpload = useCallback(() => {
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
  }, []);

  // --- Computed values for summary ---

  const totalCount = fileQueue.length;
  const successCount = fileQueue.filter((i) => i.status === 'success').length;
  const errorCount = fileQueue.filter((i) => i.status === 'error').length;
  const uploadingItem = fileQueue.find((i) => i.status === 'uploading');
  const pendingCount = fileQueue.filter((i) => i.status === 'pending').length;
  const completedCount = successCount + errorCount;
  const isProcessing = !!uploadingItem || pendingCount > 0;

  // --- Screen reader announcement ---

  const getStatusText = (): string => {
    if (fileQueue.length === 0) return '';
    if (uploadingItem) {
      return `Uploading ${uploadingItem.file.name}: ${uploadingItem.progress}% complete. ${completedCount} of ${totalCount} files processed.`;
    }
    if (pendingCount > 0) {
      return `${pendingCount} files waiting to upload.`;
    }
    return `All uploads complete. ${successCount} succeeded, ${errorCount} failed.`;
  };

  // --- Status icon per item ---

  const renderStatusIcon = (item: FileUploadItem) => {
    switch (item.status) {
      case 'pending':
        return <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0" />;
      case 'uploading':
        return <Loader2 className="h-4 w-4 text-primary animate-spin flex-shrink-0" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />;
    }
  };

  // --- Summary text ---

  const renderSummary = () => {
    if (isProcessing) {
      const uploadingIndex = fileQueue.findIndex(
        (i) => i.status === 'uploading'
      );
      const currentNum = uploadingIndex >= 0 ? uploadingIndex + 1 : completedCount + 1;
      return (
        <span className="text-sm text-muted-foreground">
          Uploading {currentNum} of {totalCount}...
        </span>
      );
    }
    // All done
    const parts: string[] = [];
    if (successCount > 0) parts.push(`${successCount} uploaded`);
    if (errorCount > 0) parts.push(`${errorCount} failed`);
    return (
      <span className="text-sm text-muted-foreground">{parts.join(', ')}</span>
    );
  };

  return (
    <div className="w-full">
      {/* Screen reader status announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {getStatusText()}
      </div>

      {/* Hidden file input (multiple) */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept={getAcceptString()}
        onChange={handleFileInputChange}
        disabled={disabled}
        multiple
      />

      {/* Drop zone - always present for drag-and-drop */}
      <div
        className={cn(
          'relative border-2 border-dashed rounded-lg transition-colors',
          isDragOver && !disabled && 'border-primary bg-primary/10',
          !isDragOver && !disabled && 'border-border hover:border-border/70 bg-muted/40',
          disabled && 'border-border bg-muted cursor-not-allowed opacity-60',
          fileQueue.length === 0 && 'p-6 flex flex-col items-center justify-center gap-3 min-h-[160px]',
          fileQueue.length > 0 && 'p-4'
        )}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Idle state: no files in queue */}
        {fileQueue.length === 0 && (
          <>
            <div
              className={cn(
                'p-3 rounded-full',
                isDragOver ? 'bg-primary/10' : 'bg-muted'
              )}
            >
              <Upload
                className={cn(
                  'h-6 w-6',
                  isDragOver ? 'text-primary' : 'text-muted-foreground/70'
                )}
              />
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium">Drop files here</span> or{' '}
                <button
                  type="button"
                  onClick={handleBrowseClick}
                  disabled={disabled}
                  className="text-primary hover:text-primary font-medium focus:outline-none focus:underline disabled:opacity-50"
                >
                  browse
                </button>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                PDF files up to {formatBytes(MAX_FILE_SIZE)}
              </p>
            </div>
          </>
        )}

        {/* Queue state: files are present */}
        {fileQueue.length > 0 && (
          <div className="space-y-3">
            {/* File list */}
            <ul className="space-y-2" role="list" aria-label="Upload queue">
              {fileQueue.map((item) => (
                <li key={item.id} className="space-y-1">
                  <div className="flex items-center gap-2">
                    {renderStatusIcon(item)}
                    <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm text-foreground/80 truncate flex-1 min-w-0">
                      {item.file.name}
                    </span>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {formatBytes(item.file.size)}
                    </span>
                    {/* Remove button for pending or error items */}
                    {(item.status === 'pending' || item.status === 'error') && (
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="p-0.5 text-muted-foreground hover:text-foreground/80 focus:outline-none focus:ring-1 focus:ring-ring rounded"
                        aria-label={`Remove ${item.file.name}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {/* Cancel button for the currently uploading item */}
                    {item.status === 'uploading' && (
                      <button
                        type="button"
                        onClick={handleCancelUpload}
                        className="text-xs text-muted-foreground hover:text-foreground/80 focus:outline-none focus:ring-1 focus:ring-ring rounded px-1"
                        aria-label={`Cancel upload of ${item.file.name}`}
                      >
                        Cancel
                      </button>
                    )}
                  </div>

                  {/* Progress bar for uploading item */}
                  {item.status === 'uploading' && (
                    <div className="ml-[52px]">
                      <div
                        className="w-full bg-muted/60 rounded-full h-1.5 overflow-hidden"
                        role="progressbar"
                        aria-valuenow={item.progress}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Upload progress for ${item.file.name}: ${item.progress}%`}
                      >
                        <div
                          className="bg-primary h-1.5 rounded-full transition-all duration-300 ease-out"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground mt-0.5 block">
                        {item.progress}%
                      </span>
                    </div>
                  )}

                  {/* Error message */}
                  {item.status === 'error' && item.error && (
                    <p className="text-xs text-destructive ml-[52px]">
                      {item.error}
                    </p>
                  )}
                </li>
              ))}
            </ul>

            {/* Summary + Add more */}
            <div className="flex items-center justify-between pt-1 border-t border-border/50">
              {renderSummary()}
              <Button
                variant="outline"
                size="sm"
                onClick={handleBrowseClick}
                disabled={disabled}
                className="flex-shrink-0"
              >
                <Upload className="h-3 w-3 mr-1" />
                Add more
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
