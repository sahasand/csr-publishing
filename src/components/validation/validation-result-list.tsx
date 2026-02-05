'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ValidationResultItem } from './validation-result-item';
import { ChevronDown, ChevronRight, Filter } from 'lucide-react';
import type {
  ValidationResultWithDetails,
  ValidationCategoryType,
  ValidationSeverityType,
} from '@/types';

export type FilterSeverity = 'ALL' | ValidationSeverityType;

export interface ValidationResultListProps {
  results: ValidationResultWithDetails[];
  filter?: FilterSeverity;
  onFilterChange?: (filter: FilterSeverity) => void;
}

/**
 * Category display configuration
 */
const categoryLabels: Record<ValidationCategoryType, string> = {
  PDF_COMPLIANCE: 'PDF Compliance',
  ECTD_TECHNICAL: 'eCTD Technical',
  FORMATTING: 'Formatting',
  CONTENT: 'Content',
};

/**
 * Category header colors
 */
const categoryColors: Record<ValidationCategoryType, string> = {
  PDF_COMPLIANCE: 'bg-primary/10 border-primary/30',
  ECTD_TECHNICAL: 'bg-purple-50 border-purple-200',
  FORMATTING: 'bg-success/10 border-success/30',
  CONTENT: 'bg-amber-50 border-amber-200',
};

/**
 * Filter options
 */
const filterOptions: { value: FilterSeverity; label: string }[] = [
  { value: 'ALL', label: 'All Results' },
  { value: 'ERROR', label: 'Errors Only' },
  { value: 'WARNING', label: 'Warnings Only' },
  { value: 'INFO', label: 'Info Only' },
];

/**
 * Validation result list component
 * Features:
 * - Groups results by category (PDF_COMPLIANCE, ECTD_TECHNICAL, etc.)
 * - Collapsible category sections (Accordion-like)
 * - Filter by severity (All, Errors, Warnings, Info)
 * - Shows count per category
 */
export function ValidationResultList({
  results,
  filter: externalFilter,
  onFilterChange,
}: ValidationResultListProps) {
  const [internalFilter, setInternalFilter] = React.useState<FilterSeverity>('ALL');
  const [expandedCategories, setExpandedCategories] = React.useState<Set<string>>(
    new Set()
  );

  // Use external filter if provided, otherwise use internal state
  const filter = externalFilter ?? internalFilter;
  const handleFilterChange = (newFilter: FilterSeverity) => {
    if (onFilterChange) {
      onFilterChange(newFilter);
    } else {
      setInternalFilter(newFilter);
    }
  };

  // Filter results by severity
  const filteredResults = React.useMemo(() => {
    if (filter === 'ALL') return results;
    return results.filter((r) => r.severity === filter);
  }, [results, filter]);

  // Group filtered results by category
  const groupedResults = React.useMemo(() => {
    const groups: Record<ValidationCategoryType, ValidationResultWithDetails[]> = {
      PDF_COMPLIANCE: [],
      ECTD_TECHNICAL: [],
      FORMATTING: [],
      CONTENT: [],
    };

    for (const result of filteredResults) {
      const category = result.category || 'CONTENT';
      if (groups[category]) {
        groups[category].push(result);
      } else {
        groups.CONTENT.push(result);
      }
    }

    return groups;
  }, [filteredResults]);

  // Get categories that have results, maintaining a consistent order
  const categoriesWithResults = React.useMemo(() => {
    const order: ValidationCategoryType[] = [
      'PDF_COMPLIANCE',
      'ECTD_TECHNICAL',
      'FORMATTING',
      'CONTENT',
    ];
    return order.filter((cat) => groupedResults[cat].length > 0);
  }, [groupedResults]);

  // Initialize expanded categories to include all with errors
  React.useEffect(() => {
    const categoriesWithErrors = categoriesWithResults.filter((cat) =>
      groupedResults[cat].some((r) => !r.passed && r.severity === 'ERROR')
    );
    if (categoriesWithErrors.length > 0) {
      setExpandedCategories(new Set(categoriesWithErrors));
    } else if (categoriesWithResults.length > 0) {
      // Expand first category if no errors
      setExpandedCategories(new Set([categoriesWithResults[0]]));
    }
  }, [categoriesWithResults, groupedResults]);

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // Count issues by severity for filter badge
  const getCategoryCounts = (category: ValidationCategoryType) => {
    const categoryResults = groupedResults[category];
    return {
      total: categoryResults.length,
      passed: categoryResults.filter((r) => r.passed).length,
      failed: categoryResults.filter((r) => !r.passed).length,
      errors: categoryResults.filter((r) => !r.passed && r.severity === 'ERROR').length,
      warnings: categoryResults.filter((r) => !r.passed && r.severity === 'WARNING')
        .length,
    };
  };

  if (results.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-8">
        No validation results available
      </div>
    );
  }

  if (filteredResults.length === 0) {
    return (
      <div className="space-y-4">
        {/* Filter Dropdown */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground/70" />
          <Select
            value={filter}
            onChange={(e) => handleFilterChange(e.target.value as FilterSeverity)}
            className="text-sm"
            aria-label="Filter by severity"
          >
            {filterOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="text-sm text-muted-foreground text-center py-4">
          No results match the selected filter
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Dropdown */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground/70" />
        <Select
          value={filter}
          onChange={(e) => handleFilterChange(e.target.value as FilterSeverity)}
          className="text-sm"
          aria-label="Filter by severity"
        >
          {filterOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <span className="text-xs text-muted-foreground">
          {filteredResults.length} result{filteredResults.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Grouped Results with Accordion */}
      <div className="space-y-2">
        {categoriesWithResults.map((category) => {
          const isExpanded = expandedCategories.has(category);
          const counts = getCategoryCounts(category);

          return (
            <div
              key={category}
              className={cn(
                'border rounded-lg overflow-hidden',
                categoryColors[category]
              )}
            >
              {/* Category Header */}
              <button
                type="button"
                className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-muted/40 transition-colors"
                onClick={() => toggleCategory(category)}
                aria-expanded={isExpanded}
                aria-controls={`category-${category}`}
              >
                <div className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-sm font-medium text-foreground/80">
                    {categoryLabels[category]}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {counts.errors > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {counts.errors} error{counts.errors !== 1 ? 's' : ''}
                    </Badge>
                  )}
                  {counts.warnings > 0 && (
                    <Badge variant="warning" className="text-xs">
                      {counts.warnings} warning{counts.warnings !== 1 ? 's' : ''}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {counts.passed}/{counts.total} passed
                  </span>
                </div>
              </button>

              {/* Category Content */}
              {isExpanded && (
                <div
                  id={`category-${category}`}
                  className="px-3 pb-3 space-y-2 bg-card/30"
                >
                  {groupedResults[category].map((result) => (
                    <ValidationResultItem key={result.id} result={result} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
