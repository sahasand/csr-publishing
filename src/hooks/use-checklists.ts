import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  ChecklistWithCount,
  ChecklistWithItems,
  Checklist,
  ChecklistItem,
  CreateChecklistInput,
  UpdateChecklistInput,
  CreateChecklistItemInput,
  UpdateChecklistItemInput,
} from '@/types';

// API fetch functions

async function fetchChecklists(): Promise<ChecklistWithCount[]> {
  const res = await fetch('/api/checklists');
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
}

async function fetchChecklist(id: string): Promise<ChecklistWithItems> {
  const res = await fetch(`/api/checklists/${id}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
}

async function createChecklist(data: CreateChecklistInput): Promise<Checklist> {
  const res = await fetch('/api/checklists', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
}

async function updateChecklist({
  id,
  data,
}: {
  id: string;
  data: UpdateChecklistInput;
}): Promise<Checklist> {
  const res = await fetch(`/api/checklists/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
}

async function deleteChecklist(id: string): Promise<{ success: boolean }> {
  const res = await fetch(`/api/checklists/${id}`, { method: 'DELETE' });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
}

async function createChecklistItem({
  checklistId,
  data,
}: {
  checklistId: string;
  data: CreateChecklistItemInput;
}): Promise<ChecklistItem> {
  const res = await fetch(`/api/checklists/${checklistId}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
}

async function updateChecklistItem({
  checklistId,
  itemId,
  data,
}: {
  checklistId: string;
  itemId: string;
  data: UpdateChecklistItemInput;
}): Promise<ChecklistItem> {
  const res = await fetch(`/api/checklists/${checklistId}/items/${itemId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
}

async function deleteChecklistItem({
  checklistId,
  itemId,
}: {
  checklistId: string;
  itemId: string;
}): Promise<{ success: boolean }> {
  const res = await fetch(`/api/checklists/${checklistId}/items/${itemId}`, {
    method: 'DELETE',
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
}

// Query key factory for checklists
export const checklistKeys = {
  all: ['checklists'] as const,
  detail: (id: string) => ['checklists', id] as const,
};

/**
 * Fetch all checklists with item counts
 */
export function useChecklists() {
  return useQuery({
    queryKey: checklistKeys.all,
    queryFn: fetchChecklists,
  });
}

/**
 * Fetch a single checklist with its items
 * Enabled only when id is provided
 */
export function useChecklist(id: string | undefined) {
  return useQuery({
    queryKey: checklistKeys.detail(id ?? ''),
    queryFn: () => fetchChecklist(id!),
    enabled: !!id,
  });
}

/**
 * Mutation to create a new checklist
 * Invalidates checklists list query on success
 */
export function useCreateChecklist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createChecklist,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: checklistKeys.all,
      });
    },
  });
}

/**
 * Mutation to update a checklist
 * Invalidates both checklists list and detail queries on success
 */
export function useUpdateChecklist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateChecklist,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: checklistKeys.all,
      });
      queryClient.invalidateQueries({
        queryKey: checklistKeys.detail(variables.id),
      });
    },
  });
}

/**
 * Mutation to delete a checklist
 * Invalidates checklists list query on success
 */
export function useDeleteChecklist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteChecklist,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: checklistKeys.all,
      });
    },
  });
}

/**
 * Mutation to add an item to a checklist
 * Invalidates single checklist query on success
 */
export function useCreateChecklistItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createChecklistItem,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: checklistKeys.detail(variables.checklistId),
      });
    },
  });
}

/**
 * Mutation to update a checklist item
 * Invalidates single checklist query on success
 */
export function useUpdateChecklistItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateChecklistItem,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: checklistKeys.detail(variables.checklistId),
      });
    },
  });
}

/**
 * Mutation to delete a checklist item
 * Uses optimistic update to remove from list immediately
 * Rolls back on error
 */
export function useDeleteChecklistItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteChecklistItem,
    onMutate: async ({ checklistId, itemId }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: checklistKeys.detail(checklistId),
      });

      // Snapshot the previous value
      const previousChecklist = queryClient.getQueryData<ChecklistWithItems>(
        checklistKeys.detail(checklistId)
      );

      // Optimistically remove the item from the checklist
      if (previousChecklist) {
        queryClient.setQueryData<ChecklistWithItems>(
          checklistKeys.detail(checklistId),
          {
            ...previousChecklist,
            items: previousChecklist.items.filter((item) => item.id !== itemId),
          }
        );
      }

      // Return context with the snapshot
      return { previousChecklist, checklistId };
    },
    onError: (err, variables, context) => {
      // Rollback to the previous value on error
      if (context?.previousChecklist) {
        queryClient.setQueryData(
          checklistKeys.detail(context.checklistId),
          context.previousChecklist
        );
      }
    },
    onSettled: (data, error, variables) => {
      // Always refetch after error or success
      queryClient.invalidateQueries({
        queryKey: checklistKeys.detail(variables.checklistId),
      });
    },
  });
}
