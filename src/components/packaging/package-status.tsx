'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Package, FileText, CheckCircle, AlertTriangle } from 'lucide-react';
import { formatBytes, cn } from '@/lib/utils';
import type { ExportResult } from '@/hooks/use-package';
import { ValidationResults } from './validation-results';

interface PackageStatusProps {
  result: ExportResult;
  onDownload?: () => void;
  showValidation?: boolean;
}

export function PackageStatus({ result, onDownload, showValidation = true }: PackageStatusProps) {
  const handleDownload = () => {
    if (onDownload) {
      onDownload();
    } else {
      // Default: open download URL
      window.location.href = result.downloadUrl;
    }
  };

  // Determine overall status based on validation
  const hasValidationErrors = result.validation && result.validation.errorCount > 0;
  const cardBorderColor = hasValidationErrors
    ? 'border-yellow-200 bg-yellow-50/30'
    : 'border-green-200 bg-green-50/30';

  return (
    <div className="space-y-4">
      <Card className={cardBorderColor}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              {hasValidationErrors ? (
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
              ) : (
                <CheckCircle className="h-4 w-4 text-green-500" />
              )}
              Package Ready
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant="success">Exported</Badge>
              {hasValidationErrors && (
                <Badge variant="warning">Has Issues</Badge>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-3 text-sm">
            {/* Package ID */}
            <div className="flex items-center justify-between">
              <dt className="text-gray-500 flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5" />
                Package ID
              </dt>
              <dd className="font-mono text-xs text-gray-700 truncate max-w-[180px]" title={result.packageId}>
                {result.packageId.slice(0, 8)}...
              </dd>
            </div>

            {/* Study Number */}
            <div className="flex items-center justify-between">
              <dt className="text-gray-500">Study</dt>
              <dd className="font-medium text-gray-700">{result.studyNumber}</dd>
            </div>

            {/* File Count */}
            <div className="flex items-center justify-between">
              <dt className="text-gray-500 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Files Included
              </dt>
              <dd className="font-medium text-gray-700">
                {result.fileCount} {result.fileCount === 1 ? 'file' : 'files'}
              </dd>
            </div>

            {/* ZIP Size */}
            <div className="flex items-center justify-between">
              <dt className="text-gray-500">Package Size</dt>
              <dd className="font-medium text-gray-700">
                {formatBytes(result.zipSize)}
              </dd>
            </div>

            {/* Quick validation summary if present */}
            {result.validation && (
              <div className="flex items-center justify-between">
                <dt className="text-gray-500">Validation</dt>
                <dd className="flex items-center gap-2">
                  {result.validation.errorCount === 0 && result.validation.warningCount === 0 ? (
                    <span className="text-green-600 font-medium text-xs">All Passed</span>
                  ) : (
                    <>
                      {result.validation.errorCount > 0 && (
                        <Badge variant="destructive" className="text-[10px]">
                          {result.validation.errorCount} error{result.validation.errorCount !== 1 ? 's' : ''}
                        </Badge>
                      )}
                      {result.validation.warningCount > 0 && (
                        <Badge variant="warning" className="text-[10px]">
                          {result.validation.warningCount} warning{result.validation.warningCount !== 1 ? 's' : ''}
                        </Badge>
                      )}
                    </>
                  )}
                </dd>
              </div>
            )}
          </dl>

          {/* Download Button */}
          <div className={cn("mt-4 pt-4 border-t", hasValidationErrors ? "border-yellow-200" : "border-green-200")}>
            <Button
              className="w-full"
              onClick={handleDownload}
            >
              <Download className="h-4 w-4 mr-2" />
              Download Package
            </Button>
            <p className="text-xs text-gray-500 text-center mt-2">
              {hasValidationErrors
                ? 'Package exported with validation issues'
                : 'ZIP archive ready for submission'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Full Validation Results */}
      {showValidation && result.validation && (
        <ValidationResults validation={result.validation} />
      )}
    </div>
  );
}
