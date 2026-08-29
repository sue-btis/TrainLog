import type { ComponentProps } from 'react';
import { Tabs as TabsPrimitive } from 'radix-ui';
import { TAB_TRIGGER } from '@/features/ui/styles';
import { cn } from '@/lib/utils';

export function Tabs({ className, ...props }: ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root className={cn('flex flex-col gap-4', className)} data-slot="tabs" {...props} />
  );
}
export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn('rail -mx-4 -my-1 flex gap-2 px-4 py-1', className)}
      data-slot="tabs-list"
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger className={cn(TAB_TRIGGER, className)} data-slot="tabs-trigger" {...props} />
  );
}

export function TabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn('flex flex-col gap-4 outline-none', className)}
      data-slot="tabs-content"
      {...props}
    />
  );
}
