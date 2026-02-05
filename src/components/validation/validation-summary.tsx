'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  Play,
  RefreshCw,
} from 'lucide-react';

export interface ValidationSummaryData {
  passed: number;
  failed: number;
  errors: number;
  warnings: number;
  total?: number;
}

export interface ValidationSummaryProps {
  documentId: string;
  summary: ValidationSummaryData | null;
  onRunValidation: () => void;
  isLoading?: boolean;
  isRunning?: boolean;
}

/**
 * Validation summary component
 * Shows:
 * - Pass/fail counts with icons (CheckCircle, XCircle)
 * - Color-coded: green for pass, red for errors, yellow for warnings
 * - Progress bar showing pass percentage
 * - "Run Validation" button to trigger validation
 */
export function ValidationSummary({
  documentId,
  summary,
  onRunValidation,
  isLoading = false,
  isRunning = false,
}: ValidationSummaryProps) {
  // Calculate totals
  const total = summary?.total ?? (summary ? summary.passed + summary.failed : 0);
  const passPercentage = total > 0 && summary ? Math.round((summary.passed / total) * 100) : 0;

  // Determine overall status
  const hasErrors = summary ? summary.errors > 0 : false;
  const hasWarnings = summary ? summary.warnings > 0 : false;
  const allPassed = summary ? summary.failed === 0 && total > 0 : false;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/70" />
      </div>
    );
  }

  // No validation results yet
  if (!summary || total === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          No validation results yet. Run validation to check this document.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={onRunValidation}
          disabled={isRunning}
        >
          {isRunning ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Run Validation
            </>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-2">
        {/* Passed */}
        <div className="flex items-center gap-2 p-2 bg-success/10 rounded-md">
          <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />
          <div>
            <p className="text-lg font-semibold text-success">{summary.passed}</p>
            <p className="text-xs text-success">Passed</p>
          </div>
        </div>

        {/* Failed */}
        <div className="flex items-center gap-2 p-2 bg-destructive/10 rounded-md">
          <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
          <div>
            <p className="text-lg font-semibold text-destructive">{summary.failed}</p>
            <p className="text-xs text-destructive">Failed</p>
          </div>
        </div>
      </div>

      {/* Error/Warning Breakdown */}
      {(hasErrors || hasWarnings) && (
        <div className="flex items-center gap-2 text-xs">
          {hasErrors && (
            <Badge variant="destructive" className="gap-1">
              <XCircle className="h-3 w-3" />
              {summary.errors} error{summary.errors !== 1 ? 's' : ''}
            </Badge>
          )}
          {hasWarnings && (
            <Badge variant="warning" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              {summary.warnings} warning{summary.warnings !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      )}

      {/* Progress Bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Pass Rate</span>
          <span className="font-medium">{passPercentage}%</span>
        </div>
        <div
          className="h-2 bg-muted/60 rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={passPercentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${passPercentage}% of validations passed`}
        >
          <div
            className={cn(
              'h-full transition-all duration-300',
              allPassed
                ? 'bg-success'
                : hasErrors
                ? 'bg-destructive'
                : hasWarnings
                ? 'bg-warning'
                : 'bg-primary'
            )}
            style={{ width: `${passPercentage}%` }}
          />
        </div>
      </div>

      {/* Status Message */}
      {allPassed && (
        <div className="flex items-start gap-2 p-2 bg-success/10 rounded-md">
          <CheckCircle className="h-4 w-4 text-success flex-shrink-0 mt-0.5" />
          <p className="text-xs text-success">All validation checks passed</p>
        </div>
      )}

      {hasErrors && (
        <div className="flex items-start gap-2 p-2 bg-destructive/10 rounded-md">
          <XCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
          <p className="text-xs text-destructive">
            {summary.errors} validation error{summary.errors !== 1 ? 's' : ''} need
            attention
          </p>
        </div>
      )}

      {!hasErrors && hasWarnings && (
        <div className="flex items-start gap-2 p-2 bg-warning/10 rounded-md">
          <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
          <p className="text-xs text-warning">
            {summary.warnings} warning{summary.warnings !== 1 ? 's' : ''} to review
          </p>
        </div>
      )}

      {/* Re-run Validation Button */}
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={onRunValidation}
        disabled={isRunning}
      >
        {isRunning ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Running...
          </>
        ) : (
          <>
            <RefreshCw className="h-4 w-4 mr-2" />
            Re-run Validation
          </>
        )}
      </Button>
    </div>
  );
}
