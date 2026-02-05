import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  ValidationRule,
  CreateValidationRuleInput,
  UpdateValidationRuleInput,
  ValidationCategoryType,
} from '@/types';

// Options for fetching validation rules list
export interface UseValidationRulesOptions {
  category?: ValidationCategoryType;
  isActive?: boolean;
}

// API fetch functions

async function fetchValidationRules(
  options?: UseValidationRulesOptions
): Promise<ValidationRule[]> {
  const params = new URLSearchParams();

  if (options?.category) {
    params.set('category', options.category);
  }
  if (options?.isActive !== undefined) {
    params.set('active', String(options.isActive));
  }

  const queryString = params.toString();
  const url = queryString
    ? `/api/validation-rules?${queryString}`
    : '/api/validation-rules';

  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
}

async function fetchValidationRule(id: string): Promise<ValidationRule> {
  const res = await fetch(`/api/validation-rules/${id}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
}

async function createValidationRule(
  data: CreateValidationRuleInput
): Promise<ValidationRule> {
  const res = await fetch('/api/validation-rules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
}

async function updateValidationRule({
  id,
  data,
}: {
  id: string;
  data: UpdateValidationRuleInput;
}): Promise<ValidationRule> {
  const res = await fetch(`/api/validation-rules/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
}

async function deleteValidationRule(id: string): Promise<ValidationRule> {
  const res = await fetch(`/api/validation-rules/${id}`, { method: 'DELETE' });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
}

// Query key factory for validation rules
export const validationRuleKeys = {
  all: ['validation-rules'] as const,
  list: (options?: UseValidationRulesOptions) =>
    options ? (['validation-rules', options] as const) : (['validation-rules'] as const),
  detail: (id: string) => ['validation-rules', 'detail', id] as const,
};

/**
 * Fetch all validation rules with optional filtering
 * @param options - Optional filters: category, isActive
 */
export function useValidationRules(options?: UseValidationRulesOptions) {
  return useQuery({
    queryKey: validationRuleKeys.list(options),
    queryFn: () => fetchValidationRules(options),
  });
}

/**
 * Fetch a single validation rule by ID
 * Enabled only when id is provided
 */
export function useValidationRule(id: string | undefined) {
  return useQuery({
    queryKey: validationRuleKeys.detail(id ?? ''),
    queryFn: () => fetchValidationRule(id!),
    enabled: !!id,
  });
}

/**
 * Mutation to create a new validation rule
 * Invalidates validation rules list query on success
 */
export function useCreateValidationRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createValidationRule,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: validationRuleKeys.all,
      });
    },
  });
}

/**
 * Mutation to update a validation rule
 * Invalidates both list and detail queries on success
 */
export function useUpdateValidationRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateValidationRule,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: validationRuleKeys.all,
      });
      queryClient.invalidateQueries({
        queryKey: validationRuleKeys.detail(variables.id),
      });
    },
  });
}

/**
 * Mutation to soft-delete a validation rule (sets isActive=false)
 * Invalidates validation rules list query on success
 */
export function useDeleteValidationRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteValidationRule,
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: validationRuleKeys.all,
      });
      queryClient.invalidateQueries({
        queryKey: validationRuleKeys.detail(data.id),
      });
    },
  });
}
