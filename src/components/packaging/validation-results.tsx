'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  FileText,
  Code,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ExportValidationResult, ValidationIssue } from '@/hooks/use-package';

interface ValidationResultsProps {
  validation: ExportValidationResult;
  className?: string;
}

interface IssueItemProps {
  issue: ValidationIssue;
}

function IssueItem({ issue }: IssueItemProps) {
  const Icon =
    issue.severity === 'ERROR'
      ? XCircle
      : issue.severity === 'WARNING'
      ? AlertTriangle
      : Info;
  const iconColor =
    issue.severity === 'ERROR'
      ? 'text-destructive'
      : issue.severity === 'WARNING'
      ? 'text-warning'
      : 'text-primary';

  return (
    <li className="flex items-start gap-2 py-1.5 text-sm">
      <Icon className={cn('h-4 w-4 shrink-0 mt-0.5', iconColor)} />
      <div className="flex-1 min-w-0">
        <span className="text-foreground/80">{issue.message}</span>
        {issue.filePath && (
          <span className="block text-xs text-muted-foreground font-mono truncate" title={issue.filePath}>
            {issue.filePath}
          </span>
        )}
      </div>
    </li>
  );
}

interface FileResultsSectionProps {
  fileResults: ExportValidationResult['packageReport']['fileResults'];
}

