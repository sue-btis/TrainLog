/**
 * shadcn's Popover, re-skinned on arrival and trimmed to what is used.
 *
 * Here for behaviour alone, the same reason as the DropdownMenu: a panel that
 * must position itself against its trigger, stay inside the viewport, trap and
 * return focus, close on Escape and on an outside press, and render through a
 * portal so the card it belongs to cannot clip it. None of that is worth
 * re-deriving by hand, and all of it is what the native `<input type="date">`
 * was standing in for.
 *
 * The face is ours: `rounded-card`, a solid card white and `--lift`, per
 * DESIGN.md §Implementation. Nothing here ships shadcn's own geometry.
 */

import type { ComponentProps } from 'react';
import { Popover as PopoverPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;

export function PopoverContent({
  className,
  align = 'start',
  sideOffset = 8,
  ...props
}: ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        className={cn(
          'z-20 rounded-card bg-card p-4 text-ink shadow-lift',
          // The board is narrow and the trigger sits mid-row, so the panel is
          // told how much room it actually has rather than being allowed to
          // reach past the screen.
          'max-w-[calc(100vw-2rem)]',
          className,
        )}
        data-slot="popover-content"
        sideOffset={sideOffset}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}
