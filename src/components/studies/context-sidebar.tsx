'use client';

import * as React from 'react';
import { cn, formatBytes, formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Info,
  FileText,
  Upload,
  Trash2,
  AlertCircle,
  FileQuestion,
  Loader2,
  RefreshCw,
  ClipboardCheck,
  Shield,
  ChevronDown,
  ChevronRight,
  Package,
} from 'lucide-react';
import type { StructureNode, Document, LatestProcessingJob } from '@/types';
import { useRetryJob, useProcessingJobPolling, isJobActive } from '@/hooks/use-processing';
import { useDocumentChecklist, useInitializeChecklist } from '@/hooks/use-checklist-response';
import { useDocumentValidation, useRunValidation } from '@/hooks/use-validation-results';
import { ChecklistSelector } from '@/components/checklists/checklist-selector';
import { ChecklistPanel } from '@/components/checklists/checklist-panel';
import { ValidationSummary } from '@/components/validation/validation-summary';
import { ValidationResultList } from '@/components/validation/validation-result-list';
import { ReadinessPanel, ExportButton, PackageStatus } from '@/components/packaging';
import type { ExportResult } from '@/hooks/use-package';

// Document status type from Prisma schema
type DocumentStatus =
  | 'DRAFT'
  | 'PROCESSING'
  | 'PROCESSED'
  | 'PROCESSING_FAILED'
  | 'IN_REVIEW'
  | 'CORRECTIONS_NEEDED'
  | 'APPROVED'
  | 'PUBLISHED';

// Extended Document type that includes the processing job
interface DocumentWithProcessing extends Document {
  latestProcessingJob?: LatestProcessingJob | null;
}

export interface ContextSidebarProps {
  studyId: string;
  node: StructureNode | null;
  document: DocumentWithProcessing | null;
  onUploadClick?: () => void;
  onDeleteClick?: () => void;
  onStatusChange?: (status: DocumentStatus) => void;
}

// Status badge configuration
const statusConfig: Record<
  DocumentStatus,
  { variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'; label: string }
> = {
  DRAFT: { variant: 'secondary', label: 'Draft' },
  PROCESSING: { variant: 'warning', label: 'Processing' },
  PROCESSED: { variant: 'default', label: 'Processed' },
  PROCESSING_FAILED: { variant: 'destructive', label: 'Failed' },
  IN_REVIEW: { variant: 'default', label: 'In Review' },
  CORRECTIONS_NEEDED: { variant: 'warning', label: 'Corrections Needed' },
  APPROVED: { variant: 'success', label: 'Approved' },
  PUBLISHED: { variant: 'success', label: 'Published' },
};

// Document type badge configuration
const documentTypeBadgeConfig: Record<
  string,
  { variant: 'default' | 'secondary' | 'outline'; label: string }
> = {
  PDF: { variant: 'default', label: 'PDF' },
  DATASET: { variant: 'secondary', label: 'Dataset' },
  LISTING: { variant: 'secondary', label: 'Listing' },
  FIGURE: { variant: 'secondary', label: 'Figure' },
  OTHER: { variant: 'outline', label: 'Other' },
};

// Statuses that can be manually changed
const manualStatusOptions: { value: DocumentStatus; label: string }[] = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'IN_REVIEW', label: 'In Review' },
  { value: 'CORRECTIONS_NEEDED', label: 'Corrections Needed' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'PUBLISHED', label: 'Published' },
];

