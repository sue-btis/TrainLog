import type { ComponentProps } from 'react';
import { Label as LabelPrimitive } from 'radix-ui';
import { LABEL } from '@/features/ui/styles';
import { cn } from '@/lib/utils';

export function Label({ className, ...props }: ComponentProps<typeof LabelPrimitive.Root>) {
  return <LabelPrimitive.Root className={cn(LABEL, className)} data-slot="label" {...props} />;
}
