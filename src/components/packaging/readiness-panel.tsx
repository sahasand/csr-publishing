'use client';

import { usePackageReadiness } from '@/hooks/use-package';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReadinessPanelProps {
  studyId: string;
}

interface ReadinessItemProps {
  label: string;
  passed: boolean;
  value: string;
  warning?: boolean;
}

function ReadinessItem({ label, passed, value, warning }: ReadinessItemProps) {
  const Icon = passed ? CheckCircle : warning ? AlertTriangle : XCircle;
  const iconColor = passed
    ? 'text-success'
    : warning
    ? 'text-warning'
    : 'text-destructive';

  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2">
        <Icon className={cn('h-4 w-4', iconColor)} />
        <span className="text-sm text-foreground/80">{label}</span>
      </div>
      <span
        className={cn(
          'text-sm font-medium',
          passed ? 'text-muted-foreground' : warning ? 'text-warning' : 'text-destructive'
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function ReadinessPanel({ studyId }: ReadinessPanelProps) {
  const { data, isLoading, error, refetch } = usePackageReadiness(studyId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Package Readiness</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/70" />
            <span className="ml-2 text-sm text-muted-foreground">Checking readiness...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/30 bg-destructive/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-destructive" />
            Package Readiness
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive mb-2">
            {error instanceof Error ? error.message : 'Failed to check readiness'}
          </p>
          <button
            type="button"
            className="text-xs text-destructive underline hover:no-underline"
            onClick={() => refetch()}
          >
            Retry
          </button>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  const { readiness } = data;
  const {
    ready,
    missingRequired,
    pendingApproval,
    validationErrors,
    unresolvedAnnotations,
    totalFiles,
    totalRequiredNodes,
  } = readiness;

  const requiredNodesPassed = missingRequired.length === 0;
  const validationPassed = validationErrors === 0;
  const annotationsPassed = unresolvedAnnotations === 0;

  // Calculate how many required nodes have documents
  const populatedRequiredNodes = totalRequiredNodes - missingRequired.length;

  return (
    <Card className={cn(ready ? 'border-success/30' : 'border-warning/30')}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span>Package Readiness</span>
          <Badge variant={ready ? 'success' : 'warning'}>
            {ready ? 'Ready' : 'Not Ready'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {/* Required nodes status */}
          <ReadinessItem
            label="Required Sections"
            passed={requiredNodesPassed}
            value={`${populatedRequiredNodes}/${totalRequiredNodes}`}
          />

          {/* Total documents ready */}
          <ReadinessItem
            label="Documents Ready"
            passed={totalFiles > 0}
            warning={totalFiles > 0 && !ready}
            value={String(totalFiles)}
          />

          {/* Pending approval count - informational, not blocking */}
          {pendingApproval.length > 0 && (
            <ReadinessItem
              label="Pending Approval"
              passed={true}
              warning={true}
              value={String(pendingApproval.length)}
            />
          )}

          {/* Validation errors */}
          <ReadinessItem
            label="Validation Errors"
            passed={validationPassed}
            value={validationErrors === 0 ? 'None' : String(validationErrors)}
          />

          {/* Unresolved annotations */}
          <ReadinessItem
            label="Unresolved Corrections"
            passed={annotationsPassed}
            value={unresolvedAnnotations === 0 ? 'None' : String(unresolvedAnnotations)}
          />
        </div>

        {/* Missing required nodes list */}
        {missingRequired.length > 0 && (
          <div className="mt-4 pt-3 border-t border-border">
            <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
              <XCircle className="h-3.5 w-3.5 text-destructive" />
              Missing Required Sections ({missingRequired.length})
            </h4>
            <ul className="space-y-1.5">
              {missingRequired.slice(0, 5).map((node) => (
                <li
                  key={node.nodeId}
                  className="text-xs text-muted-foreground flex items-start gap-2"
                >
                  <span className="font-mono text-muted-foreground shrink-0">{node.code}</span>
                  <span className="truncate">{node.title}</span>
                </li>
              ))}
              {missingRequired.length > 5 && (
                <li className="text-xs text-muted-foreground/70 italic">
                  +{missingRequired.length - 5} more...
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Pending approval documents list */}
        {pendingApproval.length > 0 && (
          <div className="mt-4 pt-3 border-t border-border">
            <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-warning" />
              Pending Approval ({pendingApproval.length})
            </h4>
            <ul className="space-y-1.5">
              {pendingApproval.slice(0, 5).map((doc) => (
                <li
                  key={doc.documentId}
                  className="text-xs text-muted-foreground flex items-center justify-between gap-2"
                >
                  <span className="truncate" title={doc.fileName}>
                    {doc.fileName}
                  </span>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {doc.status.replace(/_/g, ' ')}
                  </Badge>
                </li>
              ))}
              {pendingApproval.length > 5 && (
                <li className="text-xs text-muted-foreground/70 italic">
                  +{pendingApproval.length - 5} more...
                </li>
              )}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
