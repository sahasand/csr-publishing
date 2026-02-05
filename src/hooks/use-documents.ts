import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { DocumentWithRelations } from '@/types';

async function fetchStudyDocuments(studyId: string): Promise<DocumentWithRelations[]> {
  const res = await fetch(`/api/studies/${studyId}/documents`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
}

async function deleteDocument(id: string): Promise<void> {
  const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const json = await res.json();
    throw new Error(json.error);
  }
}

export function useStudyDocuments(studyId: string) {
  return useQuery({
    queryKey: ['documents', 'study', studyId],
    queryFn: () => fetchStudyDocuments(studyId),
    enabled: !!studyId,
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => {
      // Invalidate all document queries to ensure lists are refreshed
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      // Also invalidate studies to update document counts
      queryClient.invalidateQueries({ queryKey: ['studies'] });
    },
  });
}
