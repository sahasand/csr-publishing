import * as React from 'react';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

export type CheckboxProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>;

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, ...props }, ref) => {
    return (
      <div className="relative inline-flex items-center">
        <input
          type="checkbox"
          className={cn(
            'peer h-4 w-4 shrink-0 rounded border border-gray-300 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950 disabled:cursor-not-allowed disabled:opacity-50 appearance-none bg-white checked:bg-gray-900 checked:border-gray-900',
            className
          )}
          ref={ref}
          {...props}
        />
        <Check className="absolute h-3 w-3 text-white pointer-events-none opacity-0 peer-checked:opacity-100 left-0.5 top-0.5" />
      </div>
    );
  }
);
Checkbox.displayName = 'Checkbox';

export { Checkbox };
