/**
 * More — the overflow of the navigation, and nothing else.
 *
 * The bottom navigation caps at four tabs (DESIGN.md §Navigation) and Today,
 * Calendar and Progress took three of them. What is left is not a section in
 * its own right: it is the two screens that had nowhere else to be, and this
 * screen exists to name them.
 *
 * It used to carry Settings and the backup as well. Those are the app's own
 * knobs rather than places you go, they belong one press from anywhere rather
 * than three from Today, and they now live behind the gear in the top bar
 * (`/settings`). A screen holding both destinations and actions was a screen
 * whose title could not be true.
 *
 * Session history was a third row here and is gone: the calendar already draws
 * every Session on the day it happened, beside what was planned, and one
 * Session's detail is reached from there.
 */

import { Link } from 'react-router';
import { ChevronRight, Dumbbell, ScrollText } from 'lucide-react';
import { ICON_STROKE, PRESS, WELL } from '@/features/ui/styles';
import { cn } from '@/lib/utils';

export function MoreScreen() {
  return (
    <>
      <Link className={cn(WELL, PRESS, 'flex-row items-center gap-3')} to="/routines">
        <ScrollText aria-hidden="true" className="text-ink-3" size={20} strokeWidth={ICON_STROKE} />
        <span className="min-w-0 flex-1">
          <span className="block type-title">Routines</span>
          <span className="block type-body-sm text-ink-2">
            Every programme you have imported or built.
          </span>
        </span>
        <ChevronRight aria-hidden="true" className="text-ink-3" size={20} strokeWidth={ICON_STROKE} />
      </Link>

      <Link className={cn(WELL, PRESS, 'flex-row items-center gap-3')} to="/exercises">
        <Dumbbell aria-hidden="true" className="text-ink-3" size={20} strokeWidth={ICON_STROKE} />
        <span className="min-w-0 flex-1">
          <span className="block type-title">Exercises</span>
          <span className="block type-body-sm text-ink-2">
            The full catalog, and each movement's history.
          </span>
        </span>
        <ChevronRight aria-hidden="true" className="text-ink-3" size={20} strokeWidth={ICON_STROKE} />
      </Link>
    </>
  );
}
