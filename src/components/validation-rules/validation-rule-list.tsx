'use client';

import { useMemo, useState } from 'react';
import {
  useValidationRules,
  useDeleteValidationRule,
} from '@/hooks/use-validation-rules';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { BadgeProps } from '@/components/ui/badge';
import { SkeletonList } from '@/components/ui/skeleton';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ValidationRuleDialog } from '@/components/validation-rules/validation-rule-dialog';
import { Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type {
  ValidationRule,
  ValidationCategoryType,
  ValidationSeverityType,
} from '@/types';

// Display order + human labels for category groupings.
const CATEGORY_ORDER: ValidationCategoryType[] = [
  'PDF_COMPLIANCE',
  'ECTD_TECHNICAL',
  'FORMATTING',
  'CONTENT',
];

const CATEGORY_LABELS: Record<ValidationCategoryType, string> = {
  PDF_COMPLIANCE: 'PDF Compliance',
  ECTD_TECHNICAL: 'eCTD Technical',
  FORMATTING: 'Formatting',
  CONTENT: 'Content',
};

function severityVariant(severity: ValidationSeverityType): BadgeProps['variant'] {
  switch (severity) {
    case 'ERROR':
      return 'destructive';
    case 'WARNING':
      return 'warning';
    case 'INFO':
    default:
      return 'info';
  }
}

export function ValidationRuleList() {
  const { data: rules, isLoading, error } = useValidationRules();
  const deleteRule = useDeleteValidationRule();

  const [editRule, setEditRule] = useState<ValidationRule | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<ValidationRule | null>(null);

  // Group rules by category in a stable display order.
  const grouped = useMemo(() => {
    const map = new Map<ValidationCategoryType, ValidationRule[]>();
    for (const rule of rules ?? []) {
      const cat = rule.category as ValidationCategoryType;
      const list = map.get(cat) ?? [];
      list.push(rule);
      map.set(cat, list);
    }
    // Sort each group by name for readability.
    for (const list of map.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    const known = CATEGORY_ORDER.filter((c) => map.has(c));
    const extra = [...map.keys()].filter((c) => !CATEGORY_ORDER.includes(c));
    return [...known, ...extra].map((cat) => ({
      category: cat,
      rules: map.get(cat) ?? [],
    }));
  }, [rules]);

  if (isLoading) {
    return <SkeletonList count={3} />;
  }

  if (error) {
    return (
      <div className="text-center py-12 text-destructive">
        Failed to load validation rules: {error.message}
      </div>
    );
  }

  if (!rules?.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No validation rules found. Create your first rule to get started.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {grouped.map(({ category, rules: groupRules }) => (
        <section key={category} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {CATEGORY_LABELS[category] ?? category}
          </h2>
          <div className="space-y-3">
            {groupRules.map((rule) => (
              <Card key={rule.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
                  <div className="min-w-0 space-y-1">
                    <CardTitle className="text-base font-semibold break-words">
                      {rule.name}
                    </CardTitle>
                    <p className="font-mono text-xs text-muted-foreground break-all">
                      {rule.checkFn}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditRule(rule);
                        setEditOpen(true);
                      }}
                      title="Edit rule"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setRuleToDelete(rule);
                        setDeleteOpen(true);
                      }}
                      disabled={deleteRule.isPending}
                      title="Delete rule"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-foreground/80">{rule.message}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">
                      {CATEGORY_LABELS[rule.category as ValidationCategoryType] ??
                        rule.category}
                    </Badge>
                    <Badge
                      variant={severityVariant(
                        rule.severity as ValidationSeverityType
                      )}
                    >
                      {rule.severity}
                    </Badge>
                    {rule.autoFix && <Badge variant="secondary">Auto-fix</Badge>}
                    <Badge variant={rule.isActive ? 'success' : 'secondary'}>
                      {rule.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ))}

      <ValidationRuleDialog
        rule={editRule}
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setEditRule(null);
        }}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Validation Rule"
        description="This deactivates the rule so it no longer runs during validation. You can recreate it later if needed."
        confirmLabel="Delete"
        variant="destructive"
        isPending={deleteRule.isPending}
        onConfirm={() => {
          if (ruleToDelete) {
            deleteRule.mutate(ruleToDelete.id, {
              onSuccess: () => {
                toast.success('Validation rule deleted');
                setDeleteOpen(false);
                setRuleToDelete(null);
              },
              onError: (err) => {
                toast.error(
                  err instanceof Error
                    ? err.message
                    : 'Failed to delete validation rule'
                );
              },
            });
          }
        }}
      />
    </div>
  );
}
