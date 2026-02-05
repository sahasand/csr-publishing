import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  ChecklistResponseWithChecklist,
  CreateChecklistResponseInput,
  ChecklistItemResponse,
} from '@/types';

// API fetch functions

async function fetchDocumentChecklist(
  documentId: string
): Promise<ChecklistResponseWithChecklist | null> {
  const res = await fetch(`/api/documents/${documentId}/checklist`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
}

async function initializeChecklist({
  documentId,
  checklistId,
}: {
  documentId: string;
  checklistId: string;
}): Promise<ChecklistResponseWithChecklist> {
  const body: CreateChecklistResponseInput = { checklistId };
  const res = await fetch(`/api/documents/${documentId}/checklist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
}

async function updateChecklistResponse({
  documentId,
  responses,
}: {
  documentId: string;
  responses: ChecklistItemResponse[];
}): Promise<ChecklistResponseWithChecklist> {
  const res = await fetch(`/api/documents/${documentId}/checklist`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ responses }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
}

// Query key factory for document checklist responses
export const documentChecklistKeys = {
  all: ['document-checklists'] as const,
  detail: (documentId: string) => ['document-checklists', documentId] as const,
};

/**
 * Fetch checklist response for a document
 * Returns ChecklistResponseWithChecklist | null
 * Enabled only when documentId is provided
 */
export function useDocumentChecklist(documentId: string | undefined) {
  return useQuery({
    queryKey: documentChecklistKeys.detail(documentId ?? ''),
    queryFn: () => fetchDocumentChecklist(documentId!),
    enabled: !!documentId,
  });
}

/**
 * Mutation to create/initialize a checklist response for a document
 * Accepts { documentId, checklistId }
 * Invalidates document checklist query on success
 */
export function useInitializeChecklist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: initializeChecklist,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: documentChecklistKeys.detail(variables.documentId),
      });
    },
  });
}

/**
 * Mutation to update checklist responses for a document
 * Accepts { documentId, responses: ChecklistItemResponse[] }
 * Invalidates document checklist query on success
 */
export function useUpdateChecklistResponse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateChecklistResponse,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: documentChecklistKeys.detail(variables.documentId),
      });
    },
  });
}
