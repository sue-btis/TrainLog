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
 * The wizard and gym mode render their own frames and are deliberately outside
 * this one.
 */

import { Dumbbell, History, ScrollText } from 'lucide-react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { BottomNav } from '@/features/shell/BottomNav';
import { SECTIONS } from '@/features/shell/sections';
import { TopBar } from '@/features/shell/TopBar';
import { COLUMN, SCREEN } from '@/features/ui/styles';
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

export function AppShell() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const section = SECTIONS.find((entry) => entry.to === pathname);

  // Routes that sit under a section rather than beside them.
  const routines = section === undefined && pathname === ROUTINES;
  const detail = section === undefined && pathname.startsWith(`${ROUTINES}/`);
  const exercise = section === undefined && pathname.startsWith('/exercises/');
  const sessions = section === undefined && pathname === '/sessions';
  const sessionDetail = section === undefined && pathname.startsWith('/sessions/');

  // An exercise's history is reached from more than one place — the routine
  // detail and, mid-workout, gym mode — so its back control retraces the step
  // taken rather than naming a destination. Sending a lifter to Routines from
  // an open session would be the wrong answer to "back". One session's detail
  // is reached from two places for the same reason: the history list and the
  // calendar. The list itself has one way in, so it can name it.
  const back =
    exercise || sessionDetail
      ? { onBack: () => void navigate(-1) }
      : sessions || routines
        ? { to: MORE }
        : detail
          ? { to: ROUTINES }
          : undefined;

  const history = sessions || sessionDetail;

  return (
    <main className={SCREEN}>
      <TopBar
        back={back}
        backLabel={backLabel(exercise || sessionDetail, sessions || routines)}
        icon={history ? History : exercise ? Dumbbell : (section?.Icon ?? ScrollText)}
        title={
          sessions
            ? 'History'
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

/** What the back control says: where it goes, when it goes somewhere named. */
function backLabel(retraces: boolean, toMore: boolean): string {
  if (retraces) return 'Back';
  return toMore ? 'Back to More' : 'Back to Routines';
}
