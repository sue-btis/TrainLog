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

import { Outlet, useLocation } from 'react-router';
import { BottomNav } from '@/features/shell/BottomNav';
import { SECTIONS } from '@/features/shell/sections';
import { TopBar } from '@/features/shell/TopBar';
import { COLUMN, SCREEN } from '@/features/ui/styles';
import { cn } from '@/lib/utils';

const ROUTINES = SECTIONS[2];

export function AppShell() {
  const { pathname } = useLocation();
  const section = SECTIONS.find((entry) => entry.to === pathname);

  // The one route that sits under a section rather than beside them.
  const detail = section === undefined && pathname.startsWith(`${ROUTINES.to}/`);

  return (
    <main className={SCREEN}>
      <TopBar
        back={detail ? { to: ROUTINES.to } : undefined}
        backLabel="Back to Routines"
        icon={section?.Icon ?? ROUTINES.Icon}
        title={section?.label ?? 'Routine'}
      />

      <div className={cn(COLUMN, 'pb-32')}>
        <Outlet />
      </div>

      <BottomNav />
    </main>
  );
}
