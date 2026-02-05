import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { StudyWithTemplate, CreateStudyInput, UpdateStudyInput } from '@/types';

async function fetchStudies(): Promise<StudyWithTemplate[]> {
  const res = await fetch('/api/studies');
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
}

async function fetchStudy(id: string): Promise<StudyWithTemplate> {
  const res = await fetch(`/api/studies/${id}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
}

async function createStudy(data: CreateStudyInput): Promise<StudyWithTemplate> {
  const res = await fetch('/api/studies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
}

async function updateStudy({
  id,
  data,
}: {
  id: string;
  data: UpdateStudyInput;
}): Promise<StudyWithTemplate> {
  const res = await fetch(`/api/studies/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
}

async function deleteStudy(id: string): Promise<void> {
  const res = await fetch(`/api/studies/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const json = await res.json();
    throw new Error(json.error);
  }
}

export function useStudies() {
  return useQuery({
    queryKey: ['studies'],
    queryFn: fetchStudies,
  });
}

export function useStudy(id: string) {
  return useQuery({
    queryKey: ['studies', id],
    queryFn: () => fetchStudy(id),
    enabled: !!id,
  });
}

export function useCreateStudy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createStudy,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studies'] });
    },
  });
}

export function useUpdateStudy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateStudy,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['studies'] });
      queryClient.invalidateQueries({ queryKey: ['studies', data.id] });
    },
  });
}

export function useDeleteStudy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteStudy,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studies'] });
    },
  });
}
