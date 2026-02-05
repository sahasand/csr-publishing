'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { cn, formatBytes } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Upload, X, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import type { Document } from '@/types';

// Allowed file types matching the API validation
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/csv',
  'application/rtf',
];

const ALLOWED_EXTENSIONS = ['.xpt'];

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

// Human-readable file type descriptions
const FILE_TYPE_LABELS: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/msword': 'Word (.doc)',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word (.docx)',
  'text/plain': 'Text',
  'text/csv': 'CSV',
  'application/rtf': 'RTF',
};

export interface DocumentUploadProps {
  studyId: string;
  slotId: string;
  onUploadComplete?: (document: Document) => void;
  disabled?: boolean;
}

type UploadStatus = 'idle' | 'validating' | 'uploading' | 'success' | 'error';

interface UploadState {
  status: UploadStatus;
  progress: number;
  error: string | null;
  file: File | null;
}

/**
 * Validates a file against allowed types and size limits
 */
function validateFile(file: File): { valid: boolean; error?: string } {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File exceeds maximum size of ${formatBytes(MAX_FILE_SIZE)}`,
    };
  }

  // Check if file type is in allowed MIME types
  if (ALLOWED_TYPES.includes(file.type)) {
    return { valid: true };
  }

  // Check for .xpt extension (datasets)
  if (file.name.toLowerCase().endsWith('.xpt')) {
    return { valid: true };
  }

  // Build helpful error message
  const allowedLabels = Object.values(FILE_TYPE_LABELS).join(', ');
  return {
    valid: false,
    error: `File type not allowed. Accepted types: ${allowedLabels}, .xpt (datasets)`,
  };
}

/**
 * Gets the accept string for the file input
 */
function getAcceptString(): string {
  return [...ALLOWED_TYPES, '.xpt'].join(',');
}

export function DocumentUpload({
  studyId,
  slotId,
  onUploadComplete,
  disabled = false,
}: DocumentUploadProps) {
  const [uploadState, setUploadState] = useState<UploadState>({
    status: 'idle',
    progress: 0,
    error: null,
    file: null,
  });
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Abort any in-flight XHR request
      if (xhrRef.current) {
        xhrRef.current.abort();
        xhrRef.current = null;
      }
      // Clear any pending timeout
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
        successTimeoutRef.current = null;
      }
    };
  }, []);

  const resetState = useCallback(() => {
    // Abort any in-flight XHR request
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
    // Clear any pending timeout
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = null;
    }
    setUploadState({
      status: 'idle',
      progress: 0,
      error: null,
      file: null,
    });
  }, []);

  const uploadFile = useCallback(
    async (file: File) => {
      // Validate file first
      setUploadState({
        status: 'validating',
        progress: 0,
        error: null,
        file,
      });

      const validation = validateFile(file);
      if (!validation.valid) {
        setUploadState({
          status: 'error',
          progress: 0,
          error: validation.error || 'Invalid file',
          file,
        });
        return;
      }

      // Start upload
      setUploadState({
        status: 'uploading',
        progress: 0,
        error: null,
        file,
      });

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('studyId', studyId);
        formData.append('slotId', slotId);

        // Use XMLHttpRequest for progress tracking
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;

        const uploadPromise = new Promise<Document>((resolve, reject) => {
          xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
              const progress = Math.round((event.loaded / event.total) * 100);
              setUploadState((prev) => ({ ...prev, progress }));
            }
          });

          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const response = JSON.parse(xhr.responseText);
                if (response.error) {
                  reject(new Error(response.error));
                } else {
                  resolve(response.data as Document);
                }
              } catch {
                reject(new Error('Invalid response from server'));
              }
            } else {
              try {
                const response = JSON.parse(xhr.responseText);
                reject(new Error(response.error || `Upload failed with status ${xhr.status}`));
              } catch {
                reject(new Error(`Upload failed with status ${xhr.status}`));
              }
            }
          });

          xhr.addEventListener('error', () => {
            reject(new Error('Network error during upload'));
          });

          xhr.addEventListener('abort', () => {
            reject(new Error('Upload was cancelled'));
          });

          xhr.open('POST', '/api/upload');
          xhr.send(formData);
        });

        const document = await uploadPromise;

        setUploadState({
          status: 'success',
          progress: 100,
          error: null,
          file,
        });

        // Clear the XHR reference as upload completed
        xhrRef.current = null;

        // Call the success callback
        onUploadComplete?.(document);

        // Reset state after a brief delay to show success message
        successTimeoutRef.current = setTimeout(() => {
          successTimeoutRef.current = null;
          resetState();
        }, 2000);
      } catch (error) {
        setUploadState({
          status: 'error',
          progress: 0,
          error: error instanceof Error ? error.message : 'Upload failed',
          file,
        });
      }
    },
    [studyId, slotId, onUploadComplete, resetState]
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;

      // Only handle the first file
      const file = files[0];
      uploadFile(file);
    },
    [uploadFile]
  );

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

  const handleCancelClick = useCallback(() => {
    resetState();
  }, [resetState]);

  const isUploading = uploadState.status === 'uploading' || uploadState.status === 'validating';
  const isDisabled = disabled || isUploading;

  // Get status text for screen reader announcements
  const getStatusText = (): string => {
    switch (uploadState.status) {
      case 'validating':
        return 'Validating file...';
      case 'uploading':
        return `Uploading ${uploadState.file?.name ?? 'file'}: ${uploadState.progress}% complete`;
      case 'success':
        return `Upload complete: ${uploadState.file?.name ?? 'file'}`;
      case 'error':
        return `Upload failed: ${uploadState.error ?? 'Unknown error'}`;
      default:
        return '';
    }
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

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept={getAcceptString()}
        onChange={handleFileInputChange}
        disabled={isDisabled}
      />

      {/* Drop zone */}
      <div
        className={cn(
          'relative border-2 border-dashed rounded-lg p-6 transition-colors',
          'flex flex-col items-center justify-center gap-3 min-h-[160px]',
          isDragOver && !disabled && 'border-blue-500 bg-blue-50',
          !isDragOver && !disabled && 'border-gray-300 hover:border-gray-400 bg-gray-50',
          disabled && 'border-gray-200 bg-gray-100 cursor-not-allowed opacity-60',
          uploadState.status === 'error' && 'border-red-300 bg-red-50',
          uploadState.status === 'success' && 'border-green-300 bg-green-50'
        )}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Idle state */}
        {uploadState.status === 'idle' && (
          <>
            <div
              className={cn(
                'p-3 rounded-full',
                isDragOver ? 'bg-blue-100' : 'bg-gray-100'
              )}
            >
              <Upload
                className={cn(
                  'h-6 w-6',
                  isDragOver ? 'text-blue-500' : 'text-gray-400'
                )}
              />
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">
                <span className="font-medium">Drop a file here</span> or{' '}
                <button
                  type="button"
                  onClick={handleBrowseClick}
                  disabled={isDisabled}
                  className="text-blue-600 hover:text-blue-700 font-medium focus:outline-none focus:underline disabled:opacity-50"
                >
                  browse
                </button>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                PDF, Word, RTF, CSV, TXT, XPT up to {formatBytes(MAX_FILE_SIZE)}
              </p>
            </div>
          </>
        )}

        {/* Validating state */}
        {uploadState.status === 'validating' && (
          <>
            <div className="p-3 rounded-full bg-gray-100 animate-pulse">
              <FileText className="h-6 w-6 text-gray-400" />
            </div>
            <p className="text-sm text-gray-600">Validating file...</p>
          </>
        )}

        {/* Uploading state */}
        {uploadState.status === 'uploading' && uploadState.file && (
          <>
            <div className="w-full max-w-xs">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-blue-500 flex-shrink-0" />
                <span className="text-sm text-gray-700 truncate">
                  {uploadState.file.name}
                </span>
                <span className="text-xs text-gray-500 flex-shrink-0">
                  {formatBytes(uploadState.file.size)}
                </span>
              </div>
              {/* Progress bar */}
              <div
                className="w-full bg-gray-200 rounded-full h-2 overflow-hidden"
                role="progressbar"
                aria-valuenow={uploadState.progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Upload progress: ${uploadState.progress}%`}
              >
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${uploadState.progress}%` }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-xs text-gray-500">
                  {uploadState.progress}% uploaded
                </span>
                <button
                  type="button"
                  onClick={handleCancelClick}
                  className="text-xs text-gray-500 hover:text-gray-700 focus:outline-none"
                >
                  Cancel
                </button>
              </div>
            </div>
          </>
        )}

        {/* Success state */}
        {uploadState.status === 'success' && uploadState.file && (
          <>
            <div className="p-3 rounded-full bg-green-100">
              <CheckCircle className="h-6 w-6 text-green-500" />
            </div>
            <div className="text-center">
              <p className="text-sm text-green-700 font-medium">
                Upload complete!
              </p>
              <p className="text-xs text-green-600 mt-1">
                {uploadState.file.name}
              </p>
            </div>
          </>
        )}

        {/* Error state */}
        {uploadState.status === 'error' && (
          <>
            <div className="p-3 rounded-full bg-red-100">
              <AlertCircle className="h-6 w-6 text-red-500" />
            </div>
            <div className="text-center">
              <p className="text-sm text-red-700 font-medium">Upload failed</p>
              <p className="text-xs text-red-600 mt-1 max-w-xs">
                {uploadState.error}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={resetState}
              className="mt-2"
            >
              <X className="h-3 w-3 mr-1" />
              Try again
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
