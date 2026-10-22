import { Link } from 'react-router';
import { ChevronRight, Database, Dumbbell, ScrollText, Settings } from 'lucide-react';
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

      <Link className={cn(WELL, PRESS, 'flex-row items-center gap-3')} to="/settings">
        <Settings aria-hidden="true" className="text-ink-3" size={20} strokeWidth={ICON_STROKE} />
        <span className="min-w-0 flex-1">
          <span className="block type-title">Settings</span>
          <span className="block type-body-sm text-ink-2">
            Units, default RIR, bodyweight and alerts.
          </span>
        </span>
        <ChevronRight aria-hidden="true" className="text-ink-3" size={20} strokeWidth={ICON_STROKE} />
      </Link>

      <Link className={cn(WELL, PRESS, 'flex-row items-center gap-3')} to="/settings">
        <Database aria-hidden="true" className="text-ink-3" size={20} strokeWidth={ICON_STROKE} />
        <span className="min-w-0 flex-1">
          <span className="block type-title">Backup</span>
          <span className="block type-body-sm text-ink-2">
            Export or restore everything on this phone.
          </span>
        </span>
        <ChevronRight aria-hidden="true" className="text-ink-3" size={20} strokeWidth={ICON_STROKE} />
      </Link>

      <p className="type-body-sm text-ink-3 px-1">
        Exercise figures by Bryl Lim and Everkinetic, from Workout Guide
        (github.com/bryllim/workout-guide), used under CC BY-SA 4.0.
      </p>
    </>
  );
}
