import * as React from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

function Breadcrumb({ children, className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <nav aria-label="Breadcrumb" className={cn('', className)} {...props}>
      <ol className="flex items-center gap-1.5 text-sm text-muted-foreground">
        {children}
      </ol>
    </nav>
  );
}

function BreadcrumbItem({ children, className, ...props }: React.HTMLAttributes<HTMLLIElement>) {
  return (
    <li className={cn('flex items-center gap-1.5', className)} {...props}>
      {children}
    </li>
  );
}

function BreadcrumbSeparator() {
  return <ChevronRight className="h-3 w-3 text-muted-foreground/50 flex-shrink-0" />;
}

function BreadcrumbLink({ children, className, ...props }: React.HTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn('hover:text-foreground transition-colors', className)}
      {...props}
    >
      {children}
    </button>
  );
}

function BreadcrumbPage({ children, className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cn('text-foreground font-medium', className)} aria-current="page" {...props}>
      {children}
    </span>
  );
}

export { Breadcrumb, BreadcrumbItem, BreadcrumbSeparator, BreadcrumbLink, BreadcrumbPage };
