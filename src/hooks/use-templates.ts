import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { StructureTemplate, StructureNode, PaginatedResponse } from '@/types';

interface TemplateWithCounts extends StructureTemplate {
  _count?: {
    nodes: number;
    studies: number;
  };
}

interface TemplateWithNodes extends StructureTemplate {
  nodes: StructureNode[];
}

interface UseTemplatesOptions {
  page?: number;
  pageSize?: number;
}

async function fetchTemplates(options: UseTemplatesOptions = {}): Promise<PaginatedResponse<TemplateWithCounts>> {
  const params = new URLSearchParams();
  if (options.page) params.set('page', String(options.page));
  if (options.pageSize) params.set('pageSize', String(options.pageSize));
  const query = params.toString();
  const res = await fetch(`/api/templates${query ? `?${query}` : ''}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return { data: json.data, pagination: json.pagination };
}

async function fetchTemplate(id: string): Promise<TemplateWithNodes> {
  const res = await fetch(`/api/templates/${id}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
}

async function createTemplate(data: { name: string; isDefault?: boolean; useStandardSections?: boolean }): Promise<StructureTemplate> {
  const res = await fetch('/api/templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
}

async function updateTemplate({ id, data }: { id: string; data: { name?: string; isDefault?: boolean } }): Promise<StructureTemplate> {
  const res = await fetch(`/api/templates/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
}

async function deleteTemplate(id: string): Promise<void> {
  const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const json = await res.json();
    throw new Error(json.error);
  }
}

export function useTemplates(options: UseTemplatesOptions = {}) {
  const { page, pageSize } = options;
  return useQuery({
    queryKey: ['templates', { page, pageSize }],
    queryFn: () => fetchTemplates({ page, pageSize }),
  });
}

export function useTemplate(id: string) {
  return useQuery({
    queryKey: ['templates', id],
    queryFn: () => fetchTemplate(id),
    enabled: !!id,
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateTemplate,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      queryClient.invalidateQueries({ queryKey: ['templates', data.id] });
    },
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}