function FileResultsSection({ fileResults }: FileResultsSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const filesWithIssues = fileResults.filter((f) => f.errorCount > 0 || f.warningCount > 0);

  if (filesWithIssues.length === 0) {
    return null;
  }

  return (
    <div className="border-t border-border pt-3 mt-3">
      <button
        type="button"
        className="flex items-center gap-2 w-full text-left text-sm font-medium text-foreground/80 hover:text-foreground"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        <FileText className="h-4 w-4" />
        Files with Issues ({filesWithIssues.length})
      </button>

      {expanded && (
        <div className="mt-2 space-y-3 pl-6">
          {filesWithIssues.map((file) => (
            <div key={file.filePath} className="text-sm">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground truncate" title={file.filePath}>
                  {file.filePath.split('/').pop()}
                </span>
                {file.errorCount > 0 && (
                  <Badge variant="destructive" className="text-[10px]">
                    {file.errorCount} error{file.errorCount !== 1 ? 's' : ''}
                  </Badge>
                )}
                {file.warningCount > 0 && (
                  <Badge variant="warning" className="text-[10px]">
                    {file.warningCount} warning{file.warningCount !== 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
              {file.issues.length > 0 && (
                <ul className="mt-1 pl-2 border-l-2 border-border">
                  {file.issues.slice(0, 3).map((issue, idx) => (
                    <IssueItem key={`${file.filePath}-${idx}`} issue={issue} />
                  ))}
                  {file.issues.length > 3 && (
                    <li className="text-xs text-muted-foreground/70 italic py-1">
                      +{file.issues.length - 3} more issue{file.issues.length - 3 !== 1 ? 's' : ''}...
                    </li>
                  )}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ValidationResults({ validation, className }: ValidationResultsProps) {
  const [showAllIssues, setShowAllIssues] = useState(false);
  const { errorCount, warningCount, xmlValid, packageReport } = validation;
  const hasErrors = errorCount > 0;
  const hasWarnings = warningCount > 0;
  const allPassed = !hasErrors && !hasWarnings && xmlValid;

  // Collect all issues from packageReport
  const allIssues = [
    ...packageReport.packageIssues,
    ...packageReport.fileResults.flatMap((f) => f.issues),
  ];

  // Separate by severity
  const errors = allIssues.filter((i) => i.severity === 'ERROR');
  const warnings = allIssues.filter((i) => i.severity === 'WARNING');
  const infos = allIssues.filter((i) => i.severity === 'INFO');

  return (
    <Card
      className={cn(
        allPassed
          ? 'border-success/30 bg-success/10'
          : hasErrors
          ? 'border-destructive/30 bg-destructive/10'
          : 'border-warning/30 bg-warning/10',
        className
      )}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            {allPassed ? (
              <CheckCircle className="h-4 w-4 text-success" />
            ) : hasErrors ? (
              <XCircle className="h-4 w-4 text-destructive" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-warning" />
            )}
            Validation Results
          </div>
          <div className="flex items-center gap-2">
            {errorCount > 0 && (
              <Badge variant="destructive">
                {errorCount} error{errorCount !== 1 ? 's' : ''}
              </Badge>
            )}
            {warningCount > 0 && (
              <Badge variant="warning">
                {warningCount} warning{warningCount !== 1 ? 's' : ''}
              </Badge>
            )}
            {allPassed && <Badge variant="success">All Passed</Badge>}
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent>
        {/* Summary Stats */}
        <dl className="space-y-2 text-sm">
          {/* XML Validation Status */}
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground flex items-center gap-1.5">
              <Code className="h-3.5 w-3.5" />
              XML Validation
            </dt>
            <dd className="flex items-center gap-1.5">
              {xmlValid ? (
                <>
                  <CheckCircle className="h-3.5 w-3.5 text-success" />
                  <span className="text-success font-medium">Valid</span>
                </>
              ) : (
                <>
                  <XCircle className="h-3.5 w-3.5 text-destructive" />
                  <span className="text-destructive font-medium">Invalid</span>
                </>
              )}
            </dd>
          </div>

          {/* Files Validated */}
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Files Validated
            </dt>
            <dd className="font-medium text-foreground/80">
              {packageReport.summary.validatedFiles} / {packageReport.summary.totalFiles}
            </dd>
          </div>

          {/* Package Status */}
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Package Status</dt>
            <dd>
              {packageReport.valid ? (
                <span className="text-success font-medium">Valid</span>
              ) : (
                <span className="text-destructive font-medium">Has Issues</span>
              )}
            </dd>
          </div>
        </dl>

        {/* Errors Section */}
        {errors.length > 0 && (
          <div className="mt-4 pt-3 border-t border-destructive/30">
            <h4 className="text-xs font-medium text-destructive mb-2 flex items-center gap-1.5">
              <XCircle className="h-3.5 w-3.5" />
              Errors ({errors.length})
            </h4>
            <ul className="space-y-0.5">
              {(showAllIssues ? errors : errors.slice(0, 3)).map((issue, idx) => (
                <IssueItem key={`error-${idx}`} issue={issue} />
              ))}
              {!showAllIssues && errors.length > 3 && (
                <li className="text-xs text-muted-foreground/70 italic py-1">
                  +{errors.length - 3} more error{errors.length - 3 !== 1 ? 's' : ''}...
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Warnings Section */}
        {warnings.length > 0 && (
          <div className="mt-4 pt-3 border-t border-warning/30">
            <h4 className="text-xs font-medium text-warning mb-2 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              Warnings ({warnings.length})
            </h4>
            <ul className="space-y-0.5">
              {(showAllIssues ? warnings : warnings.slice(0, 3)).map((issue, idx) => (
                <IssueItem key={`warning-${idx}`} issue={issue} />
              ))}
              {!showAllIssues && warnings.length > 3 && (
                <li className="text-xs text-muted-foreground/70 italic py-1">
                  +{warnings.length - 3} more warning{warnings.length - 3 !== 1 ? 's' : ''}...
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Info Section */}
        {infos.length > 0 && (
          <div className="mt-4 pt-3 border-t border-primary/30">
            <h4 className="text-xs font-medium text-primary mb-2 flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5" />
              Info ({infos.length})
            </h4>
            <ul className="space-y-0.5">
              {(showAllIssues ? infos : infos.slice(0, 2)).map((issue, idx) => (
                <IssueItem key={`info-${idx}`} issue={issue} />
              ))}
              {!showAllIssues && infos.length > 2 && (
                <li className="text-xs text-muted-foreground/70 italic py-1">
                  +{infos.length - 2} more...
                </li>
              )}
            </ul>
          </div>
        )}

        {/* File Results (Expandable) */}
        <FileResultsSection fileResults={packageReport.fileResults} />

        {/* Show All Toggle */}
        {allIssues.length > 5 && (
          <div className="mt-4 pt-3 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={() => setShowAllIssues(!showAllIssues)}
            >
              {showAllIssues ? 'Show Less' : `Show All ${allIssues.length} Issues`}
            </Button>
          </div>
        )}

        {/* All Passed Message */}
        {allPassed && (
          <div className="mt-4 pt-3 border-t border-success/30">
            <p className="text-sm text-success text-center">
              All validation checks passed. Package is ready for submission.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
