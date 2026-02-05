import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { BulkTransitionInput, BulkTransitionResult } from '@/types';

async function bulkTransition(
  studyId: string,
  data: BulkTransitionInput
): Promise<BulkTransitionResult> {
  const res = await fetch(`/api/studies/${studyId}/bulk-transition`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to bulk transition documents');
  return json.data;
}

export function useBulkTransition(studyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: BulkTransitionInput) => bulkTransition(studyId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', 'study', studyId] });
      queryClient.invalidateQueries({ queryKey: ['studies', studyId] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['pending-review-count'] });
    },
  });
}
