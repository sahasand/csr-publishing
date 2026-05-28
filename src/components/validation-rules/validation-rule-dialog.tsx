'use client';

import { useState } from 'react';
import {
  useCreateValidationRule,
  useUpdateValidationRule,
} from '@/hooks/use-validation-rules';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import type {
  ValidationRule,
  ValidationCategoryType,
  ValidationSeverityType,
} from '@/types';

const CATEGORIES: ValidationCategoryType[] = [
  'PDF_COMPLIANCE',
  'ECTD_TECHNICAL',
  'FORMATTING',
  'CONTENT',
];

const SEVERITIES: ValidationSeverityType[] = ['ERROR', 'WARNING', 'INFO'];

export interface ValidationRuleDialogProps {
  /** Rule to edit. When null/undefined the dialog operates in create mode. */
  rule?: ValidationRule | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Hooks return params as an object; the raw Prisma type stores a JSON string. */
function paramsToText(params: unknown): string {
  let obj: unknown = params;
  if (typeof params === 'string') {
    try {
      obj = JSON.parse(params || '{}');
    } catch {
      obj = {};
    }
  }
  if (obj === null || obj === undefined) obj = {};
  return JSON.stringify(obj, null, 2);
}

/**
 * Create/edit dialog for a validation rule. A single component handles both
 * modes: when given a `rule` it updates, otherwise it creates.
 *
 * The `params` field is edited as a JSON string and parsed to an object on
 * submit; invalid JSON surfaces an inline error and blocks submission.
 *
 * The outer component remounts the form (via `key`) each time the dialog opens
 * for a rule, so form state is seeded from props without a syncing effect.
 */
export function ValidationRuleDialog({
  rule,
  open,
  onOpenChange,
}: ValidationRuleDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        {open && (
          <ValidationRuleForm
            key={rule?.id ?? 'new'}
            rule={rule ?? null}
            onOpenChange={onOpenChange}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface ValidationRuleFormProps {
  rule: ValidationRule | null;
  onOpenChange: (open: boolean) => void;
}

function ValidationRuleForm({ rule, onOpenChange }: ValidationRuleFormProps) {
  const createRule = useCreateValidationRule();
  const updateRule = useUpdateValidationRule();
  const isEdit = !!rule;

  const [name, setName] = useState(rule?.name ?? '');
  const [category, setCategory] = useState<ValidationCategoryType>(
    (rule?.category as ValidationCategoryType) ?? 'PDF_COMPLIANCE'
  );
  const [severity, setSeverity] = useState<ValidationSeverityType>(
    (rule?.severity as ValidationSeverityType) ?? 'ERROR'
  );
  const [checkFn, setCheckFn] = useState(rule?.checkFn ?? '');
  const [message, setMessage] = useState(rule?.message ?? '');
  const [autoFix, setAutoFix] = useState(!!rule?.autoFix);
  const [isActive, setIsActive] = useState(rule?.isActive ?? true);
  const [paramsText, setParamsText] = useState(() => paramsToText(rule?.params));
  const [paramsError, setParamsError] = useState<string | null>(null);

  const isPending = createRule.isPending || updateRule.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let params: Record<string, unknown>;
    try {
      const parsed = JSON.parse(paramsText.trim() || '{}');
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setParamsError('Params must be a JSON object, e.g. { "maxMB": 100 }');
        return;
      }
      params = parsed as Record<string, unknown>;
    } catch {
      setParamsError('Invalid JSON. Please enter a valid JSON object.');
      return;
    }
    setParamsError(null);

    try {
      if (rule) {
        await updateRule.mutateAsync({
          id: rule.id,
          data: {
            name: name.trim(),
            category,
            severity,
            checkFn: checkFn.trim(),
            message: message.trim(),
            params,
            autoFix,
            isActive,
          },
        });
        toast.success('Validation rule updated');
      } else {
        await createRule.mutateAsync({
          name: name.trim(),
          category,
          severity,
          checkFn: checkFn.trim(),
          message: message.trim(),
          params,
          autoFix,
          isActive,
        });
        toast.success('Validation rule created');
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to save validation rule'
      );
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEdit ? 'Edit Validation Rule' : 'New Validation Rule'}</DialogTitle>
        <DialogDescription className="text-left">
          {isEdit
            ? 'Update the configuration for this validation rule.'
            : 'Define a new PDF/eCTD validation rule.'}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="flex flex-col">
        {/* Scrollable field area so the header and footer stay pinned */}
        <div className="space-y-4 overflow-y-auto max-h-[55vh] px-6">
          <div>
            <label className="block text-sm font-medium text-foreground/80 mb-1.5">
              Name *
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., pdf-file-size"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                Category
              </label>
              <Select
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as ValidationCategoryType)
                }
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                Severity
              </label>
              <Select
                value={severity}
                onChange={(e) =>
                  setSeverity(e.target.value as ValidationSeverityType)
                }
              >
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground/80 mb-1.5">
              Check Function *
            </label>
            <Input
              value={checkFn}
              onChange={(e) => setCheckFn(e.target.value)}
              placeholder="e.g., checkFileSize"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground/80 mb-1.5">
              Message *
            </label>
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g., File size exceeds maximum limit of 100MB"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground/80 mb-1.5">
              Params (JSON)
            </label>
            <textarea
              value={paramsText}
              onChange={(e) => {
                setParamsText(e.target.value);
                if (paramsError) setParamsError(null);
              }}
              rows={4}
              spellCheck={false}
              className="flex w-full rounded-[var(--radius-md)] border border-border bg-background px-3 py-2 font-mono text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
              placeholder='{ "maxMB": 100 }'
            />
            {paramsError ? (
              <p className="text-xs text-destructive mt-1">{paramsError}</p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">
                Configuration passed to the check function. Must be a JSON object.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="autoFix"
              checked={autoFix}
              onChange={(e) => setAutoFix(e.target.checked)}
            />
            <label htmlFor="autoFix" className="text-sm text-foreground/80">
              Auto-fix issues when possible
            </label>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <label htmlFor="isActive" className="text-sm text-foreground/80">
              Active (rule runs during validation)
            </label>
          </div>
        </div>

        <DialogFooter className="mt-4 pt-3 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={
              isPending || !name.trim() || !checkFn.trim() || !message.trim()
            }
          >
            {isPending
              ? 'Saving...'
              : isEdit
                ? 'Save Changes'
                : 'Create Rule'}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
