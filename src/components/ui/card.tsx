/**
 * shadcn's Card, re-skinned on arrival.
 *
 * Only the parts this app uses survive: the card itself, a header, a body, and
 * a footer set off by a hairline. Padding lives on the card, so the slots add
 * none — shadcn's `px-6` per slot exists to let a header bleed, which nothing
 * here does.
 */

import type { ComponentProps } from 'react';
import { Slot } from 'radix-ui';
import { CARD, PANEL_CARD, RULED } from '@/features/ui/styles';
import { cn } from '@/lib/utils';

type CardProps = ComponentProps<'div'> & {
  /** A row that is its own object on the board: same face, shallower drop. */
  readonly panel?: boolean;
  /** Let the card be an `<article>` or a `<section>` where that is the truth. */
  readonly asChild?: boolean;
};

export function Card({ className, panel = false, asChild = false, ...props }: CardProps) {
  const Comp = asChild ? Slot.Root : 'div';

  return <Comp className={cn(panel ? PANEL_CARD : CARD, className)} data-slot="card" {...props} />;
}

export function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div className={cn('flex flex-col gap-1', className)} data-slot="card-header" {...props} />
  );
}

export function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div className={cn('flex flex-col gap-3', className)} data-slot="card-content" {...props} />
  );
}

export function CardFooter({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn(RULED, className)} data-slot="card-footer" {...props} />;
}
