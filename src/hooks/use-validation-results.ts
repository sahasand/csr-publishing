import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  DocumentValidationResponse,
  StudyValidationResponse,
  ValidationSeverityType,
} from '@/types';
import type { ValidationSummary } from '@/lib/validation/runner';

// Options for fetching study validation
export interface UseStudyValidationOptions {
  severity?: ValidationSeverityType;
}

// API fetch functions

async function fetchDocumentValidation(
  documentId: string
): Promise<DocumentValidationResponse> {
  const res = await fetch(`/api/documents/${documentId}/validation`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
}

async function fetchStudyValidation(
  studyId: string,
  options?: UseStudyValidationOptions
): Promise<StudyValidationResponse> {
  const params = new URLSearchParams();

  if (options?.severity) {
    params.set('severity', options.severity);
  }

  const queryString = params.toString();
  const url = queryString
    ? `/api/studies/${studyId}/validation?${queryString}`
    : `/api/studies/${studyId}/validation`;

  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
}

async function runValidation(documentId: string): Promise<ValidationSummary> {
  const res = await fetch(`/api/documents/${documentId}/validate`, {
    method: 'POST',
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
}

// Query key factory for validation results
export const validationResultKeys = {
  all: ['validation-results'] as const,
  document: (documentId: string) =>
    ['validation-results', 'document', documentId] as const,
  study: (studyId: string, options?: UseStudyValidationOptions) =>
    options
      ? (['validation-results', 'study', studyId, options] as const)
      : (['validation-results', 'study', studyId] as const),
};

/**
 * Fetch validation results for a document
 * Returns DocumentValidationResponse with all results sorted by severity then ruleName
 * Enabled only when documentId is provided
 */
export function useDocumentValidation(documentId: string | undefined) {
  return useQuery({
    queryKey: validationResultKeys.document(documentId ?? ''),
    queryFn: () => fetchDocumentValidation(documentId!),
    enabled: !!documentId,
  });
}

/**
 * Fetch aggregated validation summary for a study
 * Returns StudyValidationResponse with summary and per-document breakdown
 * Enabled only when studyId is provided
 * @param studyId - The study ID
 * @param options - Optional filters: severity
 */
export function useStudyValidation(
  studyId: string | undefined,
  options?: UseStudyValidationOptions
) {
  return useQuery({
    queryKey: validationResultKeys.study(studyId ?? '', options),
    queryFn: () => fetchStudyValidation(studyId!, options),
    enabled: !!studyId,
  });
}

/**
 * Mutation to trigger validation on a document
 * Calls POST /api/documents/[id]/validate
 * Invalidates document validation query on success
 */
export function useRunValidation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: runValidation,
    onSuccess: (data, documentId) => {
      // Invalidate document validation query
      queryClient.invalidateQueries({
        queryKey: validationResultKeys.document(documentId),
      });
      // Also invalidate documents queries as validation affects document status
      queryClient.invalidateQueries({
        queryKey: ['documents'],
      });
      // Invalidate study validation queries (we don't know which study)
      queryClient.invalidateQueries({
        queryKey: ['validation-results', 'study'],
      });
    },
  });
}
