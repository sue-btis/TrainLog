/**
 * The frame the daily screens sit in (§10): a top bar naming where you are, the
 * column, and the navigation in the thumb zone.
 *
 * The bar is filled from the route rather than by each screen, so a screen
 * cannot forget to render one or name itself something the navigation does not
 * call it. Sections come from the same table the navigation reads; three route
 * families sit below the sections rather than beside them, and each names its
 * own way back — a root section has nowhere to go.
 *
 * The bar's accessory slot carries the gear. Settings and the backup are not a
 * place in the navigation — they are the app's own knobs, wanted from wherever
 * a lifter already is — so they hang off the bar that is on every screen rather
 * than off a row three presses down inside More.
 *
 * The wizard and gym mode render their own frames and are deliberately outside
 * this one, gear included: §21 says nothing may compete with the set in front
 * of you, and an import is a task you finish and leave.
 */

import { Dumbbell, ScrollText, Settings } from 'lucide-react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { BottomNav } from '@/features/shell/BottomNav';
import { SECTIONS } from '@/features/shell/sections';
import { TopBar } from '@/features/shell/TopBar';
import { COLUMN, ICON_STROKE, SCREEN } from '@/features/ui/styles';
import { cn } from '@/lib/utils';

/**
 * The two destinations a route below a section goes back to, as paths.
 *
 * They were read out of `SECTIONS` by position, which held only while both were
 * tabs and while nothing was ever inserted before them. Routines is not a tab
 * any more, and a positional read of a homogeneous array is the kind of thing
 * that keeps compiling after it stops being true.
 */
const ROUTINES = '/routines';
const MORE = '/more';
const SETTINGS = '/settings';

export function AppShell() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const section = SECTIONS.find((entry) => entry.to === pathname);

  // Routes that sit under a section rather than beside them.
  const routines = section === undefined && pathname === ROUTINES;
  const detail = section === undefined && pathname.startsWith(`${ROUTINES}/`);
  const exercise = section === undefined && pathname.startsWith('/exercises/');
  const catalog = section === undefined && pathname === '/exercises';
  const sessionDetail = section === undefined && pathname.startsWith('/sessions/');
  const settings = section === undefined && pathname === SETTINGS;

  // An exercise's history is reached from more than one place — the routine
  // detail and, mid-workout, gym mode — so its back control retraces the step
  // taken rather than naming a destination. Sending a lifter to Routines from
  // an open session would be the wrong answer to "back". One session's detail
  // is reached from the calendar, and settings from the gear on whatever screen
  // a lifter was on, so both retrace for the same reason. The lists themselves
  // have one way in each — More — so they can name it.
  const back =
    exercise || sessionDetail || settings
      ? { onBack: () => void navigate(-1) }
      : routines || catalog
        ? { to: MORE }
        : detail
          ? { to: ROUTINES }
          : undefined;

  return (
    <main className={SCREEN}>
      <TopBar
        // The gear is the way in, so the screen it opens does not offer it
        // again: a control that reloads the screen you are already on is a
        // control that has stopped meaning anything.
        action={settings ? undefined : <GearLink />}
        back={back}
        backLabel={backLabel(exercise || sessionDetail || settings, routines || catalog)}
        icon={
          settings
            ? Settings
            : exercise || catalog
              ? Dumbbell
              : (section?.Icon ?? ScrollText)
        }
        title={
          settings
            ? 'Settings'
            : catalog
              ? 'Exercises'
              : sessionDetail
                ? 'Session'
                : exercise
                  ? 'Exercise'
                  : routines
                    ? 'Routines'
                    : (section?.label ?? 'Routine')
        }
      />

      <div className={cn(COLUMN, 'pb-32')}>
        <Outlet />
      </div>

      <BottomNav />
    </main>
  );
}

/** The accessory in the bar: settings and the backup, one press from anywhere. */
function GearLink() {
  return (
    <Button aria-label="Settings and backup" asChild size="icon" variant="ghost">
      <Link to={SETTINGS}>
        <Settings aria-hidden="true" size={20} strokeWidth={ICON_STROKE} />
      </Link>
    </Button>
  );
}

/** What the back control says: where it goes, when it goes somewhere named. */
function backLabel(retraces: boolean, toMore: boolean): string {
  if (retraces) return 'Back';
  return toMore ? 'Back to More' : 'Back to Routines';
}
