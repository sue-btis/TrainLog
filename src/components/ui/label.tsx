/**
 * shadcn's Label, re-skinned on arrival.
 *
 * Radix's Label is kept over a bare `<label>` for one behaviour: it stops a
 * double-click on the caption from selecting the text instead of reaching the
 * control, which on a phone is what a firm tap looks like.
 */

import type { ComponentProps } from 'react';
import { Label as LabelPrimitive } from 'radix-ui';
import { LABEL } from '@/features/ui/styles';
import { cn } from '@/lib/utils';

export function Label({ className, ...props }: ComponentProps<typeof LabelPrimitive.Root>) {
  return <LabelPrimitive.Root className={cn(LABEL, className)} data-slot="label" {...props} />;
}
