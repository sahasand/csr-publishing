import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  AnnotationWithReplies,
  CreateAnnotationInput,
  UpdateAnnotationInput,
  CreateAnnotationReplyInput,
  AnnotationReply,
} from '@/types';

// API fetch functions

async function fetchDocumentAnnotations(documentId: string): Promise<AnnotationWithReplies[]> {
  const res = await fetch(`/api/documents/${documentId}/annotations`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
}

async function createAnnotation({
  documentId,
  data,
}: {
  documentId: string;
  data: CreateAnnotationInput;
}): Promise<AnnotationWithReplies> {
  const res = await fetch(`/api/documents/${documentId}/annotations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
}

async function updateAnnotation({
  id,
  data,
}: {
  id: string;
  data: UpdateAnnotationInput;
}): Promise<AnnotationWithReplies> {
  const res = await fetch(`/api/annotations/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
}

async function deleteAnnotation(id: string): Promise<{ success: boolean }> {
  const res = await fetch(`/api/annotations/${id}`, { method: 'DELETE' });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
}

async function createReply({
  annotationId,
  data,
}: {
  annotationId: string;
  data: CreateAnnotationReplyInput;
}): Promise<AnnotationReply> {
  const res = await fetch(`/api/annotations/${annotationId}/replies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
}

// Query key factory for annotations
export const annotationKeys = {
  all: ['annotations'] as const,
  document: (documentId: string) => ['annotations', 'document', documentId] as const,
};

/**
 * Fetch annotations for a document with nested replies
 * Enabled only when documentId is provided
 */
export function useDocumentAnnotations(documentId: string | undefined) {
  return useQuery({
    queryKey: annotationKeys.document(documentId ?? ''),
    queryFn: () => fetchDocumentAnnotations(documentId!),
    enabled: !!documentId,
  });
}

/**
 * Mutation to create a new annotation
 * Invalidates document annotations query on success
 */
export function useCreateAnnotation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createAnnotation,
    onSuccess: (data) => {
      // Invalidate annotations for the document
      queryClient.invalidateQueries({
        queryKey: annotationKeys.document(data.documentId),
      });
    },
  });
}

/**
 * Mutation to update an annotation
 * Invalidates annotations query on success
 */
export function useUpdateAnnotation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateAnnotation,
    onSuccess: (data) => {
      // Invalidate annotations for the document
      queryClient.invalidateQueries({
        queryKey: annotationKeys.document(data.documentId),
      });
    },
  });
}

/**
 * Mutation to delete an annotation
 * Uses optimistic update to remove from list immediately
 * Rolls back on error
 */
export function useDeleteAnnotation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      documentId,
    }: {
      id: string;
      documentId: string;
    }) => deleteAnnotation(id),
    onMutate: async ({ id, documentId }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: annotationKeys.document(documentId),
      });

      // Snapshot the previous value
      const previousAnnotations = queryClient.getQueryData<AnnotationWithReplies[]>(
        annotationKeys.document(documentId)
      );

      // Optimistically remove the annotation from the list
      if (previousAnnotations) {
        queryClient.setQueryData<AnnotationWithReplies[]>(
          annotationKeys.document(documentId),
          previousAnnotations.filter((annotation) => annotation.id !== id)
        );
      }

      // Return context with the snapshot
      return { previousAnnotations, documentId };
    },
    onError: (err, variables, context) => {
      // Rollback to the previous value on error
      if (context?.previousAnnotations) {
        queryClient.setQueryData(
          annotationKeys.document(context.documentId),
          context.previousAnnotations
        );
      }
    },
    onSettled: (data, error, variables) => {
      // Always refetch after error or success
      queryClient.invalidateQueries({
        queryKey: annotationKeys.document(variables.documentId),
      });
    },
  });
}

/**
 * Mutation to add a reply to an annotation
 * Invalidates annotations query on success
 */
export function useCreateReply() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createReply,
    onSuccess: (data, variables) => {
      // We need documentId to invalidate the right query
      // The reply contains annotationId, so we invalidate all annotation queries
      // A more targeted approach would require passing documentId to the mutation
      queryClient.invalidateQueries({
        queryKey: annotationKeys.all,
      });
    },
  });
}

/**
 * Enhanced version of useCreateReply that accepts documentId for targeted invalidation
 */
export function useCreateReplyWithDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      annotationId,
      documentId,
      data,
    }: {
      annotationId: string;
      documentId: string;
      data: CreateAnnotationReplyInput;
    }) => createReply({ annotationId, data }),
    onSuccess: (data, variables) => {
      // Invalidate annotations for the specific document
      queryClient.invalidateQueries({
        queryKey: annotationKeys.document(variables.documentId),
      });
    },
  });
}
