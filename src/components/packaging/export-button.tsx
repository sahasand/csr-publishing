'use client';

import { useState } from 'react';
import {
  useExportPackage,
  usePackageReadiness,
  triggerDownload,
  type ExportResult,
} from '@/hooks/use-package';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Download, Loader2, Package, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { ValidationResults } from './validation-results';

interface ExportButtonProps {
  studyId: string;
  onExportComplete?: (result: ExportResult) => void;
  /** Show validation results in a dialog after export (default: true) */
  showResultsDialog?: boolean;
}

export function ExportButton({ studyId, onExportComplete, showResultsDialog = true }: ExportButtonProps) {
  const [showForceDialog, setShowForceDialog] = useState(false);
  const [forceExport, setForceExport] = useState(false);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [lastExportResult, setLastExportResult] = useState<ExportResult | null>(null);

  const { data: readinessData, isLoading: isLoadingReadiness } =
    usePackageReadiness(studyId);
  const exportPackage = useExportPackage();

  const isReady = readinessData?.readiness.ready ?? false;
  const isExporting = exportPackage.isPending;

  const handleExport = async (force = false) => {
    try {
      const result = await exportPackage.mutateAsync({
        studyId,
        force,
      });

      // Close force dialog if open
      setShowForceDialog(false);
      setForceExport(false);

      // Store result for showing in modal
      setLastExportResult(result);

      toast.success('Package exported successfully');

      // Trigger download
      triggerDownload(result.downloadUrl);

      // Show results dialog if enabled and there are validation results
      if (showResultsDialog && result.validation) {
        setShowResultsModal(true);
      }

      // Notify parent
      onExportComplete?.(result);
    } catch {
      toast.error('Export failed');
    }
  };

  const handlePrimaryClick = () => {
    if (isReady) {
      handleExport(false);
    } else {
      // Show confirmation dialog for force export
      setShowForceDialog(true);
    }
  };

  const handleForceConfirm = () => {
    if (forceExport) {
      handleExport(true);
    }
  };

  return (
    <>
      <div className="space-y-2">
        {/* Main Export Button */}
        <Button
          className="w-full"
          onClick={handlePrimaryClick}
          disabled={isExporting || isLoadingReadiness}
        >
          {isExporting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <Package className="h-4 w-4 mr-2" />
              Export Package
            </>
          )}
        </Button>

        {/* Readiness indicator */}
        {!isLoadingReadiness && readinessData && (
          <p
            className={cn(
              'text-xs text-center',
              isReady ? 'text-success' : 'text-warning'
            )}
          >
            {isReady
              ? 'All checks passed - ready to export'
              : 'Some checks failed - force export available'}
          </p>
        )}

        {/* Export error */}
        {exportPackage.isError && (
          <p className="text-xs text-center text-destructive">
            {exportPackage.error instanceof Error
              ? exportPackage.error.message
              : 'Export failed'}
          </p>
        )}
      </div>

      {/* Force Export Confirmation Dialog */}
      <Dialog open={showForceDialog} onOpenChange={setShowForceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Package Not Ready
            </DialogTitle>
            <DialogDescription className="text-left">
              The package has issues that should be resolved before export:
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 px-1">
            {/* List issues */}
            {readinessData && (
              <ul className="text-sm text-muted-foreground space-y-2">
                {readinessData.readiness.missingRequired.length > 0 && (
                  <li className="flex items-start gap-2">
                    <span className="text-destructive mt-0.5">*</span>
                    <span>
                      {readinessData.readiness.missingRequired.length} required{' '}
                      {readinessData.readiness.missingRequired.length === 1
                        ? 'section is'
                        : 'sections are'}{' '}
                      missing documents
                    </span>
                  </li>
                )}
                {readinessData.readiness.validationErrors > 0 && (
                  <li className="flex items-start gap-2">
                    <span className="text-destructive mt-0.5">*</span>
                    <span>
                      {readinessData.readiness.validationErrors} validation{' '}
                      {readinessData.readiness.validationErrors === 1
                        ? 'error'
                        : 'errors'}{' '}
                      found
                    </span>
                  </li>
                )}
                {readinessData.readiness.unresolvedAnnotations > 0 && (
                  <li className="flex items-start gap-2">
                    <span className="text-destructive mt-0.5">*</span>
                    <span>
                      {readinessData.readiness.unresolvedAnnotations} unresolved{' '}
                      {readinessData.readiness.unresolvedAnnotations === 1
                        ? 'correction'
                        : 'corrections'}
                    </span>
                  </li>
                )}
                {readinessData.readiness.pendingApproval.length > 0 && (
                  <li className="flex items-start gap-2">
                    <span className="text-warning mt-0.5">*</span>
                    <span>
                      {readinessData.readiness.pendingApproval.length}{' '}
                      {readinessData.readiness.pendingApproval.length === 1
                        ? 'document is'
                        : 'documents are'}{' '}
                      not yet approved
                    </span>
                  </li>
                )}
              </ul>
            )}

            {/* Force export checkbox */}
            <div className="mt-6 pt-4 border-t border-border px-1">
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox
                  checked={forceExport}
                  onChange={(e) => setForceExport(e.target.checked)}
                  className="mt-0.5"
                />
                <div className="text-sm">
                  <span className="font-medium text-foreground">
                    Export anyway
                  </span>
                  <p className="text-muted-foreground mt-0.5">
                    I understand the package may be incomplete or have issues.
                    Only approved and published documents will be included.
                  </p>
                </div>
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowForceDialog(false);
                setForceExport(false);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleForceConfirm}
              disabled={!forceExport || isExporting}
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Force Export
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Results Dialog */}
      <Dialog open={showResultsModal} onOpenChange={setShowResultsModal}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {lastExportResult?.validation ? (
                lastExportResult.validation.errorCount === 0 ? (
                  <>
                    <CheckCircle className="h-5 w-5 text-success" />
                    Export Successful
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-5 w-5 text-warning" />
                    Export Complete with Issues
                  </>
                )
              ) : (
                <>
                  <CheckCircle className="h-5 w-5 text-success" />
                  Export Successful
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-left">
              {lastExportResult && (
                <span className="flex items-center gap-2 mt-1">
                  Package ID: <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{lastExportResult.packageId.slice(0, 8)}...</code>
                  {lastExportResult.validation && (
                    <>
                      {lastExportResult.validation.errorCount > 0 && (
                        <Badge variant="destructive">
                          {lastExportResult.validation.errorCount} error{lastExportResult.validation.errorCount !== 1 ? 's' : ''}
                        </Badge>
                      )}
                      {lastExportResult.validation.warningCount > 0 && (
                        <Badge variant="warning">
                          {lastExportResult.validation.warningCount} warning{lastExportResult.validation.warningCount !== 1 ? 's' : ''}
                        </Badge>
                      )}
                    </>
                  )}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {/* Validation Results */}
          {lastExportResult?.validation && (
            <div className="py-2">
              <ValidationResults validation={lastExportResult.validation} />
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowResultsModal(false)}
            >
              Close
            </Button>
            {lastExportResult && (
              <Button onClick={() => {
                triggerDownload(lastExportResult.downloadUrl);
              }}>
                <Download className="h-4 w-4 mr-2" />
                Download Again
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
