import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium',
  {
    variants: {
      variant: {
        default: 'border-[#2E75B6] text-[#0E2A47] bg-white',
        agg:     'border-[#7A5CC0] text-[#0E2A47] bg-white',
        field:   'border-[#3FA66A] text-[#0E2A47] bg-white',
        outline: 'border-[#CBD8E6] text-[#5A6B7B] bg-white',
        solid:   'border-transparent text-white bg-[#2E75B6]',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
