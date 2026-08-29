import type { ComponentProps } from 'react';
import { field } from '@/features/ui/styles';
import { cn } from '@/lib/utils';

type InputProps = ComponentProps<'input'> & { readonly invalid?: boolean };

export function Input({ className, invalid = false, ...props }: InputProps) {
  return <input className={cn(field(invalid), className)} data-slot="input" {...props} />;
}
