import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        'flex h-8 w-full rounded-lg border border-[#CBD8E6] bg-white px-2.5 py-1.5 text-sm text-[#1F2A37] outline-none',
        'placeholder:text-[#5A6B7B] focus-visible:ring-2 focus-visible:ring-[#2E75B6]/40',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
);
Input.displayName = 'Input';

export { Input };
