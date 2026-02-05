'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Shield,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useStudyValidation } from '@/hooks/use-validation-results';
import type {
  StudyValidationSummaryStats,
  DocumentValidationSummary,
} from '@/types';

export interface StudyValidationPanelProps {
  studyId: string;
  onDocumentClick?: (documentId: string, slotId?: string) => void;
}

/**
 * Study-level validation dashboard panel
 * Shows:
 * - Summary: X documents validated, Y with errors, Z with warnings
 * - List of documents with issues (clickable to navigate)
 * - Color-coded status indicators
 */
export function StudyValidationPanel({
  studyId,
  onDocumentClick,
}: StudyValidationPanelProps) {
  const [isExpanded, setIsExpanded] = React.useState(true);
  const [showAllDocuments, setShowAllDocuments] = React.useState(false);

  const { data, isLoading, error } = useStudyValidation(studyId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="h-4 w-4 text-gray-400" />
            Study Validation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="h-4 w-4 text-gray-400" />
            Study Validation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-500">Failed to load validation data</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="h-4 w-4 text-gray-400" />
            Study Validation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">No validation data available</p>
        </CardContent>
      </Card>
    );
  }

  const { summary, documents } = data;

  // Get documents with issues (errors or warnings)
  const documentsWithIssues = documents.filter(
    (doc) => doc.hasErrors || doc.hasWarnings
  );

  // Documents to display in the list
  const displayDocuments = showAllDocuments
    ? documents
    : documentsWithIssues.slice(0, 5);

  // Determine overall status
  const hasErrors = summary.documentsWithErrors > 0;
  const hasWarnings = summary.documentsWithWarnings > 0;
  const allValid =
    summary.validatedDocuments > 0 &&
    summary.validDocuments === summary.validatedDocuments;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">
          <button
            type="button"
            className="w-full flex items-center justify-between"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-expanded={isExpanded}
            aria-controls="study-validation-content"
          >
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-gray-400" />
              Study Validation
            </div>
            <div className="flex items-center gap-2">
              {/* Status badge */}
              {summary.validatedDocuments > 0 && (
                <Badge
                  variant={
                    hasErrors
                      ? 'destructive'
                      : hasWarnings
                      ? 'warning'
                      : 'success'
                  }
                >
                  {hasErrors
                    ? `${summary.documentsWithErrors} error${summary.documentsWithErrors !== 1 ? 's' : ''}`
                    : hasWarnings
                    ? `${summary.documentsWithWarnings} warning${summary.documentsWithWarnings !== 1 ? 's' : ''}`
                    : 'Valid'}
                </Badge>
              )}
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-400" />
              )}
            </div>
          </button>
        </CardTitle>
      </CardHeader>

      {isExpanded && (
        <CardContent id="study-validation-content">
          <div className="space-y-4">
            {/* Summary Stats */}
            <ValidationSummaryStats summary={summary} />

            {/* Documents List */}
            {documents.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-medium text-gray-700">
                    {showAllDocuments
                      ? 'All Documents'
                      : documentsWithIssues.length > 0
                      ? 'Documents with Issues'
                      : 'Recent Documents'}
                  </h4>
                  {documents.length > 5 && (
                    <button
                      type="button"
                      className="text-xs text-blue-600 hover:text-blue-800"
                      onClick={() => setShowAllDocuments(!showAllDocuments)}
                    >
                      {showAllDocuments
                        ? 'Show issues only'
                        : `Show all (${documents.length})`}
                    </button>
                  )}
                </div>

                <div className="space-y-1">
                  {displayDocuments.length > 0 ? (
                    displayDocuments.map((doc) => (
                      <DocumentValidationItem
                        key={doc.documentId}
                        document={doc}
                        onClick={
                          onDocumentClick
                            ? () => onDocumentClick(doc.documentId)
                            : undefined
                        }
                      />
                    ))
                  ) : (
                    <p className="text-xs text-gray-500 py-2">
                      No documents with issues
                    </p>
                  )}
                </div>

                {/* Show more indicator */}
                {!showAllDocuments && documentsWithIssues.length > 5 && (
                  <p className="text-xs text-gray-500 text-center">
                    +{documentsWithIssues.length - 5} more with issues
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                No documents have been validated yet
              </p>
            )}

            {/* Status message */}
            {allValid && summary.validatedDocuments > 0 && (
              <div className="flex items-start gap-2 p-2 bg-green-50 rounded-md">
                <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-green-700">
                  All validated documents pass validation checks
                </p>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

/**
 * Summary statistics display
 */
function ValidationSummaryStats({
  summary,
}: {
  summary: StudyValidationSummaryStats;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {/* Validated Documents */}
      <div className="p-2 bg-gray-50 rounded-md">
        <p className="text-lg font-semibold text-gray-900">
          {summary.validatedDocuments}
        </p>
        <p className="text-xs text-gray-500">
          of {summary.totalDocuments} validated
        </p>
      </div>

      {/* Valid Documents */}
      <div
        className={cn(
          'p-2 rounded-md',
          summary.documentsWithErrors > 0
            ? 'bg-red-50'
            : summary.documentsWithWarnings > 0
            ? 'bg-yellow-50'
            : 'bg-green-50'
        )}
      >
        <p
          className={cn(
            'text-lg font-semibold',
            summary.documentsWithErrors > 0
              ? 'text-red-700'
              : summary.documentsWithWarnings > 0
              ? 'text-yellow-700'
              : 'text-green-700'
          )}
        >
          {summary.validDocuments}
        </p>
        <p
          className={cn(
            'text-xs',
            summary.documentsWithErrors > 0
              ? 'text-red-600'
              : summary.documentsWithWarnings > 0
              ? 'text-yellow-600'
              : 'text-green-600'
          )}
        >
          passing
        </p>
      </div>

      {/* Errors */}
      {summary.documentsWithErrors > 0 && (
        <div className="flex items-center gap-2 p-2 bg-red-50 rounded-md col-span-2">
          <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-700">
              {summary.documentsWithErrors}
            </p>
            <p className="text-xs text-red-600">with errors</p>
          </div>
        </div>
      )}

      {/* Warnings (only show if no errors) */}
      {summary.documentsWithErrors === 0 && summary.documentsWithWarnings > 0 && (
        <div className="flex items-center gap-2 p-2 bg-yellow-50 rounded-md col-span-2">
          <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-yellow-700">
              {summary.documentsWithWarnings}
            </p>
            <p className="text-xs text-yellow-600">with warnings</p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Individual document validation item
 */
function DocumentValidationItem({
  document,
  onClick,
}: {
  document: DocumentValidationSummary;
  onClick?: () => void;
}) {
  const hasErrors = document.hasErrors;
  const hasWarnings = document.hasWarnings;

  const content = (
    <div
      className={cn(
        'flex items-center gap-2 p-2 rounded-md text-left w-full',
        onClick && 'hover:bg-gray-100 cursor-pointer',
        hasErrors
          ? 'bg-red-50/50'
          : hasWarnings
          ? 'bg-yellow-50/50'
          : 'bg-green-50/50'
      )}
    >
      {/* Status icon */}
      {hasErrors ? (
        <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
      ) : hasWarnings ? (
        <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0" />
      ) : (
        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
      )}

      {/* Document info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-900 truncate">
          {document.documentName}
        </p>
        <p className="text-xs text-gray-500">
          <span className="font-mono">{document.slotCode}</span>
          {' - '}
          {document.errors > 0 && (
            <span className="text-red-600">
              {document.errors} error{document.errors !== 1 ? 's' : ''}
            </span>
          )}
          {document.errors > 0 && document.warnings > 0 && ', '}
          {document.warnings > 0 && (
            <span className="text-yellow-600">
              {document.warnings} warning{document.warnings !== 1 ? 's' : ''}
            </span>
          )}
          {document.errors === 0 && document.warnings === 0 && (
            <span className="text-green-600">Valid</span>
          )}
        </p>
      </div>

      {/* Click indicator */}
      {onClick && (
        <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
      )}
    </div>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="w-full">
        {content}
      </button>
    );
  }

  return content;
}
