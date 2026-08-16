'use client';

import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface PasswordInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Classes for the wrapper the reveal button is positioned against. */
  wrapperClassName?: string;
}

/**
 * Password field with a reveal toggle. The caller keeps control of the input's
 * own styling — this only reserves space on the right for the button and
 * flips the type between `password` and `text`.
 */
const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, wrapperClassName, disabled, ...props }, ref) => {
    const [isVisible, setIsVisible] = React.useState(false);
    const Icon = isVisible ? EyeOff : Eye;
    const action = isVisible ? 'Hide password' : 'Show password';

    return (
      <div className={cn('relative', wrapperClassName)}>
        <input
          ref={ref}
          type={isVisible ? 'text' : 'password'}
          disabled={disabled}
          className={cn(className, 'pr-11')}
          {...props}
        />
        <button
          type="button"
          onClick={() => setIsVisible((visible) => !visible)}
          disabled={disabled}
          aria-label={action}
          aria-pressed={isVisible}
          title={action}
          className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = 'PasswordInput';

export { PasswordInput };
