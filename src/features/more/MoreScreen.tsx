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
            The full catalog, and each exercise&rsquo;s history.
          </span>
        </span>
        <ChevronRight aria-hidden="true" className="text-ink-3" size={20} strokeWidth={ICON_STROKE} />
      </Link>

      {/* Not a courtesy — a licence term. The exercise figures are CC BY-SA
          4.0, and that licence requires the credit to travel with the work
          wherever it is shown. This screen is the only surface a lifter reaches
          that is not itself a task, so it is where the credit can sit without
          interrupting anything. Kept as text rather than a link: the app makes
          no network requests, and a tappable URL that does nothing offline
          would be worse than a readable one. */}
      <p className="type-body-sm text-ink-3 px-1">
        Exercise figures by Bryl Lim and Everkinetic, from Workout Guide
        (github.com/bryllim/workout-guide), used under CC BY-SA 4.0.
      </p>
    </>
  );
}
