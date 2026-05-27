'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ValidationResultList } from '@/components/validation/validation-result-list';
import {
  useDocumentValidation,
  useRunValidation,
} from '@/hooks/use-validation-results';
import { toast } from 'sonner';
import {
  Loader2,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
} from 'lucide-react';

export interface DocumentValidationPanelProps {
  documentId: string;
}

/**
 * Validation tab content for the document viewer.
 *
 * Shows the per-rule PDF/eCTD compliance results (pass/fail + message) for a
 * single document, grouped by category, with a button to (re)run validation.
 */
export function DocumentValidationPanel({ documentId }: DocumentValidationPanelProps) {
  const { data, isLoading, error } = useDocumentValidation(documentId);
  const runValidation = useRunValidation();

  const handleRun = async () => {
    try {
      await runValidation.mutateAsync(documentId);
      toast.success('Validation complete');
    } catch {
      toast.error('Failed to run validation');
    }
  };

  const hasResults = !!data && data.total > 0;
  const hasErrors = !!data && data.errors > 0;
  const hasWarnings = !!data && data.warnings > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Validation</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRun}
          disabled={runValidation.isPending}
        >
          {runValidation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          {hasResults ? 'Re-validate' : 'Validate'}
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/70" />
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-sm text-destructive">
          Failed to load validation results
        </p>
      )}

      {/* Empty — never validated */}
      {!isLoading && !error && !hasResults && (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <ShieldQuestion className="h-8 w-8 text-muted-foreground/70" />
          <p className="text-sm text-muted-foreground">
            No validation results yet.
          </p>
          <p className="text-xs text-muted-foreground">
            Run validation to check this document for PDF/eCTD compliance.
          </p>
        </div>
      )}

      {/* Results */}
      {!isLoading && !error && hasResults && data && (
        <>
          {/* Summary banner */}
          <div
            className={cn(
              'flex items-center gap-2 p-3 rounded-md',
              hasErrors
                ? 'bg-destructive/10'
                : hasWarnings
                ? 'bg-warning/10'
                : 'bg-success/10'
            )}
          >
            {hasErrors ? (
              <ShieldAlert className="h-5 w-5 text-destructive flex-shrink-0" />
            ) : hasWarnings ? (
              <ShieldAlert className="h-5 w-5 text-warning flex-shrink-0" />
            ) : (
              <ShieldCheck className="h-5 w-5 text-success flex-shrink-0" />
            )}
            <div className="text-xs">
              <p className="font-medium text-foreground">
                {data.passed} of {data.total} checks passed
              </p>
              {(hasErrors || hasWarnings) && (
                <p className="text-muted-foreground">
                  {data.errors > 0 && (
                    <span className="text-destructive">
                      {data.errors} error{data.errors !== 1 ? 's' : ''}
                    </span>
                  )}
                  {data.errors > 0 && data.warnings > 0 && ', '}
                  {data.warnings > 0 && (
                    <span className="text-warning">
                      {data.warnings} warning{data.warnings !== 1 ? 's' : ''}
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>

          {/* Grouped result list */}
          <ValidationResultList results={data.results} />
        </>
      )}
    </div>
  );
}
