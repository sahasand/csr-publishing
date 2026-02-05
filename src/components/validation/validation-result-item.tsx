'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, ChevronDown, ChevronRight, Info } from 'lucide-react';
import type { ValidationResultWithDetails, ValidationSeverityType } from '@/types';

export interface ValidationResultItemProps {
  result: ValidationResultWithDetails;
}

/**
 * Severity badge configuration
 */
const severityConfig: Record<
  ValidationSeverityType,
  { variant: 'destructive' | 'warning' | 'default'; label: string }
> = {
  ERROR: { variant: 'destructive', label: 'Error' },
  WARNING: { variant: 'warning', label: 'Warning' },
  INFO: { variant: 'default', label: 'Info' },
};

/**
 * Single validation result item component
 * Shows:
 * - Pass/fail icon (CheckCircle green / XCircle red)
 * - Rule name and message
 * - Severity badge (ERROR=red, WARNING=yellow, INFO=blue)
 * - Expandable details section (if result has details)
 */
export function ValidationResultItem({ result }: ValidationResultItemProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  // Parse details if it's a JSON string
  const parsedDetails = React.useMemo(() => {
    if (!result.details) return null;
    if (typeof result.details === 'string') {
      try {
        return JSON.parse(result.details);
      } catch {
        return result.details;
      }
    }
    return result.details;
  }, [result.details]);

  const hasDetails = parsedDetails !== null;
  const severity = result.severity || 'INFO';
  const config = severityConfig[severity];

  return (
    <div
      className={cn(
        'border rounded-md transition-colors',
        result.passed
          ? 'border-green-200 bg-green-50/30'
          : severity === 'ERROR'
          ? 'border-red-200 bg-red-50/30'
          : severity === 'WARNING'
          ? 'border-yellow-200 bg-yellow-50/30'
          : 'border-gray-200 bg-gray-50/30'
      )}
    >
      <div
        className={cn(
          'flex items-start gap-3 p-3',
          hasDetails && 'cursor-pointer'
        )}
        onClick={() => hasDetails && setIsExpanded(!isExpanded)}
        role={hasDetails ? 'button' : undefined}
        tabIndex={hasDetails ? 0 : undefined}
        onKeyDown={(e) => {
          if (hasDetails && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setIsExpanded(!isExpanded);
          }
        }}
        aria-expanded={hasDetails ? isExpanded : undefined}
      >
        {/* Pass/Fail Icon */}
        <div className="flex-shrink-0 mt-0.5">
          {result.passed ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : (
            <XCircle className="h-4 w-4 text-red-500" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {result.ruleName}
              </p>
              <p className="text-xs text-gray-600 mt-0.5">{result.message}</p>
            </div>

            {/* Severity Badge */}
            {!result.passed && (
              <Badge
                variant={config.variant}
                className="flex-shrink-0 text-xs"
              >
                {config.label}
              </Badge>
            )}
          </div>
        </div>

        {/* Expand/Collapse Icon */}
        {hasDetails && (
          <div className="flex-shrink-0 mt-0.5 text-gray-400">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </div>
        )}
      </div>

      {/* Expandable Details Section */}
      {hasDetails && isExpanded && (
        <div className="border-t border-gray-200 px-3 py-2 bg-white/50">
          <div className="flex items-start gap-2">
            <Info className="h-3.5 w-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-gray-600 overflow-auto">
              {typeof parsedDetails === 'object' ? (
                <pre className="whitespace-pre-wrap font-mono text-xs">
                  {JSON.stringify(parsedDetails, null, 2)}
                </pre>
              ) : (
                <p>{String(parsedDetails)}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
