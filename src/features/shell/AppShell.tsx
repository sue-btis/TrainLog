/**
 * The frame the daily screens sit in (§10): a top bar naming where you are, the
 * column, and the navigation in the thumb zone.
 *
 * The bar is filled from the route rather than by each screen, so a screen
 * cannot forget to render one or name itself something the navigation does not
 * call it. Sections come from the same table the navigation reads; the routine
 * detail is the one route below a section, and it is the only one with a way
 * back — a root section has nowhere to go.
 *
 * The wizard and gym mode render their own frames and are deliberately outside
 * this one.
 */

import { Dumbbell } from 'lucide-react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { BottomNav } from '@/features/shell/BottomNav';
import { SECTIONS } from '@/features/shell/sections';
import { TopBar } from '@/features/shell/TopBar';
import { COLUMN, SCREEN } from '@/features/ui/styles';
import { cn } from '@/lib/utils';

const ROUTINES = SECTIONS[2];

export function AppShell() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const section = SECTIONS.find((entry) => entry.to === pathname);

  // Two routes sit under a section rather than beside them.
  const detail = section === undefined && pathname.startsWith(`${ROUTINES.to}/`);
  const exercise = section === undefined && pathname.startsWith('/exercises/');

  // An exercise's history is reached from more than one place — the routine
  // detail and, mid-workout, gym mode — so its back control retraces the step
  // taken rather than naming a destination. Sending a lifter to Routines from
  // an open session would be the wrong answer to "back".
  const back = exercise
    ? { onBack: () => void navigate(-1) }
    : detail
      ? { to: ROUTINES.to }
      : undefined;

  return (
    <main className={SCREEN}>
      <TopBar
        back={back}
        backLabel={exercise ? 'Back' : 'Back to Routines'}
        icon={exercise ? Dumbbell : (section?.Icon ?? ROUTINES.Icon)}
        title={exercise ? 'Exercise' : (section?.label ?? 'Routine')}
      />

      <div className={cn(COLUMN, 'pb-32')}>
        <Outlet />
      </div>

      <BottomNav />
    </main>
  );
}
