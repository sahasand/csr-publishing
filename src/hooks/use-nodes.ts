import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { StructureNode, CreateNodeInput, UpdateNodeInput, ReorderNodesInput } from '@/types';

// Fetch all nodes for a template
async function fetchTemplateNodes(templateId: string): Promise<StructureNode[]> {
  const res = await fetch(`/api/templates/${templateId}/nodes`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
}

// Fetch a single node by ID
async function fetchNode(nodeId: string): Promise<StructureNode> {
  const res = await fetch(`/api/nodes/${nodeId}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
}

// Create a new node
async function createNode({
  templateId,
  data,
}: {
  templateId: string;
  data: CreateNodeInput;
}): Promise<StructureNode> {
  const res = await fetch(`/api/templates/${templateId}/nodes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
}

// Update a node
async function updateNode({
  nodeId,
  data,
}: {
  nodeId: string;
  data: UpdateNodeInput;
}): Promise<StructureNode> {
  const res = await fetch(`/api/nodes/${nodeId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
}

// Delete a node
async function deleteNode({
  nodeId,
}: {
  nodeId: string;
  templateId: string;
}): Promise<{ success: boolean; deletedCount: number }> {
  const res = await fetch(`/api/nodes/${nodeId}`, { method: 'DELETE' });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
}

// Batch reorder nodes
async function reorderNodes(
  input: ReorderNodesInput
): Promise<{ success: boolean; updatedCount: number }> {
  const res = await fetch('/api/nodes/reorder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
}

/**
 * Hook to fetch all nodes for a template
 */
export function useTemplateNodes(templateId: string) {
  return useQuery({
    queryKey: ['templates', templateId, 'nodes'],
    queryFn: () => fetchTemplateNodes(templateId),
    enabled: !!templateId,
  });
}

/**
 * Hook to fetch a single node by ID
 */
export function useNode(nodeId: string) {
  return useQuery({
    queryKey: ['nodes', nodeId],
    queryFn: () => fetchNode(nodeId),
    enabled: !!nodeId,
  });
}

/**
 * Hook to create a new node
 */
export function useCreateNode(templateId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateNodeInput) => createNode({ templateId, data }),
    onSuccess: () => {
      // Invalidate the template nodes query
      queryClient.invalidateQueries({ queryKey: ['templates', templateId, 'nodes'] });
      // Also invalidate the template query (which includes nodes)
      queryClient.invalidateQueries({ queryKey: ['templates', templateId] });
    },
  });
}

/**
 * Hook to update a node
 */
export function useUpdateNode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ nodeId, data }: { nodeId: string; data: UpdateNodeInput }) =>
      updateNode({ nodeId, data }),
    onSuccess: (updatedNode) => {
      // Invalidate the specific node query
      queryClient.invalidateQueries({ queryKey: ['nodes', updatedNode.id] });
      // Invalidate the template nodes query
      queryClient.invalidateQueries({
        queryKey: ['templates', updatedNode.templateId, 'nodes'],
      });
      // Also invalidate the template query (which includes nodes)
      queryClient.invalidateQueries({ queryKey: ['templates', updatedNode.templateId] });
    },
  });
}

/**
 * Hook to delete a node
 */
export function useDeleteNode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteNode,
    onSuccess: (_data, { nodeId, templateId }) => {
      // Invalidate the specific node query
      queryClient.invalidateQueries({ queryKey: ['nodes', nodeId] });
      // Invalidate only the relevant template queries
      queryClient.invalidateQueries({ queryKey: ['templates', templateId, 'nodes'] });
      queryClient.invalidateQueries({ queryKey: ['templates', templateId] });
    },
  });
}

/**
 * Hook to reorder nodes (batch update sortOrder and optionally parentId)
 * Includes optimistic updates for smooth UX
 */
export function useReorderNodes(templateId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: reorderNodes,
    onMutate: async (input) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['templates', templateId, 'nodes'] });
      await queryClient.cancelQueries({ queryKey: ['templates', templateId] });

      // Snapshot the previous values
      const previousNodes = queryClient.getQueryData<StructureNode[]>([
        'templates',
        templateId,
        'nodes',
      ]);

      // Optimistically update the cache
      if (previousNodes) {
        const updatesMap = new Map(input.updates.map((u) => [u.id, u]));
        const updatedNodes = previousNodes.map((node) => {
          const update = updatesMap.get(node.id);
          if (update) {
            return {
              ...node,
              sortOrder: update.sortOrder,
              ...(update.parentId !== undefined && { parentId: update.parentId }),
            };
          }
          return node;
        });
        queryClient.setQueryData(['templates', templateId, 'nodes'], updatedNodes);
      }

      return { previousNodes };
    },
    onError: (_err, _input, context) => {
      // Rollback to previous value on error
      if (context?.previousNodes) {
        queryClient.setQueryData(
          ['templates', templateId, 'nodes'],
          context.previousNodes
        );
      }
    },
    onSettled: () => {
      // Always refetch after error or success to ensure server state
      queryClient.invalidateQueries({ queryKey: ['templates', templateId, 'nodes'] });
      queryClient.invalidateQueries({ queryKey: ['templates', templateId] });
    },
  });
}
