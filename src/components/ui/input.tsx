/**
 * shadcn's Input, re-skinned on arrival: a native input wearing `field()`.
 *
 * It stays a plain `<input>` — a phone's own numeric keypad and date picker are
 * better than anything this app would draw, so nothing is intercepted here.
 */

import type { ComponentProps } from 'react';
import { field } from '@/features/ui/styles';
import { cn } from '@/lib/utils';

type InputProps = ComponentProps<'input'> & { readonly invalid?: boolean };

export function Input({ className, invalid = false, ...props }: InputProps) {
  return <input className={cn(field(invalid), className)} data-slot="input" {...props} />;
}
