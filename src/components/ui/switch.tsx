import type { ComponentProps } from 'react';
import { Switch as SwitchPrimitive } from 'radix-ui';
import { FOCUS_RING, PRESS } from '@/features/ui/styles';
import { cn } from '@/lib/utils';

export function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'inline-flex h-7 w-12 shrink-0 items-center rounded-chip bg-well p-0.5',
        'ring-1 ring-rule data-[state=checked]:bg-actual-ink data-[state=checked]:ring-transparent',
        PRESS,
        FOCUS_RING,
        className,
      )}
      data-slot="switch"
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          'block size-6 rounded-chip bg-card shadow-dome',
          'transition-transform duration-[110ms] ease-snap data-[state=checked]:translate-x-5',
        )}
        data-slot="switch-thumb"
      />
    </SwitchPrimitive.Root>
  );
}
