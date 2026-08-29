import type { ComponentProps } from 'react';
import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui';
import { LABEL, MENU_ITEM } from '@/features/ui/styles';
import { cn } from '@/lib/utils';

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuGroup = DropdownMenuPrimitive.Group;

export function DropdownMenuContent({
  className,
  sideOffset = 8,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        className={cn('z-20 min-w-44 rounded-card bg-card p-2 shadow-lift', className)}
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}
type ItemProps = ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  /** Destructive: the red is the warning, so nothing else has to shout. */
  readonly destructive?: boolean;
};

export function DropdownMenuItem({ className, destructive = false, ...props }: ItemProps) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        MENU_ITEM,
        destructive && 'text-missed-ink focus:bg-missed-wash data-[highlighted]:bg-missed-wash',
        className,
      )}
      data-slot="dropdown-menu-item"
      {...props}
    />
  );
}

export function DropdownMenuLabel({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Label>) {
  return (
    <DropdownMenuPrimitive.Label
      className={cn(LABEL, 'px-3 py-2', className)}
      data-slot="dropdown-menu-label"
      {...props}
    />
  );
}

export function DropdownMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      className={cn('my-1 h-px bg-rule', className)}
      data-slot="dropdown-menu-separator"
      {...props}
    />
  );
}
