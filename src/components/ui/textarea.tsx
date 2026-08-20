/** shadcn's Textarea, re-skinned on arrival: a native textarea wearing `field()`. */

import type { ComponentProps } from 'react';
import { field } from '@/features/ui/styles';
import { cn } from '@/lib/utils';

type TextareaProps = ComponentProps<'textarea'> & { readonly invalid?: boolean };

export function Textarea({ className, invalid = false, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(field(invalid), 'py-3', className)}
      data-slot="textarea"
      {...props}
    />
  );
}
