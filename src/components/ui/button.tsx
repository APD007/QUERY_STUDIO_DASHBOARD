import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-45 outline-none',
  {
    variants: {
      variant: {
        default:     'bg-[#2E75B6] text-white hover:opacity-90',
        good:        'bg-[#2E9E5B] text-white hover:opacity-90',
        ghost:       'bg-white text-[#0E2A47] border border-[#CBD8E6] hover:bg-slate-50',
        soft:        'bg-[#EAF3FB] text-[#0E2A47] hover:opacity-90',
        danger:      'bg-[#E4572E] text-white hover:opacity-90',
        outline:     'border border-[#CBD8E6] bg-transparent hover:bg-slate-50',
      },
      size: {
        default: 'px-3.5 py-2 text-sm',
        sm:      'px-2.5 py-1 text-xs',
        icon:    'p-1.5',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
