import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info';
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background',
        {
          'border-transparent bg-primary text-primary-foreground': variant === 'default',
          'border-transparent bg-secondary text-foreground': variant === 'secondary',
          'border-transparent bg-destructive/10 text-destructive': variant === 'destructive',
          'border-border text-foreground': variant === 'outline',
          'border-transparent bg-success/10 text-success': variant === 'success',
          'border-transparent bg-warning/10 text-warning': variant === 'warning',
          'border-transparent bg-info/10 text-info': variant === 'info',
        },
        className
      )}
      {...props}
    />
  );
}

export { Badge };
