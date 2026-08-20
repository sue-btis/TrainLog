/**
 * shadcn's Button, re-skinned on arrival (DESIGN.md §Implementation).
 *
 * What is kept is the behaviour: `asChild`, so a Link or a label can wear a
 * button without a nested control, and the variant/size API. What is replaced
 * is every class it shipped with — the geometry comes from `styles.ts`, which
 * stays the one place a button's face is described.
 */

import type { ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import { BUTTON_BASE, BUTTON_SIZE, BUTTON_VARIANT } from '@/features/ui/styles';
import { cn } from '@/lib/utils';

const buttonVariants = cva(BUTTON_BASE, {
  variants: { variant: BUTTON_VARIANT, size: BUTTON_SIZE },
  defaultVariants: { variant: 'primary', size: 'control' },
});

type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & { readonly asChild?: boolean };

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : 'button';

  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      data-slot="button"
      {...props}
    />
  );
}

export { buttonVariants };