export function ContextSidebar({
  studyId,
  node,
  document,
  onUploadClick,
  onDeleteClick,
  onStatusChange,
}: ContextSidebarProps) {
  const retryJob = useRetryJob();
  const initializeChecklist = useInitializeChecklist();
  const runValidation = useRunValidation();

  // State for expandable validation details
  const [isValidationExpanded, setIsValidationExpanded] = React.useState(false);

  // State for packaging section
  const [isPackagingExpanded, setIsPackagingExpanded] = React.useState(true);
  const [exportResult, setExportResult] = React.useState<ExportResult | null>(null);

  // Handle export completion
  const handleExportComplete = (result: ExportResult) => {
    setExportResult(result);
  };

  // Fetch checklist response for document (if document exists)
  const { data: checklistResponse, isLoading: isChecklistLoading } = useDocumentChecklist(
    document?.id
  );

  // Fetch validation results for document
  const {
    data: validationData,
    isLoading: isValidationLoading,
  } = useDocumentValidation(document?.id);

  // Handle checklist initialization
  const handleInitializeChecklist = (checklistId: string) => {
    if (document?.id) {
      initializeChecklist.mutate({ documentId: document.id, checklistId });
    }
  };

  // Handle run validation
  const handleRunValidation = () => {
    if (document?.id) {
      runValidation.mutate(document.id);
    }
  };

  // Get latest processing job info
  const processingJob = document?.latestProcessingJob;
  const isProcessing = document?.status === 'PROCESSING';
  const isFailed = document?.status === 'PROCESSING_FAILED';

  // Poll for job status updates when processing
  const shouldPoll = !!(isProcessing && processingJob && isJobActive(processingJob.status));
  const { data: polledJobStatus } = useProcessingJobPolling(
    shouldPoll ? processingJob?.id : null,
    { enabled: shouldPoll }
  );

  // Use polled data if available, otherwise use cached data
  const currentJobProgress = polledJobStatus?.progress ?? processingJob?.progress ?? 0;
  const currentJobStatus = polledJobStatus?.status ?? processingJob?.status;

  // Build validation summary from API response
  const validationSummary = validationData
    ? {
        passed: validationData.passed,
        failed: validationData.failed,
        errors: validationData.errors,
        warnings: validationData.warnings,
        total: validationData.total,
      }
    : null;

  const hasSelection = node || document;

  // Handle retry button click
  const handleRetryClick = () => {
    if (processingJob?.id) {
      retryJob.mutate(processingJob.id);
    }
  };

  if (!hasSelection) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-2 mb-4">
          <Info className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm text-foreground/80">Details</h2>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
          <FileQuestion className="h-12 w-12 mb-4 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground mb-1">No selection</p>
          <p className="text-xs text-muted-foreground/70">
            Select a section or document to view details
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <Info className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-semibold text-sm text-foreground/80">Details</h2>
      </div>

      <div className="space-y-4 overflow-y-auto flex-1">
        {/* Node Details Section */}
        {node && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Section Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Code</dt>
                  <dd className="font-mono font-medium text-foreground">
                    {node.code}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Title</dt>
                  <dd className="font-medium text-foreground">{node.title}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Document Type</dt>
                  <dd>
                    {node.documentType ? (
                      <Badge
                        variant={
                          documentTypeBadgeConfig[node.documentType]?.variant ||
                          'outline'
                        }
                      >
                        {documentTypeBadgeConfig[node.documentType]?.label ||
                          node.documentType}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground/70">Not specified</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Required</dt>
                  <dd>
                    <Badge variant={node.required ? 'warning' : 'secondary'}>
                      {node.required ? 'Required' : 'Optional'}
                    </Badge>
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        )}

        {/* Document Details Section */}
        {document && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground/70" />
                Document Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Filename</dt>
                  <dd
                    className="font-medium text-foreground truncate"
                    title={document.sourceFileName}
                  >
                    {document.sourceFileName}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Version</dt>
                  <dd className="font-medium text-foreground">
                    v{document.version}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Status</dt>
                  <dd>
                    <Badge
                      variant={
                        statusConfig[document.status as DocumentStatus]
                          ?.variant || 'secondary'
                      }
                    >
                      {statusConfig[document.status as DocumentStatus]?.label ||
                        document.status}
                    </Badge>
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        )}

        {/* Processing Status Section */}
        {document && (isProcessing || isFailed) && processingJob && (
          <Card className={cn(isFailed && 'border-destructive/30 bg-destructive/10')}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-destructive" />
                )}
                Processing Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* Job Type */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Job Type</span>
                  <Badge variant="outline">
                    {processingJob.jobType.replace(/_/g, ' ')}
                  </Badge>
                </div>

                {/* Status */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <Badge
                    variant={
                      currentJobStatus === 'RUNNING'
                        ? 'warning'
                        : currentJobStatus === 'COMPLETED'
                        ? 'success'
                        : currentJobStatus === 'FAILED'
                        ? 'destructive'
                        : 'secondary'
                    }
                  >
                    {currentJobStatus}
                  </Badge>
                </div>

                {/* Progress Bar for Processing */}
                {isProcessing && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="text-foreground/80">{currentJobProgress}%</span>
                    </div>
                    <div
                      className="h-2 bg-muted/60 rounded-full overflow-hidden"
                      role="progressbar"
                      aria-valuenow={currentJobProgress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className="h-full bg-amber-500 transition-all duration-300"
                        style={{ width: `${currentJobProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Error Message */}
                {isFailed && processingJob.error && (
                  <div className="p-2 bg-destructive/10 rounded-md">
                    <p className="text-xs text-destructive font-medium mb-1">Error:</p>
                    <p className="text-xs text-destructive">{processingJob.error}</p>
                  </div>
                )}

                {/* Retry Button */}
                {isFailed && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={handleRetryClick}
                    disabled={retryJob.isPending}
                  >
                    {retryJob.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Retrying...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Retry Processing
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Document Metadata Section */}
        {document && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Metadata</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">File Size</dt>
                  <dd className="font-medium text-foreground">
                    {formatBytes(document.fileSize)}
                  </dd>
                </div>
                {document.pageCount !== null && document.pageCount !== undefined && (
                  <div>
                    <dt className="text-muted-foreground">Page Count</dt>
                    <dd className="font-medium text-foreground">
                      {document.pageCount} {document.pageCount === 1 ? 'page' : 'pages'}
                    </dd>
                  </div>
                )}
                {document.pdfVersion && (
                  <div>
                    <dt className="text-muted-foreground">PDF Version</dt>
                    <dd className="font-medium text-foreground">
                      {document.pdfVersion}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-muted-foreground">PDF/A Compliant</dt>
                  <dd>
                    <Badge variant={document.isPdfA ? 'success' : 'outline'}>
                      {document.isPdfA ? 'Yes' : 'No'}
                    </Badge>
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Created</dt>
                  <dd className="text-foreground">{formatDate(document.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Last Updated</dt>
                  <dd className="text-foreground">{formatDate(document.updatedAt)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        )}

        {/* Validation Section - Enhanced with new components */}
        {document && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground/70" />
                  Validation
                </div>
                {validationSummary && validationSummary.total > 0 && (
                  <Badge
                    variant={
                      validationSummary.errors > 0
                        ? 'destructive'
                        : validationSummary.warnings > 0
                        ? 'warning'
                        : 'success'
                    }
                  >
                    {validationSummary.failed === 0
                      ? 'Passed'
                      : `${validationSummary.failed} issue${validationSummary.failed !== 1 ? 's' : ''}`}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ValidationSummary
                documentId={document.id}
                summary={validationSummary}
                onRunValidation={handleRunValidation}
                isLoading={isValidationLoading}
                isRunning={runValidation.isPending}
              />

              {/* Expandable Validation Details */}
              {validationData && validationData.results.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border">
                  <button
                    type="button"
                    className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setIsValidationExpanded(!isValidationExpanded)}
                    aria-expanded={isValidationExpanded}
                    aria-controls="validation-details"
                  >
                    <span className="font-medium">View Details</span>
                    {isValidationExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>

                  {isValidationExpanded && (
                    <div
                      id="validation-details"
                      className="mt-3"
                    >
                      <ValidationResultList results={validationData.results} />
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* QC Checklist Section */}
        {document && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-muted-foreground/70" />
                  QC Checklist
                </div>
                {checklistResponse && (
                  <Badge
                    variant={checklistResponse.completedAt ? 'success' : 'secondary'}
                  >
                    {checklistResponse.completedAt ? 'Complete' : 'In Progress'}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isChecklistLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/70" />
                </div>
              ) : checklistResponse ? (
                <ChecklistPanel documentId={document.id} />
              ) : (
                <ChecklistSelector
                  documentId={document.id}
                  onInitialize={handleInitializeChecklist}
                  isInitializing={initializeChecklist.isPending}
                />
              )}
            </CardContent>
          </Card>
        )}

        {/* Packaging Section - Collapsible */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              <button
                type="button"
                className="w-full flex items-center justify-between"
                onClick={() => setIsPackagingExpanded(!isPackagingExpanded)}
                aria-expanded={isPackagingExpanded}
                aria-controls="packaging-section"
              >
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground/70" />
                  Packaging
                </div>
                {isPackagingExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground/70" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground/70" />
                )}
              </button>
            </CardTitle>
          </CardHeader>
          {isPackagingExpanded && (
            <CardContent id="packaging-section">
              <div className="space-y-4">
                {/* Show export result if available */}
                {exportResult ? (
                  <PackageStatus
                    result={exportResult}
                    onDownload={() => {
                      window.location.href = exportResult.downloadUrl;
                    }}
                  />
                ) : (
                  <>
                    {/* Readiness Panel */}
                    <ReadinessPanel studyId={studyId} />

                    {/* Export Button */}
                    <ExportButton
                      studyId={studyId}
                      onExportComplete={handleExportComplete}
                    />
                  </>
                )}

                {/* Clear export result link */}
                {exportResult && (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground underline hover:no-underline w-full text-center"
                    onClick={() => setExportResult(null)}
                  >
                    Export another package
                  </button>
                )}
              </div>
            </CardContent>
          )}
        </Card>

        {/* Quick Actions Section */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Upload Button */}
              {node && onUploadClick && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={onUploadClick}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Document
                </Button>
              )}

              {/* Status Change Dropdown */}
              {document && onStatusChange && (
                <div className="space-y-1.5">
                  <label
                    htmlFor="status-select"
                    className="text-xs text-muted-foreground"
                  >
                    Change Status
                  </label>
                  <Select
                    id="status-select"
                    value={document.status}
                    onChange={(e) =>
                      onStatusChange(e.target.value as DocumentStatus)
                    }
                    aria-label="Change document status"
                  >
                    {manualStatusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </div>
              )}

              {/* Delete Button */}
              {document && onDeleteClick && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={onDeleteClick}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Document
                </Button>
              )}

              {/* Show message if no actions available */}
              {node && !document && !onUploadClick && (
                <p className="text-xs text-muted-foreground/70 text-center py-2">
                  No actions available
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
