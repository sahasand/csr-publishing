'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  total?: number;
  pageSize?: number;
  className?: string;
}

export function Pagination({ page, totalPages, onPageChange, total, pageSize, className }: PaginationProps) {
  if (totalPages <= 1) return null;

  const showingText = total != null && pageSize
    ? `Showing ${(page - 1) * pageSize + 1}\u2013${Math.min(page * pageSize, total)} of ${total}`
    : `Page ${page} of ${totalPages}`;

  return (
    <div className={cn('flex items-center justify-between', className)}>
      <span className="text-sm text-muted-foreground">
        {showingText}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          Next
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
