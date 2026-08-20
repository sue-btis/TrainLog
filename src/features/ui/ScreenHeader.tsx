/**
 * The header every screen opens with: an icon, the screen's name, and whatever
 * context belongs under it — all on one raised card.
 *
 * A bare title on the board read as flat, and each screen was inventing its own
 * header shape. One component means the four screens and the wizard's steps
 * open the same way, which is the point: in an app you are operating, the same
 * thing should look the same everywhere.
 *
 * The icon repeats the one the navigation uses for that screen, so the tab you
 * pressed and the screen you land on say the same word twice.
 */

import type { ComponentType, ReactNode } from 'react';
import { CARD, ICON_STROKE } from '@/features/ui/styles';
import { cn } from '@/lib/utils';

interface ScreenHeaderProps {
  readonly icon: ComponentType<{ 'aria-hidden'?: boolean | 'true'; className?: string; size?: number; strokeWidth?: number }>;
  readonly title: string;
  /** Anything that belongs under the title: a lede, a date, a routine name. */
  readonly children?: ReactNode;
}

export function ScreenHeader({ icon: Icon, title, children }: ScreenHeaderProps) {
  return (
    <header className={cn(CARD, 'flex-row gap-4', children ? 'items-start' : 'items-center')}>
      <Icon aria-hidden="true" className="shrink-0 text-planned-ink" size={32} strokeWidth={ICON_STROKE} />
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="type-display">{title}</h1>
        {children}
      </div>
    </header>
  );
}
