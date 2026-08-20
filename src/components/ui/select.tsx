/**
 * shadcn's Select, re-skinned on arrival and trimmed to what is used.
 *
 * A native `<select>` would be the lazier control, and on a phone it opens the
 * system's own sheet — but its open panel cannot be styled, so the one moment
 * the user is choosing is the one moment the app stops looking like itself.
 * Radix gives back the panel: typed-ahead, arrow keys, Escape, focus returned
 * to the trigger, and a listbox that wears `styles.ts` like everything else.
 *
 * The trigger is a field, because that is what it is standing in for. The panel
 * is the same near-white card the menu uses, with the current value marked by a
 * check rather than by a fill — a chosen row is not a pressed cell.
 */

import type { ComponentProps } from 'react';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { Select as SelectPrimitive } from 'radix-ui';
import { FIELD_BASE, ICON_STROKE, LABEL, MENU_ITEM } from '@/features/ui/styles';
import { cn } from '@/lib/utils';

export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

type TriggerProps = ComponentProps<typeof SelectPrimitive.Trigger> & {
  readonly invalid?: boolean;
};

export function SelectTrigger({ className, children, invalid = false, ...props }: TriggerProps) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        FIELD_BASE,
        'flex items-center justify-between gap-2 py-2 text-left',
        invalid && 'ring-missed',
        className,
      )}
      data-slot="select-trigger"
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown aria-hidden="true" className="shrink-0 text-ink-3" size={18} strokeWidth={ICON_STROKE} />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export function SelectContent({
  className,
  children,
  position = 'popper',
  sideOffset = 8,
  ...props
}: ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        className={cn(
          'z-20 max-h-(--radix-select-content-available-height) min-w-(--radix-select-trigger-width)',
          'overflow-hidden rounded-card bg-card p-2 shadow-lift',
          className,
        )}
        data-slot="select-content"
        position={position}
        sideOffset={sideOffset}
        {...props}
      >
        <SelectPrimitive.ScrollUpButton className="flex justify-center py-1 text-ink-3">
          <ChevronUp aria-hidden="true" size={16} strokeWidth={ICON_STROKE} />
        </SelectPrimitive.ScrollUpButton>
        <SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport>
        <SelectPrimitive.ScrollDownButton className="flex justify-center py-1 text-ink-3">
          <ChevronDown aria-hidden="true" size={16} strokeWidth={ICON_STROKE} />
        </SelectPrimitive.ScrollDownButton>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export function SelectItem({
  className,
  children,
  ...props
}: ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item className={cn(MENU_ITEM, className)} data-slot="select-item" {...props}>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="ml-auto text-planned-ink">
        <Check aria-hidden="true" size={18} strokeWidth={ICON_STROKE} />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

export function SelectLabel({
  className,
  ...props
}: ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label className={cn(LABEL, 'px-3 py-2', className)} data-slot="select-label" {...props} />
  );
}
