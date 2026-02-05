import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Query key factory
export const packageKeys = {
  all: ['packages'] as const,
  readiness: (studyId: string) => [...packageKeys.all, 'readiness', studyId] as const,
};

// Types matching API response structure
export interface MissingRequiredNode {
  code: string;
  title: string;
  nodeId: string;
}

export interface PendingDocument {
  documentId: string;
  fileName: string;
  status: string;
  nodeCode: string;
  nodeTitle: string;
}

export interface ReadinessStatus {
  ready: boolean;
  missingRequired: MissingRequiredNode[];
  pendingApproval: PendingDocument[];
  validationErrors: number;
  unresolvedAnnotations: number;
  totalFiles: number;
  totalRequiredNodes: number;
}

export interface PackageReadinessResponse {
  studyId: string;
  studyNumber: string;
  sponsor: string;
  readiness: ReadinessStatus;
}

export interface ValidationIssue {
  severity: 'ERROR' | 'WARNING' | 'INFO';
  check: string;
  message: string;
  filePath?: string;
  documentId?: string;
}

export interface FileValidationResult {
  filePath: string;
  documentId: string;
  accessible: boolean;
  errorCount: number;
  warningCount: number;
  issues: ValidationIssue[];
}

export interface ExportValidationResult {
  xmlValid: boolean;
  errorCount: number;
  warningCount: number;
  packageReport: {
    valid: boolean;
    ready: boolean;
    validatedAt: string;
    studyId: string;
    studyNumber: string;
    summary: {
      totalFiles: number;
      validatedFiles: number;
      inaccessibleFiles: number;
      errorCount: number;
      warningCount: number;
      infoCount: number;
    };
    fileResults: FileValidationResult[];
    packageIssues: ValidationIssue[];
    issueCount: {
      total: number;
      errors: number;
      warnings: number;
      info: number;
    };
  };
}

export interface ExportResult {
  packageId: string;
  studyId: string;
  studyNumber: string;
  sponsor: string;
  zipSize: number;
  fileCount: number;
  downloadUrl: string;
  validation?: ExportValidationResult;
}

// API functions
async function fetchPackageReadiness(studyId: string): Promise<PackageReadinessResponse> {
  const res = await fetch(`/api/studies/${studyId}/package`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
}

async function exportPackage({
  studyId,
  force = false,
}: {
  studyId: string;
  force?: boolean;
}): Promise<ExportResult> {
  const res = await fetch(`/api/studies/${studyId}/package`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ force }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
}

/**
 * Hook to fetch package readiness status for a study
 */
export function usePackageReadiness(studyId: string) {
  return useQuery({
    queryKey: packageKeys.readiness(studyId),
    queryFn: () => fetchPackageReadiness(studyId),
    enabled: !!studyId,
    // Refresh every 30 seconds to catch status changes
    refetchInterval: 30000,
    // Stale after 10 seconds
    staleTime: 10000,
  });
}

/**
 * Hook to trigger package export
 */
export function useExportPackage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: exportPackage,
    onSuccess: (data) => {
      // Invalidate readiness query to reflect any changes
      queryClient.invalidateQueries({
        queryKey: packageKeys.readiness(data.studyId),
      });
    },
  });
}

/**
 * Trigger file download from URL
 */
export function triggerDownload(url: string, filename?: string) {
  const link = document.createElement('a');
  link.href = url;
  if (filename) {
    link.download = filename;
  }
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
