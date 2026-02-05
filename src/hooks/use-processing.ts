import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Job status type matching the Prisma enum
export type JobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export type JobType = 'PDF_CONVERSION' | 'PDF_VALIDATION' | 'METADATA_EXTRACTION' | 'PACKAGE_EXPORT';

// Latest processing job structure returned from document APIs
export interface LatestProcessingJob {
  id: string;
  jobType: JobType;
  status: JobStatus;
  progress: number;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}

// Full job status response from GET /api/jobs/[id]
export interface JobStatusResponse {
  id: string;
  documentId: string;
  jobType: JobType;
  status: JobStatus;
  progress: number;
  error: string | null;
  result: Record<string, unknown> | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  document: {
    id: string;
    sourceFileName: string;
    status: string;
    studyId: string;
    slotId: string;
  };
  queue: {
    attemptsMade: number;
    attemptsTotal: number;
    state: string;
    progress: number;
    failedReason: string | null;
  } | null;
}

// Retry response from POST /api/jobs/[id]/retry
export interface RetryJobResponse {
  id: string;
  documentId: string;
  jobType: JobType;
  status: JobStatus;
  createdAt: string;
  retriedFrom: string;
}

async function fetchJobStatus(jobId: string): Promise<JobStatusResponse> {
  const res = await fetch(`/api/jobs/${jobId}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to fetch job status');
  return json.data;
}

async function retryJob(jobId: string): Promise<RetryJobResponse> {
  const res = await fetch(`/api/jobs/${jobId}/retry`, {
    method: 'POST',
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to retry job');
  return json.data;
}

/**
 * Hook to fetch and optionally poll job status
 * @param jobId - The job ID to fetch
 * @param options - Query options
 * @param options.enabled - Whether to enable the query (default: true if jobId is provided)
 * @param options.polling - Whether to poll for updates (default: false)
 * @param options.pollingInterval - Polling interval in ms (default: 2000)
 */
export function useJobStatus(
  jobId: string | null | undefined,
  options: {
    enabled?: boolean;
    polling?: boolean;
    pollingInterval?: number;
  } = {}
) {
  const { enabled = true, polling = false, pollingInterval = 2000 } = options;

  return useQuery({
    queryKey: ['job', jobId],
    queryFn: () => fetchJobStatus(jobId!),
    enabled: enabled && !!jobId,
    refetchInterval: (query) => {
      if (!polling) return false;
      // Stop polling when job is completed or failed
      const status = query.state.data?.status;
      if (status === 'COMPLETED' || status === 'FAILED') {
        return false;
      }
      return pollingInterval;
    },
    staleTime: polling ? 0 : 30000, // Keep data fresh when polling
  });
}

/**
 * Hook to poll for processing job status changes
 * Useful for documents that are currently being processed
 * @param jobId - The job ID to poll
 * @param options - Polling options
 */
export function useProcessingJobPolling(
  jobId: string | null | undefined,
  options: {
    enabled?: boolean;
    interval?: number;
    onComplete?: (data: JobStatusResponse) => void;
    onError?: (data: JobStatusResponse) => void;
  } = {}
) {
  const { enabled = true, interval = 2000, onComplete, onError } = options;
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['job', jobId, 'polling'],
    queryFn: () => fetchJobStatus(jobId!),
    enabled: enabled && !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      // Stop polling when job reaches terminal state
      if (status === 'COMPLETED') {
        if (onComplete && query.state.data) {
          onComplete(query.state.data);
        }
        // Invalidate related queries to refresh data
        queryClient.invalidateQueries({ queryKey: ['documents'] });
        return false;
      }
      if (status === 'FAILED') {
        if (onError && query.state.data) {
          onError(query.state.data);
        }
        return false;
      }
      return interval;
    },
    staleTime: 0,
  });
}

/**
 * Hook to retry a failed job
 * Invalidates related queries on success
 */
export function useRetryJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: retryJob,
    onSuccess: (data) => {
      // Invalidate the old job query
      queryClient.invalidateQueries({ queryKey: ['job', data.retriedFrom] });
      // Invalidate the new job query
      queryClient.invalidateQueries({ queryKey: ['job', data.id] });
      // Invalidate document queries to refresh the document status
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}

/**
 * Helper to determine if a job is in an active/processing state
 */
export function isJobActive(status: JobStatus | undefined | null): boolean {
  return status === 'PENDING' || status === 'RUNNING';
}

/**
 * Helper to determine if a job has failed
 */
export function isJobFailed(status: JobStatus | undefined | null): boolean {
  return status === 'FAILED';
}

/**
 * Helper to determine if a job has completed successfully
 */
export function isJobCompleted(status: JobStatus | undefined | null): boolean {
  return status === 'COMPLETED';
}
